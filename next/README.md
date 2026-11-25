# Hazakura Editor Next — ネイティブ技術検証

このディレクトリは、第一世代と独立した macOS アプリの開発用プロジェクトです。現時点では、内蔵のサンプル原稿を TextKit 2 で編集する検証画面だけを提供します。配布版ではありません。方針・フェーズは[ロードマップ](../docs/roadmap.md#第二世代設計)を参照してください。

## ビルド・テスト・起動

開発ターゲットは暫定で macOS 26 以降。Swift 6.2 以上と対応する macOS SDK を使います。対応OS・Intel対応・配布方式の最終決定ではありません。npm、Cargo、外部 Swift パッケージは不要です。

リポジトリのルートから:

```bash
swift test --package-path next
bash next/scripts/run-dev.sh --build-only
bash next/scripts/run-dev.sh
bash next/scripts/run-dev.sh --long-sample
```

`--build-only` は `.build/` 配下に開発用 `.app` を作成し、ローカルのアドホック署名と整合性を確認します。配布署名や公証は行いません。通常起動と `--long-sample` はその `.app` を開き、後者は内蔵サンプルを繰り返して生成した長文を表示します。Bundle ID は `dev.hazakura.editor.next.dev`（第一世代とは別）。第一世代の設定・保存場所は読み書きしません。アプリ独自の永続データは現時点では作成せず、将来のデータ領域も第一世代から分離します。入力はウィンドウ/アプリを閉じると失われます。実原稿ではなく内蔵テキストで検証してください。

## 検証すること・まだ検証しないこと

- `HazakuraNextCore` は文書 ID・Markdown 原文・編集リビジョンを所有します。ディスク上の版や復旧レコードを持つふりはしません。
- `HazakuraNextEditor` は TextKit 2 の AppKit ビュー、SwiftUI はウィンドウと表示を担当します。SwiftUI 更新のたびに原文をビューへ押し戻さず、選択・変換・Undo は AppKit に残します。
- これ以降の実機では、変換中の確定/取消、文字列や選択範囲の保持、Undo/Redo の単位、長文の折り返し、VoiceOver、起動と入力応答、メモリを計測します。自動試験とビルドの成功はこの受け入れを代替しません。ファイル操作、保存と競合、復旧、符号化、サンドボックス、配布、モデル推論はこの検証には含めません。
