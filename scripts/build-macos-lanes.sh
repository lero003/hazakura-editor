#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

app_name="hazakura editor"
app_dir="src-tauri/target/release/bundle/macos"
normal_app="${app_dir}/${app_name}.app"
dev_app="${app_dir}/${app_name} Dev.app"

require_app() {
  local path="$1"
  if [[ ! -d "$path" ]]; then
    echo "Missing built app: $path" >&2
    exit 1
  fi
}

echo "==> build Developer / GitHub lane"
npm run build
require_app "$normal_app"

echo "==> copy Developer / GitHub lane to: $dev_app"
rm -rf "$dev_app"
cp -a "$normal_app" "$dev_app"

echo "==> build App Store preview lane as the normal app"
npm run build:app-store-preview
require_app "$normal_app"

echo "==> built macOS lanes"
echo "App Store preview: $normal_app"
echo "Developer / GitHub: $dev_app"
