#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
test_dir="src-tauri/target/background-assets-reconnect-test"
mkdir -p "$test_dir/module-cache"
xcrun clang -target "$(uname -m)-apple-macos26.0" -fobjc-arc -fblocks -fmodules \
  "-fmodules-cache-path=$test_dir/module-cache" -Werror -Wno-nullability-completeness \
  src-tauri/native/background_assets_bridge_reconnect_test.m \
  -framework BackgroundAssets -framework Foundation \
  -o "$test_dir/reconnect-test"
"$test_dir/reconnect-test"
