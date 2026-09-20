# Core AI テスト用モデル

Status: Operational
Scope: Developer向け単体モデル検証。製品C-1/C-2とは別
Authority: Medium
Last reviewed: 2026-09-20

簡単なロード・生成確認には **Qwen3-0.6B / macOS / INT4 / context 4096** を使う。
モデルの層は省略しない。本番allowlistのidentity、日本語文章品質の採用判定、
App Store配布、本番C-1/C-2の完成を意味しない。通常buildの生成経路は引き続き
`system_default`。Developer専用のPhase 1経路だけが固定fixtureを `core_ai_test` として選べる。

## この作業環境で試す

リポジトリのルートで実行する。macOS 27以降のApple Silicon Mac向け。

```bash
bash scripts/smoke-coreai-test-model.sh
bash scripts/smoke-coreai-test-model.sh '日本語で短く挨拶してください。 /no_think'
```

実体はGit管理外の `.hazakura/coreai-test/exports/hazakura-qwen3-0.6b-test/`。
`.aimodel`、`tokenizer/`、`metadata.json`、ライセンスを一緒に扱う。
`.aimodel`だけをコピーすると言語モデルの実行に必要な情報が欠ける。
`SHA256SUMS`で準備時のファイルを照合してから、Apple公式 `llm-runner` を実行する。
最大出力128 tokens、temperature 0。`/no_think`はQwenへの入力であり、出力形式を保証しない。
生成案は標準出力へ出る。エディタへの反映・保存は行わない。

## Hazakura Local Assistで試す

モデルとAppleソースを上記固定位置へ準備した環境だけで実行する。

```bash
npm run build:apple-assist-helper:coreai-test
HAZAKURA_LOCAL_ASSIST_TEST_BACKEND=core_ai_test npm run dev
```

選択はRust supervisorが起動時に固定enumとして解決する。frontendからbackend、model path、
model id、URLを渡すAPIはない。通常build / App Store buildは従来のlive helperを作り直し、
Core AI packageやテストモデルを同梱しない。Systemへ戻すときは
`HAZAKURA_LOCAL_ASSIST_TEST_BACKEND=system_default`（または環境変数なし）で起動する。

## 固定した入力と再作成

| 入力 | 固定値 |
|---|---|
| Apple変換・実行ツール | `apple/coreai-models` / `3f109efd54273391f9fd9f5f5b3d8c6e99836d55` |
| 公式ソースtar.gz SHA-256 | `7e05a7ae64fe667a35b56a0ce121d9b7163539a158ae71615d96c7a5810130b9` |
| 重み・tokenizer | `Qwen/Qwen3-0.6B` / `c1899de289a04d12100db370d81485cdf75e47ca` |
| モデルライセンス | Apache-2.0（取得したLICENSEも同梱） |
| 変換 | macOS / 4bit / float16 compute / context 4096 / 全層 |
| 配置 | `.hazakura/coreai-test/`（モデル・依存・キャッシュはGit管理外） |

新しい環境ではメンテナーが上記の固定ソースと重みを取得する。
Appleソースはその `uv.lock` で `uv sync --frozen --no-default-groups` し、
専用 `.venv` を使う。アプリのnpm/Cargo/Swift依存やグローバルPythonは変更しない。
HF snapshotは固定revision、認証不要の重み・JSON・tokenizer・LICENSEだけを取得する。
専用HFキャッシュの `refs/main` をそのrevisionに固定してから、以下をオフラインで実行する。
キャッシュの場所はすべて検証ディレクトリに閉じる。

```bash
# 固定したAppleソースディレクトリから実行
HF_HOME=../hf-cache HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 \
  HF_HUB_DISABLE_IMPLICIT_TOKEN=1 HF_HUB_DISABLE_TELEMETRY=1 \
  .venv/bin/coreai.llm.export Qwen/Qwen3-0.6B \
  --platform macOS --compression 4bit --max-context-length 4096 \
  --output-dir ../exports --output-name hazakura-qwen3-0.6b-test

CLANG_MODULE_CACHE_PATH=../clang-cache \
  swift build --disable-sandbox -c release --product llm-runner --force-resolved-versions
```

