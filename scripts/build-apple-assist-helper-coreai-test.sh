#!/usr/bin/env bash
# Build the Developer-only macOS 27 / Apple Silicon Core AI Local Assist helper.
# The app never downloads, converts, or imports a model. This script consumes
# the fixed local Apple source checkout and Qwen test bundle prepared under
# .hazakura/coreai-test/.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HELPER_DIR="$REPO_ROOT/src-helpers/apple-assist"
TEST_ROOT="$REPO_ROOT/.hazakura/coreai-test"
APPLE_REVISION="3f109efd54273391f9fd9f5f5b3d8c6e99836d55"
APPLE_SOURCE="$TEST_ROOT/coreai-models-$APPLE_REVISION"
MODEL="$TEST_ROOT/exports/hazakura-qwen3-0.6b-test"
OUT_DIR="$REPO_ROOT/binaries"

if [[ "$(uname -m)" != "arm64" ]]; then
  echo "error: the Core AI test helper requires Apple Silicon" >&2
  exit 1
fi

for required in \
  "$APPLE_SOURCE/Package.swift" \
  "$APPLE_SOURCE/Package.resolved" \
  "$MODEL/metadata.json" \
  "$MODEL/tokenizer/tokenizer.json" \
  "$MODEL/hazakura-qwen3-0.6b-test.aimodel/main.mlirb"; do
  if [[ ! -e "$required" ]]; then
    echo "error: fixed Core AI test input is missing: $required" >&2
    exit 1
  fi
done

mkdir -p "$OUT_DIR"
cp "$APPLE_SOURCE/Package.resolved" "$HELPER_DIR/Package.resolved"

echo "==> swift build (Developer Core AI test backend, arm64)"
HAZAKURA_COREAI_TEST_BUILD=1 \
CLANG_MODULE_CACHE_PATH="$HELPER_DIR/.build/coreai-clang-module-cache" \
  swift build \
    --package-path "$HELPER_DIR" \
    --scratch-path "$HELPER_DIR/.build/coreai-test" \
    --disable-sandbox \
    --force-resolved-versions \
    -c release \
    --arch arm64 \
    --product HazakuraAppleAssist

BIN_PATH="$(HAZAKURA_COREAI_TEST_BUILD=1 swift build \
  --package-path "$HELPER_DIR" \
  --scratch-path "$HELPER_DIR/.build/coreai-test" \
  --disable-sandbox \
  --force-resolved-versions \
  -c release \
  --arch arm64 \
  --product HazakuraAppleAssist \
  --show-bin-path)"
BUILT="$BIN_PATH/HazakuraAppleAssist"
DEST="$OUT_DIR/hazakura-local-assist-helper-aarch64-apple-darwin"
if [[ ! -x "$BUILT" ]]; then
  echo "error: Core AI helper build did not produce $BUILT" >&2
  exit 1
fi
cp "$BUILT" "$DEST"
chmod +x "$DEST"
echo "==> wrote $DEST"
echo "Run with: HAZAKURA_LOCAL_ASSIST_TEST_BACKEND=core_ai_test npm run dev"
