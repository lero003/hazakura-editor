# v3.1 C-3 スライス2 — Custom Models の registry / UI 統合

Status: Implemented（外部レビュー用 checkpoint）
Scope: app-managed local model の検出を既存の単一 registry とモデル管理ページへ接続する
Implementation commit: `f35e710f`

## 目的

C-3 スライス1で固定した Rust / Swift 共通のローカル契約を、既存の
`CoreAiModelStore` と「オンデバイスモデル」ページへ接続する。Apple-hosted の
download / select / cancel / delete 経路は変更せず、ローカルモデルはこのスライスでは
**検出・表示のみ**とする。

## 実装

- `app_data_dir()/CoreAICustomModels` の直下を `scan_custom_models_directory` で走査する。
- `CoreAiModelSummary` に `source` と frontend 向けの安定した `errorCode` を追加し、
  既存 registry の応答へローカル候補を加える。別 registry は作らない。
- 正常な候補は `app_managed_local / detected`、壊れた候補は
  `app_managed_local / failed` として返す。表示名は descriptor の `displayName`、無い場合は
  ディレクトリ名を使う。
- ローカル ID は `local:app-managed:<directory-name>` に名前空間を分け、Rust 側でも
  select / download / cancel / delete を拒否する。
- frontend は `source` を見て「ローカル」表示と検出状態を出し、Apple-hosted 用の操作を
  出さない。ローカル契約の失敗理由は `errorCode` を日本語 / 英語 / かなで表示する。
- `source` が無い旧 payload は Apple-hosted として扱い、既存表示を維持する。

## Red / Green

先に `CoreAiModelManager.test.tsx` へ次を追加し、未実装状態で2件が失敗することを確認した。

1. 正常なローカル候補に「ローカル」と「検出済み」を表示し、操作ボタンを出さない。
2. `missing-tokenizer` を日本語へ変換し、raw code と再試行ボタンを出さない。

表示文言と `detected` 状態を実装後、対象13件が成功した。

## 検証

- `npm run typecheck` — success
- `npm test` — 298 files / 2,676 tests、scripts 24 tests success
- `npm run build:vite` — success（既存の chunk size warning あり）
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` — success
- `cargo test --manifest-path src-tauri/Cargo.toml` — 455 passed / 2 ignored
- `npm run smoke:app-store-surface` — 10 files / 132 tests success
- `git diff --check` — success

Rust には既存の `probe_apple_assist_availability_with_label` dead-code warning が1件ある。
このスライス由来の失敗ではない。

## 外部レビューで見てほしい点

1. 既存 `CoreAiModelStore` へ `source` を足す形で、Apple-hosted 経路を十分に隔離できているか。
2. `local:app-managed:` prefix と全管理操作の Rust-side reject が、この段階の fail-closed として
   十分か。
3. `list()` ごとの軽量 scan と、壊れた候補を一覧へ残す設計に見落としがないか。
4. `errorCode` の frontend 所有、旧 payload の `apple_hosted` fallback が IPC 互換として妥当か。
5. 「検出済みだが生成不可」を `detected` として独立させた状態表現が誤解を招かないか。

## 未接続 / 非主張

- ローカルモデルの選択、helper への path 引き渡し、実生成
- 外部 resource folder / `.aimodel` の登録 UI と security-scoped bookmark
- Custom Models フォルダの作成、Finderで開く、明示的な再スキャン操作
- サイズ、作者、ライセンス等の追加 metadata 表示
- 実モデルでのロード、対象メモリ機、built app、VoiceOver / キーボード、TestFlight

この checkpoint は「ローカルモデルを使える」証跡ではない。次の実装ゲートは、helper の
ローカル backend と権限境界を先に固定してから、選択・生成へ接続すること。