作成後はモデルにLICENSEを添え、取得元revision、変換条件、OS/SDKと全ファイルの
相対path / size / SHA-256を `resource-manifest.json` に記録する。
モデル一式・manifest・実行バイナリの `SHA256SUMS` を検証ディレクトリ直下に作る。
これはメンテナーのローカル完全性記録で、署名済みcatalogやC-1の安全な展開・検証実装ではない。
変換ごとのmetadata日時などにより、出力digestの再現性は未保証。

## 今回の検証（2026-09-20）

- macOS 27.0 build `26A428`、Xcode 27.0 build `27A266a`、arm64。
- 公式lockfileの専用環境で変換成功。bundleは8ファイル、347,311,047 bytes（約347 MB）。
- 全ファイルとrunnerのSHA-256照合後、Core AI単体生成を確認。初回load約4.80秒、
  17 tokens生成。これは単回smokeで、性能保証やApp Store候補の計測ではない。
- 入力「今日は良い天気でず。」に対し「正しい文: 今日は良い天気で、ず。」を出力し、
  空のthinkタグも残った。**ロード・生成は成功、校正精度・本文のみ出力は不合格。**
  日本語bake-offの合格や製品採用の根拠にはしない。
- sandbox内の初回実行はCore AI標準キャッシュの書込み制限で停止。
  キャッシュ書込みを許可した実行で上記を確認した。キャッシュの場所はOS管理で、
  アプリにキャッシュ削除機能や広いアクセス権は追加していない。
- `.aimodelc`へのAOTは未実施。ここで準備したのはポータブルな `.aimodel` bundle。
- HazakuraのDeveloper専用QA appで、Core AI load → streaming → Proposal → main window Diff →
  明示Apply（未保存）→ Undo、再依頼直後のCancelを確認。Proposalの生成元は
  `apple:core-ai:qwen3-0.6b-test`。同じappを `system_default` で再起動し、System生成と
  `apple:foundation-models:system-default` への復帰も確認した。
- Local Assist経由の校正候補は「今日は良い天気でず。」に対して
  「今日の良い天気でず。」で、**配管確認は成功、品質は不合格**。Phase 1は候補品質を採用根拠にしない。

準備ログ、生成結果、manifestは `.hazakura/coreai-test/` に保持する。
変換時にはAppleの固定依存からtorch/coremltools互換性等のwarningも出ている。
変換・ロードの成功を全演算の数値一致や他Mac/旧OS互換の保証へ繰り上げない。

## 受入の区別

- 単体smoke: bundleロードと短文生成。結果と制約は下の検証記録に残す。
- C-1 fixture配管: 取得・検証・準備・削除の製品実装は別途必要。
- C-2 Phase 1 fixture配管: Rust所有のtest選択、backend固有availability、Local Assist会話→提案→
  Diff→明示Apply→Undo / Cancelは接続済み。通常利用者向けの本番選択・配布契約ではない。
- 本番: identity再選定、expanded manifest、配信/AOT、権利・容量・地域、日本語bake-offと同一署名候補の受入が必要。

この軽量テストモデルを本番idへ昇格しない。アプリからPython、任意URL/import、
外部AI fallbackを使う入口も追加しない。モデル準備はメンテナーの明示操作だけで行う。

根拠: [Apple Qwen3 recipe](https://github.com/apple/coreai-models/blob/3f109efd54273391f9fd9f5f5b3d8c6e99836d55/models/qwen3/README.md)、
[公式モデル](https://huggingface.co/Qwen/Qwen3-0.6B/tree/c1899de289a04d12100db370d81485cdf75e47ca)、
[Local Assist計画](v2.9-v3-local-assist-plan.md)。
