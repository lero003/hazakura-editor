#!/usr/bin/env bash
set -euo pipefail

project="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
mode="${1:-}"
if (( $# > 1 )) || [[ "$mode" != "" && "$mode" != --build-only && "$mode" != --long-sample ]]; then
    printf 'Usage: %s [--build-only | --long-sample]\n' "$0" >&2
    exit 2
fi

swift build --package-path "$project" --product HazakuraNext
bin_dir="$(swift build --package-path "$project" --show-bin-path)"
app="$bin_dir/Hazakura Editor Next.app"
mkdir -p "$app/Contents/MacOS"
install -m 644 "$project/Resources/Info.plist" "$app/Contents/Info.plist"
install -m 755 "$bin_dir/HazakuraNext" "$app/Contents/MacOS/HazakuraNext"
# Seal the generated bundle locally; the SwiftPM executable's signature does not bind Info.plist.
codesign --force --sign - "$app"
codesign --verify --strict "$app"
printf 'Development app: %s\n' "$app"

case "$mode" in
    --build-only) ;;
    --long-sample) open -n "$app" --args --long-sample ;;
    *) open -n "$app" ;;
esac
