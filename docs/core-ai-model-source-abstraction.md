# Core AI モデルソース抽象化（ローカル `.aimodel` / resource folder）

Status: v3.1 スコープ（オーナー決定 2026-09-22）。未着手
Scope: v3.1 の C-3 レーン — Apple-hosted 以外のモデルソースを Hazakura で扱う設計とゲート
Authority: Medium（設計詳細の正本。v3.1 のスコープ判断は `roadmap.md`、キューは `current-work.md`）
Last reviewed: 2026-09-22

## この文書の位置づけ

これは、オーナーが受け取った外部意見（2026-09-22、`.aimodel` のオープン配布を見据えた
モデルソース抽象化）を、**現行構造と突き合わせて v3.1 のレーンとして整理した計画メモ**である。
オーナー決定（2026-09-22）により **v3.1 に含める**。ただし**まだ1行も実装していない**。
ここに書いた着手順・型は実装時の出発点で、完了・検証済みを意味しない。

- 現行の実装境界の正本は `core-ai-c0-design.md`（C-0 / C-1 / C-2 の gate）。
- 本番候補 identity と asset 準備の正本は `core-ai-production-models.md`。
- この文書がそれらと衝突したら、**現行の正本が優先**する。
- 実装の順序・着手判断は `current-work.md` と `roadmap.md` で決める。

### オーナー決定（2026-09-22）

現行の hard rail は「Core AI は **allowlist only**、任意 URL / 未署名 blob /
ユーザー持ち込みモデルを読まない」だった（`roadmap.md` § Core AI、`assist-surface-strategy.md`
§ Core AI）。オーナー判断により、**v3.1 でこの境界を次の範囲だけ広げる**。

- 許す: ユーザーが **明示登録** したローカル resource folder / `.aimodel`、および
  Hazakura 管理の Custom Models ディレクトリ。
- 許さない: 任意 URL からの取得 / ダウンロード、未検証 blob の自動取り込み、
  モデルマーケット、署名・検証なしでの配布物取得（詳細は Non-Goals）。

この決定は v3.1 のスコープ判断であり、実装（`C-3`）の完了や検証済みを意味しない。
境界の詳細と Non-Goals は本ファイル、キューの順序は `current-work.md`、版の位置づけは
`roadmap.md` を正本とする。

## 外部意見の要旨

- `.aar` を**モデル形式として固定しない**。Core AI が実際に使う resource folder /
  `.aimodel` をモデルの本体として扱い、`.aar` は**取得方法のひとつ**にする。
- 次の3経路を、内部では同じ「利用可能な Core AI モデル」として扱える構造にする。
  1. Apple CDN / `.aar` から取得した公式モデル
  2. Hazakura の「カスタムモデル用ディレクトリ」に置かれたモデル
  3. ユーザーが指定した外部ローカル resource folder
- URL 入力、モデルストア、Hugging Face 連携、GGUF 変換、独自 package format は scope 外。

```text
Model source
├─ Apple-hosted Background Asset (.aar)
├─ App-managed custom model directory
└─ User-selected external directory
        ↓
Resolved model resource directory
        ↓
Validation
        ↓
Installed / Available Model
        ↓
CoreAILanguageModel(resourcesAt:)
```

## 現状構造の調査（2026-09-22 時点）

着手前に「今どうなっているか」を実装で確認した結果。抽象化はここを土台にする。

