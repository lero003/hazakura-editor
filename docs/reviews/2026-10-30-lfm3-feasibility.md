# LFM3-1.7B の互換性確認

Status: 調査・GGUF単体44回の生成試験完了。Core AI変換・アプリ内生成は未実施
Scope: Local Assist / Core AI のローカルモデル経路。製品機能の追加・採用判断ではない
Last reviewed: 2026-10-30

## 現時点の結論

LFM3-1.7B の post-trained 版は評価対象になるが、公式の GGUF / MLX / PyTorch 配布物を
現在の Hazakura にそのまま登録して利用することはできない。今回確認した公開一次情報では、
**テキスト版 1.7B の Core AI LanguageBundle / exporter は見つからなかった**。
GGUF の単体生成は成功したが、現行 Hazakura のプロンプト・出力契約への適合は不合格。
**現状のまま Local Assist に採用しない**。Core AI の実モデルロード・速度・メモリ、
署名済みアプリ内の操作は未検証。

## GGUF の生成品質と速度

オーナー承認後、検証フォルダへ公式 llama.cpp の配布ビルドを展開し、公式 `Q4_K_M` を取得した。
双方の SHA-256 を配布元 metadata と照合。アプリの依存とグローバル環境は変更していない。

| 固定入力 | 値 |
|---|---|
| モデル | `LiquidAI/LFM3-1.7B-GGUF` / `bad5729bba61d076fff20d2548e62526665af215` |
| ファイル | `LFM3-1.7B-Q4_K_M.gguf` / 1,099,627,808 bytes |
| モデル SHA-256 | `3793e1e6e2266919d6e015287221b41100175a98eddaba92e111aed3b05c93c4` |
| runtime | llama.cpp `b11960` / `8642541b255bfb5dc39cd351a178be09013a55d6` |
| runtime archive SHA-256 | `58e5a5e1d7c2bf66cedd9c29e0323f3e570660a70a1e2156d32eed08f4cc1e3c` |
| chat template | 通常版 `ac2586a34f1a1c03329dbdcdefabd8b6478ddaa7` の公式 Jinja |
| 共通設定 | context 8,192 / max output 2,048 / GPU layers 99 / seed 42 |

既存品質 fixture 6 件と追加の合成入力 5 件を使用。現行の `AssistPrompt`、system instructions、
`CandidateFormatting`、`ProofreadCandidateProtection` を独立 executable で再利用した。
公式 Jinja は既存の Transformers で描画し、CLI の会話モードを無効にして渡した。
短いプロンプトの追加試験だけは既存 Developer Qwen fixture 用 `CoreAITestPrompt` を使用。

| 設定（各11件） | 校正の完全一致 / 対象8件 | 最終回答あり | 内部マーカー混入 | wall中央値 |
|---|---:|---:|---:|---:|
| 現行prompt・greedy・既定の思考あり | 4/8 | 6/11 | 0/11 | 6.587秒 |
| 現行prompt・greedy・思考なし | 3/8 | 11/11 | 6/11 | 0.500秒 |
| 現行prompt・推奨sampling・思考なし | 3/8 | 11/11 | 5/11 | 0.502秒 |
| 短いprompt・推奨sampling・思考なし | 2/8 | 11/11 | 0/11 | 0.453秒 |

推奨 sampling は temperature 0.1 / top-k 50 / repetition penalty 1.1。
top-p 1 / min-p 0、反復penaltyの参照範囲は8,192 tokens。
greedy は temperature 0 / repetition penalty 1。
上表の完全一致は、最終回答を思考から分離し既存formatterを通した結果である。
原文への数値保護フォールバックはモデル成功に数えていない。単一seed・小規模な合成入力であり、
LFM3一般の能力や量子化方式全体の優劣を示す評価ではない。
マーカー混入の分母11件には最終回答のない試行も含む。思考ありの0件を出力品質の合格とは扱わない。

主な失敗:

