# README 画像のv3更新（2026-09-14）

Status: Applied（README.md の「Preview」を更新済み。画像は `docs/images/` に配置）
Scope: README用スクリーンショットの選定・公開処理・差し替え
Authority: Advisory
Date: 2026-09-14

## 元と加工

- 元: `.hazakura/private/app-store-v3-captures-2026-09-13/`（2026-09-13 撮影・ベース Git HEAD
  `d01a82b5`・App Store surface の ad-hoc QA ビルド・main window 1280×820）。
  App Store 掲載素材と同じ元キャプチャ。
- 公開用の加工は `sanitize-readme-images.py` のみ。撮影環境の絶対パス（ユーザーホーム配下）と一時的な
  状態メッセージ（「タブを閉じました」「タブにフォーカスしました」）を、同一画像内の内容のない帯
  から複製して除去した。塗りつぶしや色置換はしていない（除去位置はスクリプトのdocstringを参照）。
- 加工後、パッチを当てた3枚は画素の再確認と目視で「パスなし・メッセージなし・継ぎ目なし」を確認。

## 出力（docs/images/）

| 出力 | 元 | 加工 |
|---|---|---|
| `v3-editor-preview.png` | 01-editor-preview-light | パスバー除去・左メッセージ除去 |
| `v3-l-mode.png` | 02-l-mode-light | なし |
| `v3-reader-spread.png` | 03-reader-spread-light | 左メッセージ除去 |
| `v3-diff-review.png` | 04-review-unsaved-diff-light | なし（「変更確認の準備ができました 未保存」は内容として保持） |
| `v3-themes.png` | 06-themes-and-writing-light | なし |
| `v3-edohigan.png` | 07-editor-preview-edohigan | パスバー除去・左メッセージ除去 |
| `v3-local-assist-review.png` | 10-local-assist-review-edohigan | なし（「案を差分レビューに表示しました…」は内容として保持） |

README.md の「Preview」は上記7枚を参照する（旧 v0.11 画像の参照は差し替え済み。旧ファイルは残置）。

## 限界

- 元QAキャプチャのため、タイトル下の workspace 名「v3」が写る（掲載判断はこれまでどおりオーナー）。
- メインウィンドウの窓タイトルは文書名で、アプリ名は写らない。
- 再撮影はしていない。次の更新時は `.hazakura/private/` の元キャプチャを差し替えて本スクリプトを再実行する。