| 層 | 実体 | いまの振る舞い |
|---|---|---|
| モデル registry | `src-tauri/src/commands/core_ai_models.rs` の `CoreAiModelStore` | catalog はコンパイル時定数（E4B / 12B）。`CoreAiModelSummary` が frontend 契約。model ごとの `RuntimeState`（status / progress / `materialized_path` / asset pack version）を持つ |
| 選択状態 | 同ファイル `CoreAiSelectionState` | `core-ai-selection.json` に `selectedModelId` を永続。既定は `apple:foundation-models:system-default` |
| 取得 transport | `src-tauri/src/commands/background_assets.rs` の `BackgroundAssetTransport` | Apple-hosted `.aar` を materialize し、その絶対 path を `materialized_path` に保持する |
| 検証 | `core_ai_models.rs` の `ResourceManifest` / `ResourceManifestFile` | 相対 path の safety、`max_entries`、サイズ、SHA-256 を確認してから `Ready` にする（G2） |
| helper への引き渡し | `src-helpers/apple-assist/Sources/HazakuraAppleAssist/main.swift` | Rust が stdin の `modelPath` を渡す。backend は Rust が唯一選択する |
| helper 側の解決 | `CoreAITestResourceContract.swift` / `CoreAITestRuntime.swift` | `modelPath` から resource を検証し、`CoreAILanguageModel(resourcesAt:)` に渡す |
| 保存先 | `src-tauri/src/lib.rs`（`app_data_dir()`） | 現行はアプリコンテナ配下（`CoreAIModels` / `core-ai-selection.json` / `core-ai-validation`） |
| App Group | `src-tauri/Info.appstore.plist`、`src-tauri/entitlements/*` | `group.dev.hazakura.editor` は Background Download extension 側で使う。モデル保管場所としての共用は現状ない |
| 権限の先例 | `src-tauri/src/commands/security_bookmarks.rs`、`src-tauri/src/import_assist/stage.rs` | security-scoped bookmark の作成 / 解決は Rust が持つ。import は「main が scope を持ち、**nested helper は sandbox しか継承しない**ので container temp へコピーする」方式 |

分かったこと:

- 現行は **「Apple CDN が materialize した path だけを helper に渡す」** 形に閉じている。
  catalog もローカル配置の入口も無い。
- Rust がモデル registry・選択・path の単一 authority になっている。抽象化はここを広げる形が自然で、
  **Swift / Rust / frontend に別 registry を作らない**（`core-ai-c0-design.md` D20 と同じ思想）。
- 外部ディレクトリを helper にそのまま読ませられるかは**未検証**。既存の import は
  「helper へは権限を渡さずコピーする」先例で、これは本レーンの前提を左右する。

## 目標構造

概念は「source」と「解決済みリソース」を分ける。型名は実装時に既存へ合わせるが、
分岐は transport / source 側に閉じ、**Core AI 実行側に「`.aar` 由来だから」という分岐を増やさない**。

- 入口: `ModelSource = managedBackgroundAsset | appManagedLocal | externalLocal`
- 中間: `ResolvedModelResource`（resource root + 検証結果 + metadata）
- 出口: 既存と同じ `CoreAILanguageModel(resourcesAt:)` 経路

既存の `CoreAiCatalogEntry` / `CoreAiModelSummary` / `RuntimeState` を 3 source へ一般化する。
`ModelDescriptor`（id / displayName / version / resourceRoot / source / metadata / validationState）
相当の情報は、既存 summary の拡張として持たせる。

## 経路ごとの設計

### 1. 公式（不変）

`Apple catalog → Background Assets → .aar → 展開後 resource folder → helper` は現行のまま維持する。

- E4B / 12B の download / cancel / resume / delete / 低メモリ警告 / license 表示は壊さない。
- `.aar` は「公式モデルの delivery mechanism」という位置づけを明文化するだけに留める。
- ローカル `.aar` を一般のモデル bundle として独自展開する実装は**しない**。

### 2. Custom Models ディレクトリ（app-managed local）

Hazakura が管理する `Custom Models` ディレクトリを1つ用意し、直下の各ディレクトリを
1モデル候補として扱う。

```text
Custom Models/
├─ MyGemma/
│  ├─ metadata.json
│  ├─ model.aimodel
│  └─ tokenizer/
└─ MyQwen/
   ├─ metadata.json
   ├─ qwen.aimodel
   └─ tokenizer/
```

- 保存場所は**未決**。候補は既存 `app_data_dir()` 配下か `group.dev.hazakura.editor` 配下。
  既存 Background Assets の保存領域と無理に混在させない。
- アプリ起動時・モデル管理画面表示時の軽量な再検出は可。重い specialize 等は**勝手に実行しない**。
- ユーザー自身が置いたファイルは、この段階では**アプリから削除しない**設計を優先する。

### 3. 外部ローカル（user-selected external directory）

macOS の標準フォルダ選択 UI で resource folder（または `.aimodel`）を選ばせ、
その場所のまま使う。

- absolute path 保存にせず **security-scoped bookmark** を使い、再起動後も解決する。
- stale / 失効時はクラッシュせず「モデルへのアクセス権が失われました。もう一度場所を指定してください」
  のような再承認導線を出す。
