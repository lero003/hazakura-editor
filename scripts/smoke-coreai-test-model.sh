#!/usr/bin/env bash
# Maintainer-only, standalone Core AI smoke. Never called by the app/build.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_ROOT="$REPO_ROOT/.hazakura/coreai-test"
APPLE_REVISION="3f109efd54273391f9fd9f5f5b3d8c6e99836d55"
RUNNER="$TEST_ROOT/coreai-models-$APPLE_REVISION/.build/release/llm-runner"
MODEL="$TEST_ROOT/exports/hazakura-qwen3-0.6b-test"

if [[ ! -x "$RUNNER" || ! -f "$MODEL/metadata.json" || ! -f "$TEST_ROOT/SHA256SUMS" ]]; then
  echo "テスト用モデルの準備が必要です。docs/core-ai-test-model.md を参照してください。" >&2
  exit 1
fi

cd "$TEST_ROOT"
shasum -a 256 -c SHA256SUMS
echo "テスト用Qwen3-0.6Bを単体実行します（Hazakuraの本番モデル選択とは別）。"
exec "$RUNNER" --model "$MODEL" \
  --prompt "${1:-次の文の誤字だけを直し、修正文のみ返してください：今日は良い天気でず。 /no_think}" \
  --max-tokens 128 --temperature 0
