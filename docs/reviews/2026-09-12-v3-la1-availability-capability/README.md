# LA-1a — Systemの利用可否と生成能力の分離

Status: Review record
Scope: Local Assist v3共通基盤の第一スライス（Swift helperの契約）
Date: 2026-09-12
Reviewed source: `78b14b08`（コード実装。本資料は後続の資料コミット）

## 結論

v3.0の共通基盤の入口として、Systemの「利用可否（availability）」と「生成能力（capability）」を
分離する契約をhelperに実装した。**四態probeのwire・文言・製品経路（`system_default`）は不変**。

今回の実装は1点に絞った。**生成前ゲートが四態probeの文字列を経由していた**ため、locale（生成能力）の
失敗が `unavailable` に混線していた（既存の `unsupported_language` 分岐は、probeが先にlocaleを
折り込むため実質到達不能だった）。ゲートをドメイン値の直接合成（`AssistRuntimeContract`）へ変え、
能力失敗は `unsupported_language`、利用可否失敗は `unavailable` に分類する。
**メッセージ文言は変更しない**（TSは `src/lib/appleAssist/errors.ts` でメッセージから分類するため）。

優先候補のもう一方（request対応の予算観測・生成元の伝播）は採用しなかった。入力側の観測
（instructions / prompt tokens / contextSize）・modelId・latencyの伝播は既に足りており、
**出力tokenの計測APIとrevision情報は26.5 SDKに存在しない**（下記「前提」）。推測で契約に足すより、
27 SDK導入時に実宣言を確認して足すのが正しい順序と判断した。評価用原稿とharnessは既存のまま使える。

## 前提（環境とSDK）

- 実施環境: macOS 26.6.2 / Xcode 26.6 / SDK 26.5 / arm64。**27 SDK・27環境は無い**。
- SDK宣言を実物で確認: `SystemLanguageModel.availability` / `supportsLocale()`（26.0+）、
  `tokenCount(for:)`（26.4+）、`contextSize`（26.4未満はback-deployedの定数 `4096`）、
  `LanguageModelSession.Response` に `usage` は無い（27の表示例とは別物）。revision系APIは無い。
- 擬似コード・モデル世代名・context sizeをAPI契約にしていない。使ったのはSDKの実宣言のみ。
  27固有の適合確認（`LanguageModel` 抽象 / `usage`）は**未実施のまま**残す。

## 変わったこと / 変わらないこと

実装（コードコミット `78b14b08`）:

| ファイル | 変更 |
|---|---|
| `AssistRuntimeContract.swift`（新規） | 利用可否（4状態）・生成能力（locale）・両者の合成（probe wire / 生成ゲート）を fixture/live 共通の純関数として定義。文言は `AssistRuntimeMessages` に集約 |
| `AvailabilityProbe.swift` | 四態wireの応答は同一。合成を契約へ委譲（fixtureも契約経由に） |
| `SystemAssistRuntime.swift` | `SystemLanguageModel` の読み出しを `status(for:)` の1箇所へ。ゲートは契約へ委譲。26未満は能力を**不明（nil）**として扱い、推測しない |
| `GenerateCandidate.swift` | 26未満フォールバックの文言を定数参照へ（挙動不変） |
| `AssistRuntimeContractTests.swift`（新規） | 契約11件: wire維持（locale先行含む）・分類の分離・不明時のフォールバック・文言固定・fixture probe |

不変（回帰としてテスト・ビルド・既存Rust回帰で確認）:

- 四態wire（available / disabled / unsupported / unavailable + reason）と順序（locale先行）
- 文言。`unsupported_language` はSDKエラー畳み込み（`unsupportedLanguageOrLocale`）と同一kind
- D17（tokenCountは観測専用、強制上限なし）・D20（TSからbackend/path/URLを送らない）・
  D24（System専用probeのまま。選択backend probeとcomposer接続はC-2）・D26（taxonomy）・
  D27（partialは別窓のみ）
- 文字数cap（4000/8000/1000）・sanitize・Apply/Undo/自動保存なし・配布レーン条件

## 検証（実行したものだけ）

