# v3.1 C-3 外部レビュー指摘の是正（ローカル契約の分離と symlink / scan）

Status: Implemented（再レビュー用）
Scope: `docs/reviews/2026-09-22-v3.1-c3-local-model-resolution/` への外部レビュー P1/P2 是正
Authority: Review evidence
Last reviewed: 2026-09-22

## 結論

スライス1の「Rust の検証が helper の契約と同じ」という主張は誤りだった。Rust は
Hazakura 記述 bundle の `schemaVersion` / `modelId` / `runtimeKind` / `layout` だけを見て、
Swift の production helper は `licensing.reviewStatus` / `licensing.licenseFiles` /
`LICENSE-APACHE-2.0.txt` / `THIRD_PARTY_MODEL_NOTICE.md` / `expectedModelId` 一致まで要求する。
bare language bundle も Rust は受理、production helper は `hazakura-model.json` を要求する。
つまり **Rust で OK・helper で invalid** を作れた。

production 契約へ寄せるのではなく、**ローカル用 contract を明示的に分けた**。
`CoreAILocalResourceContract`（Swift）と Rust の `core_ai_local_models` が同じルールで
`bare language resource` と `Hazakura-described local resource` を検証し、両者は
**共通 fixture spec** で突き合わせる。production 契約 `CoreAIResourceContract` は不変。

## 指摘への対応

| 指摘 | 対応 |
| --- | --- |
| **P1** Rust の検証が helper 契約と不一致 | ローカル契約を分離。Swift に `CoreAILocalResourceContract` を追加し、`src-tauri/resources/core-ai/local-model-contract-cases.json` を Rust と Swift の両テストが読む。production 契約が licence 必須・local 契約が licence 不要であることを Swift テストで明示 |
| **P2** symlink 拒否が最終要素中心 | root から対象までの**全 component** を `symlink_metadata`（Rust）/ `resourceValues`（Swift）で辿り、途中の symlink を `unsafe-path` で拒否 |
| **P2** scan が壊れた候補を黙って消す | symlink 候補と種別不明の候補を resolver へ渡し、`unsafe-path` / `unreadable` として報告。通常ファイルだけを除外 |
| 軽微 descriptor の read エラー | NotFound は対象ごとの missing code、その他の read 失敗は `unreadable`、JSON parse 失敗は `malformed-descriptor` に分離 |
| 軽微 証跡の件数 | スライス1 README の「異常系11件」を12件へ訂正（列挙はもともと12件） |

## 変更ファイル

| File | 内容 |
| --- | --- |
| `src-tauri/src/commands/core_ai_local_models.rs` | ローカル契約として再定義。全component symlink walk、read エラー分離、scan の報告 |
| `src-tauri/src/tests/core_ai_local_models.rs` | 25件へ拡張。共通 spec 駆動テスト、symlink 4種、scan の symlink 報告 |
| `src-tauri/resources/core-ai/local-model-contract-cases.json` | 新規。20ケースの共通 fixture spec（Rust は `include_str!`） |
| `src-helpers/apple-assist/Sources/HazakuraAppleAssist/CoreAILocalResourceContract.swift` | 新規。同じルールの Swift 実装 |
| `src-helpers/apple-assist/Tests/HazakuraAppleAssistTests/CoreAILocalResourceContractTests.swift` | 新規。共通 spec 駆動テストと production 契約との差の回帰 |

## 契約の分離

| | production（`CoreAIResourceContract`） | local（`CoreAILocalResourceContract` / Rust） |
| --- | --- | --- |
| 入力 | 公式 Apple-hosted bundle | ユーザー選択 / Custom Models |
| 署名 manifest | 必須（G2） | なし |
| `hazakura-model.json` | 必須 | 任意（無ければ bare language resource） |
| `licensing` / licence / notice | 必須 | 要求しない（不明として扱う） |
| `modelId` 一致 | `expectedModelId` と一致必須 | 宣言があれば保持、無ければ不明 |
| symlink | 対象 path を拒否 | root と root 配下の全 component を拒否 |

## 検証

| Gate | Command | Result |
| --- | --- | --- |
| Rust format | `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | pass |
| Rust tests | `cargo test --manifest-path src-tauri/Cargo.toml` | 452 passed / 2 ignored（モジュール内25件、共通 spec 20ケースを含む） |
| Swift tests | `swift test --package-path src-helpers/apple-assist` | 57 passed（`CoreAILocalResourceContractTests` 5件、共通 spec 20ケースを含む） |

共通 spec は「同じ入力に対して Rust と Swift が同じ正規化結果を返す」ことを両言語で
主張する。Rust の `contract_cases_match_the_shared_spec` と Swift の
`testContractCasesMatchTheSharedSpec` がどちらも 20ケースを通す。片側の実装だけを変えると
もう片方が落ちる。

Swift のテストは Codex seatbelt 内で module cache を作れないため sandbox 外で実行した。

## 残リスク / 次のゲート

1. `CoreAILocalResourceContract` はまだ helper のランタイム選択に接続していない。次の
   スライスでローカル backend 経路（`selectedId` は Rust 所有のまま）に組み込む。
2. 外部 resource folder の security-scoped bookmark と helper への権限受け渡しは未確定。
3. Custom Models の保存場所（`app_data_dir()` か App Group か）は未決定。
4. 実モデルでのロード、対象メモリ機、VoiceOver、App Store レーンの開示整合は未確認。
