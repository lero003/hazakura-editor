#!/usr/bin/env bash
# Build/copy the current App Store preview app, apply draft sandbox
# entitlements with ad-hoc signing, and verify the helper-enabled
# App Store lane shape. This is a diagnostic preview only; it does
# not create a TestFlight, App Store Connect upload, Developer ID, or
# notarized artifact.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_SRC="$REPO_ROOT/src-tauri/target/release/bundle/macos/Hazakura Editor.app"
APP_ENTITLEMENTS="$REPO_ROOT/src-tauri/entitlements/mac-app-store.entitlements"
TMP_ROOT="$(mktemp -d)"
APP="$TMP_ROOT/Hazakura Editor.app"
HELPERS=(
    "$APP/Contents/MacOS/hazakura-local-assist-helper"
    "$APP/Contents/MacOS/hazakura-import-assist-helper"
)
HELPER_ENTITLEMENTS="$REPO_ROOT/src-tauri/entitlements/app-store-helper.plist"

cleanup() {
    rm -rf "$TMP_ROOT"
}
trap cleanup EXIT

if [ "${SKIP_BUILD:-0}" != "1" ]; then
    echo "==> build helper-enabled App Store preview"
    (cd "$REPO_ROOT" && npm run build:app-store-preview)
fi

if [ ! -d "$APP_SRC" ]; then
    echo "error: app bundle not found: $APP_SRC" >&2
    echo "run: npm run build:app-store-preview" >&2
    exit 1
fi

echo "==> copy app to temp sandbox smoke bundle"
ditto "$APP_SRC" "$APP"

for helper in "${HELPERS[@]}"; do
    if [ ! -x "$helper" ]; then
        echo "error: App Store preview must bundle nested helper: $helper" >&2
        exit 1
    fi
done

for helper in "${HELPERS[@]}"; do
    echo "==> ad-hoc sign helper with inherited sandbox entitlement: $helper"
    codesign \
        --force \
        --sign - \
        --options runtime \
        --entitlements "$HELPER_ENTITLEMENTS" \
        "$helper"
done

echo "==> ad-hoc sign app with draft App Store sandbox entitlements"
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
codesign -d --entitlements - "$APP" 2>/dev/null

for helper in "${HELPERS[@]}"; do
    echo
    echo "== helper entitlements ($helper) =="
    codesign -d --entitlements - "$helper" 2>/dev/null
    if ! codesign -d --entitlements - "$helper" 2>/dev/null | grep -q "com.apple.security.inherit"; then
        echo "error: App Store preview helper must carry com.apple.security.inherit: $helper" >&2
        exit 1
    fi
done

echo
echo "== app identity =="
/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "$APP/Contents/Info.plist"

echo
echo "== helper-enabled App Store preview =="
echo "ok"
