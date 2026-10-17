# リファクタリング・スライス 外部レビュー依頼（2026-10-17）

Status: Advisory / 自動検証済み・実機未実施、残スライスあり
Scope: 挙動を変えないコード改修（未参照コード削除、重複統合、責務分離、未使用検出の有効化）とその検証

Hazakura Editorの現行source（v3.3.0依存削減の受け入れ候補 `049813ea` / build 164 の後続）に対して、
**機能を変えない**リファクタリングを複数の小さなcommitで積みました。製品の信頼境界・保存形式・
文言・依存関係は変更していません。第三者の視点で「本当に挙動が変わっていないか」「移設で境界が
抜けていないか」「テストが移設を検知できる形になっているか」をレビューしてください。

**このリファクタは受け入れ中の署名候補（build 164 = `049813ea`）のbasisを変えません。**
build 164の実機受け入れはそのまま継続でき、本変更は次のsource候補に載る位置づけです。

## レビュー対象の固定点

- 変更差分: `2c8cf98d`（v3.3.0 build 164記録）から本レビュー資料commitまでの連続したcommit。
  - `445b7607` 未参照のexport関数を削除し宣言面を整理
  - `b50decc1` Tauri購読のライフサイクルを共通フック化し5箇所を移行
  - `c0aa90cd` lModeの循環importをcontextモジュールへ分離
  - `2dee3d35` プレビューのmedia access重複を共通モジュールへ統合
  - `52c01c5f` 分離窓のテーマ初期化とLocal Assist copy表を共有モジュールへ分離
  - `41050cc8` 未使用検出を有効化し未使用のimport/変数を整理
  - Rust側（`src-tauri/**`、`src/buildScripts.test.ts`）は別commit。範囲は本資料末尾の「Rust側」を参照。
- 製品版・配布設定・依存宣言（`package.json` / `Cargo.toml` / lockfile）は変更していません。
  新しい依存も追加していません。
- 判断の正本は `docs/current-status.md` / `docs/current-work.md`、境界は `docs/security-boundary.md`
  と `docs/app-store-build.md` のままです。

## 何を変更したか（スライス単位）

1. **未参照コードの削除** — 実importグラフを機械照合し、どのモジュールからもimportされず
   自ファイル内でも未使用のexport関数19件を削除。うち `src/lib/utils.ts` の
   `isEditorKeyboardTarget` / `trapFocusInElement` は、生きた実装（`lib/keyboard.ts` は
   `.editor-host`、`lib/focusTrap.ts` は完全版）と**同名・別セマンティクスの第2コピー**で
   参照ゼロでした。barrel再export3行とテストの不要mock1行も同時に整理。
2. **Tauri購読の共通化** — `useTauriSubscription`（購読ハンドルの解決前/解決後cancel、cleanup時の
   一度だけのrelease、`enabled`ゲート）を追加し、手書きだった購読effect 5箇所
   （`useAppExitConfirmation` / `useWindowCloseConfirmation` / `useAppleAssistAvailability` /
   `useWindowDragDrop` / `useOpenedFilesListener` / `useMainWindowWorkspace`の購読部分）を移行。
   各サイトのエラー処理・依存配列・登録解除の意味は変えていません。
3. **lModeの循環import解消** — `LModeContext` 型と `lModeContextFacet` を `lMode/context.ts` へ分離し、
   `contentDecorations.ts` が orchestrator（`extension.ts`）を参照しない形にしました。
   `extension.ts` は再exportで既存パスを維持。
4. **プレビューの重複統合** — `mediaAccessKey`（EBookPane/PreviewPaneで完全一致）と
   `handleMediaAction`（同）を `previewMediaActions.ts` へ。リンク遮断は両者で挙動が違う
   （Readerは選択ジェスチャ中を無視、通常プレビューは無視しない）ため統合せず、その差をコメントで固定。
5. **分離窓の共通化** — `readInitialTheme`（Agent/Local Assistで11行完全一致、sakura→edohiganの
   読み取り時移行を含む）とdocumentへのテーマ適用を `features/app/detachedWindowTheme.ts` へ。
   Local Assist窓のcopy表（型・`getAppleAssistWindowCopy`・presetビルダー・フィードバック型、
   計587行）を `lib/locale/appleAssistWindow.ts` へ移設し、component側はre-exportで
   既存import（copy契約テストを含む）を不変に維持。`AppleAssistWindowApp.tsx` は
   1,839行 → 1,252行。
6. **未使用検出の有効化** — `tsconfig.json` に `noUnusedLocals` / `noUnusedParameters` を追加。
   有効化に先立ち、検出された55件（未使用import・未使用の分割代入props・未使用ローカル・
   未使用型）を削除。挙動に影響する箇所はありません（テストの未使用ローカル1件を含む）。

## 意図的に変えていないもの

- 保存形式、Markdown/テキストsourceの扱い、Undo/dirty、明示Apply、確認ダイアログの文言。
- App Store / Developerの見え方（Agent/CLIの露出、DEVバッジ、Local Assistの可否）。
  `distributionLane.ts` の判定は1箇所のまま触っていません。
- レーン分岐のruntime化、CodeMirror拡張のCompartment構成、async競合ガード（`captureOperation`、
  要求世代比較）の意味。これらは「移動のみ」または「対象外」としています。
- 依存宣言・lockfile・Core AI pin・helper契約（JSON-over-stdioのスキーマとエラー文字列）。

