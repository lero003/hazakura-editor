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
  - `41050cc8` 未使用検出を有効化し未使用のimport/変数を整理（**Rust側のIPC surfaceテスト追加も
    このcommitに同梱**。frontendとRustを並行で進めたため）
  - `29bda2a0` CSSテストの共通ヘルパをtest-supportへ集約
  - `84de61e1` useTauriSubscriptionのライフサイクル契約テストを追加
  - `2515b68c` helper RPC transportを共通モジュールへ集約（Rust / R2・R5）
  - `e1d0962b` アプリメニュー構築をサブメニュー単位に分割（Rust / R4）
  - `a4dbd6bd` Core AIモデルストアを責務別モジュールへ分割（Rust / R3）
  - `3aa51605` テスト専用の重複ヘルパを削除しcapability記述を実態へ合わせる（Rust / R1・次点）
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
7. **Reference Compare面の切り出し** — `useAppShellController.ts` の819-950行（132行）を
   `hooks/referenceCompare/useReferenceCompareSurface.ts` へ移動（コントローラは
   1,967行 → 1,862行）。移動本体131行は機械照合で**差分0行**（`cursorLine: selectionLine` と
   `referenceRetainedStatus` の2箇所の引数名、およびImport Assistペアリングrefへの代入を
   呼び出し側へ戻した点のみ）。実装ソースの文字列を読むテスト1件のパスを新モジュールへ更新。
8. **章レビュー処理の共有化** — `AppWorkspace` と `AppShell`（L Modeレール）に17/19行一致で
   重複していた「章を開いてからディスクと突き合わせる」処理を
   `features/workspace/chapterReviewHandler.ts` の `createChapterReviewHandler` へ集約。
   request/queue の ref は**サイトごとに専有のまま**渡す（両サイドバーは同時にマウントされ得るため）。
9. **PDF/EPUB書き出しプロローグの一本化** — `useDocumentExport.ts` で形式ごとに複製されて
   いた開始プロローグ（attempt/切替の取得、preflight、stale判定、R6の同一tick切替）を
   `beginFormatExport(format, copy, options)` に統合。差は形式名と status 文言3種のみで、
   文言は6リテラルとも機械照合で**前後完全一致**（`PDF_EXPORT_COPY` / `EPUB_EXPORT_COPY` に定数化）。
   HTMLは preflight を持たず同一tickで枠を閉じる別フローなので対象外。
10. **EditorPaneのスクロール/選択ヘルパ分離** — 末尾の261行（スクロール比clamp、スクロールバー
    判定、選択情報の読み取り、スクロールバー・ドラッグの保持）を
    `features/editor/editorScrollPhysics.ts` へ移動（EditorPaneは1,478行 → 1,225行）。
    移動本体は機械照合で**差分が `export` 接頭7箇所のみ**。`EditorSelectionInfo` 型も同モジュールへ
    移し、EditorPaneからは再exportで既存importを維持。あわせて3ファイルに重複していた
    `clampScrollRatio`（意味は完全一致）を同モジュールの1実装へ統合し、既存テスト向けに
    再exportを残した。
11. **互換バレル廃止** — `src/lib/tauri.ts`→`tauri/index.ts`→各モジュール、および
    `src/lib/locale.ts`→`locale/index.ts`→各モジュールの**二層バレル**を削除し、production 150箇所を
    per-area import へ機械置換（158+73 名の名前→モジュール対応を機械照合、未対応0件）。
    テストのbarrelモック31箇所も per-area モックへ分割・再ターゲット（`vi.importActual` 併用の
    7箇所は各モジュールの actual を spread する形へ）。147ファイル / +407 −563。
    副産物として、`useDocumentExport.test.tsx` に**同じ `lib/tauri/files` を二重に mock していて
    後勝ちで片方が無効化されていた**既存の取りこぼしを発見し、1つに統合した（バレル時代は
    barrel mock と per-module mock が別モジュールとして共存していたため表面化していなかった）。
12. **テストのプロジェクトファイル読み取り共通化** — `process.cwd()` 前提の
    `readFileSync` が14テストファイル・30箇所に散在していたため、
    `src/test-support/source.ts` の `readProjectFile` へ集約。実装ソースの構造を
    意図的に検証するテスト（lane/build、エディタ拡張構成、分離窓のcopy契約）であることを
    ヘルパのコメントに明記し、移設時に更新すべき箇所を1つにした。
