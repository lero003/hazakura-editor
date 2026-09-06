# Local Assist の推敲フロー改善

Status: External review candidate
Scope: Local Assist proposal lifecycle, review UI, shared Diff, dialog focus, right Preview
Baseline: `main` at `00f179ab6cf3a83fcf5e92513a0b955567c3ab1d`
Date: 2026-09-06

## 目的

Local Assist を一発変換ではなく、会話ウィンドウで案を育て、メインウィンドウで確認した案だけを明示的に文書へ反映する推敲体験へ寄せる。

Markdown / text source が正本であること、Local First、network fallback なし、auto-apply なし、通常の保存経路を維持する。

## 提案と本文の境界

`LocalAssistProposalStore` がセッション単位で現在の案と生成の所有権を持つ。React 側は `useSyncExternalStore` で参照し、同じ proposal を別 state として複製しない。

- `beginGeneration` は現在の requestId を所有する生成だけを開始する。
- `completeGeneration` / `settleGeneration` は所有中の requestId と一致する場合だけ状態を更新する。
- 古い生成完了、失敗、キャンセルは新しい案を上書き・削除しない。
- 追加指示が失敗した場合は、対象がまだ有効な直前の完成済み案だけを復元する。
- 文書編集、ファイル切り替え、セッション変更、hook 破棄で生成の所有権を失効させる。
- `claimApply` はレビューした同一 proposal を一度だけ予約する。
- 反映時に path / session / range / original を再検証する。
- 書き込み失敗時は提案と従来 Review Bar の状態を保持し、成功時だけ提案を消費する。
- 消費済みの提案は Undo で元文章に戻っても再利用しない。

現在の selection へ提案を勝手に付け替えない。会話開始時に固定した target が反映対象である。

## AIへ渡す内容

初回は原文を `selectedText` とし、追加指示では現在の候補文章を `selectedText` とする。周辺文脈から対象本文の重複を除き、追加指示では固定した元文章を参考情報として一度だけ渡す。

直近4件・各500文字の依頼を保持し、最新の依頼を優先しながら、意味・事実・既存の修正・Markdown 構造を不用意に変えないよう指示する。参考文脈は既存の8,000文字上限内に収める。

生成結果のサニタイズはレビュー前に行い、レビュー後の Apply で再加工して表示案と反映内容を変えない。空、文字列でない出力、境界情報の漏出、再サニタイズで内容が変わる曖昧な出力、過大出力は反映可能な proposal として登録しない。

既存の4,000文字の編集対象上限は維持する。

## レビューUI

提案レビューに次を追加する。

- `差分` / `変更後` / `元の文章` の切り替え
- 対象文書・対象ラベル・文字数・提案回数
- 変更なし、空白・改行のみ、stale target の明示
- Apply 中の二重反映・破棄防止
- Apply failure 時の proposal 保持
- 長大 Diff / Diff failure 時の全文 Before / After fallback
- editor font size への追従、narrow width、keyboard scroll、focus-visible、reduced motion

共有 Diff は行対応と Markdown 見出し文脈を維持しつつ、変更行の共通 prefix / suffix を除いた範囲を追加強調する。日本語1文字変更や grapheme cluster を読みやすくする目的であり、単語単位の最小 diff を保証するものではない。

## 横断改善

共有 dialog focus trap は Tab のみを扱い、disabled / hidden / inert / negative tabindex を除外する。fixed-position control を `offsetParent` だけで除外せず、focusable element がない場合もフォーカスが背後へ抜けないようにする。

Right Preview は narrow width の余白、長い文字列、リンクの keyboard focus を調整する。ページ送り式 Reader のページ計算、画像権限、保存契約、Markdown の意味は変更しない。

## テスト

追加・変更した主な回帰テスト:

- `src/features/editor/localAssistProposal.lifecycle.test.ts`
- `src/lib/appleAssist/revisionContext.test.ts`
- `src/hooks/editor/useAppleAssistApplyHandler.test.ts`
- `src/hooks/editor/useAppleAssistProposalHandler.lifecycle.test.ts`
- `src/components/app/LocalAssistProposalReview.test.tsx`
- `src/features/diff/inlineChange.test.ts`
- `src/lib/focusTrap.test.ts`

作業時の限定検証では、変更 TypeScript / TSX の構文確認と、proposal ownership・範囲検証・文脈制限・Markdown保持・行内変更・単回 Apply / failure retention を重点確認した。

完全な `npm run typecheck` / `npm test` / `npm run build:vite`、Rust / App Store surface、実機・IME・VoiceOver・実モデル評価は外部レビュー側で実施する。GitHub Actions は手動起動しない。

## 外部レビューで重点確認すること

1. 選択 → 初回依頼 → 追加指示を複数回 → Diff / 全文確認 → Apply → Undo / Redo
2. generation cancel、文書編集、ファイル切り替え、同パス再オープン、外部変更
3. Apply 連打、Apply failure、Apply直後の次の生成、旧 Review Bar の残留
4. 日本語、Markdown、1文字差分、空白差分、長文
5. narrow window、Full Screen、Dark Mode / theme、32px以上の本文文字
6. IME と CodeMirror history のまとまり、未保存状態

生成 hook は遅着結果を失効させるが、ネイティブ生成を request 単位で中断する新しい IPC は追加していない。実際の停止経路と window 間イベント順序は結合確認が必要。

## 互換性

保存形式、localStorage、文書ファイル、Tauri command、依存バージョン、配布レーンは変更しない。migration は不要。Local First の境界を維持する。