- 実際にロードするのが helper である以上、**bookmark をどのプロセスで解決し、helper へどう権限を
  渡すか**を先に確定する。`import_assist/stage.rs` の先例（main が scope を持ち helper へはコピー）を
  踏まえ、「本体では読めるが helper からは Permission denied」を残さない。

## resource root と `.aimodel` の解決

- モデルファイル名を固定しない。`metadata.json` 等、Apple 側 resource bundle の情報から
  main asset を解決することを第一候補にする（`apple/coreai-models` の慣例に寄せる）。
- `.aimodel` 単体が選ばれた場合は best-effort:
  1. 親ディレクトリを resource root 候補として調べる
  2. tokenizer / metadata / その他必要 resource を探索する
  3. `CoreAILanguageModel` として成立する bundle なら登録する
  4. 不足していれば**登録しない**
- tokenizer 等が無い場合は「Core AI モデルは見つかりましたが、実行に必要な Tokenizer 等の
  resource が見つかりません」のように具体的に案内する。
  **別モデルの tokenizer を推測・流用しない**。

## 登録前の検証

- resource root が存在する / `.aimodel` asset が存在する
- metadata が指定する asset が存在する
- Language Model に必要な resource（tokenizer 等）が存在する
- 読み取り権限がある
- 対応 OS / Core AI でロード可能な形式かを、確認できる範囲で確認する
- metadata の相対パスが bundle 外へ脱出しない。不審な symlink は安全側で扱う
- 明らかに壊れた bundle を「利用可能」と表示しない

カスタムモデルは原則 read-only で扱う。bundle 内のスクリプト / 実行ファイルを
Hazakura が実行することはない。

## モデル管理 UI

既存の独立ページ（`models`）へ自然に統合し、Developer 向けの大きな管理画面にはしない。

```text
オンデバイスモデル

Hazakuraモデル
────────────────
Gemma 4 E4B
Gemma 4 12B
...

カスタムモデル
────────────────
My Qwen 3
ローカル
/path/.../MyQwen

My Gemma
ローカル
Hazakura Custom Models

[ ローカルモデルを追加… ]
[ カスタムモデルフォルダをFinderで開く ]
[ 再スキャン ]
```

- カスタムモデルにも選択 / 利用可能状態 / ロード失敗 / サイズ / （取得できれば）名前・作者・
  ライセンスを表示する。情報が無ければ**推測せず「不明」または非表示**にする。
- 公式 catalog モデルと区別できる「ローカル」等の表示を付ける。
- URL 入力欄は置かない。

## 削除と重複

- 外部ローカルは「**登録解除**」のみ。bookmark 等の登録情報を消し、**元 resource folder には触れない**。
- Custom Models 内のユーザー配置モデルも、この段階では勝手に削除しない。
- 公式 Background Assets の削除仕様は現行のまま維持する。
- 同じ resource root を何度選んでも重複登録しない。path 文字列だけで判定せず、
  bookmark 解決後 URL / canonical resource root / metadata を使った安定した識別にする。
  Custom Models 内モデルと外部登録モデルが同一の場合も、可能な範囲で重複を避ける。

## 壊さないもの（既存契約）

- Safe Editor 主面、Markdown/text source 正本、proposal-first / Diff / 明示 Apply / no auto-save。
- System 既定 backend、fail-closed、Rust 単一 registry、`selectedId` の Rust 所有。
- G1（複数窓同期）と G2（signed manifest / safe path / size / SHA-256 検証後に Ready）。
- 自動ダウンロード・起動時スキャンなし、明示操作、App Store lane の開示整合。
- ローカル `.aar` の独自展開、GGUF 直接読み込み、クラウド fallback は行わない。

## Non-Goals（C-3 でもやらない）

- URL からモデルを直接入力 / ダウンロードする機能
- Hugging Face 連携、モデルマーケット、独自オンライン catalog
- GGUF 直接読み込み、GGUF / PyTorch → Core AI 変換
- アプリ内 `.aimodel` export、任意 `.zip` の自動展開
- 未知モデル用 tokenizer の自動取得、カスタムモデルの自動更新
- cloud fallback / tool calling / workspace indexing / auto-apply

将来追加できる設計にはしてよいが、C-3 でも**今は実装しない**。

