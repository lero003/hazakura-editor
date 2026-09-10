# UI 調整 — 狭いウィンドウのサイドバー（画面23）

Status: Implementation + evidence
Authority: Evidence
Date: 2026-09-11
Branch: `codex/v3`

## 何をしたか

モック23の「1024×748でサイドバーを畳み、一つの紙面を広く使う」に対して、**表示上だけの一時的な折畳み**を入れた。

| 条件 | 挙動 |
| --- | --- |
| 幅 ≤ 1100px（既存の狭幅メディアクエリと同じ閾値） | サイドバーを**既定で畳む** |
| 利用者が開閉した | その選択を幅の既定より優先（狭いまま開ける） |
| 幅が変わった | 明示選択を**解除**し、新しい幅の既定へ戻る（広幅→狭幅→広幅で元に戻る） |

**保存設定は持たない**（`AppShell` の一時stateのみ。localStorage へ書かないことをテストで固定）。
モック23の指示6「既存の side pane 表示設定を、狭い画面にしただけで永続的にOFFへ上書きしない。
表示上の一時的な折畳みと利用者設定を分ける」に対応する。

実装：

- `src/features/workspace/compactSidebar.ts`（新規・純関数）：`resolveSidebarCollapsed` / `nextSidebarOverride` /
  `COMPACT_SIDEBAR_MAX_WIDTH = 1100`
- `src/hooks/app/useCompactSidebarCollapse.ts`（新規）：`matchMedia` を購読し、明示選択と幅の既定を合成。
  `matchMedia` が無い環境では false（＝広い幅の既定）を返し、レイアウトを勝手に変えない
- `AppShell`：`useState(false)` を差し替え。ツールバーのトグルと `onWorkspaceSidebarCollapsedChange` を
  同じ一時選択へ接続（既存の `workspaceSidebarCollapsedOverride` の仕組みはそのまま）

## 実測（実描画・等倍）

| 手順 | サイドバー | エディタ | トグルの `aria-expanded` | 横スクロール |
| --- | --- | --- | --- | --- |
| 1440×850 | 280px 表示 | 663px | `true` | なし |
| → 1024×748 へ縮小 | **畳まれる**（0px） | 564px（プレビューと2面） | `false` | なし |
| → トグルで開く | 280px 表示 | 738px（単一面） | `true` | なし |
| → 1440×850 へ戻す | 280px 表示 | 663px（最初と同一の描画） | `true` | なし |

1440 の2枚は md5 が一致（戻したときに同じ状態へ復帰）。畳んだ状態の画像だけが別ハッシュ。

## 表示（画像）

[1440（既定・開く）](editor-light-1440.png) / [1024（自動で畳む）](editor-light-1024-folded.png) /
[1024（トグルで開く）](editor-light-1024-opened.png) / [1440（戻す）](editor-light-1440-again.png)

## 検証

| 項目 | 結果 |
| --- | --- |
| `npm run typecheck` | 成功 |
| 追加テスト | `compactSidebar.test.ts`（純関数5件）、`useCompactSidebarCollapse.test.tsx`（フック4件：狭幅の既定／トグル／リサイズで解除／永続化しない／matchMedia無し） |
| `npm test` | **264ファイル / 2,326件 成功**（前段2,316件＋本スライス10件） |
| `npm run smoke:app-store-surface` | 117件 成功 |
| `npm run build:vite` | 成功 |

## 残差（判断が要る点）

**1024で畳んだとき、エディタは564pxでプレビューと2面に分かれる**（モックの本文目安は630px）。
これは既存の設計で、`workspace-paper.css` の

```css
@container document-workspace (max-width: 780px) { /* 単一ペインへ */ }
```

が**文書カラムの幅**で単一ペインを決めているため（「利用者のサイドバー幅を含めた実効幅を使う」というコメント付き）。
サイドバーを畳むとカラムが1024pxになり閾値780pxを超えるので、2面に戻る。

- 現状維持：サイドバーを畳んだ分を2面で使う（アプリの既存方針）
- モックに寄せる：閾値を 780px → 約880px に上げ、1024では単一ペインのまま本文を広く使う

どちらも一行の変更だが、**既存の受入（広い窓で保存済みの分割へ戻る）に触れる**ため、オーナー判断とする。
