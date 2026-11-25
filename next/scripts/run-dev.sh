#!/usr/bin/env bash
set -euo pipefail

project="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
mode="${1:-}"
case "$mode" in
    ''|--build-only|--long-sample|--assist-review-demo|--build-assist-review-demo) valid_mode=true ;;
    *) valid_mode=false ;;
esac
if (( $# > 1 )) || [[ "$valid_mode" == false ]]; then
    printf 'Usage: %s [--build-only | --long-sample | --assist-review-demo | --build-assist-review-demo]\n' "$0" >&2
    exit 2
fi

swift build --package-path "$project" --product HazakuraNext
bin_dir="$(swift build --package-path "$project" --show-bin-path)"
app="$bin_dir/Hazakura Editor Next.app"
demo=false
if [[ "$mode" == --assist-review-demo || "$mode" == --build-assist-review-demo ]]; then
    app="$bin_dir/Hazakura Editor Next Assist Demo.app"
    demo=true
fi
mkdir -p "$app/Contents/MacOS"
plist="$app/Contents/Info.plist"
install -m 644 "$project/Resources/Info.plist" "$plist"
if [[ "$demo" == true ]]; then
    # Separate Launch Services identity. The identifier also selects demo mode on Finder launch.
    plutil -replace CFBundleIdentifier -string dev.hazakura.editor.next.assist-demo.dev "$plist"
    plutil -replace CFBundleDisplayName -string 'Hazakura Editor Next Assist Demo' "$plist"
    plutil -replace CFBundleName -string 'Hazakura Editor Next Assist Demo' "$plist"
fi
install -m 755 "$bin_dir/HazakuraNext" "$app/Contents/MacOS/HazakuraNext"
# Seal the generated bundle locally; the SwiftPM executable's signature does not bind Info.plist.
codesign --force --sign - "$app"
codesign --verify --strict "$app"
printf 'Development app: %s\n' "$app"

case "$mode" in
    --build-only|--build-assist-review-demo) ;;
    --long-sample) open "$app" --args --long-sample ;;
    *) open "$app" ;;
esac
