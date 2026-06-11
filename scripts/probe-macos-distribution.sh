#!/usr/bin/env bash
# Inspect the current macOS app bundle for distribution-readiness signals.
#
# This script is read-only. It does not sign, notarize, package, upload,
# or mutate the app. Use it after `npm run build` has produced the local
# app bundle.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="${1:-$REPO_ROOT/src-tauri/target/release/bundle/macos/hazakura editor.app}"
HELPER="$APP/Contents/MacOS/hazakura-apple-assist-helper"
PLIST="$APP/Contents/Info.plist"

if [ ! -d "$APP" ]; then
    echo "error: app bundle not found: $APP" >&2
    echo "run: npm run build" >&2
    exit 1
fi

if [ ! -f "$PLIST" ]; then
    echo "error: Info.plist not found: $PLIST" >&2
    exit 1
fi

print_plist_value() {
    local key="$1"
    /usr/libexec/PlistBuddy -c "Print :$key" "$PLIST" 2>/dev/null || echo "(missing)"
}

echo "== bundle =="
echo "app: $APP"
echo "version: $(print_plist_value CFBundleShortVersionString)"
echo "identifier: $(print_plist_value CFBundleIdentifier)"
echo "name: $(print_plist_value CFBundleName)"
echo "executable: $(print_plist_value CFBundleExecutable)"
echo "minimumSystemVersion: $(print_plist_value LSMinimumSystemVersion)"

echo
echo "== nested helper =="
if [ -x "$HELPER" ]; then
    echo "helper: executable"
else
    echo "helper: missing or not executable"
fi

echo
echo "== codesign verify =="
codesign --verify --deep --strict --verbose=2 "$APP"

echo
echo "== app signature details =="
codesign -dvvv --entitlements - "$APP" 2>&1 || true

echo
echo "== helper signature details =="
if [ -x "$HELPER" ]; then
    codesign -dvvv --entitlements - "$HELPER" 2>&1 || true
else
    echo "(helper unavailable)"
fi

echo
echo "== sandbox entitlement check =="
if codesign -d --entitlements - "$APP" 2>/dev/null | grep -q "com.apple.security.app-sandbox"; then
    echo "app sandbox entitlement: present"
else
    echo "app sandbox entitlement: missing"
fi

if [ -x "$HELPER" ] && codesign -d --entitlements - "$HELPER" 2>/dev/null | grep -q "com.apple.security.app-sandbox"; then
    echo "helper sandbox entitlement: present"
else
    echo "helper sandbox entitlement: missing or helper unavailable"
fi

echo
echo "== Gatekeeper assessment =="
if spctl -a -vv -t open "$APP" 2>&1; then
    echo "spctl: accepted"
else
    echo "spctl: rejected or inconclusive (expected for ad-hoc, not-notarized local builds)"
fi
