# UI 第二調整 — 境界線の階層（--border / --border-strong）

Status: Implementation + evidence（段階2の第二調整・B案）
Authority: Evidence
Date: 2026-09-11
Branch: `codex/v3`

## 何をしたか

段階2でモック値をそのまま入れた結果、**面の分離は chrome vs 紙面で 1.06〜1.13:1**、
境界線は light 1.31:1 / dark 1.48:1 しかなく、領域の輪郭が事実上1pxの罫線だけに依存していた。
モック自身の受入目標 C08「重要なUI境界は3:1目安」と衝突するため、**面の構造は変えず、罫線だけを一段強めた**（B案）。

役割分担（レビュー指摘どおり、全罫線を3:1にはしない）：

| トークン | 役割 | 目標（紙面比） |
| --- | --- | --- |
| `--border` | 通常の区切り。ペイン間の1px線 | 1.5〜1.7 |
| `--border-strong` | 入力欄・重要な輪郭 | 2.1以上、かつ `--border` より明確に強い |
| focus（`outline: 2px solid var(--accent)`） | キーボード操作の現在地 | **3:1以上**（全テーマ自動検査） |

値を「paper から既存border色への補間を k 倍に伸ばす」方法で求め、7テーマで紙面比を揃えた（色相はテーマごとに維持）。

## 変わった値

| テーマ | `--border` 前 → 後 | `--border-strong` 前 → 後 |
| --- | --- | --- |
| light | `#dce2d9` → `#c7d2c5` | `#b9c6b8` → `#a1b3a1` |
| dark | `#35463a` → `#38493c` | `#4a5f4d` → `#4b614e` |
| yakou | `#2a2a50` → `#393870` | `#3c3c6c` → `#4e4d8d` |
| shokou | `#cfdceb` → `#b9cce1` | `#a8c0d4` → `#8eadc7` |
| edohigan | `#4a3548` → `#553e53` | `#6a4a62` → `#73516b` |
| shinkai | `#1d4a60` → `#23566e` | `#2a6480` → `#2f6e8c` |
| crt | `#143020` → `#19402b` | `#1f4a32` → `#255a3d` |

`:root` のライト既定では `--cm-gutter-border` も `--border` に追従（light `#c7d2c5` / dark `#38493c`）。
モックの提案値（`#DCE2D9` / `#B9C6B8`）からは意図的に離れる。**モック準拠より輪郭の読み取りを優先した判断**。

## 実測（CSS実値）

| テーマ | border/紙面 | strong/紙面 | 差 | surface↔strong | nav↔border | chrome↔border | accent↔紙面（focus） | accent↔chrome | native==CSS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| light | 1.55 | 2.20 | 0.65 | 2.22 | 1.38 | 1.46 | 6.18 | 5.85 | ✓ |
| dark | 1.55 | 2.22 | 0.67 | 1.97 | 1.75 | 1.67 | 8.76 | 9.41 | ✓ |
| yakou | 1.55 | 2.18 | 0.63 | 2.39 | 1.70 | 1.74 | 6.25 | 7.00 | ✓ |
| shokou | 1.54 | 2.20 | 0.66 | 2.22 | 1.37 | 1.49 | 4.44 | 4.30 | ✓ |
| edohigan | 1.55 | 2.20 | 0.65 | 半透明 | 半透明 | 1.63 | 7.12 | 7.48 | ✓ |
| shinkai | 1.55 | 2.20 | 0.65 | 半透明 | 半透明 | 1.88 | 8.92 | 10.78 | ✓ |
| crt | 1.54 | 2.22 | 0.68 | 2.37 | 1.50 | 1.72 | 10.53 | 11.76 | ✓ |

focus は 7テーマすべて 3:1 以上（最小 shokou 3.96）。半透明の `--surface` / `--nav-surface`
（edohigan / shinkai）は合成後でしか測れないため、テストでは hex のときだけ計測する。

## 実描画での確認

- 罫線の実画素：サイドバー右端 x=279 が **`#dce2d9` → `#c7d2c5`**、ツールバー下 y=53 も同じく変化（前後で同座標を比較）。
- 目視評価（vision）：**輪郭は確かに分かるようになった**。サイドバー右・ツールバー下は改善。
  表計算ソフトのようなグリッド感は出ておらず、静かなMarkdownエディタとして許容範囲。
- 残る弱い箇所：**ステータスバー上端（y≈836）とタブバー下端（y≈118）**。
  ここは面の明度差が 1.06:1 しかないため、罫線を `--border` のままにすると相対的に弱く見える。

## 表示（画像）

編集画面（実アプリ・1440×850）：[light](editor-light-1440.png) / [dark](editor-dark-1440.png)

設定ダイアログ（fixture・960×640、7テーマ）：
[light](settings-light-960.png) / [dark](settings-dark-960.png) / [yakou](settings-yakou-960.png) /
[shokou](settings-shokou-960.png) / [edohigan](settings-edohigan-960.png) / [shinkai](settings-shinkai-960.png) /
[crt](settings-crt-960.png)

## 検証

| 項目 | 結果 |
| --- | --- |
| `npm run typecheck` | 成功 |
| `npm test` | **259ファイル / 2,304件 成功**（前段2,269件＋階層/focus/native契約） |
| `npm run smoke:app-store-surface` | 117件 成功 |
| `npm run build:vite` | 成功 |

## 自動検査として固定した契約

`themeContrast.test.ts` に追加：

1. **階層**：`--border` は紙面比 1.45〜1.70、`--border-strong` は 2.1以上かつ `--border` と 0.4 以上の差。
2. **面との関係**：`chrome↔border` ≥1.4、不透明 `nav↔border` ≥1.3、`surface↔strong` ≥1.9。
3. **focus**：`--accent` が紙面・ナビ面・chrome面のすべてで 3:1 以上（`outline: 2px solid var(--accent)` の契約）。
4. **native chrome 契約**（レビュー指摘 P3-test）：`theme-palette.json[theme] === CSS --chrome-surface` を7テーマで直接assert。
   CSSだけ変えてJSON側を忘れる事故を、片方ずつのpin更新では見逃さないようにする。

## 未決・次の段階

1. **chrome と紙面の境目**（ステータス上端・タブ下）だけ `--border-strong` を使うか。面差1.06:1を線で補う案。
   今回は B の範囲（階層のセット調整）に留めた。
2. モックの提案値（`#DCE2D9`/`#B9C6B8`）へ戻す余地は残る（「静かさ優先」に方針転換するなら）。
3. 「実装途中感」の3点（サイドバーの「No folder open」二重表示、プレビュー上端の空白、開始画面ヘッダーの二重表示）。
4. native 受入（VoiceOver / 200% / 実機 / 半透明ナビ＋実シェーダー）は未実施のまま。
