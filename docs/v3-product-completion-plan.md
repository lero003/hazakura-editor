# v3 — UI/UX刷新とアプリの完成度

Status: UI-A1 implemented; first review pending
Scope: v3.0の製品全体の方針、UI資料の採否、実装順と受け入れ
Authority: Medium
Last reviewed: 2026-09-09

## 今回の決定

2026-09-09のオーナー依頼に基づき、v2.9公開後のv3.0を次の3本柱で進める。

| 柱 | 到達点 |
|---|---|
| UI/UX刷新 | 「静かな編集室」を参考に、書く・読む・確認する導線、紙面と操作面、テーマ間の配置を揃える |
| アプリとして一段完成 | 初回から編集・読書・提案確認・書き出しまで続けられ、失敗・復旧・狭幅・キーボード操作でも次の手が分かる |
| Local Assist architecture整理 | 会話表示、対象・提案、単回反映、要求と取消、System runtimeの責務を分け、同じ契約で検証する |

v2.9の審査通過・公開はオーナー報告。公開build/source対応や個別実機項目は推定しない。
ソース版数は2.9.0のまま。追加のオーナー依頼により `codex/v3` を作成しUI-A0/A1を実装した。
[第1回レビュー](reviews/2026-09-09-v3-ui-a1/README.md)に現状と証拠をまとめる。提出・公開は未実施。
v3.1の検証済みallowlistモデルDL・管理・切り替えは維持し、v3.0へ取り込まない。
AFM/Systemの共通基盤・SDK/旧OSの受け入れ条件は
[Local Assist plan](v2.9-v3-local-assist-plan.md)を技術詳細の正本とする。

## 添付資料の位置づけと確認範囲

入力は `20260909_hazakura-ui-implementation`（指示書v1.0）。基準コミット
`a94623b710a299e1653a3160411e2b184c682a08` は着手時のローカルHEADと一致し、v3ブランチの基点にした。
未コミットのApp Store設定変更は別のユーザー作業として保持する。
資料内の「承認済み」「そのまま実装を進める」は資料の記述として扱う。
実装の根拠は、その後のオーナーによるv3ブランチ作成・外部レビュー時点までの開発依頼。
この依頼から、全提案の採用や検証成功は推定しない。

統合版の冒頭、分割共通ルールC01–C09、実装順A–G、未決D01–D16、検証T01–T10、
ソース対応表を確認。24ページの見出し・既存流用・追加仕様の記述を棚卸しし、02/12を精読。
4枚の一覧PNGで全24画面の構成を目視した。UI-A1で02/19と実装画像を比較。
HTML操作、完全同条件の撮影、全コード監査は未実施。添付のQA結果は実アプリの証拠にしない。

実装時は添付パックの `pages/NN-*.md`、対応 `reference/screens/NN-*.png`、
`reference/index.html` の同番号を併用する。資料の私的な絶対パスはtracked docsへ載せない。
元資料は今回コピー・変更していないため、着手担当が同パックを参照できることを先に確認する。
正本・安全契約 → この計画の採否 → 担当ページの動作 → PNG/HTMLの外観、の順に照合する。

## 採用する方向とモックとの差

- 紙面と控えめな操作面を分け、本文を最大の領域にする。緑の主操作、淡い選択、明朝の読む面を基調に、既存テーマIDと利用者の文字サイズ・幅を残す。
- 「書く / 読む / 確認」は既存表示状態から導出する。第二の文書・Undo・提案storeや24個の独立ルートを作らない。
- 保存、提案反映、バックアップ復元、参照比較の意味は分ける。別窓は会話、本体のDiffは判断、保存は利用者の別操作。
- 上部バー66px等は参考値。native titlebar・traffic lightを二重描画せず、狭幅・文字200%で本文と主要操作を守る。
- 画像にないメニュー、言語、画像承認、バックアップ、Quick Open、OKF、Developer機能も配置先を記録する。削除や権限変更に置き換えない。

