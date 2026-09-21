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
