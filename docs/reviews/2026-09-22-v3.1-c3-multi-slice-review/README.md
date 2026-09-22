# v3.1 C-3 スライス1〜3 — 外部レビュー資料

Status: Implemented（外部レビュー用 checkpoint）
Scope: local Core AI contract、Custom Models registry、選択・helper実行経路
Review range: `ac4fc79f..HEAD`
Latest implementation commit: `e91f6a3d`

## レビュー対象

C-3 を小分けにした次の実装を、今回はまとめてレビューしてほしい。

1. `652de60f` — Rust の local resource 解決・検証層
2. `a26f4a03` — production / local helper contract の分離、symlink / scan 是正
3. `f35e710f` — `CoreAICustomModels` を既存 registry / UI へ統合
4. `e91f6a3d` — app-managed local model を Rust-owned selection と helper 生成経路へ接続

途中の docs commit も range に含む。比較起点 `ac4fc79f` は PR #52 と C-3 を分離した境界。

## 到達した契約

- 受理する local resource は bare language bundle または Hazakura descriptor 付き bundle。
  Rust / Swift が共通20-case fixture specを読み、同じ構造・symlink規則で検証する。
- Apple-hosted の production contract（signed manifest、固定 identity、licence / notice）は変更しない。
  local contract は構造と identity だけを検証し、licence provenance を推測しない。
- app-managed source は `app_data_dir()/CoreAICustomModels` 直下だけ。別 registry は作らず、
  `CoreAiModelSummary.source = app_managed_local` と stable `errorCode` で既存 UI に載せる。
- Rust は `local:app-managed:<directory-name>` から path を組み立てない。scan から同じ ID の候補を
  探し、検証済み canonical root だけを `core_ai_local` wire で helper へ渡す。
- helper は load 直前に `CoreAILocalResourceContract` を再実行する。local model は production と同じ
  prompt / generation profile / Proposal → Diff → 明示 Apply / Undo 契約を使う。
- selection の保存値は ID のみ。再起動時に候補が消失・破損していれば System へ fail closed し、
  保存値も修復する。生成中の切替拒否と保存失敗時の rollback は既存 store 契約を再利用する。
- local candidate は選択できるが、download / cancel / retry / delete には入れない。
  ユーザー配置ファイルを Hazakura が変更・削除しない。
- cache identity は tokenizer / `main.hash` / descriptor の content digest と、モデル本体 / tables の
  size / mtime を組み合わせる。同一性を確認できない request は cache を使わない。

## 主なレビュー観点

1. scan 結果との exact ID 照合と helper 再検証で、crafted ID、path escape、symlink、選択後の
   bundle 差し替えに対して十分 fail closed になっているか。
2. local contract と Apple-hosted production contract の分離が、公式 bundle の G2 検証や
   licence / notice 条件を弱めていないか。
3. 起動復元、選択永続化、生成中切替、保存失敗 rollback に不整合や deadlock の余地がないか。
4. `core_ai_local` が通常 / streaming / availability のすべてで production prompt/profile と
   正しい runtime loader を使い、Developer fixture や System backend と混線していないか。
5. local cache signature が stale engine / tokenizer を再利用しないために十分か。大きな payload を
   request ごとに hash しない判断に危険な穴がないか。
6. frontend と Rust の両方で local source を Apple-hosted asset lifecycle から隔離できているか。

## 検証

- `npm run typecheck` — success
- `npm test` — 298 files / 2,676 tests、scripts 24 tests success
- `npm run build:vite` — success（既存の chunk size warning あり）
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` — success
- `cargo test --manifest-path src-tauri/Cargo.toml` — 456 passed / 2 ignored
- `swift test --package-path src-helpers/apple-assist` — 59 passed
- `npm run build:apple-assist-helper:distribution` — success
  - live System helper arm64 / x86_64 / universal + probe
  - production Core AI arm64 adapter + x86_64 compatibility + universal sidecar
  - 既存の macOS 27 `LanguageModelSession.GenerationError` deprecation warning 2件あり
- `npm run smoke:app-store-surface` — 10 files / 132 tests success
- `git diff --check` — success

Rust には既存の `probe_apple_assist_availability_with_label` dead-code warning が1件ある。
この range 由来の失敗ではない。

## 未接続 / 非主張

- 外部 resource folder / `.aimodel` の登録・登録解除と security-scoped bookmark
- helper へ外部ディレクトリの sandbox 権限を渡す方式
- Custom Models フォルダを Finder で開く、作成する、明示再スキャンする UI
- 実 local model の load / 生成品質・latency・memory、対象メモリ機での受入
- built app のモデル選択、キーボード、VoiceOver、最大 Dynamic Type
- 署名候補、TestFlight、App Store Connect、公開状態

この checkpoint は **source 上で app-managed local model を既存生成経路へ接続した証跡**であり、
任意の local model が動くことや v3.1 の出荷準備完了を示すものではない。外部レビュー後の次ゲートは、
指摘を閉じてから external local source の bookmark / helper 権限境界を独立して設計・実装すること。
