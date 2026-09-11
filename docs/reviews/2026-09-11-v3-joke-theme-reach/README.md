# お遊びテーマの演出範囲（実機指摘⑦）

Status: Implemented
Scope: `src/styles/crt-theme.css`・`src/styles/shinkai-theme.css`・`src/styles/jokeThemeReachCss.test.ts`
Authority: Evidence（実コンポーネントの実描画と computed style 実測・CSS契約テスト）
Date: 2026-09-11
Branch: `codex/v3`

## 何が起きていたか

本文（CodeMirror / プレビュー）には**文字の演出**（CRT の色収差、深海の水中グロー）が常時
かかっている一方、UI chrome は次の規則で明示的に除外されていた。

```css
/* 旧: UI chrome は色収差なし（CRT）。深海も同形。 */
:is(.tabs-row, .file-tree-pane, .status-bar, .workspace-sidebar-rail) :is(span, button, …) {
  text-shadow: none;
}
```

つまり「演出がワークスペースだけ」（実機指摘⑦）はこの除外規則そのものだった。
背景シェーダー/粒子は元から全画面の固定層（`position: fixed` / `--z-base`）で、タブ・
サイドバーには回っていたが、**文字の演出**は本文だけだった。

## 判断（オーナー）と実装

> サイドバーとタブまで（ステータスと主要操作ボタンは除外）

- **載せる**: タブ（`.tab-name` / `.tab-parent` / `.empty-tabs`）とサイドバー
  （`.tree-name` / `.workspace-kicker` / `.workspace-title` / `.workspace-labels`）。
  本文より**薄く**する（ずれ 1.6px → 0.9px、不透明度 0.55/0.50 → 0.30/0.28。
  深海のグローは 6px/0.16 → 5px/0.10）。
- **据え置く**: ステータスバー（状態表示）、および主要操作ボタン
  （`.primary-save` / `.primary-companion` / `.pane-toggle` / サイドバーの新規・開く・
  ゴミ箱・折りたたみ・レールの戻す）。値を読み違えると操作を誤る面を対象から外す。
- 夜光・曙光の演出は背景の粒子とグラデーションで、固定層として全画面に回っている
  （タブ・サイドバーには元から乗る）。江戸彼岸は明色の静かな紙面で文字演出を持たない。
  **今回の変更は文字演出を持つ CRT と深海の2テーマ**。

## 検証（実行した数字だけ）

- `npx vitest run src/styles/jokeThemeReachCss.test.ts` 5件成功
  （載せる対象7クラス／除外する対象10クラス／本文より弱いことを CSS で固定）
- `npm run typecheck` 成功／`npm test` 成功

### 表示（実コンポーネント・1440×850・deviceScaleFactor 1・computed style 実測）

| 対象 | CRT | 深海 |
| --- | --- | --- |
| `.tab-name` | `rgba(255,40,40,.3) 0 0` + `rgba(40,140,255,.28) 0 0` | `rgba(125,211,224,.1) 0 0 5px` |
| `.tree-name` | 同上 | 同上 |
| `.workspace-title` | 同上 | 同上 |
| `.status-bar-format-value` | **none** | **none** |
| `.status-bar-status` | **none** | **none** |
| `.primary-save` | **none** | **none** |
| `.primary-companion` | **none** | **none** |

ライトテーマでは全対象が `none`（お遊びテーマ限定であること）。

- `joke-reach-crt-1440.png` / `joke-reach-shinkai-1440.png` / `joke-reach-light-1440.png`

## 画像との差・未決

- モックに「ジョークテーマの適用範囲」の規定は無い（テーマは `:root` / `.dark` / `.edohigan`
  の3つだけが定義され、yakou/shokou/shinkai/crt はアプリ独自）。今回の範囲は
  オーナー判断として記録する。
- 強度の最終値（0.9px / 0.5px グロー）は実機の見え方で調整しうる。

## 残リスク・未受入

- **実機での見え方**（WebGL 背景シェーダーと文字演出の重なり）。ヘッドレス撮影では
  WebGL 層が写らないため、この証跡は「文字演出の有無」だけを示す。
- 200%文字、VoiceOver、`prefers-reduced-motion: reduce` の実機挙動。
