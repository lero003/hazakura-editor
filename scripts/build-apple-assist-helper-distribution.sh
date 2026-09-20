#!/usr/bin/env bash
# Build the App Store/TestFlight Local Assist sidecars.
#
# Keep the existing System Foundation Models helper available on every
# supported Mac. Core AI lives in a second sidecar because Apple's package
# requires macOS 27; merging it into the System helper would raise that
# helper's deployment target for users who never select Core AI.
#
# The Core AI arm64 slice contains the adapter only. Model assets are never
# bundled, fetched, or selected by this script. The x86_64 slice is an inert
# compatibility slice and reports Core AI unavailable at runtime.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HELPER_DIR="$REPO_ROOT/src-helpers/apple-assist"
OUT_DIR="$REPO_ROOT/binaries"
CORE_AI_KIT_REVISION="bebe09a050c144034c169af2074fda47fb7ba326"
CORE_AI_MODELS_REVISION="f7a75ec0f89fab451d277572afe8995b7ef768c1"
CORE_AI_RESOLVED="$HELPER_DIR/CoreAIProduction.Package.resolved"
ACTIVE_RESOLVED="$HELPER_DIR/Package.resolved"

"$REPO_ROOT/scripts/build-apple-assist-helper-live.sh"

mkdir -p "$OUT_DIR"

if [[ ! -f "$CORE_AI_RESOLVED" ]] || \
   ! grep -q "$CORE_AI_KIT_REVISION" "$CORE_AI_RESOLVED" || \
   ! grep -q "$CORE_AI_MODELS_REVISION" "$CORE_AI_RESOLVED"; then
  echo "error: committed CoreAIProduction.Package.resolved is missing a pinned production runtime revision" >&2
  exit 1
fi

RESOLVED_BACKUP="$(mktemp "${TMPDIR:-/tmp}/hazakura-coreai-resolved.XXXXXX")"
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

echo "==> swift build (distribution Core AI adapter, arm64)"
HAZAKURA_COREAI_DISTRIBUTION_BUILD=1 \
CLANG_MODULE_CACHE_PATH="$HELPER_DIR/.build/coreai-distribution-clang-module-cache" \
SWIFTPM_MODULECACHE_OVERRIDE="$HELPER_DIR/.build/coreai-distribution-swiftpm-module-cache" \
  swift build \
    --package-path "$HELPER_DIR" \
    --scratch-path "$HELPER_DIR/.build/coreai-distribution" \
    --disable-sandbox \
    --force-resolved-versions \
    -c release \
    --arch arm64 \
    --product HazakuraAppleAssist

CORE_AI_BIN_PATH="$(HAZAKURA_COREAI_DISTRIBUTION_BUILD=1 \
  CLANG_MODULE_CACHE_PATH="$HELPER_DIR/.build/coreai-distribution-clang-module-cache" \
  SWIFTPM_MODULECACHE_OVERRIDE="$HELPER_DIR/.build/coreai-distribution-swiftpm-module-cache" \
  swift build \
  --cache-path "$HELPER_DIR/.build/swiftpm-cache" \
  --config-path "$HELPER_DIR/.build/swiftpm-config" \
  --security-path "$HELPER_DIR/.build/swiftpm-security" \
  --package-path "$HELPER_DIR" \
  --scratch-path "$HELPER_DIR/.build/coreai-distribution" \
  --disable-sandbox \
  --force-resolved-versions \
  -c release \
  --arch arm64 \
  --product HazakuraAppleAssist \
  --show-bin-path)"
CORE_AI_ARM64="$OUT_DIR/hazakura-core-ai-helper-aarch64-apple-darwin"
cp "$CORE_AI_BIN_PATH/HazakuraAppleAssist" "$CORE_AI_ARM64"
chmod +x "$CORE_AI_ARM64"

# The compatibility build uses the dependency-free manifest. Remove the
# temporary active lock so SwiftPM cannot rewrite the committed production lock.
rm -f "$ACTIVE_RESOLVED"

# The default build excludes CoreAILM and remains runnable on Intel. This
# slice exists so Tauri can bundle a universal sidecar; Rust never selects it
# as a ready Core AI backend on Intel.
echo "==> swift build (Core AI unavailable compatibility slice, x86_64)"
CLANG_MODULE_CACHE_PATH="$HELPER_DIR/.build/coreai-compatibility-clang-module-cache" \
SWIFTPM_MODULECACHE_OVERRIDE="$HELPER_DIR/.build/coreai-compatibility-swiftpm-module-cache" \
swift build \
  --cache-path "$HELPER_DIR/.build/swiftpm-cache" \
  --config-path "$HELPER_DIR/.build/swiftpm-config" \
  --security-path "$HELPER_DIR/.build/swiftpm-security" \
  --package-path "$HELPER_DIR" \
  --scratch-path "$HELPER_DIR/.build/coreai-compatibility" \
  --disable-sandbox \
  -c release \
  --arch x86_64 \
  --product HazakuraAppleAssist
COMPAT_BIN_PATH="$(CLANG_MODULE_CACHE_PATH="$HELPER_DIR/.build/coreai-compatibility-clang-module-cache" \
  SWIFTPM_MODULECACHE_OVERRIDE="$HELPER_DIR/.build/coreai-compatibility-swiftpm-module-cache" \
  swift build \
  --cache-path "$HELPER_DIR/.build/swiftpm-cache" \
  --config-path "$HELPER_DIR/.build/swiftpm-config" \
  --security-path "$HELPER_DIR/.build/swiftpm-security" \
  --package-path "$HELPER_DIR" \
  --scratch-path "$HELPER_DIR/.build/coreai-compatibility" \
  --disable-sandbox \
  -c release \
  --arch x86_64 \
  --product HazakuraAppleAssist \
  --show-bin-path)"
CORE_AI_X86="$OUT_DIR/hazakura-core-ai-helper-x86_64-apple-darwin"
cp "$COMPAT_BIN_PATH/HazakuraAppleAssist" "$CORE_AI_X86"
chmod +x "$CORE_AI_X86"

UNIVERSAL_DEST="$OUT_DIR/hazakura-core-ai-helper-universal-apple-darwin"
echo "==> lipo universal Core AI sidecar"
lipo -create "$CORE_AI_ARM64" "$CORE_AI_X86" -output "$UNIVERSAL_DEST"
chmod +x "$UNIVERSAL_DEST"

echo "==> wrote $UNIVERSAL_DEST"
echo "==> Core AI model catalog remains empty until an Apple-hosted asset pack is published"
