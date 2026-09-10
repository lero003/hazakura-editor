# UI 手直し2 — focus ring・ガター境界・領域境界

Status: Implementation + evidence（レビュー指摘 P2×1 / P3×2 への対応＋次の境界線調整）
Authority: Evidence
Date: 2026-09-10
Branch: `codex/v3`

## 1. [P2] focus ring を実際の色で3:1以上にした

**指摘のとおり、自動検査は `--accent` を見ていて、実UIのリングは薄めた色だった。**
`outline: 2px solid color-mix(in srgb, var(--accent) 56%, transparent)` のような宣言が9箇所あり、
chrome 面に合成すると 3:1 を割っていた。意味トークン `--focus-ring`（既定 `var(--accent)`）を新設し、
**9箇所すべてを `var(--focus-ring)` に置き換えた**（薄めない）。

| テーマ | 旧（56%合成 / chrome面） | 新（`--focus-ring` / chrome面） |
| --- | --- | --- |
| light | `#8aa999` → **2.40:1** | `#356b50` → **5.85:1** |
| shokou | `#86afcf` → **2.11:1** | `#3478ad` → **4.30:1** |
| shinkai | `#8c8b72` → 4.32:1 | `#f2d8a0` → **10.78:1** |

タブの閉じるボタン（60%）も light **2.59:1** / shokou **2.24:1** だったものが、同じ実値になる。
`prefers-contrast: more` の上書き（3px outline）は元から問題なく、通常表示側だけの修正。

置き換えた9箇所：`agent-window.css`（2）／`controls.css`（2）／`editor.css`（2）／`preview.css`（2）／`workspace.css`（1）。
危険操作のボタン（旧 `--danger` 70%）もリングは `--focus-ring` に統一した（フォーカスの色は意味を変えない）。

### 自動検査を「実宣言」まで広げた

- `focusRingCss.test.ts`（新規）：**全CSSファイルを走査して `outline: … color-mix(…)` が1つも無いこと**を固定。
  薄めたリングが再導入されたら落ちる。`--focus-ring` の定義が `var(--accent)` であることも固定。
- `themeContrast.test.ts`：focus の検査を `--accent` ではなく **`--focus-ring` の実値**で行い、
  3:1 以上を確認する。**自動検査の範囲は紙面とchrome面の全7テーマ＋不透明ナビの5テーマ**で、
  半透明ナビ（edohigan / shinkai）は合成後でしか測れないため**実描画の証跡**（前段の測定）に委ねる。

## 2. [P3] ガター境界を全テーマで `--border` に追従させた

CodeMirror のガター線は `--cm-gutter-border` で、5テーマが第二調整前の値のままだった
（light/darkは追従済み）。**全テーマの上書きを `var(--border)` に一本化**した。

| テーマ | 旧（紙面比） | 新（紙面比） |
| --- | --- | --- |
| yakou | `#2a2a50` 1.22:1 | `#393870` **1.55:1** |
| shokou | `#cfdceb` 1.31:1 | `#b9cce1` **1.54:1** |
| edohigan | `#4a3548` 1.34:1 | `#553e53` **1.55:1** |
| shinkai | `#1d4a60` 1.30:1 | `#23566e` **1.55:1** |
| crt | `#143020` 1.26:1 | `#19402b` **1.54:1** |

自動検査：テーマCSS・lMode の `--cm-gutter-border` 宣言がすべて `var(--border)` であることを固定。

## 3. 領域境界だけを一段強くした（予定していた調整）

ドーン氏の役割分担に沿って、**大きな領域が切り替わる2箇所だけ** `--border-strong`（紙面比 約2.2:1）にした。

| 境界 | トークン | 実測（light） |
| --- | --- | --- |
| ツールバー下 | `--border` | `#c7d2c5`（1.55:1） |
| サイドバー右 | `--border` | `#c7d2c5` |
| CodeMirror ガター右 | `--border`（`--cm-gutter-border` 経由） | `#c7d2c5` |
| **タブ群 → 文書本文** | **`--border-strong`** | `#a1b3a1`（2.20:1） |
| **文書 → ステータス** | **`--border-strong`** | `#a1b3a1`（2.22:1） |

実描画で確認：light は tabs/status が `rgb(161,179,161)`＝`--border-strong`、ツールバーが `rgb(199,210,197)`＝`--border`。
shokou は `rgb(142,173,199)` / `rgb(185,204,225)`、dark は `rgb(75,97,78)` / `rgb(56,73,60)` で、いずれも役割どおり。
画面全体をグリッド化せず、領域の切り替わりだけが立つ。

## 4. [P3-doc] 証跡の日付を JST に直した

実コミットは `2026-09-10T12:41Z` = **9月10日21:41 JST** のため、証跡ディレクトリと本文の日付を
`2026-09-11-*` → **`2026-09-10-*`** に是正した（`2026-09-10-v3-border-hierarchy` /
`2026-09-10-v3-rough-edges` / `2026-09-10-v3-focus-and-boundaries`）。参照リンクも同時に更新。

## 表示（画像）

編集画面 1440×850：[light](editor-light-1440.png) / [shokou](editor-shokou-1440.png) / [dark](editor-dark-1440.png)
フォーカスリング（light・保存ボタンにfocus）：[focus-light-1440.png](focus-light-1440.png)

計算値：ring は `rgb(53, 107, 80)`＝`#356b50` の 2px solid（薄めていない）。

## 検証

| 項目 | 結果 |
| --- | --- |
| `npm run typecheck` | 成功 |
| `npm test` | **261ファイル / 2,314件 成功**（前段2,309件＋focus/ガター/境界） |
| `npm run smoke:app-store-surface` | 117件 成功 |
| `npm run build:vite` | 成功 |

## 残り・未決

1. 設定の外枠寸法（1100×752参考・レール200px）と Help 導線。
2. 画面16/05/23/24 の個別調整。
3. native 受入（VoiceOver / 200% / 再起動後設定 / 実System / 半透明ナビ＋実シェーダー）は未実施のまま。
4. CI は GitHub の status が付かないため、合格としては扱わない（ローカルの数値のみを根拠にする）。
