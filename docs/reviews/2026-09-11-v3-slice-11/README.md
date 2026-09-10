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

## 残り

- 05 / 12 / 13 / 18（大型差分・既決との衝突）は**判断待ち**
- 実機受入（native・WebGL・VoiceOver・横断シナリオ T01〜T10）
