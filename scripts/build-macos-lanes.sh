#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

app_name="hazakura editor"
dev_app_name="hazakura editor Dev"
dev_bundle_identifier="lab.hazakura.note.dev"
app_dir="src-tauri/target/release/bundle/macos"
normal_app="${app_dir}/${app_name}.app"
dev_app="${app_dir}/${dev_app_name}.app"
plist_buddy="/usr/libexec/PlistBuddy"

require_app() {
  local path="$1"
  if [[ ! -d "$path" ]]; then
    echo "Missing built app: $path" >&2
    exit 1
  fi
}

set_plist_value() {
  local plist_path="$1"
  local key="$2"
  local type="$3"
  local value="$4"

  if "$plist_buddy" -c "Print :${key}" "$plist_path" >/dev/null 2>&1; then
    "$plist_buddy" -c "Set :${key} ${value}" "$plist_path"
  else
    "$plist_buddy" -c "Add :${key} ${type} ${value}" "$plist_path"
  fi
}

sign_app_bundle() {
  local app_path="$1"

  codesign --force --options runtime --sign - "${app_path}/Contents/MacOS/hazakura-apple-assist-helper"
  codesign --force --options runtime --sign - "${app_path}/Contents/MacOS/hazakura-editor"
  codesign --force --deep --options runtime --sign - "$app_path"
}

prepare_dev_bundle_identity() {
  local plist_path="${dev_app}/Contents/Info.plist"

  echo "==> set Developer / GitHub lane identity"
  set_plist_value "$plist_path" "CFBundleName" "string" "$dev_app_name"
  set_plist_value "$plist_path" "CFBundleDisplayName" "string" "$dev_app_name"
  set_plist_value "$plist_path" "CFBundleIdentifier" "string" "$dev_bundle_identifier"

  echo "==> re-sign Developer / GitHub lane"
  sign_app_bundle "$dev_app"
}

echo "==> build Developer / GitHub lane"
npm run build
require_app "$normal_app"

echo "==> copy Developer / GitHub lane to: $dev_app"
rm -rf "$dev_app"
cp -a "$normal_app" "$dev_app"
prepare_dev_bundle_identity

echo "==> build App Store preview lane as the normal app"
npm run build:app-store-preview
require_app "$normal_app"

echo "==> built macOS lanes"
echo "App Store preview: $normal_app"
echo "Developer / GitHub: $dev_app"