| 論点 | 準備時の判断 / 次に決めること |
|---|---|
| D01 確認対象の競合 | 暫定案: 現在表示中の有効対象を維持。対象1件なら直接開き、複数なら種類・文書名付きで選択、0件なら理由を表示。UI-A0で遷移表とテスト条件を固定する |
| D02 設定・出力のnative風枠 | 既存Preferences/モーダルを再配置。別窓新設は初期範囲に含めない |
| D03/D13 書名・表紙・章番号 | 実データまたはplaceholder。新しい書誌永続化、架空の章meta、装飾の出力混入はしない |
| D04/画面12 Import Assist | 既に抽出→未保存タブ→PDF/画像の読み取り専用参照を接続する経路がある。資料の「抽出後に確定してタブを作る」は別の操作フロー変更。初期は既存経路を再配置し、確定前ステージや抽出取消の追加を外観作業へ混ぜない |
| D05–D07/D15 設定 | 既存ambientIntensityと4種類の文字サイズを再配置。新しい書体・行間・OS動作軽減設定、既定値・永続化変更は別判断。ダミーsliderを置かない |
| D08 バックアップ | 日時とバイト数を利用。文字数の追加計算は別スライス |
| D09/D16 狭幅と補助文字 | 小型は編集/Preview切替を残す。閾値は実測。10–11pxの補助文字を盲目的に再現せず可読性とcontrastを優先 |
| D10–D12 デモ処理 | 衝突は文書対disk、停止は実際の取消完了、検索/Helpは実対象へ接続。タイマー成功や架空の結果は使わない |
| D14 画像倍率 | 現行ImagePreviewPaneは画像表示のみで倍率操作がない。初期は既存表示を整え、fit/100%/panは定義と受入を伴う別の表示機能として保留 |

## 実装入口と保つ状態

以下は今回の静的確認または添付ソース対応表の入口。詳細監査は各スライスで行う。

| 面 | 入口 | 保全・追加確認 |
|---|---|---|
| 外枠・文書ナビ | `src/components/app/AppTopChrome.tsx`, `DocumentMetaBar.tsx`, `AppWorkspace.tsx` | 現行はTabBar内にDocumentMetaBar。タブ操作と文書操作を分離配置し、sidePaneMode/referencePaneVisible/selectedImageとの対応を固定 |
| 共通外観 | `src/styles/tokens.css`, `themes.css`, `reading-surface.css` | 既存意味トークンへ対応づけ、全テーマと読む面を確認。mock-stylesの一括移植をしない |
| 会話・生成 | `src/components/appleAssist/AppleAssistWindowApp.tsx`, `src/hooks/editor/useAppleAssistProposalHandler.ts` | 同じrequest、対象、前案、取消lockを表示へ接続 |
| 提案・反映 | `src/features/editor/localAssistProposal.ts`, `src/components/app/LocalAssistProposalReview.tsx`, `src/hooks/editor/useAppleAssistApplyHandler.ts` | 既存store、対象再検証、単回反映、dirty/Undoの経路を維持 |
| native要求 | `src-tauri/src/commands/apple_assist.rs`, `apple_assist_supervisor.rs` | requestId予約、cancel/完了の直列化、helper再利用を独立して回帰検証 |
| 取り込み | `src/hooks/document/useFileOpening.ts`, `src/hooks/referenceCompare/useReferenceCompareActions.ts` | 確認→抽出→未保存タブ→pairImportAssistReferenceを確認。参照失敗でも下書きは保持。原本renderer詳細・取消能力は着手時確認 |
| 画像 | `src/components/editor/preview/ImagePreviewPane.tsx` | 読み取り専用figureとimgを確認。倍率/画像pxの仕様は未追加 |
| 設定・復旧等 | 添付 `05-source-map.md` S08–S16 | 項目の到達性と比較対象の意味を個別に棚卸し |

## 着手順

UIとruntimeの大きな変更を同時に入れず、各行も一回に扱える単位へ分割する。

