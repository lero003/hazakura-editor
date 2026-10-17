#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
test_dir=$(mktemp -d "${TMPDIR:-/tmp}/hazakura-remote-image-tests.XXXXXX")
trap 'rm -rf "$test_dir"' EXIT

xcrun clang -fobjc-arc -fblocks -fmodules \
  -fmodules-cache-path="$test_dir/module-cache" -Werror \
  -framework Foundation \
  "$repo_root/src-tauri/native/remote_image_bridge_tests.m" \
  -o "$test_dir/remote-image-tests"
"$test_dir/remote-image-tests"

# Compile the production translation unit as well; testing hooks must be absent.
xcrun clang -fobjc-arc -fblocks -fmodules \
  -fmodules-cache-path="$test_dir/module-cache" -Werror -c \
  "$repo_root/src-tauri/native/remote_image_bridge.m" \
  -o "$test_dir/remote-image-production.o"
if nm "$test_dir/remote-image-production.o" | awk '/hz_test_/ { found = 1; print } END { exit !found }'; then
  printf '%s\n' 'FAIL: a remote-image test hook reached the production object' >&2
  exit 1
fi
