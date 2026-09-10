# UI 段階2 — 文字色・アクセント・境界線・chrome面

Status: Implementation + evidence（段階2）
Authority: Evidence
Date: 2026-09-10
Branch: `codex/v3`

## 何をしたか

モック `20260909_hazakura-ui-implementation` の値のうち、**モックに等価な定義がある light / dark へ忠実に反映**し、
面の意味トークンに **`--chrome-surface` を新設**した。前段のUI-G3で入れた `--surface-paper`（読む面）と
`--nav-surface`（サイドバー）に、**chrome（ツールバー・タブ・ステータス）** を役割として足す。

出典：

- light：`reference/design-spec.md` §5 の配色表と `01-shared-system.md` C04 の対応表
- dark：`reference/mock-styles.css` の `.dark` ブロック（`--bg:#18241e` / `--paper:#1d2a23` / `--side:#142019` /
  `--ink:#e5eddf` / `--muted:#a6b5a5` / `--accent:#aad0ac` / `--accent-ink:#15251a` など）
- chrome面：`.chrome` / `.doc-tabs` / ステータスが `var(--bg)`、`.sidebar` が `var(--side)` を使う

## 変わった値

### light（モック §5 そのまま）

| 役割 | 前 | 後 | モック |
| --- | --- | --- | --- |
| `--bg` / `--chrome-surface` | `#fafbfa` | `#f7f8f5` | `#F7F8F5` |
| `--text` / `--cm-fg` / `--cm-mark-strong` | `#1a1f1d` | `#24362d` | `#24362D` |
| `--accent` / `--cm-caret` | `#2e6b4f` | `#356b50` | `#356B50` |
| `--accent-soft` | `#eef3f0` | `#e1ecdf` | `#E1ECDF` |
| `--border` / `--cm-gutter-border` | `#e4e7e5` | `#dce2d9` | `#DCE2D9` |
| `--border-strong` | `#c8cfc9` | `#b9c6b8` | `#B9C6B8` |
| `--surface-muted` | `#f1f3f2` | `#f2f4ef` | `#F2F4EF`（控えめな背景） |
| `--cm-gutter-bg` | `#f4f6f5` | `#f7f8f5` | フレーム色に合わせる |
| `--selection-bg` / `--accent-glass` / `--cm-active-*` / `--cm-invisible-tab` / `--shadow-accent` | `#2e6b4f` 系 | `#356b50` 系 | accent 変更に追従 |

### dark（モック `.dark` そのまま）

| 役割 | 前 | 後 |
| --- | --- | --- |
| `--bg` / `--chrome-surface` | `#0e1311` | `#18241e` |
| `--surface` | `#141a17` | `#25332a` |
| `--surface-muted` | `#101613` | `#213128` |
| `--border` | `#232c28` | `#35463a` |
| `--border-strong` | `#34423b` | `#4a5f4d` |
| `--text` / `--cm-fg` | `#e8ede5` | `#e5eddf` |
| `--text-muted` / `--cm-gutter-fg` | `#8a9b91` | `#a6b5a5` |
| `--accent` / `--cm-caret` | `#87cba8` | `#aad0ac` |
| `--accent-soft` | `#1d2c25` | `#2e4935` |
| `--accent-contrast` | 未定義＝`#ffffff` | `#15251a`（モック `--accent-ink`） |
| `--cm-gutter-bg` | `#101613` | `#213128` |

`--surface-paper`（`#1d2a23`）と `--nav-surface`（`#142019`）はモックと同じ値だったため変更なし。

### chrome面（全7テーマ）

| テーマ | `--chrome-surface` | 根拠 |
| --- | --- | --- |
| light | `#f7f8f5` | モック `--bg` |
| dark | `#18241e` | モック `.dark --bg` |
| yakou | `#12102a` | 既存 `theme-palette.json` の不透明色（`--bg` はグラデーション） |
| shokou | `#eef5fb` | 同上 |
| edohigan | `#2a2030` | `--bg` と同値 |
| shinkai | `#0a2a38` | `--bg` と同値 |
| crt | `#040a06` | `--bg` と同値 |

配線：`workspace-chrome.css` に `--workspace-chrome-bar: var(--chrome-surface)` を追加し、
**ツールバー・タブ・ステータスの3箇所**がこれを参照。**サイドバーは `--nav-surface` のまま**。
macOSの透明タイトルバー色（`src/lib/theme-palette.json` → Rust が `include_str!` で共有）も
light `#f7f8f5` / dark `#18241e` へ追従（Rust側のテストpinも更新）。

## 実測（実描画・等倍）

設定ダイアログと編集画面のスクリーンショットから画素を採取（`docs/reviews/2026-09-10-v3-theme-stage2/`）。

### 面の分離

| テーマ | ツールバー/タブ/ステータス | 紙面 | サイドバー | chrome vs 紙面 | サイドバー vs 紙面 |
| --- | --- | --- | --- | --- | --- |
| light | `#f7f8f5` | `#fffefb` | `#eef2ec` | 1.06:1 | 1.12:1 |
| dark | `#18241e` | `#1d2a23` | `#142019` | 1.07:1 | 1.13:1 |

境界線：light `#dce2d9` / 紙面 = 1.31:1、dark `#35463a` / 紙面 = 1.48:1。

