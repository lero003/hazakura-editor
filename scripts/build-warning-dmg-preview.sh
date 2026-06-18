#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This warning-expected DMG preview script must be run on macOS." >&2
  exit 1
fi

require_command node
require_command npm
require_command codesign
require_command hdiutil
require_command shasum

version="$(node -p "require('./package.json').version")"
machine_arch="$(uname -m)"
case "$machine_arch" in
  arm64)
    arch="aarch64"
    ;;
  x86_64)
    arch="x64"
    ;;
  *)
    arch="$machine_arch"
    ;;
esac
product_name="hazakura editor Dev"
artifact_name="hazakura-editor-dev"
app_path="src-tauri/target/release/bundle/macos/${product_name}.app"
dmg_dir="src-tauri/target/release/bundle/dmg"
dmg_path="${dmg_dir}/${artifact_name}_${version}_${arch}-warning-expected.dmg"
checksum_path="${dmg_path}.sha256"

verify_developer_id_signature() {
  local signature_details

  signature_details="$(codesign -dv --verbose=4 "$app_path" 2>&1)"
  if ! printf "%s\n" "$signature_details" | grep -F "Authority=Developer ID Application:" >/dev/null; then
    echo "Developer / GitHub release app is not signed with Developer ID Application." >&2
    echo "Build without SKIP_BUILD=1, or set HAZAKURA_DEVELOPER_ID_IDENTITY to the distribution identity." >&2
    exit 1
  fi

  codesign --verify --deep --strict --verbose=2 "$app_path"
}

if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  HAZAKURA_REQUIRE_DEVELOPER_ID_SIGNING=1 npm run build:macos-lanes
fi

if [[ ! -d "$app_path" ]]; then
  echo "Missing built app: $app_path" >&2
  echo "Run npm run build:macos-lanes before setting SKIP_BUILD=1." >&2
  exit 1
fi

verify_developer_id_signature

mkdir -p "$dmg_dir"
staging_root="$(mktemp -d "${dmg_dir}/${artifact_name}-dmg-root.XXXXXX")"
cleanup() {
  rm -rf "$staging_root"
}
trap cleanup EXIT

cp -a "$app_path" "$staging_root/"
ln -s /Applications "$staging_root/Applications"

hdiutil create \
  -volname "${product_name} ${version}" \
  -srcfolder "$staging_root" \
  -ov \
  -format UDZO \
  "$dmg_path"

hdiutil verify "$dmg_path"
(
  cd "$dmg_dir"
  dmg_name="$(basename "$dmg_path")"
  checksum_name="$(basename "$checksum_path")"
  shasum -a 256 "$dmg_name" > "$checksum_name"
  shasum -c "$checksum_name"
)

echo "DMG: $dmg_path"
echo "SHA256: $(awk '{print $1}' "$checksum_path")"
echo "Checksum file: $checksum_path"
