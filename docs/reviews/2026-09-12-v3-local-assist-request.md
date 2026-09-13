# 別エージェントへの依頼文 — v3 Local Assist / macOS 27

Status: Task brief
Scope: 既存計画に沿った実装依頼。新しい製品仕様の採用・実装完了を示すものではない
Date: 2026-09-12

以下を依頼先に渡してください。

---

Hazakura Editorのv3に向け、Local AssistのSystem共通基盤とmacOS 27対応を進めてください。
計画の提示だけで終わらず、現状とSDKを確認して、検証可能な最初のスライスを実装・検証してください。

## 目指す体験

日本語の校正・言い換え・追加指示について、原文の情報やMarkdownを保った提案を得られ、
途中で停止しても安全に次の依頼へ進めること。会話で案を整え、本体のDiffで確認し、
明示的に反映してUndoできる現在の体験を、新しいSystemモデルでも維持・改善します。
「OS 27のAPIを呼べた」だけで完成にせず、生成品質・遅延・停止・復旧を評価します。

版ごとの範囲は既決です。

- **v3.0:** AFM / Systemの改善、生成・停止・可用性・能力・予算観測・生成元の共通基盤。
- **v3.1:** allowlistされたモデルの明示DL・検証・管理・削除・利用選択、Core AIの本番接続。

今回はv3.0が対象です。Core AIモデルの選定、DL画面、資産の本番ロード、selectedIdの
書き込み、MLX導入は含めません。未選定モデルを理由にSystem側の作業を止めないでください。

## 着手時に確認すること

AGENTS.mdの順序でgit statusと正本を読み、実装前にHazakura Habitatを実行してください。
追加の正本は次のとおりです。

- `docs/v3-product-completion-plan.md`
- `docs/v2.9-v3-local-assist-plan.md`
- `docs/v3-local-assist-ownership.md`（LA-0の棚卸しは既存。必要な差分だけ更新）
- `docs/core-ai-c0-design.md`（版別更新を優先。D17・D20・D24・D27などの境界）
- `docs/assist-surface-strategy.md` / `docs/security-boundary.md`
- `docs/app-store-build.md`
- `docs/reviews/2026-09-08-v2.9-local-assist.md`

依頼文作成時点の作業ブランチは `codex/v3`。UIと日常操作の未コミット調整、および
ユーザー所有の `src-tauri/tauri.conf.appstore.json` 差分があります。着手時の状態を正本にし、
既存差分を戻したり混ぜてコミットしたりしないでください。UI再設計とruntime変更を混ぜません。

2026-09-12の確認では、選択中のXcodeは26.6、SDKは26.5、OSは26.6.2でした。
27環境の別途インストール有無は未確認です。担当環境でXcode/SDK/OS/architectureを再確認し、
27固有APIの名前・availability・導入条件をApple公式資料と実SDKの宣言で照合してください。
設計文書の擬似コードやモデル世代名・context sizeを、そのままAPI契約にしないでください。
SDKがなければ未検証の27専用コードを完成品として入れず、26で検証可能な共通基盤と
27検証の手順・未解決条件を完成させます。SDK導入やシステム全体のXcode切替は行いません。

## 進め方

1. **既存実装との差分を特定する。**
   `src-helpers/apple-assist/Sources/HazakuraAppleAssist/` の `AssistBackend.swift`、
   `SystemAssistRuntime.swift`、`GenerateCandidate.swift`、`AvailabilityProbe.swift`、
   `Request.swift`、`Response.swift` を入口に、Rust supervisorとTS側まで追ってください。
   System専用runtime、modelId、任意のusage観測、評価用原稿は既に存在します。
   作り直さず、v3計画に不足する契約と回帰条件を短く示してください。

2. **最初の1スライスを実装する。**
   LA-1の入口として、Systemで実証できる最小の共通契約を選びます。
   優先候補は「利用可否と能力の分離」または「requestに対応した予算観測・生成元の伝播」。
   足りている部分は変更せず、実際の不足とテストから選んでください。
   27 SDKが利用可能なら `LanguageModel` 抽象との適合を小さく検証しますが、
   利点のない型消去や汎用provider層は作りません。製品経路は `system_default` のみです。
   旧応答のdecode互換、取得できない情報の不明扱い、26向けのビルドを保ってください。
   第一スライスをテスト・必要な文書更新まで閉じ、残りは次の具体的な依頼単位に分けます。

