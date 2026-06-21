#!/usr/bin/env bash
# Launch a built macOS app bundle and verify that macOS reports an
# onscreen layer-0 window for the app process. This is a local launch
# smoke only; it does not prove App Store upload, notarization, native
# file-picker interaction, or full manual UI behavior.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_APP="$REPO_ROOT/src-tauri/target/release/bundle/macos/Hazakura Editor Dev.app"
APP="${1:-${HAZAKURA_SMOKE_APP:-$DEFAULT_APP}}"
PLIST_BUDDY="/usr/libexec/PlistBuddy"
POLL_ATTEMPTS="${HAZAKURA_SMOKE_WINDOW_ATTEMPTS:-40}"
POLL_DELAY="${HAZAKURA_SMOKE_WINDOW_DELAY:-0.25}"

if [ "${SKIP_BUILD:-0}" != "1" ]; then
    echo "==> build macOS lanes"
    (cd "$REPO_ROOT" && npm run build:macos-lanes)
fi

if [ ! -d "$APP" ]; then
    echo "error: app bundle not found: $APP" >&2
    echo "run: npm run build:macos-lanes" >&2
    exit 1
fi

if [ ! -x /usr/bin/swift ]; then
    echo "error: /usr/bin/swift is required for CGWindow smoke" >&2
    exit 1
fi

BUNDLE_ID="$("$PLIST_BUDDY" -c "Print :CFBundleIdentifier" "$APP/Contents/Info.plist")"
EXECUTABLE="$("$PLIST_BUDDY" -c "Print :CFBundleExecutable" "$APP/Contents/Info.plist")"
EXECUTABLE_PATH="$APP/Contents/MacOS/$EXECUTABLE"

if [ ! -x "$EXECUTABLE_PATH" ]; then
    echo "error: executable not found: $EXECUTABLE_PATH" >&2
    exit 1
fi

find_app_pids() {
    pgrep -f "$EXECUTABLE_PATH" || true
}

quit_running_app() {
    local pids
    pids="$(find_app_pids)"
    if [ -z "$pids" ]; then
        return
    fi

    echo "==> quit existing app instance: $BUNDLE_ID"
    /usr/bin/osascript -e "tell application id \"$BUNDLE_ID\" to quit" >/dev/null 2>&1 || true

    for _ in $(seq 1 20); do
        if [ -z "$(find_app_pids)" ]; then
            return
        fi
        sleep 0.25
    done

    echo "error: existing app instance did not quit: $BUNDLE_ID" >&2
    echo "close the app and rerun, or choose another smoke bundle" >&2
    exit 1
}

window_info_for_pid() {
    TARGET_PID="$1" /usr/bin/swift - <<'SWIFT'
import CoreGraphics
import Darwin
import Foundation

guard
  let rawPid = ProcessInfo.processInfo.environment["TARGET_PID"],
  let targetPid = Int(rawPid)
else {
  fputs("missing TARGET_PID\n", stderr)
  exit(2)
}

let windows = CGWindowListCopyWindowInfo([.optionAll], kCGNullWindowID)
  as? [[String: Any]] ?? []

func intValue(_ value: Any?) -> Int {
  if let number = value as? NSNumber {
    return number.intValue
  }
  if let value = value as? Int {
    return value
  }
  return 0
}

func doubleValue(_ value: Any?) -> Double {
  if let number = value as? NSNumber {
    return number.doubleValue
  }
  if let value = value as? Double {
    return value
  }
  if let value = value as? Int {
    return Double(value)
  }
  return 0
}

for window in windows {
  let ownerPid = intValue(window[kCGWindowOwnerPID as String])
  let layer = intValue(window[kCGWindowLayer as String])
  let onscreen = intValue(window[kCGWindowIsOnscreen as String])

  guard ownerPid == targetPid, layer == 0, onscreen == 1 else {
    continue
  }

  let bounds = window[kCGWindowBounds as String] as? [String: Any] ?? [:]
  let width = doubleValue(bounds["Width"])
  let height = doubleValue(bounds["Height"])
  guard width >= 320, height >= 240 else {
    continue
  }

  let number = intValue(window[kCGWindowNumber as String])
  let owner = window[kCGWindowOwnerName as String] as? String ?? "(unknown)"
  let name = window[kCGWindowName as String] as? String ?? ""
  let x = doubleValue(bounds["X"])
  let y = doubleValue(bounds["Y"])
  print("window=\(number) owner=\(owner) name=\(name) bounds=\(Int(width))x\(Int(height))+\(Int(x))+\(Int(y))")
  exit(0)
}

exit(1)
SWIFT
}

quit_running_app

echo "==> launch app: $APP"
/usr/bin/open -n "$APP"

PID=""
WINDOW_INFO=""
for _ in $(seq 1 "$POLL_ATTEMPTS"); do
    PID="$(find_app_pids | head -n 1)"
    if [ -n "$PID" ]; then
        if WINDOW_INFO="$(window_info_for_pid "$PID")"; then
            break
        fi
    fi
    sleep "$POLL_DELAY"
done

if [ -z "$PID" ]; then
    echo "error: app process did not start: $BUNDLE_ID" >&2
    exit 1
fi

if [ -z "$WINDOW_INFO" ]; then
    echo "error: no onscreen app window detected for pid $PID ($BUNDLE_ID)" >&2
    exit 1
fi

echo
echo "== macOS window smoke =="
echo "bundle: $BUNDLE_ID"
echo "pid: $PID"
echo "$WINDOW_INFO"
echo "ok"

if [ "${KEEP_APP_RUNNING:-0}" != "1" ]; then
    echo "==> quit smoke app"
    /usr/bin/osascript -e "tell application id \"$BUNDLE_ID\" to quit" >/dev/null 2>&1 || true
fi