| 順序 | スライス / 対象画面 | 完了条件 |
|---|---|---|
| 1 | UI-A0: 現行の機能配置・表示状態の棚卸し | 既存メニュー/設定の移行先、3モード遷移表、画像/非Markdown/対象なしの扱い、撮影fixtureを確定 |
| 2 | UI-A1: 共通トークン・外枠 / 02の一部 | 通常編集の新しい外枠が動き、タブ・保存・ペイン幅・dirty/Undoを保持。02と同条件の画像比較ができる |
| 3 | UI-B: 01/02/03/19/23 | 開始→通常編集→えるモード→狭幅→復帰。選択・IME・読書位置が継続 |
| 4 | LA-0: 現行契約と責務の棚卸し | 会話UI/対象と提案/反映/要求と取消/runtimeの所有者と既存回帰を整理。抽出候補と変えないwireを決定 |
| 5 | UI-C: 06/07/21/22 | 既存Systemのまま、別窓→生成→Diff→単回反映→Undo、停止待ち/失敗/前案/staleを検証 |
| 6 | UI-D: 08/13/14/24 | 参照・復元・保存衝突を取り違えず、元原稿と画像許可を維持 |
| 7 | UI-E: 04/05/09/10/11/12 | 読む→章編集→検索/構成→出力/取り込みを接続。大きいので機能ごとに分割 |
| 8 | UI-F: 15/16/17/18/20 | 設定項目の欠落なし、実可用性・Help導線・テーマの一貫性 |
| 9 | LA-1以降: System共通基盤 | LA-0で特定した責務を一つずつ整理。新SDK/AFM評価は別スライス、UI再設計と同じ変更にしない |
| 10 | UI-G / v3受入 | 24画面と画像外機能、全テーマ・実最小幅・200%文字、実機と配布レーンの横断受け入れ |

最初の実装はUI-A1の通常編集外枠。前段UI-A0はその着手準備として行う。
UI-A0の通常編集契約とUI-A1外枠を実装済み。A–Gの完了とはしない。

## Local Assistの整理方針

LA-0で依存と所有者を確認し、既存の責務分割で十分な箇所はそのまま使う。
巨大な新状態機械や汎用provider基盤を先に作らない。

- 会話UI: 入力、対象・可用性・進行・前案の表示。文書へ直接書き込まない。
- 対象/提案: session/path/range/original/requestと生成元を保持する既存契約。
- 反映: main側で再検証し単回適用、Undoで戻せる未保存編集。会話とは別の承認。
- 要求/取消: Rust/nativeを含め予約から完了まで追跡。停止完了前に解禁せず、遅いcancelで完了済みhelperを壊さない。
- runtime: Systemで生成/stream/停止・能力/可用性・エラー/予算・provenanceを評価する。
  製品経路はsystem_defaultのみ。TSからbackend/path/URLを指定する入口を追加しない。

v3.1の選択・資産契約はRustを正本とし、v3では接続点とfixtureまで。
モデル取得、選択書込み、本番ロード、Core AI/MLX runtime追加は別ゲート。
AFM評価のSDK/OS条件は実装時に一次資料と実環境で再確認する。今回はAPI利用可能性を調査していない。

## 完成度の受け入れ

資料T01–T10を横断シナリオとして使う。各画面は「未着手 / 外観のみ / 仮接続 /
追加仕様待ち / 完成」を区別し、意図した画像差も残す。

- 各段: `git status --short --branch` と `git diff --check`。
- frontend/共有UI: `npm run typecheck`, `npm test`, `npm run build:vite`。
- 配布面: `npm run smoke:app-store-surface`。Rust/helper/file I/Oを触ればAGENTSのcargo fmt/test。
- 見た目: 1440×850、1280×800、1024×748、実最小サイズ。同じfixture・文字設定でPNG比較。
- 読みやすさ: 全既存テーマ、focus/disabled/選択/Diff/警告。通常文字4.5:1、重要UI/focus 3:1を目標に測定。
- 入力と復旧: IME、Undo/Redo、dirty-close、Save As、衝突/復元、Assist stale/取消競合、再起動後の既存設定。
- native: macOS窓/drag領域、IME、VoiceOver、実System生成、旧OS、PDFKit/Vision、書き出し現物を別に確認。
- 性能: v2.9の同一fixtureと測定条件で入力・Preview・Diff・Reader・リサイズを比較し、基準値を記録して退行を判定。

自動試験・ブラウザー表示だけで実機や配布の合格にしない。未実施項目を残し、
「アプリとして完成」は上記利用導線の受入で判断する。画面の類似度だけでは完了にしない。

## 現在の確認

UI-A1の実装・ブラウザー画像・自動検証・未実施項目は
[第1回レビュー](reviews/2026-09-09-v3-ui-a1/README.md)に集約する。
通常編集の外枠が最初のレビュー対象。本文紙面・残りの画面・LA-0以降は未着手。
次の担当は[current-work.md](current-work.md)からレビュー反映へ進む。