- 思考あり5件は出力上限までに最終回答へ到達しない（eval 2,047 runs＋最初の生成token）。
- 正しい「桜」等へ `HAZAKURA_TEXT_END` を付ける。壊れたmarker断片は既存formatterでも残る。
- 「今日は良い天気でず」を修正しない、または「今日は良い天気で。」等へ誤修正する。
- 現行promptの思考なしでは、要約を頼んでも原文一段落を返す。引用やコードの保持だけでは合格にしない。
- 短いpromptではmarker混入が消えた一方、引用消失、参考文脈の混入、コード内文字列の変更、
  漢数字の数字化、説明の付加が発生。promptを短くするだけでは受け入れられない。

GGUF decode は設定別中央値 **251〜255 tokens/s**、各試行の peak RSS は最大 **1,319 MiB**。
wall はプロセス起動・モデルロード・prompt処理・生成を含む。モデルファイルはOS cacheが温まった状態で、
各試行は独立プロセス。8K context設定の短文入力であり、長文・256K・16 GB端末・電力の測定ではない。
**これらは Core AI / Hazakura アプリ全体の性能値ではない。** Gemmaとの同条件比較も未実施。

## 思考タグの接続上の問題

公式テンプレートの既定の生成prefixは `<think>` で終わる。
現pinの `StreamingTagParser` は新規生成された opening tag からしか思考区間を開始しないため、
prefixで消費済みのtagを考慮せず、その後の思考を response として流す。
合成入力で再現し、さらに実GGUF出力33件を同じparserへ1文字ずつ再生した。
思考あり11件はすべて reasoning として分類された文字数が0で、本文responseが最終回答と一致しなかった。
最終回答に到達した6件では閉じtagもresponseに残った。
Core AI推論の再現ではなく、**現行parserへ同じ出力形式を渡す場合の契約確認**である。
変換時にはtemplateとparserを組にして確認する必要がある。

## 実際に確認したこと

- macOS 27.2 / Xcode 27.1 / Apple M4 Max / 128 GB。既存 llama.cpp の device enumeration は Metal GPU を認識。
- 既存 `mlx-lm` 0.32.2 の `_get_classes` に公式 LFM3 config を渡すと、
  `ValueError: Model type lfm3 not supported.`。**config だけを使ったアーキテクチャ解決の確認**であり、重みのロード試験ではない。
- 既存 Core AI helper の `core_ai_local` probe に、公式 HF config を保存した検証フォルダを渡すと、
  `unavailable` / `The selected Core AI model resource is invalid.`。
  **Core AI metadata / aimodel のない入力を拒否する確認**であり、LFM3 演算の不具合を示すものではない。
- 既存 llama.cpp 0.7.0（build 11669 / `620d2225c`）は実GGUFのロードで
  `unknown model architecture: 'lfm3'` / exit 1。対応版 `b11960` ではロード・44回の生成成功。
- 実GGUFを置いたフォルダも既存Core AI helperで `unavailable` / resource invalid。
  `.aimodel`へ変換されていない入力の期待どおりの拒否であり、Core AI演算の失敗ではない。
- アプリの既存 `AssistPrompt` / `CandidateFormatting` / `ProofreadCandidateProtection` を使う
  独立 Swift executable をコンパイルし、既存品質 fixture 6 件と追加の合成入力 5 件の prompt を生成。
  誤字修正、無変更校正、Markdown / 引用 / 数値の保持、文脈混入、条件・否定、要約を対象とする。
- `git diff --check` 成功。アプリの source、依存、モデル選択設定、配布 catalog は変更していない。

整理後の最終回答・集計・固定条件は Git 管理外の
`.hazakura/coreai-experiments/lfm3-1.7b-2026-10-30/evidence.json` にまとめる。
入力は合成文のみ。既存の江戸彼岸関連の未コミット変更と混ぜない。

## Hazakura 側の対応範囲