| 検証 | 結果 |
|---|---|
| `swift test --package-path src-helpers/apple-assist` | **16件成功**（新規11含む。debug=fixture） |
| `npm run build:apple-assist-helper:live` | 成功。arm64 / x86_64 / universal。live probe smoke = `available` |
| live生成スモーク（自作文字列2件を直接投入） | ゲート通過→応答（rephrase 743ms / proofread 566ms、`modelId` 付き）。proofreadの生応答1件に既知の予約区切り文字の混入（sanitize前の確率的挙動。プロンプト・整形は本スライスで未変更） |
| `npm run build:apple-assist-helper:fixture` | 成功（JSON smoke含む） |
| `cargo test`（fixture helperを注入） | **385 passed / 2 ignored**。supervisorのfixture往復（probe / generate / 取消回帰）を含む |
| `cargo fmt --check` | 成功（Rustは無変更） |
| `git diff --check` | 成功 |
| フロント | 未変更（typecheck / test / build / App Store surface は未実行）。TSの分類テストが参照する文言は不変 |

未実施: 27 SDKによるコンパイル・照合、27固有API（`usage` / `LanguageModel`）、実モデルでの27品質、
native実機（別窓の表示・IME・VoiceOver）、x86_64実機での実モデル利用、ピークメモリ。

## 27環境に残る確認

1. 27 SDKで `usage` / `LanguageModel` 抽象 / capability関連の**実宣言**をApple公式資料と照合し、
   本契約の読み出し（`SystemAssistRuntime.status`）がそのまま成立するかをコンパイルで確認する。
2. `SystemLanguageModel` の availability / supportsLocale / tokenCount / contextSize の27での値を確認。
3. 27 Systemの日本語評価（下記LA-1b）。実環境が無い間は「未確認」として残す。

## 次のスライス

- **LA-1b: 27環境でのSystem評価**。既存harness（`scripts/fixtures/local-assist-evaluation.json` /
  `scripts/evaluate-local-assist.mjs` / `scripts/local-assist-evaluation-checks.mjs`）を再利用し、
  v2.9基準と比較する。**実測前に合格基準を確定して固定**する（下記は案）。
- **LA-1c: 27 SDKでの `LanguageModel` 抽象の小検証**（SDKを導入できる環境で。適合しない場合は
  現行free-textを維持し、利点のない型消去・汎用provider層は作らない）。
- 予算観測の拡張（出力token / revision）は27 SDKの実宣言を確認したあとのスライスに置く。

### LA-1bの合格基準（案 — 実測前に確定して固定する）

- 自作原稿のみ使用（利用者の原稿・ログを収集しない）。原稿・依頼はv2.9評価と同一のものを使う。
- 校正 / 言い換え / 追加指示の各系統で、空応答・拒否・上限超過は**失敗**として記録し成功と混ぜない。
  完成案は4,000コードポイント以内。数字・引用・リンク・コード・見出し/表の構造保持を機械検査し、
  不一致は「要レビュー」として記録（意味保持は人間が確認）。
- 初回応答時間・完了時間、cold / warm、停止後の再開を分けて記録。v2.9基準
  （`docs/reviews/2026-09-08-v2.9-local-assist.md` の実測値）との比較表を作る。
- 実行環境（OS / SDK / arch / commit / helper SHA-256）とhelperの対応をレポートに記録する。
- 取消はhelper直接killのまま（native取消の合格証拠に流用しない）。
- 合格 = 全系統が成功し、構造保持の機械検査を通過すること。1件でも失敗した場合は内容を分類し、
  採用判断のスライスへ回す。

## 仕様判断が必要な点

1. **LA-1bの合格基準（上記案）**の内容と、失敗時の扱いの確定（実測前に固定が必要）。
2. locale失敗（`unsupported_language`）のサイドバー案内は現行の一般文言のまま。理由別の文言を出すかは
   利用者に見える差があるため、別スライスで判断したい（今回は文言不変）。
3. `capability` の拡張（token観測・guided生成など）をどの版の契約へ入れるか（予算 / G-1のスライス）。

## 再実行

```bash
swift test --package-path src-helpers/apple-assist
npm run build:apple-assist-helper:fixture
npm run build:apple-assist-helper:live
HAZAKURA_APPLE_ASSIST_HELPER_FIXTURE="$PWD/binaries/hazakura-local-assist-helper-aarch64-apple-darwin" \
  cargo test --manifest-path src-tauri/Cargo.toml
```

`binaries/` は追跡外。fixtureビルドはhost archの `-aarch64-apple-darwin` を上書きする（既存挙動）。
liveのuniversalバイナリは別名で残る。

## 参照

- 依頼: `docs/reviews/2026-09-12-v3-local-assist-request.md`
- 正本: `docs/v2.9-v3-local-assist-plan.md` / `docs/v3-local-assist-ownership.md` /
  `docs/core-ai-c0-design.md`（D17 / D20 / D24 / D26 / D27）
- v2.9評価: `docs/reviews/2026-09-08-v2.9-local-assist.md`
