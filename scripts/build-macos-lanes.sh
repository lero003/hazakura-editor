#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

app_name="Hazakura Editor"
dev_app_name="Hazakura Editor Dev"
dev_bundle_identifier="lab.hazakura.note.dev"
app_dir="src-tauri/target/release/bundle/macos"
normal_app="${app_dir}/${app_name}.app"
dev_app="${app_dir}/${dev_app_name}.app"
plist_buddy="/usr/libexec/PlistBuddy"
developer_id_required="${HAZAKURA_REQUIRE_DEVELOPER_ID_SIGNING:-0}"
developer_id_identity="${HAZAKURA_DEVELOPER_ID_IDENTITY:-}"
dev_signing_identity="-"

require_app() {
  local path="$1"
  if [[ ! -d "$path" ]]; then
    echo "Missing built app: $path" >&2
    exit 1
  fi
}

detect_developer_id_identity() {
  local matches
  local count

  matches="$(security find-identity -p codesigning -v 2>/dev/null | awk -F'"' '/"Developer ID Application:/{print $2}')"
  count="$(printf "%s\n" "$matches" | sed '/^$/d' | wc -l | tr -d ' ')"

  case "$count" in
    0)
      echo "No valid Developer ID Application signing identity was found." >&2
      echo "Set HAZAKURA_DEVELOPER_ID_IDENTITY or install the distribution certificate." >&2
      exit 1
      ;;
    1)
      printf "%s\n" "$matches" | sed '/^$/d'
      ;;
    *)
      echo "Multiple Developer ID Application identities were found." >&2
      echo "Set HAZAKURA_DEVELOPER_ID_IDENTITY to the exact identity to use:" >&2
      printf "%s\n" "$matches" | sed '/^$/d' >&2
      exit 1
      ;;
  esac
}

resolve_dev_signing_identity() {
  if [[ -n "$developer_id_identity" ]]; then
    if ! security find-identity -p codesigning -v 2>/dev/null | grep -F "\"$developer_id_identity\"" >/dev/null; then
      echo "Developer ID signing identity not found: $developer_id_identity" >&2
      exit 1
    fi
    printf "%s\n" "$developer_id_identity"
    return
  fi

  if [[ "$developer_id_required" == "1" ]]; then
    detect_developer_id_identity
    return
  fi

  printf "%s\n" "-"
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
  local timestamp_enabled=0

  if [[ "$dev_signing_identity" != "-" ]]; then
    timestamp_enabled=1
  fi

  sign_codesign_target "${app_path}/Contents/MacOS/hazakura-local-assist-helper" 0 "$timestamp_enabled"
  sign_codesign_target "${app_path}/Contents/MacOS/hazakura-import-assist-helper" 0 "$timestamp_enabled"
  sign_codesign_target "${app_path}/Contents/MacOS/hazakura-editor" 0 "$timestamp_enabled"
  sign_codesign_target "$app_path" 1 "$timestamp_enabled"
  codesign --verify --deep --strict --verbose=2 "$app_path"
}

sign_codesign_target() {
  local target="$1"
  local deep="$2"
  local timestamp_enabled="$3"

  if [[ "$deep" == "1" && "$timestamp_enabled" == "1" ]]; then
    codesign --force --deep --options runtime --timestamp --sign "$dev_signing_identity" "$target"
    return
  fi
  if [[ "$deep" == "1" ]]; then
    codesign --force --deep --options runtime --sign "$dev_signing_identity" "$target"
    return
  fi
  if [[ "$timestamp_enabled" == "1" ]]; then
    codesign --force --options runtime --timestamp --sign "$dev_signing_identity" "$target"
    return
  fi

  codesign --force --options runtime --sign "$dev_signing_identity" "$target"
}

prepare_dev_bundle_identity() {
  local plist_path="${dev_app}/Contents/Info.plist"

  echo "==> set Developer / GitHub lane identity"
  set_plist_value "$plist_path" "CFBundleName" "string" "$dev_app_name"
  set_plist_value "$plist_path" "CFBundleDisplayName" "string" "$dev_app_name"
  set_plist_value "$plist_path" "CFBundleIdentifier" "string" "$dev_bundle_identifier"

  echo "==> re-sign Developer / GitHub lane"
  echo "Signing identity: $dev_signing_identity"
  sign_app_bundle "$dev_app"
}

dev_signing_identity="$(resolve_dev_signing_identity)"

echo "==> build Developer / GitHub lane"
npm run build:developer-preview
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