3. **27環境でのSystem評価を続くスライスとして準備する。**
   同じ自作原稿・依頼を用い、v2.9基準と27 Systemを比較できるようにします。
   `scripts/fixtures/local-assist-evaluation.json`、`scripts/evaluate-local-assist.mjs`、
   `scripts/local-assist-evaluation-checks.mjs` を流用してください。
   校正、言い換え、追加指示、数字・固有名詞・引用・リンク・Markdown構造の保持、
   不要な加筆、空応答・拒否・長さ超過を評価します。実測前に合格基準を記録してください。
   初回応答・完了時間、cold/warm、停止後の再開を分け、実行環境とhelperの対応を記録します。
   実モデル評価は自作fixtureのみを用い、ユーザーの原稿やログを収集しません。
   既存harnessの取消はhelperへの直接killです。本体のnative取消の合格証拠に流用しないでください。
   OS 27で生成できる環境がなければ、比較結果は未確認として残します。

4. **品質を上げる変更は評価を見て採否を決める。**
   prompt調整やguided generationは、原文保持と日本語品質を改善する根拠があれば別スライスで採用。
   構造化出力のためだけのJSON文字列parserは増やしません。sanitizeで本文が変わった場合は
   モデルの説明をそのまま使わず、最終Diffからの説明を優先する既存方針を守ります。

## 必ず保持する契約

- Markdown sourceが正本。案は明示Diff確認→Apply→未保存bufferへ1回→Undo。自動保存なし。
- 対象のsession/path/range/originalを再検証し、別タブや別文書へ黙って対象を移さない。
- requestIdをworker開始前に予約し、生成・native停止・cleanup完了まで `cancelling` を保持。
  遅いpartial/terminalを無視し、完了が先に勝ったhelperを遅いcancelで破壊しない。
- partialは別窓、完成した提案だけmainのstoreへ。失敗・取消後の有効な前案を保つ。
- 既存System専用probeの四態wireを維持。共通能力と将来backend選択の製品接続を混同しない。
- 案の生成元はそのrequestの実情報。後の設定で過去の案を再ラベルしない。
- D17のtokenCountは観測用。4K/8K等を決め打ちせず、新しい強制予算上限を追加しない。
  現行の文字数・完成案上限も無断で変えず、長い出力を黙って切り捨てない。
- TS generateへbackend・model path・URLを渡す口を追加しない。未知backendは呼出前に拒否。
- PCCを含むクラウドfallback、外部AI、tool calling、画像入力、Spotlight/RAG、背景index、
  会話の永続化、汎用チャット、CLI/Pythonを製品生成経路へ追加しない。
- macOS 26のSystem経路と非対応環境の通常編集を保持。arm64/x86_64、App Store/Developerの
  既存ビルド・露出条件を壊さない。x86_64での実モデル利用を前提にしない。

## 検証と納品

バグ・境界の修正は可能なら失敗テストを先行し、触った層に応じて以下を確認してください。

- フロント: `npm run typecheck`、`npm test`、`npm run build:vite`、`npm run smoke:app-store-surface`。
- Rust: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` と
  `cargo test --manifest-path src-tauri/Cargo.toml`。取消とhelper再利用の既存回帰も確認。
- Swift helper: 既存Packageのテスト、fixture/liveを区別したビルド。
  `npm run build:apple-assist-helper:live` のarm64・x86_64・universal条件を確認。
  `swift test` のdebugはFIXTURE_MODEになるため、live APIのコンパイル証拠とは分ける。
- 実機: System成功系、途中停止→再依頼、前案保持、別窓→Diff→単回反映→Undo。
  26/27・旧OS起動・IME等の未実施条件を明示し、fixture/probe成功と混同しない。
- 常時: `git diff --check`。必要な範囲のcurrent-work/current-status/handoffと設計を更新。

納品は、①採用した第一スライスと変更、②実行済みの検証と証拠、③27環境に残る確認、
④次の小さなスライス、⑤仕様判断が必要な点を、日本語で簡潔にまとめてください。
未確認のモデル品質や配布状態を完了と書かず、無関係な差分のcommit・push・merge・公開は行いません。

## 参照するApple公式資料

2026-09-12に公式の新モデル・共通抽象の説明を確認。実装時には対象SDKでも再確認してください。

- [Foundation Modelsの更新とLanguageModel抽象](https://developer.apple.com/videos/play/wwdc2026/241/)
- [SystemLanguageModel](https://developer.apple.com/documentation/foundationmodels/systemlanguagemodel)
- [Core AIによるオンデバイスモデル統合（v3.1側の参考）](https://developer.apple.com/videos/play/wwdc2026/326/)
