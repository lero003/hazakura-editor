# 上部バーの重複・左上の開閉ボタン・保存ボタン・最大化（実機指摘①③⑧⑨）

Status: Implemented
Scope: `src/components/app/AppPrimaryToolbar.tsx`（+`.test.tsx`）・`DocumentMetaBar.tsx`（+`.test.tsx`）・
`RightPaneToggleControls.tsx`（+`.test.tsx` / `.layout.test.tsx`）・`AppTopChrome.tsx`（+`.test.tsx`）・
`AppShell.tsx`・`LModeWindowDragBand.tsx`・`src/features/workspace/primarySaveEnabled.ts`（+test）・
`windowZoom.ts`（+test）・`src/lib/locale/sidePane.ts`・`src/styles/workspace-chrome.css`・`workspace-start.css`
Authority: Evidence（実コンポーネントの実描画・DOM実測）
Date: 2026-09-11
Branch: `codex/v3`

## ① 最上部と二段目の「確認」の重複 → 二段目を削除

- 最上部（`WorkspaceModeNavigation`）の「確認」＝**レビュー対象を選ぶ**メニュー
  （提案 / 保存前の変更 / 参照 / 比較。対象が1つなら直接実行）。
- 二段目（`RightPaneToggleControls` の `pane-review-action`）の「確認」＝**変更を確認**
  （未保存のときだけ出て、押すと保存前の差分へ）。
- **文書が未保存のとき、両方が同じ場所（保存前の変更の差分）へ行っていました。** しかも
  上部の「確認」は履歴を遡る機能ではありません（履歴＝変更を細かく遡る、は今のUIにありません）。
- モック02の二段目（`.document-toolbar`）にも「確認」は無い（`Markdown / えるモード`＋
  `文書の構成 / 並べて表示`）。→ **二段目の「確認」を外し、上部のグローバル1本に統一**。
  `RightPaneToggleCopy` の `reviewMenu` / `reviewMenuTitle`、`DocumentMetaBar` の
  `activeDirty` / `onReviewChanges` / `recoveryReviewChangesLabel`、`AppTopChrome` の
  `recoveryCopy` / `onReviewChanges` / `activeDirty` も一緒に落とした（死んだ prop を残さない）。
  `AppShell` 側は `navigation.onReview("disk")` が唯一の入口になる。
- 実測（1440×850・ライト）: 二段目のボタンは
  `えるモード / プレビュー / 電子書籍 / アウトライン / 参照 / 差分` の6つ。`確認` は0。

## ③ 左上の左ペイン開閉ボタン → 削除

- 正体はワークスペースのサイドバー開閉（モック01の上部バーも同じ位置に置いている）。
- ただし **サイドバー自身の折りたたみボタン**（`.workspace-collapse-button`）と、
  畳んだあとの**左端レールの「戻す」**があり、同じ操作が3つ見えていた。
  上部のそれは信号機の右＝ロゴの位置にあり、用途が読めない（実機指摘）。
- → 上部バーの `.primary-sidebar-toggle` を削除。`sidebarCollapsed` / `onToggleSidebar`、
  compact 折りたたみフックの `toggle` も配線から外した（フックの API はそのまま）。
  付随して `.primary-sidebar-toggle` の CSS 2か所と `workspace-start.css` の `:has()` 上書きも削除。

## ⑧ ドラッグ領域のダブルクリックで最大化

- `data-tauri-drag-region` を自前の `startDragging()` で実装しているため、macOS 標準の
  ダブルクリック判定が届かず、何も起きなかった。
- → `toggleWindowZoom()`（`src/features/workspace/windowZoom.ts`）を新設し、
  `getCurrentWindow().toggleMaximize()` を呼ぶ。**フルスクリーンではなく最大化（ズーム）**。
  上部バーと L モードのドラッグ帯の両方に付けた。ボタン・`role=group` の上では発火しない
  （ドラッグと同じガード）。ネイティブが無い環境では黙って何もしない。

## ⑨「保存」は未保存のときだけ押せる（見た目も）

- 旧 `canSave` は `activeDirty` を見ていなかったため、保存済みでも押せる見た目だった。
- → `resolvePrimarySaveEnabled()` に集約（`activeDirty` を必須にし、既存の
  `canNavigate` / レビュー面が覆っている間 / 生成ロック / 保存処理中 の条件はそのまま）。
- 実測: 保存済み `disabled=true`・`opacity: 0.55` ／ 未保存 `disabled=false`・`opacity: 1`。

## 検証（実行した数字だけ）

- `npm run typecheck` 成功／`npm test` **277ファイル・2,410件**成功（変更前 275・2,403）
- `npm run smoke:app-store-surface` 10ファイル・**115件**成功（`AppTopChrome.test.tsx` を含む）
- `npm run build:vite` 成功
- Rust 無変更（`cargo test` 未実行）

### 表示（実コンポーネント・1440×850・deviceScaleFactor 1）

- `top-chrome-light-clean-1440.png`（保存済み → 保存ボタンが沈む／左上にトグル無し／二段目に確認無し）
- `top-chrome-light-dirty-1440.png`（未保存 → 保存ボタンが有効）
- `top-chrome-dark-dirty-1440.png`（ダーク）

## 画像との差・未決

- モック01の上部バーは信号機の右にサイドバートグルを置いている。ここは**モックと差を付けた**
  （重複3つの解消を優先。オーナー判断）。
- モックの保存ボタンは常時表示で、未保存のとき `soft`（アクセント淡色）になる。実装は
  「未保存のときだけ押せて、押せるときは標準の面」のまま（色の強調は今回入れていない）。

## 残リスク・未受入

- **実機でのダブルクリック最大化**（ネイティブ窓の `toggleMaximize`）は未実施。テストは
  mock した `toggleMaximize` の呼び出しまでを固定している。
- 実機でのサイドバー開閉（狭い窓 ≤1100px の自動折りたたみからの復帰が左端レールだけになる）。
- VoiceOver、200%文字、別窓同期。