## Open Questions / 調査項目

1. **Apple 側の resource bundle 慣例**がどの程度固まっているか（`metadata.json` の仕様、
   main asset の解決規則）。`apple/coreai-models` の現在形を正本として確認する。
2. **`coreai-build` / AOT**。現ホストでは未取得で、`.aimodelc` を作れていない
   （`core-ai-production-models.md` § Activation gates）。ローカルモデルに AOT が要るか。
3. **helper への security-scoped 権限の渡し方**。既存 import は「コピー」方式。
   外部モデルを helper から直接読むのか、container へ stage するのか。
4. **Custom Models の保存場所**。`app_data_dir()` か App Group か。Background Assets との分離。
5. **`.aimodel` の実体**（ファイルか bundle か）と、bundle 成立判定の条件。
6. **検証の分担**。どれを Rust、どれを helper で行い、registry を二重化しないか。
7. **対応 OS / SDK**。Core AI は macOS 27+ 前提で、System helper（macOS 26 互換）を壊さない
   分離を維持できるか。

## v3.1 内の位置づけと先行ゲート

レーン名: **C-3 — ローカル / 外部モデルソース**（v3.1、オーナー決定 2026-09-22、未着手）。

1. 先行する現行 v3.1 の続き（12B archive の Apple upload / processing、32 GB 対象機 TestFlight、
   built app のキーボード / VoiceOver、外部再レビュー）を `current-work.md` の順で進める。
   C-3 は C-1 / C-2 を置き換えず、それらを止めない。
2. Apple 側 resource 慣例と AOT の確定度、helper への security-scoped 権限の渡し方を
   実装前に確認する。未確定なら「未確定のまま固定しない」方針を明記する。
3. Core AI helper / Rust registry を二重化せず、既存の単一 registry を拡張する。

## 実装時の検証項目（受け入れ）

- 既存経路: catalog が変わらない / `.aar` 取得済みモデルが従来どおり動く /
  download / cancel / delete が壊れない / 選択状態が壊れない
- ローカル: 正常な resource folder を登録できる / Custom Models から検出できる /
  再スキャンで追加モデルを認識する / 同じフォルダを二重登録しない /
  外部モデルの登録解除で元ファイルを削除しない / 再起動後も外部モデルを使える
- `.aimodel`: 親 resource folder を解決できる / tokenizer 等が揃えば登録できる /
  bare `.aimodel` だけなら明確なエラー / 別モデルの tokenizer を誤って拾わない
- Sandbox: bookmark の保存 / 復元 / stale 時の扱い / helper からロードする実経路 /
  権限不足でクラッシュしない
- 異常 bundle: metadata 破損 / asset 不存在 / tokenizer 不存在 / unreadable directory /
  bundle 外を指す path / symlink 等の危険なケース

## 実装後の報告項目

1. 現在のモデル管理アーキテクチャをどう整理したか
2. official / app-managed local / external local の 3 経路
3. resource root の判定方法
4. `.aimodel` 単体選択をどこまでサポートしたか
5. sandbox / security-scoped bookmark の扱い
6. Core AI helper へどう渡しているか
7. 追加した UI
8. 追加したテスト
9. Apple SDK / API の制約で対応できなかったもの
10. 今後 `.zip` 等を追加する場合の拡張ポイント

## 参照

- `AGENTS.md`
- `docs/roadmap.md` § Core AI — v3.0 foundation / v3.1 models、§ Hard rails
- `docs/assist-surface-strategy.md` § Core AI — Allowlisted Writing Models
- `docs/core-ai-c0-design.md`（C-0 / C-1 / C-2 の gate、D20）
- `docs/core-ai-production-models.md`（本番候補 identity、Activation gates）
- `docs/core-ai-ux-backlog.md`（モデル配布 UX の未着手候補）
- `docs/current-work.md` § Held / Separate Work
- 実装: `src-tauri/src/commands/core_ai_models.rs`、`src-tauri/src/commands/background_assets.rs`、
  `src-tauri/src/commands/security_bookmarks.rs`、`src-tauri/src/import_assist/stage.rs`、
  `src-helpers/apple-assist/Sources/HazakuraAppleAssist/{main.swift,CoreAITestResourceContract.swift,CoreAITestRuntime.swift}`
