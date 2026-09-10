# UI-F2 — 設定カテゴリ・文字設定・Help 合評

Status: Review ready
Scope: 40eea92d → f3ea3605（実装3コミット）
Authority: Evidence
Date: 2026-09-10

## 今回の区切り

外部レビューでexport排他/nativeメニューP2 CLOSED、UI-F1 GOを受領。
今回の3スライスはローカル確認済み、外部再レビュー待ち。

| Commit | 変更 |
| --- | --- |
| cb7353cd | 全7テーマのhintを固有IDでaria-describedbyへ関連付け。未選択カードにも説明を提供 |
| fe9e1d4a | 4カテゴリのナビ、見出しfocus、4文字サイズの独立した見本。旧theme selectテスト名を更新 |
| f3ea3605 | 同じPreferencesDialog内でSettingsと既存6 Helpモードを往復 |

カテゴリ切替で設定項目をアンマウントしない。スクロールは設定本文だけを動かし、
外枠のClose/Help切替/カテゴリナビを維持。4文字サイズの既存値域とcallbackは変更しない。
見本は短い静的テキストで、原稿やEditorには書き込まない。

Help入口は既存PreferencesDialogModeへ接続する。新しいmodalや外部ページを開かない。
AgentモードではHelpナビを出さず、配布レーンのAgent入口を増やさない。
Help文書とナビは既存Help方針に合わせ英語。本文/リンク制御は既存Help viewerのまま。
診断は本体では既存DiagnosticsPaneを使う。fixtureの診断文書はnative診断の証拠ではない。

## ローカル検証

- Frontend: **255ファイル / 2,206件成功**。
- App Store surface: **113件成功**。
- 4文字サイズの上限/下限、他の3値が不変、3言語カテゴリ移動、入力DOM保持を確認。
- Helpの全6モード→Settings、単一dialog、切替selectorのfocus維持を確認。
- テーマの説明IDは選択前にもhintへ対応していることを確認。
- 表示検証でscrollIntoViewが外枠まで動かす問題を発見し、本文scrollTopだけを変更する方式へ修正。
  修正後の近接**17件成功**と実表示で外枠保持を再確認。
- typecheck / Vite / native preview / codesign verifyは、スクロール修正を含む最終コードで成功。
- Rust無変更・再実行なし。前回383件を今回成功値にしない。

既知のjsdom canvas未実装出力・Vite chunk警告あり。CI成功やnative受入とは区別する。

## 960×640表示

- [カテゴリ移動](categories-960.png)
- [文字サイズと見本](typography-960.png)
- [Help](help-960.png)

実SettingsPreferencesPane/PreferencesDialog/PrivacyPreferencesPaneのブラウザーfixture。
「見た目と書き心地」→「エディタ」で見出しへ移動し、固定外枠が残ること、
Settings→About→Settingsで同じselectorにfocusが残ることを確認。
fixtureはローカルstateのみ。再起動・native診断・テーマ演出の証拠ではない。

## 次のレビューと未受入

設定の既存項目/配布レーン差分、カテゴリ移動後のTab、Help往復、文字サイズの独立性を見たい。
VoiceOver実読み上げ、200%文字、IME、native再起動後の設定・別窓同期は未受入。
UI-G横断受入と、Assist状態/Help文言の現行仕様との整合確認へ進む。
