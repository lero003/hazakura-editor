# UIレビューと最小再現

対象: `lero003/hazakura-editor@2438ef1f953b14ecf4b5ea30b3c39cbfa6bd30b5`

本編は `review-2438ef1f.md`。

## 証跡の扱い

このフォルダのHTML・PNG・JSONは、対象ソースの関係するCSS／イベント処理を抽出して作った**最小再現**です。実アプリのビルド成果物でも、Tauri・WKWebView・VoiceOver・macOSの実機検証でもありません。ファイル操作やAI生成を行いません。リポジトリのフルテストを置き換えるものではありません。

- `export-*`: 書き出しフレームの長名・低いviewport。主要レイアウトCSSを再現し、一般的なボタンと実行環境のフォントを使っています。PNGの約69pxというはみ出しはこのfixture固有の値です。
- `reader-keyboard-repro.html`: readerのdocument captureリスナー。ページ送りはカウンタに置き換えています。
- `font-number-repro.html`: number欄の即時clampをcontrolled-input相当で再現。Reactのmountではありません。
- `palette-interaction-repro.html`: inputとoptionのactivation経路およびTab順の抽出。実アプリのコマンドは実行しません。

JSONには対照ケースも含まれます。root font-size 32pxのケースを、nativeの200%拡大テストと呼ばないでください。

## 再実行

Python 3とPython用Playwright、Chromiumが必要です。作成時の実行環境では `/usr/bin/chromium` を使用しました。各スクリプトは出力先を自分自身と同じディレクトリにし、既存の証跡を上書きします。

```sh
python export-layout-repro.py
python interaction-repros.py
python palette-interaction-repro.py
```

Chromiumの場所を明示する場合は `CHROMIUM_PATH` を設定します。未指定の場合はPATH上のchromium/chromium-browserを探し、見つからなければPlaywrightの標準ブラウザを使用します。

`--no-sandbox` はこの隔離された再現用の実行設定です。第三者のWebページを閲覧する目的では使わないでください。スクリプトはローカルの固定HTMLを `set_content` するのみです。

ソース由来の挙動を追うための診断材料です。本修正時には対象リポジトリのReact統合テストとmacOS実機で同じ手順を実行してください。