## 検証済みの範囲（この変更の後）

- `npm run typecheck`（`noUnusedLocals` / `noUnusedParameters` 有効）: 成功。
- `npm test`: frontend **2,907件 / 312 files**、scripts **31件** 成功。
- `npm run build:vite`: Developer lane成功（`hasAgentEntry` / `hasXtermScript` / `hasAgentStyles` = true）。
  `HAZAKURA_DISTRIBUTION_LANE=app-store` でも成功し、境界検査は
  `hasAgentStyles: false` / `hasXtermScript: false` / `hasXtermStyles: false` を確認。
- Rust側の検証は下の「Rust側」に記載（`cargo fmt --check`、`cargo test --locked`）。

## 未実施・未確認

- **実機確認は未実施**。テーマ適用、IME/折り返し、L Mode、Reader、書き出し、ウィンドウ購読の
  実挙動は自動テストのみです。特に分離窓（Agent / Local Assist）のテーマ追従は
  描画テストが薄く、手動確認が必要です。
- `npm run smoke:app-store-surface`（surface 134件）は本変更後の一括実行をしていません
  （`npm test` に含まれる10ファイルは通過しています）。
- 署名build、TestFlight、Intel、macOS 26 GUI、VoiceOverは対象外です。
- 残スライス（下記）は未実施です。

## 見送り・延期した提案と理由

| 提案 | 判断 |
|---|---|
| レーン判定を `getDistributionCapabilities()` に集約 | 見送り。`import.meta.env` の読み取りは既に `distributionLane.ts` 1箇所で、述語も同モジュール内。呼び出し側の述語の使い分けは意味が異なるため、集約の実益が小さい |
| `useWorkspaceFileOps` の操作ガード共通化 | 見送り。共通化すると `workspaceRootPath` の非null絞り込みがヘルパ越しに伝わらず、全呼び出しでrootの持ち回りが必要になり侵襲的。`captureOperation` 自体は既に共通 |
| コマンドパレットの650行 `useMemo` 分割 | 延期。`buildCommandCommands(ctx)` への抽出は有効だが、ctx 13項目の型付けと36コマンドの移設を伴うため独立スライス |
| `useAppShellController` の Reference Compare面切り出し | 延期。353キーの戻り値と `AppShellProps` spread が契約で、キー配置を変えない移設として実施する |
| `WorkspaceSidebar` 45 props の二重配線統合 | 延期。AppShell側は `props`、AppWorkspace側はローカル値・ローカルstateで供給元が異なり、共通ソース型の導入が必要 |
| 互換barrel（`lib/tauri` 70箇所 / `lib/locale` 23箇所）廃止 | 延期。機械的だが、barrelをモックしているテスト32ファイルの追従を伴う |
| テストヘルパ共通化（`vi.mock` factory 881行、CSS `ruleBody` 8ファイル重複） | 延期。テスト専用の独立スライス |
| `EditorPane` の純関数260行とCodeMirror拡張組み立て（14生成箇所）分離 | 延期。IME/L Modeの実機受け入れと、実装ソース文字列を読むテストの更新を伴う |
| `EBookPane` のページ計測統合 | 対象外。順序変更が実機ページ送りと縦書きに波及する |

## Rust側

- `src-tauri/src/helper_transport.rs` を追加し、helper RPC transport（`rust_target_triple`、
  `ReadWatchdog`、`kill_child`、`resolve_sidecar_next_to_executable`）を共有化。
  `apple_assist_supervisor.rs` は `write_request_locked` / `classify_read_failure` を抽出し、
  watchdog2箇所と `resolve_bundled_*` を共通化。`import_assist/helper.rs` は
  `HelperRequest::new(action)`・`decode_error_envelope`・`expect_kind::<T>` を導入。
  **エラー文字列・判定順序（cancel→timeout→空→read err→parse err）・スキーマ型
  （`WireRequest` と `HelperRequest` は別契約）は不変。**
- `capabilities/agent-window.json` の説明文を実態（gate対象コマンド）に修正。
  `src/buildScripts.test.ts` に「frontendのinvoke名 ⊆ `generate_handler!` 登録名」
  「未使用コマンドは明示allowlistのみ」「allowlist名は登録済み」の静的テストを追加。
- 検証: `cargo fmt --check`、`cargo test --locked` の結果は本資料の最終更新時に追記します
  （PTYを確保できない環境依存の失敗が4件出ており、変更箇所との関連を切り分け中）。

## レビュアーに求める判定

1. 上記6スライス（Rust分を含む）に、**挙動が変わる差分が混ざっていないか**。
   特に (a) `useTauriSubscription` 移行で購読タイミング・解除回数・依存配列の意味が
   変わっていないか、(b) lModeの `LModeContext` 移設で再export経路が欠けていないか、
   (c) copy表の移設で文字列・キー集合が1文字も変わっていないか、
   (d) `noUnusedLocals` 有効化で「未使用に見えるが実は必要な宣言」を消していないか。
2. 移設・削除の根拠にした機械照合（importグラフ、完全一致ブロックの同定）に見落としがないか。
   動的参照・文字列参照・barrel経由の再exportで消してはいけないものを消していないか。
3. 残スライスの優先順位づけが妥当か。延期理由（型の絞り込み、供給元の違い、実機依存）に
   誤りがあれば指摘してください。新機能の提案より、既存の信頼境界・保存モデルの維持を優先します。