`CoreAITestRuntime.makeLocalModel` は、ローカル契約を通った language bundle を
`KitLanguageModel(bundleAt:engineVariant:.pipelined,modelID:)` に渡す。
bare bundle の構造の正本は Rust `core_ai_local_models.rs` と Swift `CoreAILocalResourceContract.swift`。
外側 `metadata.json`（`metadata_version: "0.2"`）、同梱 tokenizer、単一 `.aimodel` 内の
`metadata.json` / `main.hash` / `main.mlirb` が必要。

固定した runtime は `coreai-kit` `bebe09a050c144034c169af2074fda47fb7ba326` と
`coreai-models` `f7a75ec0f89fab451d277572afe8995b7ef768c1`。実 checkout と一致している。
この runtime の `StateHandlerFactory` は既に `kv_cache` / `sliding_cache` / `fixed` を扱う。
recurrent state の巻戻しは全 reset と prefix replay に落とす実装もあるため、
「LFM3 用に Swift の cache を必ず新実装する」とは判断しない。
一方、既存の Python exporter は LFM2 の参考実装のみで、LFM3 はない。
LFM3 の畳み込み状態・SWA・global KV を、この runtime の state 契約に合わせて変換し、
token ごとの数値比較、継続生成、reset、文脈差し替えを検証する必要がある。

## 外部情報の照合

- [通常版](https://huggingface.co/LiquidAI/LFM3-1.7B) と
  [Base](https://huggingface.co/LiquidAI/LFM3-1.7B-Base) は別。
  今回は文章支援を評価するため通常版を対象とする。
- [公式 GGUF](https://huggingface.co/LiquidAI/LFM3-1.7B-GGUF) は配布済み。
  [llama.cpp の LFM3 実装](https://github.com/ggml-org/llama.cpp/blob/master/src/models/lfm3.cpp) も公開されている。
- [公式 MLX](https://huggingface.co/LiquidAI/LFM3-1.7B-MLX-4bit) は重みを公開しているが、
  モデルカードは `mlx-lm` 対応を進行中としている。
- [LFM2.5 の Core AI 移植](https://github.com/john-rocky/coreai-model-zoo/blob/main/models/lfm2.5-2.6b/README.md) は参考になるが、LFM3 の動作証拠ではない。
- [LFM3-Audio-2B の Core AI 配布](https://huggingface.co/FluidInference/lfm3-audio-2b-coreai) は存在する。
  ただし `inputs_embeds` と host-owned state を使う音声用 backbone で、
  [FluidAudio 専用の Swift 契約](https://github.com/FluidInference/FluidAudio/blob/main/Sources/FluidAudio/ASR/LFM3Audio/LFM3AudioCoreAIBackbone.swift) を持つ。
  Hazakura のテキスト LanguageBundle と同一視しない。

## 次の検証

1. 今回は採用を保留。追加投資するなら、モデル別promptと出力分離を合成fixtureで先に受け入れる。
   markerを無差別に消す、原文復帰を成功扱いする、といった結果の補正は避ける。
2. 品質が受け入れられてから、LFM3用exporterとstate契約の数値検証へ進む。
   GGUFの品質・速度を Core AI の結果へ繰り上げない。
3. 配布catalogや製品のGGUF / localhost fallbackは追加しない。

## 検証データの整理方針（2026-10-30）

公開するのはこの評価記録とhandoffのLFM3節。ローカルは `evidence.json` と `README.md` だけを保管対象とする。
`evidence.json` は合成入力11件、4設定44回の最終候補・判定・時間・decode速度・RSS、parser再生結果、
固定revision・SHA-256をまとめたもの。実行コマンド内の個人絶対パスと生の思考出力を除く。
自動会話モードだった初回出力は44回の集計から除外している。

GitHubへのpush後、モデル重み、検証用runtime、配布archive、生成prompt、harnessと実行バイナリ、
raw出力・ログ・初回の除外出力を削除する。再評価には固定条件からの再取得とharnessの再作成が必要。
既存の別のCore AI実験・本番候補には触れない。

候補モデルの再配布・ライセンス受け入れ、署名済み sandbox アプリでの登録・生成・再起動復元、
Diff / Apply / Undo、16 GB 端末や長文・IME での受け入れは未実施。