13. **WorkspaceSidebar 45 props の一本化** — `AppWorkspace` と `AppShell`（L Modeレール）に
    90行ずつ重複していた配線を `features/workspace/workspaceSidebarProps.ts` の
    `buildWorkspaceSidebarProps(source, extras)` に集約。両サイトの供給元は同じ名前の
    props（＋ `workspaceTabMarkers`）で、差分は L Modeレール固有の4値のみ。
    `AppWorkspace` は destructuring 引数から `props` 受けへ変更し、ビルダーが使う値を
    二重に取り出さないよう不要になった29個の分割代入を削除。差分は
    **3ファイル / +138 −290**（AppWorkspace 1,337→1,215行、AppShell 460→382行、新モジュール151行）。
    sidebarの既定値（`[]` / `false` / `null` / `true`）は渡さない場合と同じ結果になることを確認済み。
14. **エディタcompartment値の集約** — `EditorPane` のmount配列と7つのreconfigure effectが
    同じ値を別々に書いていたため、`features/editor/editorExtensionSet.ts` に7つの値ビルダーを
    置き両経路から使う形へ変更。**既存の食い違いを1つ発見**した: 不可視文字は
    reconfigure経路だけが L Mode で抑制し（`showInvisibles && !lModeEnabled`）、mount経路は
    L Mode でも表示する（`showInvisibles`）。どちらが正しいか未確認のため、
    `editorInvisiblesCompartmentValue(..., suppressInLMode)` として**両挙動を明示的に保存**した
    （挙動は変更していない。確認後にどちらかへ寄せる判断が必要）。
15. **コマンド表のモジュール抽出** — `useCommandPaletteController.ts` の635行インライン
   `useMemo<Command[]>` を `commandPaletteEntries.ts` の `buildCommandCommands(ctx)` へ移動
   （フックは1,055行 → 403行）。移動は機械照合で**635行が1行も変わっていない**ことを確認済み
   （差分は `ctx.` 接頭のみ）。`openGlobalSearch` はこのmemoより後にフック内で宣言されるため
   `ctx.openGlobalSearch: () => void` として遅延参照にし、依存配列は変更していません
   （元の closure が呼び出し時に読む挙動と同じ）。

## 意図的に変えていないもの

- 保存形式、Markdown/テキストsourceの扱い、Undo/dirty、明示Apply、確認ダイアログの文言。
- App Store / Developerの見え方（Agent/CLIの露出、DEVバッジ、Local Assistの可否）。
  `distributionLane.ts` の判定は1箇所のまま触っていません。
- レーン分岐のruntime化、CodeMirror拡張のCompartment構成、async競合ガード（`captureOperation`、
  要求世代比較）の意味。これらは「移動のみ」または「対象外」としています。
- 依存宣言・lockfile・Core AI pin・helper契約（JSON-over-stdioのスキーマとエラー文字列）。

## 検証済みの範囲（この変更の後）

- `npm run typecheck`（`noUnusedLocals` / `noUnusedParameters` 有効）: 成功。
- `npm test`: frontend **2,912件 / 313 files**、scripts **31件** 成功。
- `npm run build:vite`: Developer lane成功（`hasAgentEntry` / `hasXtermScript` / `hasAgentStyles` = true）。
  `HAZAKURA_DISTRIBUTION_LANE=app-store` でも成功し、境界検査は
  `hasAgentStyles: false` / `hasXtermScript: false` / `hasXtermStyles: false` を確認。
- Rust側の検証は下の「Rust側」に記載（`cargo fmt --check`、`cargo test --locked`）。

## 未実施・未確認

- **実機確認は未実施**。テーマ適用、IME/折り返し、L Mode、Reader、書き出し、ウィンドウ購読の
  実挙動は自動テストのみです。特に分離窓（Agent / Local Assist）のテーマ追従は
  描画テストが薄く、手動確認が必要です。
- `npm run smoke:app-store-surface`（surface 137件）成功。`npm test` に含まれる10ファイルも通過。
- 署名build、TestFlight、Intel、macOS 26 GUI、VoiceOverは対象外です。
- **メニューバーの実機smokeは未実施**（Rust R4の分割）。分離窓のテーマ追従も手動確認が必要です。
- 残スライス（下記）は未実施です。

## 残スライスの状態（本レビュー時点）

