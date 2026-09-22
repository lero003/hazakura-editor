#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HELPER_DIR="$REPO_ROOT/src-helpers/apple-assist"
ACTIVE_RESOLVED="$HELPER_DIR/Package.resolved"
PRODUCTION_RESOLVED="$HELPER_DIR/CoreAIProduction.Package.resolved"
SCRATCH="$HELPER_DIR/.build/coreai-distribution"
BACKUP="$(mktemp "${TMPDIR:-/tmp}/hazakura-coreai-test-resolved.XXXXXX")"
WAS_PRESENT=0
if [[ -f "$ACTIVE_RESOLVED" ]]; then
  WAS_PRESENT=1
  cp "$ACTIVE_RESOLVED" "$BACKUP"
fi
restore_resolved_file() {
  if [[ "$WAS_PRESENT" = "1" ]]; then
    cp "$BACKUP" "$ACTIVE_RESOLVED"
  else
    rm -f "$ACTIVE_RESOLVED"
  fi
  rm -f "$BACKUP"
}
trap restore_resolved_file EXIT
cp "$PRODUCTION_RESOLVED" "$ACTIVE_RESOLVED"

export HAZAKURA_COREAI_DISTRIBUTION_BUILD=1
export CLANG_MODULE_CACHE_PATH="$HELPER_DIR/.build/coreai-distribution-clang-module-cache"
export SWIFTPM_MODULECACHE_OVERRIDE="$HELPER_DIR/.build/coreai-distribution-swiftpm-module-cache"

swift package resolve \
  --package-path "$HELPER_DIR" \
  --scratch-path "$SCRATCH" \
  --disable-sandbox \
  --force-resolved-versions
"$REPO_ROOT/scripts/apply-core-ai-kit-provider-patch.sh" \
  "$SCRATCH/checkouts/coreai-kit"
swift test \
  --package-path "$HELPER_DIR" \
  --scratch-path "$SCRATCH" \
  --cache-path "$HELPER_DIR/.build/swiftpm-cache" \
  --config-path "$HELPER_DIR/.build/swiftpm-config" \
  --security-path "$HELPER_DIR/.build/swiftpm-security" \
  --disable-sandbox \
  --force-resolved-versions
