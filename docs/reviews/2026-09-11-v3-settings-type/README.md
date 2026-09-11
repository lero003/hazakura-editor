# 設定・文字サイズの行（実機指摘⑩⑪）

Status: Implemented
Scope: `src/components/app/SettingsPreferencesPane.tsx`（+`.test.tsx`）・`src/styles/dialogs.css`
Authority: Evidence（実コンポーネントの実描画・DOM実測）
Date: 2026-09-11
Branch: `codex/v3`

## ⑩「静かな一ページ」とは何か → 行ごとの見本を削除

各文字サイズの行の右に、**その文字サイズで描いた短い見本**（`静かな一ページ`）が出ていた。
すぐ下の「この設定での見え方」（モック16の LIVE PREVIEW。4設定を1箇所に並べる面）と
役割が重複しているため、**行ごとの見本を外した**（`sizeCopy.sample` と
`.settings-font-sample` も削除）。見本は LIVE PREVIEW の1箇所だけになる。

## ⑪ フォントサイズ指定が1行取る → 同じ値・値域の slider を併設

モック16の指示3は「**数値入力を残し**、必要なら同じ値・値域に接続した slider を補助追加する」。
指示に沿って、数値入力はそのままに、**同じ値・同じ値域・同じ clamp** へ接続した
`input[type=range]` を各行へ足した（`FontSizeControl` として1箇所にまとめた）。

- 行の構成は ラベル / 数値 / slider の3要素を1行に並べる（モック16「項目行はラベルと説明を左、
  操作と値を右へ」）。狭い窓（≤900px）では slider を次の行へ落とす。
- アクセシブルな名前は同じ（`role` の spinbutton / slider で区別できる）。
- 値域: editor 12–22 / preview 12–24 / workspace 10–18 / L Mode 12–24（既存のまま）。
- slider の色は `accent-color: var(--accent)`（既存の Quick Settings と同じ）。

## 検証（実行した数字だけ）

- `npm run typecheck` 成功
- `npx vitest run src/components/app/SettingsPreferencesPane.test.tsx src/styles/dialogsCss.test.ts`
  2ファイル・21件成功
- 追加テスト: 4設定それぞれで slider の min/max が既存値域と一致し、動かすと数値入力も追随する。
  行ごとの見本が消え、LIVE PREVIEW の4行だけが残ることを固定。

### 表示（実コンポーネント・deviceScaleFactor 1）

| 画像 | 幅 | 確認したこと |
| --- | --- | --- |
| `settings-type-light-1440.png` | 1440×850 | 4行がラベル/数値/slider の1行に収まり、行ごとの見本が無い |
| `settings-type-rows-light.png` | 同上（切り出し） | 行の密度と揃え（数値の右に slider） |
| `settings-type-dark-1440.png` | 1440×850 | ダークで slider の accent が沈まない |
| `settings-type-light-960.png` | 960×640 | 最小ウィンドウでも崩れない |

実測: `.settings-font-size` 4行、`input[type=range]` 4本、値域
`12–22 / 12–24 / 10–18 / 12–24`、行ごとの見本 `0`、LIVE PREVIEW の行 `4`。
行の高さは 36px（1440 で幅 834）。

## 画像との差・未決

- モック16の画像には行ごとの見本に相当する帯があるが、同じ役割の LIVE PREVIEW が
  直下にあるため1箇所に集約した（重複の解消を優先）。
- モック16の「本文書体」「行間」の独立設定は**未実装のまま**（既存設定に同等項目が無い）。
  これは以前からの未決で、このスライスでは触っていない。

## 残リスク・未受入

- 200%文字表示、VoiceOver（slider の読み上げ）、再起動後の保持、別窓同期。
- 実機でのドラッグ操作（trackpad での slider 操作感）。