| スライス | 状態 |
|---|---|
| H2 Tauri購読の共通フック化 | **8/10 移行済み**。残る `useAppMenuActionListener`（150行のインラインハンドラを再インデントする必要があり、差分が大きい）と `useAppleAssistProposalHandler`（register/unregister + 2リスナー + job後始末が1つのownerライフサイクルを共有）は、共通フックに載せる利得より移設リスクが上と判断して保留（どちらも動作は現状維持） |
| S6 WorkspaceSidebar 45 props の二重配線 | **完了**。`buildWorkspaceSidebarProps(source, extras)` へ一本化（下記14） |
| S9 EditorPane の分離 | **完了（分割の範囲内）**。スクロール/選択ヘルパ261行の移設に加え、7つのcompartment値（折り返し・不可視文字・タブ幅・スペルチェック・テーマ・L Mode・読み取り専用）の計算を `features/editor/editorExtensionSet.ts` に集約し、mount配列と7つのreconfigure effectの二重定義を解消（下記14）。mount effect自体の分割は、IME/L Mode/破棄契約が同居するため対象外のまま |
| S3b Tauriモックビルダー | **実益が減少**。バレル廃止（上記11）でモックが per-area の狭いモックになり、共通ビルダーで置き換える利得が小さくなったため見送り |
| S5 レーン判定のcapability集約 / H3 操作ガード共通化 | 見送り（理由は下表） |

## 見送り・延期した提案と理由

| 提案 | 判断 |
|---|---|
| レーン判定を `getDistributionCapabilities()` に集約 | 見送り。`import.meta.env` の読み取りは既に `distributionLane.ts` 1箇所で、述語も同モジュール内。呼び出し側の述語の使い分けは意味が異なるため、集約の実益が小さい |
| `useWorkspaceFileOps` の操作ガード共通化 | 見送り。共通化すると `workspaceRootPath` の非null絞り込みがヘルパ越しに伝わらず、全呼び出しでrootの持ち回りが必要になり侵襲的。`captureOperation` 自体は既に共通 |
| `WorkspaceSidebar` 45 props の二重配線統合（本丸） | 一部実施。章レビューハンドラは共有化済み（上記8）。残る45 propsは両サイトでキー集合が一致し（AppWorkspace側の追加は `bookScopeReaderLoading` / `onCollapse` / `onReadBookScope` / `treeVisible` の4つのみ）、**機械照合で確認済み**。ただし値の供給元が AppShell=すべて `props.X`、AppWorkspace=`props` の分割代入＋Book Scopeコントローラ等のローカルで、10キーはソース名が異なる。単一ソース型を渡すには AppWorkspace の signature 変更と供給元の統一が必要なため独立スライス |
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
- 検証（この変更の後、レビュー側で再実行可能）:
  - `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`: 成功。
  - `cargo test --locked --manifest-path src-tauri/Cargo.toml`: **511 passed / 4 failed / 4 ignored**。
    失敗4件はすべて `tests::agent_workbench::*_pty_*` 系で、`"Cannot open provider PTY master."`。
    この環境では `python3 -c "import pty; pty.openpty()"` も `out of pty devices` で失敗し、
    **PTYを確保できない実行環境の制約**です（変更前から同一）。
  - `npx vitest run src/buildScripts.test.ts`: 31件成功（IPC surfaceテスト3件を含む）。
  - `npx tsc --noEmit`: エラーなし。
- 独立スポットチェック: `menu.rs` の `MenuItem::with_id` ID集合は分割前後で完全一致、
  supervisorのユーザー可視エラー文字列（`cancelled by user` 11箇所、`timed out after` 等）は保持、
  移動した文字列（target triple・watchdog名）は `helper_transport.rs` に存在。
- **要手動確認**: `tests/menu.rs` は純粋関数のみを対象にしており、メニュービルダー自体は
  自動テスト対象外です。File / Edit / View / Window / Help / アプリメニュー、テーマ切替、
  言語（ja / kana / en）の実機smokeが必要です。
- **要判断（挙動変更ではありません）**: frontend の未参照コード削除で
  `openMainAgentPane()` / `requestApplyAiEditTransaction()` のwrapperが消えた結果、
  Rustの `open_main_agent_pane` / `request_apply_ai_edit_transaction` は
  frontendから到達不能になりました。どちらのwrapperも削除前から参照ゼロだったため
  挙動は変わっていませんが、Rust側は登録・ラベルゲートとも健在です。
  `src/buildScripts.test.ts` はこの2件を理由コメント付きallowlistとして明示し、
  wrapper復活時もstale名検査で落ちない形にしています。**復活させるか退役させるかは別判断**です。

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
