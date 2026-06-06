#!/usr/bin/env bash
# Build/copy the current macOS app, apply draft App Store sandbox
# entitlements with ad-hoc signing, and probe the bundled Apple
# Local Assist helper. This is a diagnostic preview only; it does
# not create an App Store, TestFlight, Developer ID, or notarized
# artifact.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_SRC="$REPO_ROOT/src-tauri/target/release/bundle/macos/hazakura editor.app"
APP_ENTITLEMENTS="$REPO_ROOT/src-tauri/entitlements/app-store-app.plist"
HELPER_ENTITLEMENTS="$REPO_ROOT/src-tauri/entitlements/app-store-helper.plist"
TMP_ROOT="$(mktemp -d)"
APP="$TMP_ROOT/hazakura editor.app"
HELPER="$APP/Contents/MacOS/hazakura-apple-assist-helper"

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
echo "== helper probe under sandbox entitlements =="
set +e
PROBE_OUTPUT="$(printf '%s\n' '{"action":"probe_availability"}' | "$HELPER" 2>"$TMP_ROOT/helper-stderr.txt")"
PROBE_STATUS=$?
set -e

if [ "$PROBE_STATUS" -ne 0 ] || ! grep -q '"kind":"availability"' <<<"$PROBE_OUTPUT"; then
    echo "helper probe failed under sandbox entitlements" >&2
    echo "status: $PROBE_STATUS" >&2
    echo "stdout: $PROBE_OUTPUT" >&2
    echo "stderr: $(cat "$TMP_ROOT/helper-stderr.txt")" >&2

    # CrashReporter can write the report shortly after the process exits.
    sleep 1
    LATEST_REPORT="$(ls -t "$HOME"/Library/Logs/DiagnosticReports/*hazakura-apple-assist-helper*.ips 2>/dev/null | head -1 || true)"
    if [ -n "$LATEST_REPORT" ]; then
        echo "latest crash report: $LATEST_REPORT" >&2
        grep -m 1 '"asiSignatures"' "$LATEST_REPORT" >&2 || true
    fi
    exit 1
fi

echo "probe: $PROBE_OUTPUT"
echo "ok"
