#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHECKOUT="${1:?usage: apply-core-ai-kit-provider-patch.sh CHECKOUT}"
PATCH="$REPO_ROOT/scripts/patches/core-ai-kit-gemma-provider.patch"
EXPECTED_REVISION="bebe09a050c144034c169af2074fda47fb7ba326"

if [[ "$(git -C "$CHECKOUT" rev-parse HEAD)" != "$EXPECTED_REVISION" ]]; then
  echo "error: CoreAIKit checkout is not at the pinned revision" >&2
  exit 1
fi
if git -C "$CHECKOUT" apply --reverse --check "$PATCH" 2>/dev/null; then
  exit 0
fi
if [[ -n "$(git -C "$CHECKOUT" status --porcelain --untracked-files=no)" ]]; then
  echo "error: CoreAIKit checkout has unrelated modifications" >&2
  exit 1
fi
git -C "$CHECKOUT" apply --check "$PATCH"
chmod u+w "$CHECKOUT/Sources/CoreAIKit/Gemma/GemmaRuntime.swift" \
  "$CHECKOUT/Sources/CoreAIKit/Gemma/KitGemmaModel.swift"
git -C "$CHECKOUT" apply "$PATCH"
