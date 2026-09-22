# v3.1 C-3 ローカルモデル解決・検証層（Rustスライス1）

Status: Implemented（内部レビュー用）
Scope: `docs/core-ai-model-source-abstraction.md` の C-3 スライス1 — ローカル resource root の解決・検証
Authority: Review evidence
Last reviewed: 2026-09-22

## 結論

Apple-hosted 以外のモデルソース（Custom Models ディレクトリ、ユーザーが明示登録する
resource folder、`.aimodel` 単体指定）を扱う前提として、**ローカル bundle の解決と
構造検証を Rust に追加した**。既存の Apple-hosted catalog、Background Assets、選択状態、
helper への受け渡しは変更していない。catalog・IPC・UI への接続は次のスライスで行う。

この差分は**まだ「ローカルモデルを登録・選択・生成できる」状態ではない**。
経路の検証だけを固定したスライスであり、React側の登録UI、security-scoped bookmark、
helper への権限受け渡しは未着手である。

## 変更

1. **解決**: `resolve_local_model_root(path)` が resource root、language bundle、
   または `*.aimodel` ディレクトリ（親が bundle の場合）を受け、canonical な
   `ResolvedLocalModel` を返す。
2. **構造契約**: helper が読み込み時に使うのと同じ契約を Rust 側で先に固定する。
   `metadata.json`、`tokenizer/tokenizer.json`、単一の `*.aimodel` ディレクトリ
   （`metadata.json` / `main.hash` / `main.mlirb`）を必須とする。
3. **Hazakura記述bundle**: `hazakura-model.json` がある場合は `schemaVersion`、
   `modelId`、`runtimeKind`、`layout` を読み、`coreai-kit-gemma4-ple` では
   `tables/embed_per_layer.{i8,scale.f32}` も必須にする。`displayName` が無ければ
   推測せず `None` を返す。
4. **安全側の扱い**: symlink の root / bundle / `.aimodel`、bundle 外へ出る `layout`、
   `..` を含む相対パスを拒否する。検査対象への書き込み・修復・変換・削除は行わない。
5. **Custom Models スキャン**: `scan_custom_models_directory(root)` が直下の
   各ディレクトリを1候補として解決し、壊れた候補も理由付きで返す（黙って隠さない）。
   canonical resource root と `modelId` で重複を排除する。隠しディレクトリは除外する。
6. **文言の所在**: エラーは安定した `code`（`missing-tokenizer` 等）と診断用の英語
   message を持ち、ユーザー向け文言は接続スライスで frontend が所有する。

## 変更ファイル

| File | 内容 |
| --- | --- |
| `src-tauri/src/commands/core_ai_local_models.rs` | 新規。解決・検証・Custom Models スキャン |
| `src-tauri/src/lib.rs` | module 登録 |
| `src-tauri/src/tests/core_ai_local_models.rs` | 新規。20件 |
| `src-tauri/src/tests/mod.rs` | test module 登録 |

## 検証

| Gate | Command | Result |
| --- | --- | --- |
| Rust format | `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | pass |
| Rust tests | `cargo test --manifest-path src-tauri/Cargo.toml` | 447 passed / 2 ignored（新規20件を含む） |

新規テストの内訳:

- 正常系4件: language bundle（root指定 / `.aimodel`指定）、Hazakura記述の
  `gemma4-ple` と `language`
- 異常系11件: tables欠落、tokenizer欠落、`.aimodel` 2個、`main.mlirb` 欠落、
  `.aimodel` なし、`layout` の root 外脱出、未対応 `schemaVersion`、未知 `runtimeKind`、
  壊れた JSON、存在しない root、ファイル選択、descriptor なし
- unix系2件: `.aimodel` symlink、root symlink
- スキャン2件: 並び順と壊れた候補の報告、存在しない/非ディレクトリ root で空

`.aimodel` の実体、Apple側 `metadata.json` の仕様、helper への security-scoped 権限は
未確認のままで、テストは fixture の構造契約のみを対象にしている。実モデルのロード、
実行、対象メモリ機、VoiceOver はこの証跡に含まれない。

## 残リスク / 次のゲート

1. `CoreAiModelStore` / IPC / frontend への接続（catalog を壊さないこと、`selectedId` の
   Rust 所有の維持）。
2. 外部 resource folder の security-scoped bookmark と、helper へどう権限を渡すかの確定
   （`docs/core-ai-model-source-abstraction.md` Open Question 3）。
3. Custom Models の保存場所（`app_data_dir()` か App Group か）の決定。
4. 実モデルでのロード確認、および App Store レーンでの開示整合。
