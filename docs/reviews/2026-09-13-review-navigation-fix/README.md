# 「確認」の往復・スクロール修正

Status: Verification record
Scope: v3 global navigation / saved-file change review
Date: 2026-09-13

## 再現と原因

分離した macOS QA アプリで、保存済みサンプルに未保存の追記を行い再現した。

1. 「確認」の本文で下へスクロールしても先頭のまま。
   差分と同じ grid cell に残った空の `.reference-editor-host` が positioned element として手前に重なり、入力を遮っていた。
   実 App のブラウザ補助検証でも `elementsFromPoint` の先頭がこの host だった。
   差分表自体は clientHeight 476 / scrollHeight 2444 で、スクロール可能な高さは確保されていた。
2. 「書く」はペインを隠すだけで compareView を残していたため、再度「確認」を押すと
   「保存前の変更」と同じ原稿の「開いている比較」が並んだ。
3. その選択肢はマウスでは閉じるだけ、Return では遷移できた。
   macOS WebKit の mouse down 時の blur により、click 前に選択肢が unmount される経路をテストで固定した。

## 修正

- 差分表示中は host 全体を `display: none` にし、差分へ入力が届くようにした。エディタのマウントと Undo は維持。
- 比較から「書く」へ戻ると、既存の closeCompareView 経路で比較を終了し、ペインを畳む。
- 対象選択の左 mouse down は既定のフォーカス移動を抑え、click で選択を確定する。Tab で外へ移る場合と Escape の終了は維持。
- 比較・編集・保存・提案適用の内容や権限は変更していない。

## 確認

- red: 比較終了と WebKit の選択クリックの2テストが失敗することを確認。
- green: 関連4ファイル81件成功。全 Vitest 282ファイル・2,495件成功。
- `npm run typecheck`、`npm run build:vite`（QA build 内）、`npm run smoke:app-store-surface` 125件成功。
- 同一 bundle ID の QA アプリを再ビルドし、ad-hoc 署名の `codesign --verify --deep --strict` 成功。
- 実機で差分末尾の追記までスクロール可能。上部だけで「書く→確認」を3往復し、各回で直接比較へ遷移、未保存編集を保持。
- 比較表示中の複数対象メニューから「保存前の変更」をマウス選択でき、比較の閉じるボタンへフォーカスが戻る。
- 戻った編集で `SECOND EDIT` を追記し、次の比較へ反映。最後に3回の Undo でサンプルを未変更へ戻し、保存と確認が無効へ戻ることを確認。
- ブラウザ補助検証でも修正後の hit は `.diff-cell`、host は非表示。ブラウザ結果と native 結果は別々に観察した。

実機は既存の江戸彼岸テーマ・長文サンプルでの確認。全テーマ/狭幅/VoiceOver/IME/Local Assist の通し受入と提出候補は今回の証跡に含めない。
既存の未コミット変更を含む QA build。対象ソースと binary のハッシュは [source-evidence.json](source-evidence.json)。

## 画像

| 状態 | 証跡 |
| --- | --- |
| 修正前: 比較が残る選択肢 | [画像](before-retained-choice.png) |
| 修正前: スクロール前 / 下方向操作後も先頭 | [前](before-scroll-top.png) / [後](before-scroll-blocked.png) |
| 修正後: 先頭 / 末尾到達 | [先頭](after-scroll-top.png) / [末尾](after-scroll-bottom.png) |
| 上部のみ3往復後 | [画像](after-three-round-trips.png) |
| 戻ったあとの追加編集 | [画像](after-fresh-edit.png) |
| Undo 後・未変更の編集画面 | [画像](after-undo-clean.png) |
