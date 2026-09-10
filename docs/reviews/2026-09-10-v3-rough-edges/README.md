# UI 手直し — 「実装途中感」の3点

Status: Implementation + evidence
Authority: Evidence
Date: 2026-09-11
Branch: `codex/v3`

## 何をしたか

前回レビューの最後に挙がった3点を、実測で正体を特定してから直した。いずれも**表示の重複・空白**で、
保存・反映・パス・実行の契約には触れていない。

| # | 症状 | 実測した正体 | 直し方 |
| --- | --- | --- | --- |
| 1 | サイドバーに「No folder open」が二重 | `WorkspaceSidebar` のヘッダー（`.workspace-title`）と本文の空状態（`.workspace-empty`）が同じ `copy.noFolderOpen` を出していた（実描画で y≈98 と y≈449） | フォルダ未選択のときは**ヘッダーの見出しを出さない**。案内と操作は空状態に一本化 |
| 2 | 上部ツールバーの「Hazakura Editor」が大小で二重 | `AppPrimaryToolbar` が `<strong>{documentName}</strong>` と `<small>{workspaceName \|\| "Hazakura Editor"}</small>` を描き、フォルダ未選択だと**同じ製品名が上下に並ぶ** | 副題は開いている**フォルダ名がある時だけ**描く（モックの副題も「散文集」＝フォルダ名） |
| 3 | プレビュー上端の空白 | `.document-meta`（表示ツールバー行）は文書カラム全幅だが、`L Mode`＋閲覧系が左に寄っており、**右半分 475×85px が単色（98.8%が1色）** で空いていた | 閲覧系の節（`Preview`/`e-book`/`Outline`/`Reference`/`Diff`）を**行の右端へ寄せる**（モックで「並べて表示」が右端に置かれている位置に相当） |

## 実測（前 → 後）

| 指標 | 前 | 後 |
| --- | --- | --- |
| 表示ツールバー行の右半分（x960-1435, y70-155）の最頻色占有率 | **98.8%**（異なる色 2） | **69.0%**（異なる色 326） |
| 閲覧系クラスタの右端 | x=959（文書カラム右端は1426） | **x=1426（右端に一致）** |
| サイドバーの「No folder open」出現数 | 2 | **1** |
| ツールバー内の「Hazakura Editor」出現数（文書なし） | 2（`strong`＋`small`） | **1（`strong`のみ）** |

狭幅（960×640 / 1024×748）でも右寄せが成立し、横スクロールは出ない（クラスタ高32px＝1行のまま）。
1440×850 は [editor-light-1440.png](editor-light-1440.png) / [editor-dark-1440.png](editor-dark-1440.png)、
960 は [editor-light-960.png](editor-light-960.png)、1024 は [editor-light-1024.png](editor-light-1024.png)、
開始画面は [start-light-1440.png](start-light-1440.png)。

## 表示（画像）

[light 1440](editor-light-1440.png) / [dark 1440](editor-dark-1440.png) / [light 960](editor-light-960.png) /
[light 1024](editor-light-1024.png) / [開始画面 1440](start-light-1440.png)

## 検証

| 項目 | 結果 |
| --- | --- |
| `npm run typecheck` | 成功 |
| `npm test` | **260ファイル / 2,309件 成功**（前段2,304件＋今回5件） |
| `npm run smoke:app-store-surface` | 117件 成功 |

追加したテスト（先に落ちることを確認してから実装）：

- `WorkspaceSidebar.test.tsx`：空フォルダのとき `noFolderOpen` が**1回だけ**出て、`Open Folder` が残る
- `AppPrimaryToolbar.test.tsx`：文書名と副題に同じ製品名を出さない／フォルダがある時は副題に出る
- `workspaceChromeCss.test.ts`（新規）：表示ツールバー行が全幅であること（`grid-column: 2` / `justify-self: stretch`）と
  閲覧系の節が `margin-left: auto` で右端へ寄ること

CSS は flex の子（`.chrome-section`）を押し出す必要があったため、`:has(.pane-control-cluster.reading-controls)` で
対象を名指しした（`:has()` は既にテーマCSS・ダイアログで使用済み）。

## 未決・残り

1. **プレビュー見出しの帯**：`.right-pane-header` には既に `border-bottom: 1px solid var(--border)` がある。
   今回の手直しで「上に何も無い空白」は解消したが、ヘッダーと本文の切れ目をさらに強めるかは未決。
2. **chrome と紙面の境目**（ステータス上端・タブ下）：面差1.06:1を線で補うかは前スライスからの継続未決。
3. 設定の外枠寸法（1100×752参考・レール200px）、画面16/05/23/24。
4. native 受入（VoiceOver / 200% / 再起動後設定 / 実System / 半透明ナビ＋実シェーダー）は未実施のまま。
