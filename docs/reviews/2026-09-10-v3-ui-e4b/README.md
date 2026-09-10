# UI-E4b — HTML・取り込み 合評資料

Status: Review ready
Scope: 739a2fca → 47036d74 の実装3コミット
Authority: Evidence
Date: 2026-09-10

## 判定と変更

前回のE2/E3 R1〜R3 CLOSED・UI-E4a GOは、オーナー提供の外部レビューとして受領。
今回はP3-lowを修正し、HTMLと取り込みの既存操作を整理した。外部再レビューは未実施。

| Commit | 変更 |
| --- | --- |
| a0cfdd30 | guarded openではglobalな開始statusを出さない。Close/query変更で失効してもOpeningが残らない |
| 66591038 | HTMLにも共通確認外枠。対象文書・未保存編集・完成HTMLの10 MiB制限を案内 |
| 47036d74 | 取り込みの下書き名と元資料名・読み取り専用を明示。案内はlinked sessionだけに表示 |

HTMLは文書単位。確認してから既存の保存先pickerを開く。取消と重複確定は書き込みを起動しない。
pickerの前後でtab ID・session・workspaceを検証し、保存先決定時の最新bufferを既存writerへ渡す。
画像の既存許可、inline処理、画像/CSS込み10 MiB拒否は維持する。元Markdownの保存はしない。

HTMLのEscape/Tabは既存modal keyboard guardに接続。最初のfocusはCancel。
訂正（追レビュー）: 当時nativeメニュー側はSave Conflictのみを遮断しており、HTMLの一般modal遮断は未実装だった。
この記録の過大な主張を訂正し、0e371fbcで一般modal遮断を追加した。書き出し処理自体の全面的な非同期再設計ではない。

取り込みは既存の事前確認→ローカル抽出→新規未保存タブ→元資料の参照という流れを維持。
確定前の抽出ステージ、新しいOCR精度state、元資料の上書き経路は追加していない。
下書き表示は「編集」とし、保存後まで「未保存」と固定表示しない。
2ボタンの参照切替はrole=groupへ揃えた。

## 検証

すべて今回のローカル実行。GitHub CI成功やnative受入の代替ではない。

- Frontend: 252ファイル / **2,189件成功**。
- App Store surface: **113件成功**。
- typecheck / Vite build / native App Store preview build / codesign verify 成功。
- Rust fmt / **383件成功・2件ignored**。Rust変更なし、I/O隣接の確認として再実行。
- git diff --check 成功。
- 既知のVite chunk-size警告、jsdom canvas未実装出力あり。テスト・buildは成功。

追加確認はHTMLの明示確認/取消、二重確定、picker中のsession/workspace変更、
3言語の対象・上限表示、初期Cancel focus、Tab循環、IME Escape、取り込みsession境界。
既存の最新buffer出力と完成HTML上限テストも継続成功。

[HTML 960×640](html-960.png)は実componentの表示fixture。
対象、説明、固定footerと2ボタンが収まり、Cancelからfixtureを閉じられることを確認。
fixtureの確認ボタンは表示を閉じるだけであり、native picker/writerの実行証跡ではない。
取り込みの原寸画像比較は今回未実施。

## 外部レビューで見たい点

1. HTMLの確定・取消と既存writerの接続、session/workspace変更時の拒否が片側だけになっていないか。
2. HTMLモーダルのkeyboard/nativeメニュー境界が他形式と整合しているか。
3. 取り込みの案内が別sessionへ漏れず、保存後にも正しい意味で表示されるか。

## 未受入と次

native保存先の取消/成功/失敗、生成HTML・EPUB・PDFを開いた成果物確認、
取り込み→手動修正→保存/Undo、実IME・VoiceOver・200%は未受入。
C2実System・Reader/検索のnative通し確認も引き続き残る。

次はこの3単位を合評し、UI-Fの既存設定の分類・説明へ進む。
UI-E全体やv3完成とは判定しない。公開タグ、配布設定、uploadは変更していない。
