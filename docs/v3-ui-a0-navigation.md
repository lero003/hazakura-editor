# v3 UI-A0 — 通常編集の配置と遷移

Status: Implementation contract
Scope: UI-A1通常編集外枠。UI-B以降の各面の再設計とは分ける
Authority: Medium
Last reviewed: 2026-09-09

## 第一回レビューの範囲

画面02の通常編集外枠と文書ナビを実装し、19のdarkと23の狭幅を隣接確認する。
既存のCodeMirror、保存、タブ、Preview、右列の排他状態を流用する。
L Modeの浮動操作、本全体Reader/集中Readerの独立操作面は今回再設計しない。

| 既存操作 | 移行先 / 保持 |
|---|---|
| タブ選択・dirty・閉じる・並替え・文脈メニュー | 専用タブ行。履歴/保存対象の正本は既存タブ |
| えるモード・文字/折返し等のクイック設定 | 文書ツールバー。設定値と既存Preferencesは保持 |
| Preview・目次・参照・Diff・e-book | 文書ツールバーに既存の細かい操作を保持。上段ナビは目的別の入口 |
| Local Assist / Developer Agent | 現行の配布・セッションgateと利用不可説明を維持 |
| 保存 | 上段の明示ボタンから既存saveActiveTab。画像閲覧中・保存中・Assist lock時は無効 |
| 書き出し | 既存メニュー/Command Paletteを維持。形式別統合はUI-E |
| ファイルを開く/新規/別名保存、検索/置換/行移動、Quick Open | 既存nativeメニュー/Command Palette/ショートカット/開始画面を保持 |
| workspace/Book Scope/レシピ、画像許可、復元、OKF | 既存サイドバー・メニュー・モーダルを保持。UI-D/Eで個別再配置 |
| 言語、全テーマ、画像/リモート画像、バックアップ、Privacy/診断/Help | 既存Preferencesの全項目を保持。UI-Fで個別再配置 |

## 通常文書の遷移

| 入口 | 行うこと | 行わないこと |
|---|---|---|
| 書く | 読書/比較/参照を閉じ、既存エディタへ戻る。Preview/目次は補助面として残す | 本文変更、Undoリセット、タブ変更 |
| 読む | 現在の文書を既存e-bookで開く。すでにe-bookなら閉じない | Book Scopeの新規選択・背景読込 |
| 確認・0件 | 操作を無効化し、対象なしの説明 | 空のAI Diffを作る |
| 確認・1件 | 有効な対象へ直接移動 | 本文反映・保存 |
| 確認・複数 | 種類と文書名を表示し、利用者に選択させる | 暗黙の優先対象切替 |
| 画像中 | 文書ナビ/保存を無効化。画像を閉じる/タブ選択は既存操作 | 背後の原稿を無言で保存 |
| 読書の独立面 | 既存Readerの戻る/章編集を使う。上段ナビを出さない | 二重の読書状態を所有 |

確認対象: 完成した現タブのAI提案、dirtyかつpathを持つ文書対disk、読込済み参照、
現在開いている比較。対象ラベルは実文書名。古い提案の反映可否は既存reviewが再検証する。
一時的なpopover以外のモードstateは追加せず、表示選択は既存sidePaneMode/reference状態から導出する。
変更中に選択肢が変わった場合は古いpopoverを閉じる。EscapeはIME変換中に消費しない。

## 保全と検証

通常編集・保存・キャレット・Undo、右列の排他、タブと画像切替、dirty/no target、
複数確認対象の選択、popover Escape/focus、既存全メニューへの到達性を確認する。
共有UIのためfrontend全体とApp Store surfaceを実行。画像は同一文書と論理サイズで比較。
native drag/traffic light、IME/VoiceOver、実AI/旧OSの確認結果はブラウザー試験と区別する。
