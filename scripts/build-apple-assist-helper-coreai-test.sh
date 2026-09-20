#!/usr/bin/env bash
# Build the Developer-only macOS 27 / Apple Silicon Core AI Local Assist helper.
# The app never downloads, converts, or imports a model. This script consumes
# the exact Apple coreai-models revision in Package.swift and the Qwen test
# bundle prepared under .hazakura/coreai-test/.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HELPER_DIR="$REPO_ROOT/src-helpers/apple-assist"
TEST_ROOT="$REPO_ROOT/.hazakura/coreai-test"
APPLE_REVISION="3f109efd54273391f9fd9f5f5b3d8c6e99836d55"
MODEL="$TEST_ROOT/exports/hazakura-qwen3-0.6b-test"
OUT_DIR="$REPO_ROOT/binaries"
CORE_AI_RESOLVED="$HELPER_DIR/CoreAI.Package.resolved"
ACTIVE_RESOLVED="$HELPER_DIR/Package.resolved"

if [[ "$(uname -m)" != "arm64" ]]; then
  echo "error: the Core AI test helper requires Apple Silicon" >&2
  exit 1
fi

for required in \
  "$MODEL/metadata.json" \
  "$MODEL/tokenizer/tokenizer.json" \
  "$MODEL/hazakura-qwen3-0.6b-test.aimodel/main.mlirb"; do
  if [[ ! -e "$required" ]]; then
    echo "error: fixed Core AI test input is missing: $required" >&2
    exit 1
  fi
done

mkdir -p "$OUT_DIR"

if [[ ! -f "$CORE_AI_RESOLVED" ]] || \
   ! grep -q "$APPLE_REVISION" "$CORE_AI_RESOLVED"; then
  echo "error: committed CoreAI.Package.resolved is missing the pinned Apple revision" >&2
  exit 1
fi

RESOLVED_BACKUP="$(mktemp "${TMPDIR:-/tmp}/hazakura-coreai-test-resolved.XXXXXX")"
RESOLVED_WAS_PRESENT=0
if [[ -f "$ACTIVE_RESOLVED" ]]; then
  RESOLVED_WAS_PRESENT=1
  cp "$ACTIVE_RESOLVED" "$RESOLVED_BACKUP"
fi
restore_resolved_file() {
  if [[ "$RESOLVED_WAS_PRESENT" = "1" ]]; then
    cp "$RESOLVED_BACKUP" "$ACTIVE_RESOLVED"
  else
    rm -f "$ACTIVE_RESOLVED"
  fi
  rm -f "$RESOLVED_BACKUP"
}
trap restore_resolved_file EXIT
cp "$CORE_AI_RESOLVED" "$ACTIVE_RESOLVED"

echo "==> swift build (Developer Core AI test backend, arm64)"
HAZAKURA_COREAI_TEST_BUILD=1 \
CLANG_MODULE_CACHE_PATH="$HELPER_DIR/.build/coreai-clang-module-cache" \
SWIFTPM_MODULECACHE_OVERRIDE="$HELPER_DIR/.build/coreai-swiftpm-module-cache" \
  swift build \
    --package-path "$HELPER_DIR" \
    --scratch-path "$HELPER_DIR/.build/coreai-test" \
    --disable-sandbox \
    --force-resolved-versions \
    -c release \
    --arch arm64 \
    --product HazakuraAppleAssist

BIN_PATH="$(HAZAKURA_COREAI_TEST_BUILD=1 \
  CLANG_MODULE_CACHE_PATH="$HELPER_DIR/.build/coreai-clang-module-cache" \
  SWIFTPM_MODULECACHE_OVERRIDE="$HELPER_DIR/.build/coreai-swiftpm-module-cache" \
  swift build \
  --cache-path "$HELPER_DIR/.build/swiftpm-cache" \
  --config-path "$HELPER_DIR/.build/swiftpm-config" \
  --security-path "$HELPER_DIR/.build/swiftpm-security" \
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
