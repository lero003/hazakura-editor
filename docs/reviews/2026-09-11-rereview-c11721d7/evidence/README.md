# 再レビューの限定再現物

対象: lero003/hazakura-editor@c11721d79ae1f3265d4b485fe43388b44f052a17

これはソース制御フロー／DOMイベントの抽出型検証です。実アプリ、React Hookの実行、Tauri、WKWebView、VoiceOverの証跡ではありません。

## 実行

- `node export-lifecycle-repro.mjs`: 非同期状態モデル6ケース、結果はexport-lifecycle-results.json。
- `python quick-open-repro.py`: PlaywrightとChromiumで抽出イベント6ケース、結果はquick-open-results.json。環境のChromiumが別の場所ならexecutable_pathを変更。

quick-open-repro.pyはfile URLが環境ポリシーでブロックされるため、ローカルHTMLの文字列を新しいページへset_contentで読み込む。各ケースで新しいページを作り、グローバル変数の重複と状態持越しを避ける。

add-to-useDocumentExport-tests.ts.txtは既存リポジトリテストへの追記案であり、このレビューでは未実行。修正後は既存APIの責務変更に合わせて調整する。

HTMLからのUI閉じはhidden属性で模擬している。Reactでのunmountや閉じた後のフォーカス復帰を、この再現物から保証してはいけない。
