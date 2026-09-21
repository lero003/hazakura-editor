# Core AI 編集品質（ハーネス）調査メモ

Status: Investigation（原因候補と検証計画。結論は未確定）
Scope: Apple-hosted E4B / 12B を Hazakura の Local Assist 経路で使ったときの出力品質
Authority: Medium（実装状況の記述は source 準拠。原因は仮説）
Last reviewed: 2026-09-21

16 GB MacBook Air（M5）で DL・load・生成は通ったが、編集結果が崩れるという報告への整理。
**モデル能力そのものより、Developer テスト用のハーネスをそのまま本番へ使っている点を先に疑う。**

## 現状のハーネス（source 準拠）

| 項目 | いまの値 | 場所 |
| --- | --- | --- |
| プロンプト | `CoreAITestPrompt.build`（Qwen fixture 向け compact prompt、`/no_think` 付き） | `CoreAITestPrompt.swift` |
| 生成オプション | `samplingMode: .greedy`, `temperature: 0`, `maximumResponseTokens: 128` | `GenerateCandidate.swift` `coreAITestOptions()` |
| instructions | `liveSystemInstructions`（System 経路と共通） | `GenerateCandidate.swift` |
| 後処理 | `CandidateFormatting.reviewText`（` ```markdown ` フェンス除去のみ） | `CandidateFormatting.swift` |
| runtime | `KitGemmaModel`（E4B PLE）/ `KitLanguageModel`（12B） | `CoreAITestRuntime.swift` |
| usage | System 経路は `AppleAssistUsage` を返す。**Core AI 経路は未設定** | `Response.swift` |

`CoreAITestPrompt` のコメント自身が「tiny Qwen fixture 用に compact な prompt を与える」と述べており、
**本番の E4B 経路も同じ関数と同じオプションを使っている**（`runCoreAIModel` は
`COREAI_TEST_BACKEND || COREAI_PRODUCT_BACKEND` の共通実装）。テスト都合の設定が本番品質を
決めている状態で、これが「普通の会話はできるのに編集が崩れる」の第一候補。

## 原因候補（優先度順）

1. **`maximumResponseTokens = 128` による打ち切り（最有力）**
   日本語では概ね 100〜200 文字。段落の書き換えは容易に超えるため、途中で切れた「おかしな編集」に
   なる。System 経路は options を渡しておらず Foundation Models の既定に任せているのに、
   Core AI だけ 128 に固定している。
2. **greedy / temperature 0 のサンプリング**
   Gemma 系はサンプリング前提で学習されており、greedy は反復・コピー・破綻を招きやすい。
   テストの決定性のために入れた設定が本番にも効いている。
3. **Qwen 用プロンプトの流用**
   `/no_think` は Gemma 4 には意味がなく、出力契約（本文だけ／説明なし）も最小限。
   本番用 prompt を分離し、編集契約と文脈の区切りを明示したい。
4. **`documentContext` の扱い**
   「参考文脈（書き換えない）」として本文の前に置くため、長い文書では 4k 文脈を圧迫し、
   モデルが文脈側を書き換え始める余地がある。
5. **選択範囲の粒度**
   段落単位なら 4B でも実用域、文書全体を一度に書き換えさせると崩れる。分割処理か、
   選択が大きいときの明示が要る。
6. **量子化（int4 + PLE）の品質上限**
   能力の天井はある。ただし「普通の会話はできる」なら、まず 1〜5 を潰すのが先。

## 検証計画（安い順）

1. **usage の可視化**: Core AI 経路でも `AppleAssistUsage` を埋める。出力トークンが 128 で
   止まっていれば 1 が確定する（最小の変更で最大の情報）。
2. **上限の A/B**: `maximumResponseTokens` を 128 → 512 / 1024 にして同じ fixture を比較。
3. **サンプリングの A/B**: greedy → `temperature 0.7 / topP 0.95 / topK 64`。
4. **プロンプト分離**: 本番用 prompt を作り、`/no_think` を外し、契約と区切りを明示。
5. **長文の分割**: 段落単位の逐次編集と、その結合規則。
6. **モデル比較**: 同じ fixture で E4B / 12B / System を並べ、ハーネス起因かモデル起因かを切り分ける。

測定は既存の live 評価ハーネスを使う。

```bash
node scripts/evaluate-local-assist.mjs --helper <helper-path> --output <report.json> --repeats 3
```

13 個の authored fixture に対して、数値・URL・コード・引用・表の保持、4000 文字上限、
内部マーカー非混入を機械的に確認する。**意味的な良し悪しは人間のレビューが必要**で、
この harness が見るのは「壊れていないか」。Core AI を測るには payload を
`backend: "core_ai"` + `modelId: "apple:core-ai:gemma-4-e4b-it-int4-v1"` + materialize 済みの
`modelPath` にする必要があり、いまの script は `backend: "system_default"` 固定なので
`--backend` / `--model-path` の追加が要る。

## 次にやるなら

`maximumResponseTokens` と sampling を本番経路だけ分離して A/B するのが最短。
テスト経路の決定性は `coreAITestOptions()` を test backend 専用に残して維持する。

## 2026-09-21 実測（E4B 実モデル・ローカル）

stage 済みの E4B を本番 helper に読ませ、`scripts/evaluate-local-assist.mjs` を
`--backend core_ai --model-id apple:core-ai:gemma-4-e4b-it-int4-v1 --model-path <stage>`
で実行した（13 fixtures + cancel probe）。この評価スクリプトは Core AI を測れるよう
`--backend` / `--model-id` / `--model-path` を受け取るようにした。

変更したのは **プロンプト（`buildLivePrompt` を本番経路でも使う）・上限（128 → 2048）・
usage の記録**。sampling は greedy のまま。

| | 機械チェック失敗 | usage | 1回あたり |
| --- | --- | --- | --- |
| 変更前 | 5 / 15（shorten, follow-up×2, quote, proofread-names-quote） | 未記録 | 約 4.7〜6.0 s |
| 変更後 | 2 / 15（follow-up×2 のみ） | promptTokens / outputTokens / cachedTokens / maximumResponseTokens | 約 6.0〜7.2 s |

`outputTokens` は 16〜29 で上限 2048 には遠く、**打ち切りは起きていなかった**。内容保持の失敗は
プロンプト契約（リンク・コード・引用・固有名詞を保つ指示と action 別テンプレート）で解消した。

### 残った崩れはランタイム側の疑いが濃い

`follow-up` fixture の実出力:

```txt
pass1: "新しい展示は土曜から始まるよるよ。雨の日も開館してるから、ぜひ来てねいで。"
pass2: "新しい展示は土曜から。雨の日も開館してるよいで。"
sampling 変更時: "新しい展示は土曜からだよ。…ぜひ来てねいで。<eos>"
```

- `土曜日` が `土曜` に落ち、語尾に `よるよ` / `ねいで` のような断片が付く
- sampling（top-k 64 / temperature 0.7）に変えても消えず、逆に **`<eos>` が本文へ漏れた**
- 変換済み bundle の `decoder/tokenizer/tokenizer_config.json` は `"eos_token": "<turn|>"` で、
  `eos_token_id` を持たない。実際の語彙では `<eos>` は id 1、`<turn|>` は id 106
  （`<|turn>` 105、`<|channel>` 100 なども存在）
- `coreai-kit` の `KitExecutor` は `tokenizer.eosTokenId` と一致した時点で生成を止める実装なので、
  EOS の同定がずれると停止位置と本文末尾がずれる

したがって残りの崩れは、**アプリ側のプロンプトやサンプリングではなく、変換 bundle の
tokenizer 設定と coreai-kit の停止処理の組み合わせ**を疑うのが妥当。sampling は
決定性を優先して greedy に戻した（優劣の証拠が無かったため）。

次の候補:

1. `tokenizer_config.json` の `eos_token` を `<eos>`（または `eos_token_id: 1`）に直した bundle で
   同じ fixture を再実行し、語尾の崩れと `<eos>` 漏れが消えるか確認する。
   **lock は変換物のファイル digest を固定しているので、bundle を書き換えるなら lock と
   再現手順の更新が必要**（書き換えは「上流の再現」ではなくなるため、記録の扱いを決める）。
2. 上流（coreai-kit / 変換リポジトリ）へ報告し、修正版 revision を再 pin する。
3. 暫定緩和として、`CandidateFormatting` で末尾の特殊トークン（`<eos>` 等）を落とす。
   語尾の崩れまでは直らないため、あくまで応急処置。
