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
- `coreai-kit` の Gemma 専用実行器 `KitGemmaExecutor` は、`tokenizer.eosTokenId` に加えて
  `arch.endOfTurn`（`<turn|>`）でも停止する。ただし `eosTokenId` が `<turn|>`=106 に解決されている
  ため二つの停止判定が同じ id になり、本文中の `<eos>`=1 を捕まえられない。停止位置が
  `<eos>` の分だけ後ろへずれ、`<eos>` が本文へ漏れる、という説明になる

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

## 2026-09-21 再測定（外部レビュー修正後）

外部レビューの3件（整形の取りこぼし、アイドル解放の既定値、キャッシュ署名）を直したうえで
同じharnessを再実行した。fixtureは18件に増えている（追加指示なしの評価2件を含む）。

| | 機械チェック失敗 | 備考 |
| --- | --- | --- |
| レビュー修正後 | 3 / 18（follow-up×2, quote） | usageに `samplingRequested` / `samplingEffective` が乗る |

`outputTokens` は16で上限2048には達しておらず、**打ち切りではない**。残る `follow-up` / `quote` の
失敗は、`土曜日`→`土曜` のような語の欠落と語尾の崩れで、上に書いた bundle の
`eos_token` 不一致（`<turn|>` vs `<eos>`=id 1）と coreai-kit の停止処理に起因するとみている。
つまり**アプリ側ハーネスの改善では消えない残件**で、次の検証は bundle 側の EOS 設定を
直した版での再測定になる。`quote` は今回のfixture追加後に落ち始めたので、同じ語尾崩れの
別現れ方かどうかを切り分けたい。

### 2回目のレビュー対応（キャッシュ署名と境界値）

- **署名の内容化**: 小さい識別ファイル（`hazakura-model.json`、`hazakura-resource-manifest.json`、
  `<model>.aimodel/main.hash`、`tokenizer_config.json`、`chat_template.jinja`）は
  **内容のSHA-256**を署名に使う。同サイズ・同一秒の差し替えでも署名が変わる
  （回帰テストで固定）。巨大な重み・PLEテーブルは、検証済み manifest が全ファイルの
  SHA-256 を持つので、**manifest 自身の内容ハッシュ**で同定し、要求ごとに数十GBを読まない。
  あわせて大型ファイルは size+mtime を補助信号として残す。必須入力が読めない場合は署名 `nil`
  （キャッシュを使わず再ロード）
- **アイドル値の境界**: `UInt64` のナノ秒へ変換できない大きさ（例 `1e100`）は既定300秒へ戻す。
  `1e-999` / `-1e-999` のようなアンダーフローは「明示的な0」と区別し、無期限にしない。
  無期限はリテラルの `0` / `0.0` / `+0.00` のみ
- 実payload（stage済みE4B）で署名が計算されること（キャッシュ無効ログが出ないこと）を確認

### 次の検証（EOS設定の比較）

レビュー提案どおり、順序は **署名修正 → ローカルEOS比較 → payload確定 → build 146 実機確認**。
EOS比較では、bundle の `tokenizer_config.json` の `eos_token` を `<eos>`（または
`eos_token_id: 1`）に直した版を作り、同じ fixture・同じ生成条件で
**整形前の生出力と整形後の候補を分けて**比較する。3/18 の残件は未解決のまま扱う。

## 2026-09-21 追補 — 配線の作り込み（実測は Metal 制約で未完）

外部レビューの指摘に沿って、モデルへ渡す設定・指示・復元の配線を直した。
**この追補は source と unit test の証跡で、E4B の実生成による再測定はできていない**
（下の「この環境で実測できない理由」を参照）。

### 変更したもの

- **操作別の基本指示を追加要望から分離した**（`AssistPrompt.swift`）。
  追加要望があると action 別テンプレートが丸ごと落ちていた。いまは
  「基本操作」「変更の範囲（変えてよい／変えない）」「追加のご要望」を別項目として渡す。
  保持規則は action ごとに違えている（校正は引用・表・コードを厳守、要約は構成の組み替えを許可）。
  System 経路も同じ `AssistPrompt.buildLive` を使う。
- **要求した設定と実効設定を別々に記録する**（`CoreAIGenerationProfile.swift`）。
  pinned `coreai-kit` の実行器は `GenerationOptions.temperature` だけを
  `SamplingConfiguration` へ写し、`samplingMode`（top-k / top-p）は読まない。
  そのため Hazakura は top-k / top-p を要求せず（要求した場合は「エンジンが捨てた」と記録する）、
  usage に `samplingRequested` / `samplingEffective` を出す。
  `temperature` は production で 2048 上限・greedy のまま（優劣の実測がまだ無いため）。
- **停止トークンの漏れを外側だけ除去する**（`CandidateFormatting.stripOuterControlTokens`）。
  本文中の言及は残し、先頭・末尾の制御トークンだけを落とす。原文の語尾崩れは直らない。
- **ロード済みモデルを helper 内で再利用する**（`CoreAIRuntime.ProductionModelCache`）。
  従来は 1 リクエストごとに PLE テーブル 5.4 GB の確保と engine 構築をしていた。
  単一スロットを model id + 資源パス + サイズ/mtime の署名で保持し、セッションは毎回新しくする。
  helper 終了（キャンセル・timeout・アプリ終了）、別モデル/別資源、アイドル
  （既定 300 秒、`HAZAKURA_CORE_AI_IDLE_RELEASE_SECONDS` で変更可）で解放する。
- **評価ハーネスを強化**: `noControlTokens` を独立チェックとして追加し、
  追加指示なしの fixture を 3 件足した（従来は全 fixture が `request` を持ち、
  action 別テンプレートの分岐を通っていなかった）。`report.fixtureCoverage` に内訳を出し、
  warm の定義（同じ helper でロード済みモデルを再利用）も書き直した。

### この環境で実測できない理由

Codex の実行環境は seatbelt で GPU を渡さないため、production helper は
`CoreAIKit.KitGemmaError.noMetalDevice` で load に失敗する。`swift build`（distribution flavor）と
`swift test` は通り、`noMetalDevice` を除けば再現しない。**秒数・品質の before/after は
オーナーの通常 shell で `scripts/evaluate-local-assist.mjs` を回して確定する**（下のコマンド）。
モデル再利用の効果は「ロード時間」と「最初のトークンまで」を分けて記録すること。

```bash
node scripts/evaluate-local-assist.mjs \
  --helper binaries/hazakura-core-ai-helper-aarch64-apple-darwin \
  --backend core_ai --model-id apple:core-ai:gemma-4-e4b-it-int4-v1 \
  --model-path .hazakura/coreai-production/gemma4-e4b/2026.09.20.1/stage/CoreAIModels/gemma-4-e4b-it-int4-v1 \
  --output /tmp/e4b-report.json --repeats 3
```

### まだ残る候補

1. bundle の `tokenizer_config.json` の `eos_token` を `<eos>`（または `eos_token_id: 1`）へ直した
   変換物で語尾の崩れと `<eos>` 漏れが消えるかを確認する（lock と再現手順の更新が必要）。
2. 上流（coreai-kit / 変換リポジトリ）へ、`samplingMode` が `SamplingConfiguration` に
   反映されない点と `eos_token` 解決を報告する。
3. 文脈予算（4096）の管理: 入力トークン + 出力上限 + 余裕を tokenizer で数え、
   校正は原文と同程度、要約は小さめにする。長い選択は段落・節単位に分ける。
4. 設定画面での可視化（実効設定の表示）は、この記録を正本にした次のスライス。