**読取**：モック値は**面の明度差をほぼ持たず、分離は1pxの境界線が担う**設計（1.06〜1.13:1）。
モック自身の受入目標 C08 は「重要なUI境界・focus は 3:1 以上を目安」としており、
1pxの淡い罫線では届かない。**段階2の第二調整で決める論点**として下へ残した。

### 文字と面のコントラスト（4.5:1 目標・自動検査）

| テーマ | 本文/紙面 | 補助/紙面 | 補助/ナビ | 本文/chrome | 補助/chrome | accent面の文字 |
| --- | --- | --- | --- | --- | --- | --- |
| light | 12.69 | 5.26 | 4.69 | 12.01 | 4.98 | 6.23 |
| dark | 12.44 | 6.94 | 7.82 | 13.37 | 7.46 | 9.40 |
| yakou | 13.61 | 5.51 | 6.04 | 15.25 | 6.17 | 7.43 |
| shokou | 11.69 | 5.23 | 4.66 | 11.32 | 5.07 | 4.73 |
| edohigan | 12.02 | 5.69 | 6.07 | 12.64 | 5.98 | 8.04 |
| shinkai | 10.08 | 4.82 | 6.24 | 12.19 | 5.83 | 11.55 |
| crt | 11.59 | 4.92 | 4.78 | 12.93 | 5.49 | 11.27 |

`themeContrast.test.ts` が CSS の宣言値から読んで検査する（紙面・不透明ナビ・chrome・accent面）。
半透明ナビ（edohigan / shinkai）は前段と同じく実描画測定の経路。

### ついでに直した既存の不足

accent面の文字（`--accent-contrast`）を全テーマで自動検査したところ、**yakou 2.40:1 / crt 1.70:1** と
基準未満だった（白系の文字を明るいaccent面に載せていた）。モックの `.dark` が `--accent-ink:#15251a` を
使っている関係に合わせ、**yakou `#0a0a14` / crt `#04120a`** へ。dark も同じ理由で `#ffffff` → `#15251a`（2.05 → 9.40）。
light / shokou / edohigan / shinkai は元から基準を満たしていた。

## 表示（画像）

編集画面（実アプリ・1440×850、実描画）：

- [light](editor-light-1440.png) / [dark](editor-dark-1440.png)

開始画面： [light](start-light-1440.png) / [dark](start-dark-1440.png) / [yakou](start-yakou-1440.png) /
[shokou](start-shokou-1440.png) / [crt](start-crt-1440.png)

設定ダイアログ（fixture・960×640、7テーマ）：
[light](settings-light-960.png) / [dark](settings-dark-960.png) / [yakou](settings-yakou-960.png) /
[shokou](settings-shokou-960.png) / [edohigan](settings-edohigan-960.png) / [shinkai](settings-shinkai-960.png) /
[crt](settings-crt-960.png)

**撮影上の制約**：edohigan / shinkai はWebGL背景を持つため、ヘッドレスのアプリ画面キャプチャが
キャンバスを写さず空白になる（既知）。この2テーマは設定ダイアログの実描画で確認した。

## 検証

| 項目 | 結果 |
| --- | --- |
| `npm run typecheck` | 成功 |
| `npm test` | **259ファイル / 2,269件 成功**（前段2,250件＋chrome/accent面の検査と修正） |
| `npm run smoke:app-store-surface` | 117件 成功 |
| `npm run build:vite` | 成功 |
| `cargo fmt --check` | 成功 |
| `cargo test`（Rust） | **383件 成功**（パレットpinを更新） |

Rust は色の定義を持つテストのみ更新（パレットは `theme-palette.json` を Rust が `include_str!` で共有）。

## 未決・次の段階（第二調整）

1. **面の分離の強さ**：モック値のままだと 1.06〜1.13:1 で、領域は事実上1pxの罫線だけで分かれる。
   モック自身の C08（重要な境界は3:1目安）と衝突する。選択肢：
   - (A) モック値のまま（静か。平坦に見える）
   - (B) 境界線を強める：`--border` `#cfd8ce`（1.4:1）〜`#bdc9bb`（1.7:1）。3:1 は `#8f9c8c` 級が必要で「静か」とは両立しにくい
   - (C) 面で分ける：chrome / ナビ面をもう一段暗くし、罫線は淡いまま（例：light ナビ `#e8ede6` 前後）
2. **モックに等価定義がない5テーマ**（yakou / shokou / edohigan / shinkai / crt）の文字色・境界線。
   今回は chrome面の新設と accent文字の不足修正のみ。第二調整の対象。
3. **Diff行の背景**：モックは追加 `#E8F1E6` / 削除 `#F8E9E7` を挙げるが、既存の `--diff-*-bg` は
   alpha 合成で近い色になっており、今回変更していない（別スライスで扱う）。
4. 設定外枠寸法（1100×752参考・レール200px）、Help導線、画面16/05/23/24。
5. native 受入：VoiceOver / 200% / 実機の開始画面・編集画面 / 半透明ナビ＋実シェーダー。

## 気づいたが直していない点（既存）

- サイドバー内で「No folder open」が上下2箇所に表示される（実描画で確認）。
- プレビューペイン上部にタブ・ツールバー行と揃わない空白がある。
- 開始画面ヘッダーの「Hazakura Editor」が大小2回表示される。
  いずれも段階2の範囲外。報告のみ。
