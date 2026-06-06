#!/usr/bin/env bash
# Build/copy the current macOS app, apply draft App Store sandbox
# entitlements with ad-hoc signing, and prove the Apple Local Assist
# helper can answer an availability probe when spawned by a sandboxed
# parent from inside an app bundle. This is a diagnostic preview only;
# it does not create an App Store, TestFlight, Developer ID, or
# notarized artifact.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_SRC="$REPO_ROOT/src-tauri/target/release/bundle/macos/hazakura editor.app"
APP_ENTITLEMENTS="$REPO_ROOT/src-tauri/entitlements/app-store-app.plist"
HELPER_ENTITLEMENTS="$REPO_ROOT/src-tauri/entitlements/app-store-helper.plist"
TMP_ROOT="$(mktemp -d)"
APP="$TMP_ROOT/hazakura editor.app"
HELPER="$APP/Contents/MacOS/hazakura-apple-assist-helper"
LAUNCHER_APP="$TMP_ROOT/SandboxLauncher.app"
LAUNCHER_HELPER="$LAUNCHER_APP/Contents/MacOS/hazakura-apple-assist-helper"

cleanup() {
    rm -rf "$TMP_ROOT"
}
trap cleanup EXIT

if [ "${SKIP_BUILD:-0}" != "1" ]; then
    echo "==> build app-store preview"
    (cd "$REPO_ROOT" && npm run build:app-store-preview)
fi

if [ ! -d "$APP_SRC" ]; then
    echo "error: app bundle not found: $APP_SRC" >&2
    echo "run: npm run build:app-store-preview" >&2
    exit 1
fi

echo "==> copy app to temp sandbox smoke bundle"
ditto "$APP_SRC" "$APP"

if [ ! -x "$HELPER" ]; then
    echo "error: bundled helper not executable: $HELPER" >&2
    exit 1
fi

echo "==> ad-hoc sign helper with draft sandbox entitlements"
codesign \
    --force \
    --sign - \
    --identifier lab.hazakura.note.apple-assist-helper \
    --options runtime \
    --entitlements "$HELPER_ENTITLEMENTS" \
    "$HELPER"

echo "==> ad-hoc sign app with draft sandbox entitlements"
codesign \
    --force \
    --sign - \
    --options runtime \
    --entitlements "$APP_ENTITLEMENTS" \
    "$APP"

echo "==> verify signed sandbox preview bundle"
codesign --verify --deep --strict --verbose=2 "$APP"

echo
echo "== app entitlements =="
codesign -d --entitlements :- "$APP" 2>/dev/null

echo
echo "== helper entitlements =="
codesign -d --entitlements :- "$HELPER" 2>/dev/null

echo
echo "== helper probe from sandboxed hazakura parent =="
set +e
PARENT_OUTPUT="$(
    HAZAKURA_SANDBOX_PARENT_SMOKE=apple-assist-probe \
        "$APP/Contents/MacOS/hazakura-editor" \
        2>"$TMP_ROOT/hazakura-parent-stderr.txt"
)"
PARENT_STATUS=$?
set -e

if [ "$PARENT_STATUS" -ne 0 ] || ! grep -q '"kind":"availability"' <<<"$PARENT_OUTPUT"; then
    echo "hazakura parent helper probe failed under sandbox entitlements" >&2
    echo "status: $PARENT_STATUS" >&2
    echo "stdout: $PARENT_OUTPUT" >&2
    echo "stderr: $(cat "$TMP_ROOT/hazakura-parent-stderr.txt")" >&2
    exit 1
fi

echo "$PARENT_OUTPUT"

echo
echo "== build sandbox parent-spawn probe launcher =="
cat > "$TMP_ROOT/SandboxLauncher.swift" <<'SWIFT'
import Foundation

let helperURL = Bundle.main.executableURL!
    .deletingLastPathComponent()
    .appendingPathComponent("hazakura-apple-assist-helper")
let process = Process()
process.executableURL = helperURL

let input = Pipe()
let output = Pipe()
let error = Pipe()
process.standardInput = input
process.standardOutput = output
process.standardError = error

try process.run()
input.fileHandleForWriting.write(Data("{\"action\":\"probe_availability\"}\n".utf8))
try input.fileHandleForWriting.close()
process.waitUntilExit()

let stdout = String(
    data: output.fileHandleForReading.readDataToEndOfFile(),
    encoding: .utf8
) ?? ""
let stderr = String(
    data: error.fileHandleForReading.readDataToEndOfFile(),
    encoding: .utf8
) ?? ""

print("helper: \(helperURL.path)")
print("child_status: \(process.terminationStatus)")
print("child_stdout: \(stdout.trimmingCharacters(in: .whitespacesAndNewlines))")
print("child_stderr: \(stderr.trimmingCharacters(in: .whitespacesAndNewlines))")

if process.terminationStatus == 0 && stdout.contains("\"kind\":\"availability\"") {
    exit(0)
}
exit(1)
SWIFT

xcrun swiftc "$TMP_ROOT/SandboxLauncher.swift" -o "$TMP_ROOT/SandboxLauncher"
mkdir -p "$LAUNCHER_APP/Contents/MacOS"
cp "$TMP_ROOT/SandboxLauncher" "$LAUNCHER_APP/Contents/MacOS/SandboxLauncher"
cp "$APP_SRC/Contents/MacOS/hazakura-apple-assist-helper" "$LAUNCHER_HELPER"
cat > "$LAUNCHER_APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>SandboxLauncher</string>
  <key>CFBundleIdentifier</key>
  <string>lab.hazakura.note.sandbox-launcher</string>
  <key>CFBundleName</key>
  <string>SandboxLauncher</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>0</string>
  <key>CFBundleVersion</key>
  <string>0</string>
</dict>
</plist>
PLIST

echo "==> sign sandbox parent-spawn probe launcher"
codesign \
    --force \
    --sign - \
    --identifier lab.hazakura.note.apple-assist-helper \
    --options runtime \
    --entitlements "$HELPER_ENTITLEMENTS" \
    "$LAUNCHER_HELPER"
codesign \
    --force \
    --sign - \
    --identifier lab.hazakura.note.sandbox-launcher \
    --options runtime \
    "$LAUNCHER_APP/Contents/MacOS/SandboxLauncher"
codesign \
    --force \
    --sign - \
    --options runtime \
    --entitlements "$APP_ENTITLEMENTS" \
    "$LAUNCHER_APP"
codesign --verify --deep --strict --verbose=2 "$LAUNCHER_APP"

echo
echo "== helper probe from sandboxed parent =="
"$LAUNCHER_APP/Contents/MacOS/SandboxLauncher"
echo "ok"
