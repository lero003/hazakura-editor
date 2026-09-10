# スライスE-1 — 検索・構造のヒント・書き出し（画面09/10/11）

Status: Implemented
Scope: `src-tauri/src/commands/search.rs`・`src-tauri/src/types.rs`・`src-tauri/src/tests/search.rs`・
`src/lib/tauri/workspace.ts`・`src/hooks/globalSearch/useGlobalSearch.ts`（+`.test.ts`）・
`src/components/globalSearch/GlobalSearch.tsx`（+`.test.tsx`）・`src/components/app/SearchSurfaceAccessibility.test.tsx`・
`src/components/editor/OutlinePane.tsx`（+`.advisory.test.tsx`）・`src/lib/locale/sidePane.ts`・
`src/components/app/EpubExportSettingsDialog.tsx`・`src/components/app/PdfExportSettingsDialog.tsx`・
`src/components/app/HtmlExportSettingsDialog.tsx`（+各テスト）・`src/styles/global-search.css`・
`src/styles/workspace.css`・`src/styles/dialogs.css`
Authority: Evidence（実描画・DOM実測・Rustテスト）
Date: 2026-09-11
Branch: `codex/v3`

## 09 — ワークスペース検索

| モックの要求 | 実装前 | 実装後 |
| --- | --- | --- |
| 一致した文字列だけを強調 | 素のテキスト描画（`column` は React key のみ） | `column` を使い**一致範囲だけ `<mark>`**（色だけに頼らない） |
| ファイル別の件数 | 無し（1行=1一致のフラット表示） | 見出しに**ファイルごとの件数バッジ**（`aria-label` 付き） |
| 「3ファイルに一致」 | 走査したファイル数しか無かった | **一致したファイル数**を backend から返し、`2 ファイルに一致 · 3 件（走査 7 ファイル）` と区別して表示 |

- backend（Rust）に `total_files_matched` を追加（一致が1件以上あったファイル数）。
  走査数 `total_files_scanned` とは別物であることをテストで固定（`3 走査 / 2 一致`）。
- 入力の trim と一致長の基準を揃えた（backend は trim して検索するため）。

実描画（fixture・`?screen=search`）での実測:
`marks: 余白|余白|余白`（一致だけが着色）／`lines: 朝の余白について書く。 …`（前後の文は不変）／
`counts: 2 件 / 1 件`／`summary: 2 ファイルに一致 · 3 件（走査 7 ファイル）`

MEDIA:search-light.png

## 10 — 見出し・文書構成のヒント

| モックの要求 | 実装前 | 実装後 |
| --- | --- | --- |
| 「何が起きているか」「なぜ確認するとよいか」「該当箇所へ」の順 | 1行のヒントのみ | カードで**3要素**（内容／理由／該当箇所へ） |
| 該当箇所へ移動 | 無し | 「該当箇所へ」ボタン（見出しの選択と同じ経路） |
| 推奨を構文エラーと断定しない | 済み（「エラーではありません」） | そのまま維持 |

理由文は指摘の種類ごと（レベル飛び／名前の重複／長すぎるセクション／名前のない見出し）に用意し、3言語で同じ構造。
実測: `見出しの深さが飛ぶと、目次の並びと本文の組み立てがずれます。` / `該当箇所へ`。

MEDIA:outline-light.png

**未決**: 「もう一度確認する」の明示操作は追加していない（編集のたびに自動で再計算される既存契約を維持）。

## 11 — 書き出し

| モックの要求 | 実装前 | 実装後 |
| --- | --- | --- |
| 主操作のラベル | EPUB/PDF「書き出す」、HTML「書き出し先を選ぶ」で不統一 | **「書き出し先を選ぶ」に統一**（3言語。実際に次は保存先の選択） |
| HTMLで本全体が選べない理由 | 表示なし | 「「本全体」は PDF と EPUB で書き出せます（HTMLは1文書ずつ）。」を追加 |

実測: `confirm: 書き出し先を選ぶ / キャンセル`、`note: 「本全体」は PDF と EPUB で書き出せます（HTMLは1文書ずつ）。`

MEDIA:export-light.png

**未決**: 1モーダルに形式ナビ（EPUB/PDF/HTMLの切替）を統合するかは**未実装**。現行は3コマンド分離で、
それぞれ独立した設定を持っている（`04-open-decisions.md` の D02 は「native別窓の新設は必須でない」としており、
形式切替の統合は別スライス相当の作り直しになる）。

## 検証

| 種別 | 結果 |
| --- | --- |
| `npm run typecheck` | 成功 |
| `npm test` | **270ファイル / 2,368件** 成功 |
| `cargo test` | **383 passed / 2 ignored**（`total_files_matched` の追加後） |

## 残り（このスライスの範囲外）

- **05 本の構成の専用面**・**12 Import の専用2ペイン**・**13 復元の3領域**・**04 見開きの紙面と進捗バー**は未実装。
  いずれも画面の新設・再構成で、既存データ経路を保ったまま1スライスずつ進めるのが安全。
- 検索の結果一覧を主面の全幅サーフェスへ移すかは未決（現在は固定オーバーレイ）。
