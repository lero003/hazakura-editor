# 江戸彼岸 — 花白の紙、古木の墨、蕾の紅

Status: Review record
Scope: v3 江戸彼岸テーマの意匠と描画実装
Authority: Evidence; current-work/current-status を現状の正本とする
Date: 2026-09-12

## 意図と変更

江戸彼岸桜を題材にしたテーマとして、既存の明るい紙色を維持し、枝花と花びらで表情を揃えた。
旧演出は開花後の葉影が全面に重なり、文字・操作面まで灰色に濁って見えた。
紫色の暗い起動演出も明色の紙面とつながらなかったため撤去した。

- **色:** 花白の紙 `#fffcf8`、淡紅の下地 `#fbf4f2`、墨 `#453735`、紅 `#975b68` の既存値を維持。
  accent gradient の紫側だけを紅の濃淡へ揃えた。
- **構図:** 開始画面は右下に枝花、編集中は左下へ抑えて配置。1100px以下では枝を小さくする。
  花びらは左右に流し、窓中央32–68%はマスクで隠す。画面全面の陰影は重ねない。
- **動き:** `EdohiganAmbient` の少数要素をCSSのtransform/opacityで動かす。
  off=0、subtle=4、normal=8、dramatic=14枚。非表示時は停止し、Reduce Motionでは枝だけの静止画。
  全面WebGL、毎フレームのJS、マウス追従処理を削除した。GPU使用量・消費電力の実測は未実施。
- **一貫性:** 設定のテーマ見本に同じ枝花を使い、3言語の説明も更新。
  Previewのリンクとinline codeに残っていた明るすぎる固定色を意味トークンへ戻し、
  全文Readerの紙面・native shell tintに残った暗色も修正した。
- **境界:** source、保存、Undo、Local Assist、配布レーンは変更なし。
  先行するLocal Assist分離窓の色修正を保持。既存のUI/App Store設定の未コミット差分も保持。

植物の方向づけは、白〜淡紅の5弁花、開花時には葉が展開していないこと、古木の特徴を
[森林総合研究所のエドヒガン解説](https://www.ffpri.go.jp/kys/business/jumokuen/jumoku/zukan/edohigan.html)
で確認した。素材は植物学的な同定用図版ではなく、テーマのための創作画。

## 前後比較

専用ブラウザoriginで実際のApp/DOM/CSSを描画し、nativeコマンドだけをfixtureで置換。
ユーザーの原稿やnativeアプリの設定は使用していない。原稿は `sample.md` の自作文章。

| 状態 | 変更前 | 変更後 | 目視判断 |
| --- | --- | --- | --- |
| 開始・1440×850 | [before](01-start-before.png) | [after](01-start-after.png) | 広い余白に枝花を置き、全面のまだらな陰影を解消 |
| 編集＋Preview・1440×850 | [before](02-editor-before.png) | [after](02-editor-after.png) | 墨文字と紙の境界が明瞭。装飾を周辺へ限定 |
| 編集＋Preview・960×640 | — | [after](03-editor-960.png) | 既存の狭幅レイアウトと折り返しを維持、枝花を縮小 |
| えるモード・1440×850 | — | [after](04-lmode-after.png) | 中央の紙面と左下の枝花が共存 |
| 設定・1440×850 | — | [after](05-settings-after.png) | 選択見本・説明が実テーマと一致 |

編集の比較は同じ文章・窓寸法。変更前は新規未保存、変更後はfixtureの文書復元のため、
パス表示・Dirty表示・カーソル位置・ステータス文言は異なる。これらをテーマの差として扱わない。
設定画像の `Settings / Help` は確認用fixtureの操作で、製品へ追加したUIではない。

途中で確認ブラウザの入力操作が応答しなくなった。直接開いた実コンポーネントの表示と比較は確認できたが、
変更後の読書/設定の操作を通しで受け入れたとは扱わない。native描画・IME・体感負荷も別確認。

## 検証

リンク/inline codeの紙面コントラストを検査する失敗テストを先行。旧色の1.75:1 / 1.65:1で
失敗することを確認し、既存トークンへの修正後に通過した。これは静的色の検査で、
動く花びらが重なった画素のコントラストを保証するものではない。

| コマンド | 結果 |
| --- | --- |
| `npm run typecheck` | 成功 |
| `npm test` | 282ファイル・2,486件成功 |
| `npm run build:vite` | 成功。既存のchunk size警告あり |
| `npm run smoke:app-store-surface` | 10ファイル・125件成功 |
| focused theme/component/locale tests | 最後のCSS調整後、4ファイル・128件成功 |
| `git diff --check` | 成功 |

旧WebGL専用テストを新しい演出契約へ置き換えたため、先行作業の件数とは異なる。
新しい契約はoffからの復帰・枚数上限・visibilityの停止/復帰・イベント解除・WebGL/rAF未使用を検査。
Rust/helperは無変更のためcargo/Swiftは今回未実行。署名済みnative候補の再作成・実機受入は未実施。

再実行:

```bash
npm run typecheck
npm test
npm run build:vite
npm run smoke:app-store-surface
git diff --check
npm run dev:vite -- --port 1433
```

最後のサーバーで `docs/reviews/2026-09-12-v3-edohigan-refinement/fixture.html` を開く。
`?view=editor` / `?view=lmode`、`&intensity=off|subtle|normal|dramatic` で状態を指定できる。
このfixtureは専用の `127.0.0.1:1433` originに限定し、同originの確認用下書き・復元状態を初期化する。

## 素材の由来

組み込みImage Genで本テーマ用に新規生成した透明背景の植物画を、縮小・WebP変換して同梱。
外部画像の実行時取得はない。生成時の指示の要旨:

- **枝花:** 古い江戸彼岸の細い灰褐色の枝を左下から右上へ。疎らな5〜7房の白〜淡紅の5弁花と紅い蕾。
  葉は付けない。紙色/墨色/紅の既存パレットに合う透明水彩、余白を大きく取り、文字・UI・背景なし。
- **花びら:** 一枚だけの白〜淡紅の花びら。非対称な丸い涙形、浅い切れ込み、微かな紅の筋。
  透明水彩、小さな表示でも輪郭が分かること。透明背景、文字・影・他の花なし。

`src/assets/themes/edohigan-branch.webp`: 幅640px、66,126 bytes、cwebp quality 88。
`src/assets/themes/edohigan-petal.webp`: 幅96px、1,600 bytes、cwebp quality 90。合計約66KiB。

## 次のnative受入

演出off→再表示、各強度、Reduce Motionの切替、非表示からの復帰、長文入力中の落ち着きを確認する。
Preview・えるモード・Reader・設定・Local Assist分離窓で紙色を比較し、選択文字と操作を妨げないことを確認する。
