# 編集画面のタブと表示操作（2026-09-13）

Status: Verification record
Scope: v3 編集クロームの見た目と隣接操作

## 変更

- タブの上線（テーマ固有の疑似要素）と下線を解消。全テーマで、文字色を9%混ぜた静かな面と太字で現在の文書を示す。ホバー・閉じる・未保存表示・ドラッグ先表示は残す。
- 使われていなかった先頭42px列を削除し、えるモードとタブ群の左端を揃えた。
- v3では上部タイトルとタブに重なる下段のパンくずを省略。フルパスはタブのツールチップとエディタ下端から確認できる。
- 下段の囲みと選択下線を減らし、タブ40px・操作列40pxに整理。文字サイズを12pxに揃え、非選択操作は控えめな文字色にした。
- Local Assistを含む上部ボタンへ `-webkit-user-select: none` / `user-select: none` を指定。ラベルの単語だけが文字選択されるのを防ぐ。部分強調する独自マークアップは無かった。

## 確認

- `npm run typecheck` 成功。
- `npm test` 全282ファイル・2,498件成功。既存CSS契約を新しい二列配置へ更新。今回は見た目の変更なので、形だけの追加テストは作らず下記の表示確認を実施。
- `npm run smoke:app-store-surface` 125件成功。
- `npm run build:vite` を含む分離QAアプリのビルド成功。ad-hoc署名検査成功。
- `git diff --check` 成功。既存の混在変更を保持。実行対象のソースとQAバイナリは [source-evidence.json](source-evidence.json)。
- ネイティブQAアプリで7テーマ（ライト・ダーク・夜光・曙光・江戸彼岸・深海・CRT）を確認。深海/CRTは起動演出終了後に撮影。
- 長い名前を含む5タブ、標準1280×820と縮小幅、Aaメニューの開閉/Escape、えるモードへの往復、標準幅復帰を確認。文書は保存不要のまま。
- 実AppブラウザfixtureでLocal Assistラベルのダブルクリック後に文字選択が空、操作後も空であることを確認。[DOM実測](browser-metrics.json)ではタブとえるモードの左端がともに300px、下段のパンくず0件、上線疑似要素なし。

## 画像

- [変更前・曙光](native-before-shokou.png) / [変更後・曙光](native-shokou.png)
- [ライト](native-light.png) / [ダーク](native-dark.png) / [夜光](native-yakou.png)
- [江戸彼岸](native-edohigan.png) / [深海](native-shinkai.png) / [CRT](native-crt.png)
- [狭幅](native-narrow.png) / [えるモード](native-lmode.png)
- [Local Assist・ブラウザfixture](browser-local-assist.png)

## 限界

QAアプリの既存設定ではLocal Assist入口が非表示のため、当該ラベルは実コンポーネントのブラウザfixtureで検証した。ユーザー環境で生じた部分選択の元の操作手順は未特定。生成・停止・反映の経路は変更していない。
ネイティブQAの記録は提出候補の受入、VoiceOver、IME、署名配布・公証の完了を意味しない。
