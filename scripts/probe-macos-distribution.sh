#!/usr/bin/env bash
# Inspect the current macOS app bundle for distribution-readiness signals.
#
# This script is read-only. It does not sign, notarize, package, upload,
# or mutate the app. Use it after `npm run build` has produced the local
# app bundle. Set REQUIRE_APP_STORE_ENTITLEMENTS=1 when probing a signed
# App Store submit bundle or an intentionally sandbox-re-signed preview.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="${1:-$REPO_ROOT/src-tauri/target/release/bundle/macos/Hazakura Editor.app}"
EXPECTED_DISTRIBUTION_LANE="${EXPECTED_DISTRIBUTION_LANE:-app-store}"
REQUIRE_APP_STORE_ENTITLEMENTS="${REQUIRE_APP_STORE_ENTITLEMENTS:-0}"
HELPER="$APP/Contents/MacOS/hazakura-apple-assist-helper"
PLIST="$APP/Contents/Info.plist"
RESOURCES="$APP/Contents/Resources"

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
echo "== bundled notices =="
missing_notice=0
for notice in LICENSE THIRD_PARTY_NOTICES.md; do
    notice_path="$RESOURCES/$notice"
    if [ -s "$notice_path" ]; then
        echo "$notice: present"
    else
        echo "$notice: missing or empty"
        missing_notice=1
    fi
done

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
has_entitlement() {
    local target="$1"
    local entitlement="$2"
    codesign -d --entitlements - "$target" 2>/dev/null | grep -q "$entitlement"
}

echo "== entitlement check =="
missing_required_entitlement=0
if has_entitlement "$APP" "com.apple.security.app-sandbox"; then
    echo "app sandbox entitlement: present"
else
    echo "app sandbox entitlement: missing"
    if [ "$REQUIRE_APP_STORE_ENTITLEMENTS" = "1" ]; then
        missing_required_entitlement=1
    fi
fi

if [ "$EXPECTED_DISTRIBUTION_LANE" = "app-store" ]; then
    if [ "$REQUIRE_APP_STORE_ENTITLEMENTS" != "1" ]; then
        echo "app store entitlement gate: skipped for launchable local preview"
    fi

    for entitlement in \
        "com.apple.security.files.user-selected.read-write" \
        "com.apple.security.files.bookmarks.app-scope" \
        "com.apple.security.network.client"; do
        if has_entitlement "$APP" "$entitlement"; then
            echo "app $entitlement entitlement: present"
        else
            echo "app $entitlement entitlement: missing"
            if [ "$REQUIRE_APP_STORE_ENTITLEMENTS" = "1" ]; then
                missing_required_entitlement=1
            fi
        fi
    done

    for entitlement in \
        "com.apple.security.network.server" \
        "com.apple.security.automation.apple-events"; do
        if has_entitlement "$APP" "$entitlement"; then
            echo "app $entitlement entitlement: unexpected"
            missing_required_entitlement=1
        else
            echo "app $entitlement entitlement: absent"
        fi
    done
fi

if [ ! -e "$HELPER" ]; then
    echo "helper inherit entitlement: unavailable (helper absent)"
elif [ ! -x "$HELPER" ]; then
    echo "helper inherit entitlement: unavailable (helper not executable)"
elif has_entitlement "$HELPER" "com.apple.security.inherit"; then
    echo "helper inherit entitlement: present"
else
    echo "helper inherit entitlement: missing"
    if [ "$REQUIRE_APP_STORE_ENTITLEMENTS" = "1" ]; then
        missing_required_entitlement=1
    fi
fi

if [ "$EXPECTED_DISTRIBUTION_LANE" = "app-store" ]; then
    failed=0

    if [ "$missing_notice" -ne 0 ]; then
        echo "error: App Store lane must bundle license and third-party notices" >&2
        failed=1
    fi

    if [ ! -x "$HELPER" ]; then
        echo "error: App Store lane must bundle Apple Assist helper: $HELPER" >&2
        failed=1
    fi

    if [ "$(print_plist_value CFBundleIdentifier)" != "dev.hazakura.editor" ]; then
        echo "error: App Store lane bundle identifier must be dev.hazakura.editor" >&2
        failed=1
    fi

    if [ "$missing_required_entitlement" -ne 0 ]; then
        echo "error: App Store lane entitlement check failed" >&2
        failed=1
    fi

    if [ "$failed" -ne 0 ]; then
        exit 1
    fi
fi

echo
echo "== Gatekeeper assessment =="
if spctl -a -vv -t open "$APP" 2>&1; then
    echo "spctl: accepted"
else
    echo "spctl: rejected or inconclusive (expected for local or not-notarized preview builds)"
fi
