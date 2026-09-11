# スライス11 — 書き出しの形式ナビ（共通ダイアログ枠）

Status: Implemented
Scope: `src/components/app/ExportFormatNav.tsx`（新）・`exportFormatSwitch.ts`（新）・
`ExportDialogFrame.tsx`・`EpubExportSettingsDialog.tsx`・`PdfExportSettingsDialog.tsx`・
`HtmlExportSettingsDialog.tsx`・`AppOverlays.tsx`・`useAppShellController.ts`・`src/lib/locale/exportFormatNav.ts`（新）・
`src/styles/dialogs.css`
Authority: Evidence（実アプリの実描画・DOM実測・純関数テスト・契約テスト）
Date: 2026-09-11
Branch: `codex/v3`

## 何を変えたか

| | 変更前 | 変更後 |
| --- | --- | --- |
| 形式の選び方 | EPUB / PDF / HTML が**別々のコマンド・別々のダイアログ**（同じ画面では選べない） | **共通のダイアログ枠**に形式ナビを置き、同じ画面で形式を選べる |
| 対象（文書／本全体） | 各ダイアログの内部 | 同じ枠の中（変更なし。`export-settings-header` の対象名 ＋ スコープ選択） |
| 切替の実装 | — | いまのダイアログを閉じ、**選んだ形式の既存の準備処理**（`exportEpubBeta` / `exportPdf` / `exportHtml`）を呼ぶだけ |
| HTMLの本全体非対応 | 理由を表示 | **同じ**（`export-scope-note` に理由を残す） |
| コマンド | 3つ（パレット／メニュー） | **3つのまま**（消していない。ナビは追加の入口） |

新しい書き出し経路・新しい native 別窓は作っていない。`native別窓の新設とは分離`というレビューの整理どおり、
**入口の統合**だけを行った。

## 実アプリでの実測（1440×850）

1. パレットから `Export PDF…` を実行 → `.pdf-export-settings-dialog`
   形式ラベル `PDF` ／ 対象 `untitled.md` ／ ナビ `EPUB:false / PDF:true / HTML:false` ／ 主操作 `Choose destination…`
2. ナビの **EPUB** を押す → `.epub-export-settings-dialog` に切り替わり、`role=dialog` は**1つだけ**
   （PDFのダイアログは閉じている＝キャンセルされる）／ ナビ `EPUB:true / PDF:false / HTML:false` ／ 見出し `EPUB Export`
3. さらに **HTML** を押す → `.html-export-settings-dialog` ／ ナビ `HTML:true` ／
   本全体の理由「"Whole book" is available for PDF and EPUB; HTML exports one document at a time.」が残っている

MEDIA:pdf-dialog-with-nav-1440.png
MEDIA:epub-dialog-after-switch-1440.png
MEDIA:html-dialog-after-switch-1440.png

## テスト

| 種別 | 内容 |
| --- | --- |
| 純関数 | `exportFormatSwitch.test.ts`: 別形式なら「いまのを閉じて選ばれた方を開始」、同じ形式なら null（準備をやり直して入力を消さない） |
| コンポーネント | `ExportFormatNav.test.tsx`: 開いている形式が `aria-pressed` になり、別形式を選ぶと通知。同じ形式では通知しない。3言語のラベル |
| 枠 | `ExportDialogFrame.test.tsx`: 形式ナビが**共通の枠（`role=dialog`）の中**に描かれ、対象名と同居すること。切替が既存の準備処理へ委ねられること |
| 既存 | `EpubExportSettingsDialog` / `PdfExportSettingsDialog` / HTML のテストはそのまま緑（枠と中身は不変） |

- `npm run typecheck` 成功 / `npm test` **274ファイル / 2,393件** 成功

## レビュー対応（P2×1・受入テスト）

### P2 — 形式を往復すると入力と「本全体」が失われていた

- 原因: 切替は「いまのダイアログを閉じて、選んだ形式の準備を呼ぶ」だけだったので、
  各形式のローカル state（書名・著者・言語・表紙・余白）と**対象（文書／本全体）**が初期化されていた。
- 修正: `useExportDrafts`（新）で、**一度の書き出し操作のあいだ**だけ、文書 identity と
  形式別の入力草稿・対象を共通の親（`AppOverlays`）が保持する。永続化はしない。
  - PDF↔EPUB は**対象を保つ**（HTML は本全体非対応の理由表示のみ）。
  - EPUB へ戻ると、書名・著者・言語・表紙が復元される。
  - 文書が変わったら持ち越さない（草稿に文書 identity を持たせ、切り替わった**最初の render** から無効）。
    併せてダイアログは `key={tabId}` で文書ごとに作り直す。
- **同じ形式を再クリックしたら何もしない**判断は維持（入力の作り直しを避ける）。

### 受入テストの穴（`null === null` で成功していた）

- 指摘どおり、追加テストは両側とも `div[role='dialog']` を探しており、実装は `section[role='dialog']` なので
  **無条件に成功**していた。
- 修正: `screen.getByRole("dialog")` で実在を確かめ、`dialog.contains(group)` で包含を確かめ、
  `getAllByRole("dialog")` が1つであることを確認する形にした。**ナビを枠の外へ出すと落ちる**ことも確認済み。
- 重複していた切替通知の確認は `ExportFormatNav.test.tsx` に一本化し、その分を**往復の統合テスト**
  （`ExportFormatRoundTrip.test.tsx`）へ振った:
  - EPUB で書名・著者・「本全体」→ PDF → EPUB に戻って**すべて残っている**
  - PDF の余白プリセットも往復で残る
  - 切替中も `role=dialog` は1つで、HTML の本全体非対応の理由は出続ける
  - 文書が変われば前の入力を引き継がない

### 実アプリでの通し確認（1440×850）

`Export PDF…` → ナビで **EPUB** → 書名に「葉桜の本」→ ナビで **PDF** → ナビで **EPUB** に戻る。

結果: `epub-export-settings-dialog` が1つだけ・ナビ `EPUB:true`・**書名「葉桜の本」が残っている**。

MEDIA:epub-after-roundtrip-1440.png

## 残り

- 05 / 12 / 13 / 18（大型差分・既決との衝突）は**判断待ち**
- 実機受入（native・WebGL・VoiceOver・横断シナリオ T01〜T10）
