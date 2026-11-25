# Hazakura Editor：第二世代設計に向けた既存実装の再評価

Status: Historical / 調査時点の提案と検証記録
Scope: 現行製品の設計、履歴、移行可能性。製品変更・版割り・出荷判定を含まない
Authority: Low（判断の根拠。着手と仕様の正本ではない）
Last reviewed: 2026-11-25（JST）

基本方針の採用内容は[ロードマップ](../roadmap.md#第二世代設計)、着手候補は[作業キュー](../current-work.md#active-queue)を参照。以下は採否の相談に用いた調査時点の記録で、実験の実施や個別改修の確定を示さない。

## 1. 結論と全体評価

**今作り直しても、Markdown 正本・CodeMirror・Tauri/Rust のファイル境界・限定したネイティブ処理・明示的な Diff 採用は選ぶ。作り直すなら、保存や描画のエンジンではなく「どの文書の、どの操作の、どの結果を、誰が受け取るか」を選び直す。** 比較に最も適した最初の題材は書き出し、損失時の影響が最も大きいのは文書と復旧の所有権。どちらも UI の刷新や全置換を必要としない。

成熟度は面によって異なる。操作を個別に守る層は成熟している（保存前の衝突検出、復旧、限定パス、IPC の窓・レーン検査、生成と採用の分離など）。一方、複数の操作が交差する部分では、同じユーザー操作の状態が React の state/ref、非同期の世代番号、Tauri のウィンドウや Rust の処理単位に分散する。ここを一律に「状態が多い」と捉えると過去のバグ修正を消す。**文書の編集中バッファ、ディスク上の版、復旧チェックポイント、読む位置、書き出す時点、レビュー候補は意味の違う状態**で、一つのストアに集める必要はない。必要なのは、各状態の書き手を決め、境界で対象と世代を照合すること。

| 面 | いま維持する境界 | 第二世代で明示する契約 |
|---|---|---|
| Safe Editor / Workspace | 原文・形式・Undo を維持し、明示保存。復旧は原本への自動保存ではない。Rust がパスと書込みを検査 | 実行中のタブ ID、文書の同定、保存基準の版、復旧キーを区別。移動・Save As・閉じる場面で何を再キー化するかを定義 |
| Preview / L Mode / Reader / Export | 閲覧・装飾・出力は source を変更しない。媒体ごとの認可と失敗を維持 | ソース位置と描画位置を分ける。書き出しは各形式の決められた時点で固定した入力と認可、形式別の結果を持つ |
| Local Assist / Review | 別窓は依頼・会話、Main は対象・生成調停・Diff・明示採用。採用は編集であって保存ではない。オンデバイス、ネットワークへの推論フォールバックなし | 候補を識別子と対象版に紐付ける。現行の書き手を増やさず、使われない旧経路だけ退役する |
| Rust / OS / 配布 | IPC 検査、明示 OS handoff、OS の権限を別々に維持。Store に Workbench を出さない | 窓×レーン×操作の許否と、ビルドされた成果物・署名候補の実操作を別々に検証 |
| CSS / テーマ | 編集・読書の可読性を演出から隔離。テーマやフォールバックに価値がある | 紙面の意味と表示モードを CSS の契約に、背景の実行可否を lifecycle の契約にする。質感を共通化の対象にしない |

### 調査基準・方法

- 基準コミット: `9681d27b5a4dc4e1e2be2e24e0f628fbc401768c`（2026-11-10、開始時の `main`）。既存の未コミット変更あり。関連調査の主基準は HEAD、江戸彼岸の庭・CSS・関連テストおよび配布設定の差は作業ツリーの観察として区別。実行検証も作業ツリーに対するもので、クリーンな HEAD、公開版、提出済み成果物の再認証ではない。既存作業は保持し、リモートを再照合していない。
- [AGENTS](../../AGENTS.md)、[文書索引](../README.md)、[現状](../current-status.md)、[引き継ぎ](../handoff.md)、[製品概要](../product-brief.md)、[配布境界](../app-store-build.md)、[Assist 戦略](../assist-surface-strategy.md)、[Workbench の境界](../agent-workbench-boundary.md)、[OKF 契約](../okf-spec-pin.md)を入口に確認。release・候補状態は調査で確定し直さない。
- フロントの主要 import/call site・ref・イベントから Rust の登録/処理、Swift helper・Objective-C bridge、配布スクリプト、CSS とテストへ追跡し、`git log`/`git show` で代表コミットを照合。網羅的な動的到達性・OS 互換性の証明ではない。履歴は初出または意味が変わった代表点を記し、過去資料は当時の証跡として扱う。以下のコード行番号は調査時点。
- [v3.2 の品質強化](../releases/3.2.0-quality-hardening.md)、[v3.3 依存削減](2026-10-17-dependency-reduction.md)、[内部整理の外部レビュー](2026-10-17-refactor-slices-review-request.md)（`2c8cf98d..e50cc551`）、[横断再確認](2026-10-18-v3.3-regression-review.md)、[テーマ回帰](2026-10-19-theme-regression-review.md)、[LFM3 評価](2026-10-30-lfm3-feasibility.md)を参照。担当 hook の抽出、購読解放、media action、helper RPC transport、モデルストア分離、互換バグ修正は既に行われた。これらのやり直しを提案しない。

## 2. 優先順位

高/中/低は現状からの**見込差**。コスト・回帰は高が難、検証は高が容易。性能は実機未測定の改善余地であり、実測で逆転し得る。P0 は最初に保護・設計・比較を進める意味で、実装や出荷を今すぐ確約しない。P1 は段階導入、P2 は根拠またはゲート待ち、P3 は意図して維持。

| 候補 | 優先 | 保守 | 安定 | 性能 | UX | 拡張 | 自律 | コスト | 回帰 | 検証 | 判断の重み |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A. 文書 ID・保存・復旧・Workspace | **P0** | 高 | 高 | 低 | 高 | 高 | 中 | 高 | 高 | 中 | 原稿を失わないこと。Rust の書込み置換ではなくフロントの同定・結果反映から |
| B. Export セッション | **P0** | 高 | 高 | 低 | 中 | 高 | 中 | 中 | 中 | 高 | 取消後に要求が復活した実績、制御可能な競合、形式別副作用が切り出せる |
| C. AppShell の所有権 | **P1** | 高 | 中 | 低 | 中 | 高 | 高 | 中 | 高 | 中 | A/B/D/E の契約を下から定義し、上の配線を結果として細くする |
| D. Reader のソース位置 | **P1** | 高 | 中 | 中 | 高 | 高 | 中 | 中 | 高 | 中 | 見直しメモ・縦書きに直接効く。同一ページエンジンにはしない |
| E. Assist の旧経路と IPC | **P1** | 高 | 中 | 低 | 低 | 中 | 高 | 中 | 高 | 高 | 旧面の死活と権限を分け、既存の明示採用を単一路に保つ |
| F. EditorPane / L Mode の寿命 | **P2** | 中 | 高 | 中 | 高 | 中 | 低 | 高 | 高 | 低 | 実機 IME/日本語折り返しで同等性を示すまでは互換回避を保持 |
| G. テスト証跡・配布レーンの接点 | **P1** | 高 | 高 | 低 | 低 | 中 | 高 | 中 | 中 | 高 | テストで通る条件と署名物でしか見えない境界を混ぜない |
| H. CSS / 情景の描画所有権 | **P2** | 中 | 中 | 高 | 高 | 中 | 中 | 中 | 中 | 中 | 現行の候補受入後、負荷/停止/可読性の実測で昇格 |
| I. ネイティブ API・helper 構成 | **P3** | 中 | 低 | 未測定 | 低 | 低 | 低 | 高 | 高 | 中 | v3.3 で移行済み。SDK の新しさより互換・隔離・失敗経路に価値 |

## 3. 改修候補と比較設計

①維持、②局所改善、③構造リファクタ、④部分再設計／再実装、⑤退役／統合。強調は推奨する選択肢。代替案の評価は現行バイナリと状態を壊さず比較できることを前提とする。

### A. 文書 ID・保存・復旧・Workspace — P0

- **現状と問題。** タブの UI 身元、CodeMirror のセッション、path あり/なしの復旧、ディスク内容・形式、読む位置の寿命が違う。実装ごとのキーの違い自体は妥当だが、文書を閉じる・移動する・別名保存する際に、完了した操作が旧タブ/新タブのどちらに属するかをそれぞれで判断している。`a1c01897` の v2.9 品質強化、v3.2 の競合修正、v3.2.1 の一覧更新と旧応答拒否は維持する。明示的な一覧更新/復帰時/表示中の有界ポーリングを、常時ファイル監視や索引で置き換えない。
- **具体的な調査点。** [useAppCloseActions:69–115](../../src/hooks/app/useAppCloseActions.ts#L69-L115) の clean menu/OS quit は Assist 停止を待って最新 dirty を再確認する。一方、[controller:1009–1028](../../src/hooks/app/useAppShellController.ts#L1009-L1028) から渡す停止→flush は、[Save All:226–258 / Discard All:283–338](../../src/hooks/editor/useTabCloseFlow.ts#L226-L338) の最終 exit 前に同じ再確認を持たない。確認後の非同期停止中に別の編集が入る場合は要再現。既存の未保存保護が機能していないとは断定しない。赤ボタンの hide とアプリ終了は別契約。Discard は同意を得た版だけを対象にし、その後の編集にまで同意を流用しない。
- **比較。** ①複数キーの運用でも既存データは維持できるが、境界ごとの照合を追加し続けることになる。**②先に quit の契約を固定し、再現時だけ最小修正。③次にフロントの文書セッションを所有者にし、path/recovery との関係を一スライスずつ定義する。** ④永続化全体の再実装は移行前データと強制終了での同等性が必要で見送る。⑤バックアップ、クラッシュ復旧、Workspace セッション、位置を統合ストアへ潰さない。保存の書込み/自由な path を JS へ移さない。
- **移行と検証。** `DocumentSessionId`（実行中）／永続化の識別子／ディスク版／編集版／権限を区別。Save As、既存文書の close→reopen、case-only rename、フォルダ移動、外部置換、クラウド遅延、権限失効を別ケースとして、タブ・最新ディスク状態・元の復旧記録を突き合わせる。既存 schema のまま旧ロジックと判定を並走比較し、書込みは片方だけ。将来の schema 変更も読み取り互換・旧記録保持・選択した復旧を前提にし、余分な書込みや暗黙の上書きを起こさない。既存挙動の基準は [useTabCloseFlow.test:481–550](../../src/hooks/editor/useTabCloseFlow.test.tsx#L481-L550)、[Workspace restore](../../src/hooks/workspace/useWorkspaceRestore.test.ts)、[Draft persistence](../../src/hooks/document/useDraftPersistence.test.tsx)、[Rust ファイルテスト](../../src-tauri/src/tests/files.rs)。強制終了直後、外部/cloud ファイル、Save As ダイアログ、サンドボックスでの復旧は実機で原稿・復旧領域・直前ディスク bytes の三者を確かめる。

- **構造上の証拠と保全点。** [editorTabs:13–113](../../src/features/editor/editorTabs.ts#L13-L113) の `id`（既存文書は path）/`sessionId`（Save As で維持、`c4be75bd`）/`recoveryId`（`9c07f09c`）、[useSaveActions](../../src/hooks/document/useSaveActions.ts) のセッション単位重複防止と in-flight 編集維持、[useEditorTabsPathRekey](../../src/hooks/editor/useEditorTabsPathRekey.ts) のタブ・選択・復旧・recents への伝播を比較する。400ms の復旧と workspace の周期バックアップは目的が異なる。dirty 判定の encoding は [DraftRecord:474–489](../../src/types.ts#L474-L489) にないため、形式だけ変更→復旧も受入に追加（復元方針を明示し、勝手に保存しない）。[files.rs:211–313](../../src-tauri/src/commands/files.rs#L211-L313) の衝突比較・no-overwrite と、[util.rs:741–952](../../src-tauri/src/util.rs#L741-L952) の同ディレクトリ一時ファイル・属性保存・特定の権限条件下での直接書込み/失敗復旧は、OS API 一行で置換できるとは扱わない。保存全経路の原子的動作を一般化もしない。

### B. Export セッション — P0

- **現状と問題。** [useDocumentExport:118–251](../../src/hooks/document/useDocumentExport.ts#L118-L251) に latest refs、prepare 世代、単一 attempt、表示中 dialog を閉じる callback がある。HTML/PDF/EPUB を切り替えられる一つの UI の中で、形式別 open/決定/取消、元の dialog を残す非同期 preflight、最終 I/O が絡む。v3 一本化と 10 月の抽出で制御は既に共通化されたが、日常の回帰では取消後の復活を `daf6d7ff` で閉じた。単に bool を reducer へ移すのでなく、何を固定する段階かと、取消がどの外部操作まで効くかが設計の中心。
- **比較。** ①三形式の既存機能/副作用順を維持。②新たな競合にガード追加は短期には有効。③state/ref をまとめるだけでは入出力の違いが隠れる。**④prepare/確認/実行（picker・render・write を識別）/完了のセッションだけを部分再実装し、形式別 adapter と現行 UI/native 処理を残す。** ⑤三形式を同一レンダラ/出力形式に統合しない。
- **設計の要点。** `exportId`、対象セッション/ルート、現画面と準備中の切替、媒体認可、commit 済みかの型を定義。旧リクエストの結果を捨てることと、すでに OS に渡った処理の取消を区別する。入力は無条件に開始時固定にはしない：[HTML テスト:521–628](../../src/hooks/document/useDocumentExport.test.tsx#L521-L628) が固定する「同じ文書なら保存ダイアログ完了後の最新内容」「文書が変われば中止」を維持し、Book/形式ごとにも原稿を取り込む時点を表にする。picker・目的地、読込み、生成、書込み、表示の順序/失敗契約は adapter ごと。旧/新で実ファイルを二重に書いて比較しない。
- **方式差を残す例。** [HTML:684–741](../../src/hooks/document/useDocumentExport.ts#L684-L741) は picker → 最新本文 → 画像 → text write。単一 PDF は [確定時の本文と画像処理:491–640](../../src/hooks/document/useDocumentExport.ts#L491-L640) → picker → native capture/write。EPUB は [Book の章取得を先に、picker 後に画像・梱包:808–890](../../src/hooks/document/useDocumentExport.ts#L808-L890)。PDF/EPUB の単一文書ガードは `tabId` を使い、HTML の `sessionId`/root 照合と同じではない。同一 path の開き直し、Book の章本文を取得した後に目次やルートが変わるケースを比較対象にする。特に EPUB は章を先に採り、梱包時に現在の章ナビゲーションを読むので、同じ版で対になることを検証する（実際の誤出力は未再現）。
- **テストと受入。** [useDocumentExport.test](../../src/hooks/document/useDocumentExport.test.tsx) 48件には切替中に元を確定、連続切替、取消、失敗、unmount、認可、Book のライブ本文/不足章を含む。static import の縛り (:486) は挙動テストではなく診断用。追加は prepare/画像/保存先/書込みの各 await で cancel・タブ切替・ルート変更・遅延応答を固定順で発生させ、0/1回の I/O と認可一致を検証。実機は三形式の内容、置換確認、別形式とテーマ/PDF 組版、保存先と原文のハッシュ、サンドボックスでの失敗。HTML は本文/リンク/画像、EPUB は archive 構造と章順（時刻を固定）、PDF はページ数・抜き出し文・矩形/見た目を比較する。
- **Native PDF は別スライス。** [export.rs:146–208](../../src-tauri/src/commands/export.rs#L146-L208) → 隠し WKWebView → [createPDF と結合:425–499](../../src-tauri/src/commands/export.rs#L425-L499)/[576–636](../../src-tauri/src/commands/export.rs#L576-L636)。Swift の PDFKit 抽出は Import Assist であり、書き出しの helper ではない。予算関数には件数による増分テストがあるが実呼出は `None`（60秒）。[pdfCaptureSize.test](../../src/features/document/pdfCaptureSize.test.ts) は埋込み JS を fake DOM で動かすが章 spacer は通らない。多数章/画像、縦書き時の横方向ページ、不成立時の遅延 callback と cleanup を受入対象に置き、タイムアウト変更は実測後に判断する。

### C. AppShell の所有権 — P1

- **現状と成立。** `fbf94c22` の初期 wiring、`704e98be` の Foundation、`aae05ce6` の品質分離、`11097b7b` の Reference 抽出、`8fd6e76b` の Sidebar 配線統合。分割は実在するが、[Foundation:38–91](../../src/hooks/app/useAppShellFoundation.ts#L38-L91) が leaf state と setter を平坦化し、[Controller:996–1028](../../src/hooks/app/useAppShellController.ts#L996-L1028) や [出力部分:1480–1859](../../src/hooks/app/useAppShellController.ts#L1480-L1859) で誰がどの状態を書けるかを横断して調べる必要がある。[AppShell:316–335](../../src/components/app/AppShell.tsx#L316-L335) は見た目の境界で、文書操作の所有境界ではない。課題は props の個数ではなく、編集・選択・ウィンドウ・Assist のリクエストをどの順に解決するかが composition root に依存する点（A の quit は例）。
- **比較。** ①composition root 自体は維持。②props グループ化は名前を改善しても所有は不変。**③文書・読書位置・書き出し・提案ごとに「コマンド＋読み取り専用 view」の境界に寄せ、窓・メニュー・フォーカスの配線だけ root に残す。** ④グローバルストア/全面再実装は責任を再集中させるので不要。⑤重複した入口は意味が同じ操作だけ統合、hide/quit や source/derived は混ぜない。
- **移行と受入。** 一度に provider を差し替えず A/B のそれぞれ一操作を view adapter 越しに移す。Native menu/キーボード/ボタンで同じ command outcome、モーダル中の操作抑止、focus 復帰、StrictMode/unmount で二重購読・二重保存なしを検証。既存の [AppWorkspace.test](../../src/components/app/AppWorkspace.test.tsx) の Reading Focus/Sidebar と [AppShell.layers.test](../../src/components/app/AppShell.layers.test.tsx) の面の契約を維持、props forwarding/内部 setter の一致より利用者が見える動作を比較。実機は Cmd+Q、Dock reopen、赤ボタンと別窓、menu/VoiceOver focus。起動・typing の改善は実測するまで利得に数えない。

### D. Reader の位置・検索・章 — P1

- **現状と成立。** 単一文書の PoC `d9b34e45` から [EBookPane](../../src/components/editor/preview/EBookPane.tsx) は H1/H2 の章、CSS Columns、ページ/見開き、source line への復帰を持つ。`fa4d97f5` の [BookScopeReader](../../src/components/workspace/BookScopeReader.tsx) は章ファイル順の縦スクロールで、章相対 path＋冊子全体の scroll ratio を保存。lazy Preview の高さが確定するまで復帰を再試行する（[127–237](../../src/components/workspace/BookScopeReader.tsx#L127-L237)）。[bookScope/reader:35–105](../../src/features/bookScope/reader.ts#L35-L105) のライブ本文優先・順序・上限・欠章報告は PDF/EPUB と共有済み。検索も、一方は UTF-16 の原文範囲から行と推定ページへ、他方は [読み込み済み各章の NFKC 正規化後の一致数:108–176](../../src/features/bookScope/reader.ts#L108-L176) から章へ移動する。正規化後の検索座標を原文の選択・置換に流用しない。[Book 再開レジストリ v1](../../src/features/bookScope/readingPosition.ts#L7-L91) は app-private。10月整理でページ計測統合を実機順序の影響から見送った判断も踏襲する。
- **問題。** ページ数/スクロール比率は表示サイズ・画像・組版・章追加で変わる。これを原稿へ戻る位置やメモの恒久キーにはできない。[EBookPane:543–664](../../src/components/editor/preview/EBookPane.tsx#L543-L664) の初回計測と遅延再計測は同じ章で暫定ページ数を下限にするが、章切替では床を持ち込まない。ここを共通化するだけでは再計測の契約を失う。Book の全章 DOM と比率復帰の負担も、現段階では仮説であり仮想化を前提にしない。
- **比較。** ①二つの renderer の維持は正しい。②復帰再試行の短縮だけでは viewport に従属する。**③本文側の位置型（文書の同定、章/見出しと原文範囲、移動元の版、近傍での復帰候補）と、それを各 surface の描画位置に変換する adapter を導入。** ④ページ計測の部分再実装は縮尺・画像・IME 隣接・縦書きの機器比較後。⑤UI、章概念、検索 UX を一体化しない。既存の章取得・media 操作は再利用する。
- **移行と受入。** 旧 path/ratio と単一 Reader の位置を読み取り互換として残し、新 anchor をメモ等へ展開する前に純粋な読取/復帰判定を shadow 比較。見出しの重複・行追加、章 rename/deletion・未保存 vs disk、検索空文字/CJK/絵文字・一致ゼロ、画像遅延中の移動、横/縦/幅・文字サイズ変更で検証。曖昧な復帰は最寄りや章先頭へ明示的にフォールバックし、異なる原稿に黙って紐付けない。[EBookPane.test](../../src/components/editor/preview/EBookPane.test.tsx)、[BookScopeReader.test](../../src/components/workspace/BookScopeReader.test.tsx)、[SidePane.test](../../src/components/app/SidePane.test.tsx) はページ状態/章順/移動/モード間復帰の基準だが、実際の柱・フォント・画像寸法は jsdom で測れない。まず純粋 anchor で比較し、描画は実機で位置ずれ・初回安定時間・連続ページ操作・最終 RSS を測る。
- **媒体の基盤は維持。** Preview と EBook の既済共通化は `2dee3d35`（media actions/key）。選択中のクリック扱い、Book の子文書基準、出力時の埋込み等は異なる。[媒体境界](../v1.xx-image-media-boundary-plan.md) の deny/承認/通信を一律に同じ UI にしない。renderMarkdown は安全な表示への共通入口として維持し、CodeMirror の構文木と単一パーサーにまとめるためだけの置換はしない。

### E. Local Assist の旧経路・IPC — P1

- **現状と成立。** `9e2ee301`（提案分離）→ `9011d3a6`（固定対象の会話）→ `ae4ab871`（本体 Diff）→ `d675de19`（採用を Diff に集約）→ `4d1ee8ee`/`16e438eb`（別窓復帰と識別子付きレビュー遷移）。[AppleAssistWindowApp:665–764](../../src/components/appleAssist/AppleAssistWindowApp.tsx#L665-L764) が依頼し、[useAppleAssistProposalHandler:77–154](../../src/hooks/editor/useAppleAssistProposalHandler.ts#L77-L154) が Main の対象と現在の版を照合。[LocalAssistProposalReview:89–145](../../src/components/app/LocalAssistProposalReview.tsx#L89-L145) → [単一の apply handler:26–63](../../src/hooks/editor/useAppleAssistApplyHandler.ts#L26-L63) → [バッファ更新:36–89](../../src/hooks/editor/useLocalAssistReviewActions.ts#L36-L89)。採用は表示した案を一度だけ編集へ反映し、保存は行わない。窓を開く/移す・プレビュー・採用は別の権限。
- **退役と保持を分ける。** `request_apply_ai_edit_transaction` は [Rust 登録:251–284](../../src-tauri/src/lib.rs#L251-L284) と [旧転送:445–455](../../src-tauri/src/commands/app_window.rs#L445-L455) に残る。現行 production TS の送受信は静的追跡で見つからず、Rust は転送のみで本文を書かない。`open_main_agent_pane` も明示の未使用 IPC allowlist。旧 `useAppleAssistCandidate`/`LocalAssistSidebar` は主にテスト、[AppleAssistReviewBar のマウント:350–357](../../src/components/app/AppShell.tsx#L350-L357) は残る一方、旧ストアへ記録する production 参照は見つからない。**非 stream の生成は [モデル設定の試し打ち:103–160](../../src/components/app/CoreAiModelManager.tsx#L103-L160) が使うため退役しない。** System 専用 probe の旧コマンドは新 wrapper と照合し別判断。[停止:384–397](../../src-tauri/src/commands/apple_assist.rs#L384-L397) の ID なし停止・別窓 close と現行の ID 付き取消は別動作。設定の試用と文書依頼が干渉するかは実機未確認。
- **比較。** ①別窓・Main の機能分担は維持。②旧名の rename だけでは登録や権限が残る。**⑤参照がないと確認した旧表示/IPC を各一件ずつ退役。③依頼・取消・完了を request/conversation/document revision で型付きにし、Main の所有権を明示。** ④推論や同時実行管理の再実装、外部 provider・保存 API の追加はしない。独立した Review Desk の手動入力まで統合しない。
- **テストとゲート。** [提案 lifecycle](../../src/hooks/editor/useAppleAssistProposalHandler.lifecycle.test.ts)、[採用統合](../../src/components/app/LocalAssistApply.integration.test.tsx)、[supervisor](../../src-tauri/src/tests/apple_assist_supervisor.rs) は同一性、重複防止、予約/取消/late result の基準。採用統合には現行マウントのない Sidebar を使う harness がある。追加は現行別窓→Main Diff→採用/破棄→Undo→明示保存、同じ path を開き直す、実行中に別窓を閉じる、設定試用との交差。capability は各窓の core/plugin 権限、独自コマンドは Rust の窓×レーン検査、ファイル権限は OS sandbox の別層。両レーンの許否を確認してから撤去し、一件単位で元に戻せるようにする。書き手の二重化や内容を含む診断ログを許さない。

### F. EditorPane / L Mode / CodeMirror — P2

- **現状と成立。** `02aa71d1` からの EditorPane 寿命に、文書切替・L Mode・設定 reconfigure・復帰が重なった。[mount:519–606](../../src/components/editor/EditorPane.tsx#L519-L606) は session/kind/L Mode を境界とし、同一セッション等では履歴を引き継ぐ。終端処理・選択・double rAF の復帰がある。コメントだけで「モード変更時に Undo が常にリセット」と判断しない。`2ce41cf9` の tile tree 回避、`ed2b5cb7` の復帰/スクロール抽出、`bdf81635` の compartment 値集約を経て `daf6d7ff` は初期化 vs reconfigure の不可視文字差を修正。`@codemirror/view` は `6.43.13` pin を維持。依存の直接宣言・回避の整理は既済で、アップデートを先行させない。
- **比較。** ①日本語長文、IME、Undo、read-only/Assist lock、保存後のカーソル維持を優先。**②現在も必要な全体再初期化と設定差し替えを表にし、実機差分を一条件だけ検証する。** ③状態と view 寿命を分離するのは、mount/reconfigure の同等性を示した後。④タブをまたぐ EditorState キャッシュや同一 view の全面流用は、履歴漏れ・DOM/IME の影響が大きい。⑤L Mode 廃止/別 WYSIWYG モデルへの統合は価値と source 正本を損なう。
- **検証。** [EditorPane.test:199](../../src/components/editor/EditorPane.test.tsx#L199) の不可視文字と [:1279](../../src/components/editor/EditorPane.test.tsx#L1279) の Save As、[L Mode extension tests](../../src/features/editor/lMode/extension.test.ts) の source 保全を利用。`ResizeObserver` の文字列チェックだけで viewport の正しさは保証しない。長い日本語・URL/絵文字、スクロール中の行、横幅変更、変換候補表示中のモード/タブ変更、Undo/Redo と保存 bytes、別文書履歴非混入を実際の WKWebView＋日本語 IME で確認。paragraph/Unicode のカーソルと wrapping は jsdom の no-op 矩形では判定不可。悪化時は pin と現 mount 境界に戻す。

### G. テスト証跡とビルド・配布レーン — P1（追加候補）

- **現状と成立。** `e7330ec3` の Store レーン、`d698a936` の Quality workflow、`780468a0` の Agent CSS/JS 分離確認。Store と Developer は [Vite entry と CSS:5–41](../../vite.config.ts#L5-L41)、[配布設定](../../src-tauri/tauri.conf.json#L31-L46) と [Store 設定](../../src-tauri/tauri.conf.appstore.json#L3-L19)、[Rust のレーン](../../src-tauri/src/distribution.rs#L17-L63)、さらに embed・署名・entitlement・asset pack で意味が異なる。[npm の build scripts:10–31](../../package.json#L10-L31) 上も `build` は Store preview、submit や developer と同義ではない。**複数層の防御は重複ではない**。問題は「何を実際に通したか」を一貫して追える証跡が少ないこと。
- **具体例。** [Quality:33–53](../../.github/workflows/quality.yml#L33-L53) は Rust/codec oracle/reconnect/Swift を実行するが、fixture の生成と [Rust の明示 env による実行:295–315](../../src-tauri/src/tests/apple_assist_supervisor.rs#L295-L315) は同じでない。現 workflow でその env の設定は確認できず、通常テストの緑に conditional early return が混在し得る。専用 native HTTP/PDF harness も過去記録と同じ CI ゲートではない。Linux + jsdom の CSS は無効で、[test-setup:44–69](../../src/test-setup.ts#L44-L69) は Storage 契約を復元するが、Range 幾何を no-op にする。これらは実機を模倣したというより、テスト対象を限定する意図的な設定。
- **比較。** ①手元の各コマンド・ゲートは維持。②fixture を期待するジョブでだけ「fixture 利用済み」を明示検査する。**③実行証跡を source/fixture/kernel/real host/bundle/signed distribution に分類し、両レーンの入力設定と生成物の組を記録する。** ④単一メタビルドや広範な UI 自動化へ置換しない。⑤挙動テストを追加できてから重複した構造ガードを個別に整理。配布レーンそのものと Playwright なしの運用は維持。
- **移行・受入。** まず fixture の mode、実行/skip/対象外と、成果物のレーン/入力コミットを可視化する。既存の [source 面検査](../../src/buildScripts.test.ts)、[出力の Agent/Xterm 確認](../../scripts/check-frontend-bundle-boundary.mjs#L39-L46) は保持し、新しい CI 条件を並走して欠落があれば fail することを確認。将来レーン設定の宣言を整理しても、独立した成果物検査まで生成しない（同じ誤りを双方が出力するため）。署名 pkg/TestFlight、entitlements、同一ビルドの native GUI は [配布手順](../app-store-build.md#L411) と [smoke](../smoke-checklist.md) の別ゲート。スクリプト変更をする場合も配布結果を照合し、既存コマンドを切り戻せるようにする。

### H. CSS・情景の描画所有権 — P2（追加候補）

- **現状と成立。** `94566529` の S0–S9・紙面深度、`3537e8dd` の three.js 情景。既に [ambient 経過時間:60–81](../../src/features/theme/ambientRenderBudget.ts#L60-L81) などが共通で、文書と描画を分離している。対して CSS は [読書・紙面・素材・組版を順序で適用:29–43](../../src/styles/index.css#L29-L43) し、装飾は複数 renderer の lifecycle がある。作業ツリーでは [庭/3D の選択:215–257](../../src/components/app/AppShell.tsx#L215-L257)、庭側の [viewport・停止判定](../../src/components/app/EdohiganGardenBackdrop.tsx) と [Scene の import・failed fallback・cleanup:542–603](../../src/components/app/EdohiganSceneBackdrop.tsx#L542-L603)、[描画 loop:1218–1376](../../src/components/app/EdohiganSceneBackdrop.tsx#L1218-L1376) が広幅/狭幅・集中・比較・Reader に応じて切り替わる。現 CSS fallback や停止回避は不要な互換処理ではない。
- **問題と比較。** 紙面色・可読性の有効値が CSS 順序と mode/renderer に分散し、描画の停止・再開・静止再描画も renderer ごとに検証が要る。①現在のテーマごとの画質とフォールバックを維持。**②現候補の実機計測を先行。③必要なら `writing/reading/compare` の紙面 token と `running/still/stopped` の契約を限定して共通化する。** ④three.js や全 CSS の置換は計測が裏付ける場合だけ。⑤演出、WebGL/CSS fallback、別窓のテーマを一律には潰さない。
- **テストとゲート。** [AmbientRenderLifecycle:107–171](../../src/components/app/AmbientRenderLifecycle.test.tsx#L107-L171) は fake rAF/GL で hidden/blur 中の停止・復帰・強度維持を検査するが three.js はこの行列の対象外。[Scene の CSS テスト](../../src/styles/edohiganSceneCss.test.ts) の selector/宣言検査は計算済みの色・読める紙面の証明ではない。追加は遅延 import と unmount、素材読込と縮尺変更、低モーション、窓切替で二重ループなし、破棄後の texture/observer 更新なし。実機は DPR/Retina、Intel/Apple Silicon、60/120 Hz、7テーマ、200%文字/狭幅、入力時 frame time、ウィンドウ隠し/低モーション時の CPU/GPU、contrast と VoiceOver を分ける。色や CSS 宣言を変えただけで合否を判定しない。現 renderer/切替を残し、1 surface または 1 lifecycle のみ戻せるようにする。

### I. OS API・Rust/Swift の構成 — P3（現状維持）

- **既に現代化している所。** `f5dc7a92` は [rfd と main thread:171–201](../../src-tauri/src/commands/native_dialog.rs#L171-L201)、`c32a78d8` は [iconv + 互換層/UTF-8 SIMD](../../src-tauri/src/text_encoding.rs#L23-L92)、`af4b604d` は [NSURLSession](../../src-tauri/native/remote_image_bridge.m#L205-L269)（Rust に MIME/サイズ等の検査）、`f4588002` は [PDFKit 抽出](../../src-tauri/src/import_assist/helper.rs#L162-L249) へ移行済み。Swift PDFKit/Vision helper と in-process text fallback は用途・プロセス隔離が別で parser は同じ。互換 codec の速度低下と PDF parser 多様性が減ったことは [依存削減](2026-10-17-dependency-reduction.md) の採否に織り込み済み。
- **所有権と残る互換。** Rust の [helper supervisor wire:976–1125](../../src-tauri/src/commands/apple_assist_supervisor.rs#L976-L1125) は固定 sidecar、予約・取消・watchdog、[Swift dispatch:120–247](../../src-helpers/apple-assist/Sources/HazakuraAppleAssist/main.swift#L120-L247) は直列要求のモデル実行。`2515b68c` で transport は共有済みだが、Import の一回ごとの子と Assist の再利用は同一にしない。`backend` 省略を System とする [compat](../../src-helpers/apple-assist/Sources/HazakuraAppleAssist/AssistBackend.swift#L9-L37) は旧 fixture/契約に現役。モデルは `240474b6`/`d930267d`/`a4dbd6bd` を経て分割、Rust が選択・manifest/receipt/pack/version と再接続、[Objective-C bridge](../../src-tauri/native/background_assets_bridge.m#L133-L335) が OS へ委譲、[Swift extension](../../src-native/background-downloader/BackgroundDownloader/DownloaderExtension.swift#L5-L13) は取得側で推論をしない。OS 26 以上と Core AI の 27 以上を混同しない。通常 Developer に production Core AI sidecar はなく、登録 UI から実推論を保証しない。
- **比較と再開条件。** **①現行の責務分担と互換を保つ。** ②fixture/実機失敗に対応する限定修正。③新たな FFI 上の根拠が出れば ownership/leak の改善だけを抽出。④全部 Swift、すべて in-process、最新 Core AI SDK への刷新は isolation・OS 最低版・メモリ・配布の同等性が示せるまで見送り。⑤codec 互換・明示ダイアログ・PDF fallback は削らない。削減効果を測る場合も、現 pin または OS API で public 互換/失敗の全条件を比較する。
- **検証。** [v3.3 証跡](2026-10-18-v3.3-regression-review.md#L32-L86) の native HTTPS 55 checks、PDFKit 20 fixture/ASan、明示 fixture の helper 47件は履歴として参照する。新たに変えるなら helper 不在/異常終了、特殊な PDF/OCR/日本語 codec の oracle 差分、timeout/メモリ・再接続・削除/再登録を比較する。実利用可能な System/production Core AI、外部 bookmark、16 GB クラス、署名済み Store の取得・再起動・選択・生成は別の実機ゲート。モデルや依存をこの調査で再選定していない。

## 4. 推奨ロードマップ（提案、版割りなし）

1. **並行で進める：既存候補の受入と比較の土台。** 現行のテーマ・実機確認を継続。G はテスト証跡を明確にするだけの小スライスから。実験 1 と 2 は独立し、製品コードに同時に手を入れる必要はない。
2. **P0 を安全性と設計で分ける。** A は quit 仮説の再現と保護が先。再現すれば小修正を独立させ、再現しない場合は観測条件を記して設計課題に留める。次に文書 ID/版/復旧の関係を一操作だけ明示する。B は仕様の比較が成立してから形式別 adapter の間に制御を入れ、まず一形式・次に形式切替を移す。章取得/書き出しの入出力は現行ファイル形式のまま。
3. **P1 は機能と並走。** メモ用の文書識別子は A の方針に合わせるが、手動の編集ルールメモや最初の単一文書メモは全永続化移行を待たない。まず本文に埋め込まず、書き出しにも混ぜず、明示した範囲で保存・削除する。読書中の見直しメモと再開メモは D の source anchor を利用し、位置の曖昧さを処理してから範囲を広げる。縦書きは Reader の表示アダプターから入り、EditorPane の刷新を条件にしない。実機 WKWebView で列順・ルビ・約物・画像・検索ジャンプ・文字サイズ・選択とキーボードを受け入れ、出力は B の形式別契約の上で EPUB の対応リーダー、PDF の組版をそれぞれ判断する。CSS `writing-mode`/`text-orientation` は実装案であって、ページ送り/EPUB の互換性を保証しない。
4. **C と E は下から移す。** A/B/D の境界ができるごとに、Main の配線を一操作ずつ読み取り view と command に変える。E の明確な未使用経路確認は並行可。採用・取消の契約変更は A の文書同定、G の窓×レーンの証跡を先に用意する。メモ生成や本文への追加推敲は [既存の品質ゲート](../post-v3.1-writing-completion-draft.md) と [LFM3 評価](2026-10-30-lfm3-feasibility.md) を飛び越えない。
5. **P2/P3 は事実が変わるまで待つ。** F と H は実機差/負荷の測定に基づき、対象が限定できる場合のみ別スライスに昇格。I は依存の個数を目標にしない。P0/P1 が終わるまでメモ・縦書き・現行候補を止める進め方は採らない。

### 共通の比較手順と中止条件

| 検証層 | 比較のしかた | 採用を止める条件 |
|---|---|---|
| 純粋契約 | 旧実装から得た結果（原稿の bytes、タブの dirty、位置、章順、候補同一性）を、意図する仕様と照合して fixture にする。既知の欠陥は同値化しない | 原稿変更・権限拡大・明示同意消失・元に戻れない移行 |
| 非同期・副作用 | Promise/barrier で完了順を固定し、fake port で request/書込み/採用回数・取消後の遅延・cleanup を採取。本番で新旧二経路の書込み/推論/通信を走らせない | 0/1回の副作用契約違反、別 document/revision への適用、古い反応の表示/書込み |
| 生成物・互換 | EPUB はエントリと spine/リンク、HTML は構造と画像認可、PDF は組版/テキスト/ページ、保存は原文 bytes と改行/encoding。復旧は旧 snapshot をコピーして再起動・強制終了・読み取り失敗まで | ページ/文の欠落、フォーマット別の既存保証や復旧記録を失う、別レーンに権限が出る |
| 性能 | 同一ソース/設定・同じ Mac/OS/レーンで旧→新/新→旧を繰り返し、冷/温を別に中央値/p95・範囲を記録。10万・30万文字の日本語（散文/表・コード/遅延画像）、複数章、狭幅/Retina。起動から入力可、入力から paint、Reader 安定/位置ずれ・画像 IPC/DOM数、書き出しの render/write 分離、CPU/GPU/peak RSS を計測する | 本文・採用・復旧は性能に優先。性能目的の変更は測定の揺れ内なら見送る。初回の反復で分散を確かめて許容値を合意し、自動化の経過時間だけの優位を採用しない |
| 実機・配布 | [smoke](../smoke-checklist.md) の使い捨て原稿と隔離アプリ。macOS 26/27、Intel/Apple Silicon、普通/Retina、Store/Developer の対象行のみ実測。IME、VoiceOver、赤ボタン/Cmd+Q、Finder・iCloud、署名版の sandbox と TestFlight/モデル取得は別記 | jsdom/Vite/surface の成功から実機や出荷の完了を推定しない。同じ候補で確認が必要な項目が残れば未受入 |

過去比較値の例: [v2.9 の jsdom 原稿処理](2026-09-08-v2.9-quality-hardening.md#L55-L59) の 10万/30万文字の中央値は散文 137.5/443.6 ms、表・コード 651.8/4,237.4 ms。実機ページ描画ではない。[v3.2 の機器記録](../releases/3.2.0-dependency-acceptance-draft.md#L105-L141) は約8.7万字・360節の PDF 151頁、[v3.3](2026-10-18-v3.3-regression-review.md#L42-L86) は隔離アプリで三形式の実保存と原稿8件の SHA 不変。いずれも今回の環境・現候補の性能とは比較できない。

## 5. 最初の実験（すべて未実施、着手候補）

1. **B：書き出しの副作用トレース比較（推奨する最初の設計実験）。** 既存テストを起点に `PDF visible → EPUB preparing → 取消/旧形式を決定 → EPUB 旧応答`、同文書内の picker 中の編集、別タブへの移動を、fake picker/renderer/writer で再生。旧のイベント順と、新しい制御器の `write`/`reveal` 回数・snapshot・表示形式を比較。取消/失敗時に新形式が復活しない、同文書の最新内容契約を保つ、意図した出力だけが1回、が合格条件。違えば現制御を維持し仕様差を先に決める。実ファイル/通信/権限変更なし。
2. **A：終了直前の再編集（推奨する最初の安全性実験）。** dirty A で quit→Save All→Assist 停止 promise を保留→B を編集→停止完了。Main の実 state を使う harness で `exitApp` 0回、B が dirty のまま、必要な確認が再提示されること。Discard All でも新しい版を廃棄しないこと、赤ボタン hide の意図を維持することを別例で確認。現コードが落ちる再現を得るまで不具合としない。実原稿に触れず、終了は fake。仕様差が出たら大規模移行ではなく判定境界だけ直す。
3. **D：source anchor の読み取り専用比較。** 単一原稿の H1/H2 と Book の相対 path を基に、同名見出し・行挿入・章移動・未保存本文・画像が遅い場合を synthetic fixture で比較。新 anchor が同じ source に戻るか、曖昧なら警告/従来位置へ落ちるかを測る。マークダウン/旧 registry を書かず、全章ページャーや UI を作らない。メモと縦書きの前提に使える精度か、人間が例を見比べて判断する。

## 6. 改修しない判断

- **編集モデルの全面置換はしない。** React/Tauri/CodeMirror、Markdown 正本、marked/DOMPurify を維持。表示のパースと編集の構文木には異なる利用条件がある。IME・Undo・source preservation の代替裏付けがない。テーマ演出の不具合から本体フレームワークの限界とは判断しない。
- **無条件に単一の Reader / PDF / Preview renderer にしない。** 画面、紙、EPUB それぞれの柱と媒体許可、選択、リンク、表紙/余白が異なる。共通化はソース側の参照と、意味が同じ純粋処理まで。Reader を広範な検索基盤にもしない。
- **権限や保存の重ね合わせを取り除かない。** パス、symlink、OS sandbox、Rust 窓検査に別々の意味がある。[明示 workspace 検索:53–155](../../src-tauri/src/commands/search.rs#L53-L155) は件数/内容の上限と旧結果無視で維持。[OKF review](../v1.11-okf-draft-preview-design.md) は個別の budget/cancel と選択の契約。大小比較を理由に常時 index、全体監視/自動修正、汎用サービスを作らない。Native dialog、文字コード互換、保存の失敗経路は契約が残っているので維持。
- **Local Assist の外部化、Store と Developer の一本化をしない。** System の利用可否・Core AI の配布/権限・手動採用を分ける。過去の名称（Apple Assist）を理由に現役の窓・非 stream 生成・生成プロトコルを削除しない。

## 7. 今回の検証・残る不確実性

| 実施したこと | 結果・適用範囲 |
|---|---|
| Hazakura Habitat 1.1.1、基準 SHA、Git status、既存差分の確認 | npm と Cargo の用途をスクリプトで照合。既存依存を使用し、Swift の Core AI フラグを外し、Cargo は offline/locked。ローカルのインストール、Playwright/専用ブラウザー導入なし |
| `npm run typecheck`、`npm test`、`npm run smoke:app-store-surface` | 型検査成功、frontend **343 files / 3,190 tests**、scripts **31件**、source-level Store **137件**。jsdom canvas 等の警告あり。Mac の描画/署名物は範囲外 |
| 既存 Vite を二つの一時出力先で build、[成果物検査](../../scripts/check-frontend-bundle-boundary.mjs) を各レーンで実行 | 両成功。Agent entry/CSS/Xterm の有無を確認。frontend の生成物のみ。Developer JS/CSS は 3,175,056 / 309,695 bytes、Store は 2,829,695 / 297,752 bytes（非圧縮の全出力合計）。main は約1.75 MB、three.js は遅延約737 kB。chunk 警告あり。起動時のロード量・RSS・GPU 測定ではない |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`、`cargo test --offline --locked --manifest-path src-tauri/Cargo.toml` | fmt 成功。テストは **511 成功 / 4 失敗 / 4 ignored**。全件の再実行でも同数。失敗は Agent Workbench の `Cannot open provider PTY master.`（端末サイズ・stdin・resize・PATH の4ケース。過去レビューと同じエラー）。helper fixture の指定はなし。ignored の codec oracle 等を含め全ゲート成功とは扱わない |
| `swift test --skip-update --package-path src-helpers/apple-assist`（Core AI ビルド用フラグを外した default） | DSH の sandbox がホストの clang cache 書込みを拒否し、SwiftPM manifest 段階で失敗。Swift テスト本体は未実施。権限拡張なし |
| `git status --short --branch` / `git diff --check` と新規文書のチェック | 下記文書のみ変更対象。製品コード、依存、ロードマップ、版、署名・配布設定は変更しない |

実機 GUI、長い日本語の IME/折り返し、VoiceOver、Intel/最低 OS、Retina/120 Hz、外部ファイルの移動・クラウド/強制終了、署名済み sandbox、TestFlight、Apple Intelligence/Core AI 実モデル、native HTTP/PDF の専用 harness、実性能の新旧比較は今回未実施。外部の最新 API 資料は取得できず、現ソースと依存 pin、およびローカル macOS 27.2 SDK を根拠にした。`WKWebView.h` の `createPDFWithConfiguration` は macOS 11 以降の既存 API で、rect 指定による capture の部品として現行で使用中。これ自体は native 組版・章頭・複数ページを保証しない。静的な未参照判定は製品の両レーン・動的参照・利用者への影響を再確認してから退役に使う。予備調査の仮説はすべて評価したが、実装事故として確定していないものは実験に留める。

**次の相談事項:** B の「現行契約の凍結と無書込比較」を最初に承認するか、A の「終了直前の再編集」を先に潰すか（並行可）。メモ/縦書きは D の anchor を小さく共有する方向までを相談し、保存方式・版割り・出荷日を決めない。
