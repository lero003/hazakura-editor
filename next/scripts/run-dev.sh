#!/usr/bin/env bash
set -euo pipefail

project="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
mode="${1:-}"
case "$mode" in
    ''|--build-only|--long-sample|--assist-review-demo|--build-assist-review-demo|--build-sandbox-preview) valid_mode=true ;;
    *) valid_mode=false ;;
esac
if (( $# > 1 )) || [[ "$valid_mode" == false ]]; then
    printf 'Usage: %s [--build-only | --long-sample | --assist-review-demo | --build-assist-review-demo | --build-sandbox-preview]\n' "$0" >&2
    exit 2
fi

swift build --package-path "$project" --product HazakuraNext
bin_dir="$(swift build --package-path "$project" --show-bin-path)"
bundle_name='Hazakura Editor Next'
bundle_id=''
sign_options=(--force --sign -)
case "$mode" in
    --assist-review-demo|--build-assist-review-demo)
        bundle_name='Hazakura Editor Next Assist Demo'
        bundle_id=dev.hazakura.editor.next.assist-demo.dev
        ;;
    --build-sandbox-preview)
        bundle_name='Hazakura Editor Next Sandbox Preview'
        bundle_id=dev.hazakura.editor.next.sandbox-preview.dev
        sign_options+=(--entitlements "$project/Resources/SandboxPreview.entitlements")
        ;;
esac
app="$bin_dir/$bundle_name.app"
mkdir -p "$app/Contents/MacOS"
plist="$app/Contents/Info.plist"
install -m 644 "$project/Resources/Info.plist" "$plist"
if [[ -n "$bundle_id" ]]; then
    # Separate Launch Services identities also select distinct startup routes.
    plutil -replace CFBundleIdentifier -string "$bundle_id" "$plist"
    plutil -replace CFBundleDisplayName -string "$bundle_name" "$plist"
    plutil -replace CFBundleName -string "$bundle_name" "$plist"
fi
install -m 755 "$bin_dir/HazakuraNext" "$app/Contents/MacOS/HazakuraNext"
# Seal the generated bundle locally; the SwiftPM executable's signature does not bind Info.plist.
codesign "${sign_options[@]}" "$app"
codesign --verify --strict "$app"
printf 'Development app: %s\n' "$app"

case "$mode" in
    --build-only|--build-assist-review-demo|--build-sandbox-preview) ;;
    --long-sample) open "$app" --args --long-sample ;;
    *) open "$app" ;;
esac
