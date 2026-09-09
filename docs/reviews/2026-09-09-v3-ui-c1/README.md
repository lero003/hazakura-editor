# UI-B追修正・LA-0・UI-C1のまとめレビュー

Status: External review GO; C1 follow-up recorded in UI-C2
Scope: Preview入口、開始フォーカス、Local Assistの責務と表示面
Authority: Review evidence
Last reviewed: 2026-09-09

比較基点 `48233e1c`、ブランチ `codex/v3`。
オーナー提供レビューにより前回R1/R2はCLOSED、UI-B2は大筋GO。
その後のオーナー提供レビューでR3〜R5 CLOSED、LA-0 GO、UI-C1 GO。
C1の小修正と次の導線は[UI-C2資料](../2026-09-09-v3-ui-c2/README.md)へ。以下の検証値は当時の記録。

| コミット | 区切り |
| --- | --- |
| `45fbc027` | UI-B R3〜R5修正 |
| `62dc5f42` | LA-0所有者・変えない契約を確定 |
| `b2dda7f1` | UI-C1会話表示と提案確認の操作列 |

## 変更

**R3:** compact表示状態をAppShellから共通controllerへ移した。
下段Preview・Command Palette `view.preview`・native `toggle-preview`・Alt+Cmd+Pが
同じ`togglePreviewSurface`を呼ぶ。Referenceの解除、既存side pane toggle、開く際の
compact Preview選択をまとめた。開いているPreviewのtoggleは従来どおり閉じる。
「書く」から同じ操作を2回行うと、閉じる→Previewを開くとなる。

**R4:** live workspaceがあるStartPanelはOpen FolderへautoFocusしない。
本当の起動面ではResume/Open Folderの初期フォーカスを維持。
既存要素にフォーカスがある状態でStartPanelを表示し、フォーカスを奪わないテストを追加。

**R5:** first H1/H2の左寄せ・下線なしと、それ以外の既存装飾をCSSコメントに正確に記載。

**LA-0:** [所有者と変更境界](../../v3-local-assist-ownership.md)を採用。
既存のproposal store・Apply handler・要求と取消の所有者を維持。
会話描画を`AssistConversationMessages`へ分離し、表示copyをlocaleに移した。
要求や取消のstate/ref、wire、SDK、runtime、モデル選択は変えていない。

**UI-C1:** 対象を初期表示し、会話の依頼を淡いaccent面、応答を本文面として分けた。
生成・失敗を会話の中に残し、入力欄を下端に維持。使い方とプリセットは折り畳みのまま。
新copyはja/kana/en対応。実際の可用性に応じた表示・既存のIME送信ガードを維持。
提案面は見出しと説明を読みやすくし、破棄／反映とUndo案内を下端へ移動。
比較・全文は独立スクロール。AppShellから既存generation lockをblockedへ渡し、
停止待ち中は前案を閲覧できるが、反映／破棄はできない。生成中は生成状態を表示する。

## 検証の種類

| 種類 | 今回の結果 |
| --- | --- |
| ローカルfrontend | 241ファイル / 2,100テスト成功 |
| App Store表示境界 | 111テスト成功 |
| typecheck / Vite | 成功 |
| ローカルnative preview | App Store previewのad-hoc appを生成。提出・公証ではない |
| 最後の文言追加 | typecheck、関連21テスト、native preview再ビルド成功 |
| GitHub CI | 今回未確認。ローカル結果をCI成功と表現しない |

2,089→2,100の内訳は、共通Preview3、shortcut/native各1、live workspace focus1、
proposal lock連携/前案閲覧2、会話locale3。Palette経路とchrome経路は既存テストを更新。
先に赤を取れた独立再現とはせず、実装と同時追加のfocused回帰として記録する。
全体テストの失敗は新しい初期target表示に対する旧折り畳み期待とテスト設定を修正した。

ブラウザーの実アプリで、960×640のAlt+Cmd+PとPaletteからPreviewを開閉。
開くとEditor display:none / Preview flex、「書く」でEditorへ戻ることを確認。
このブラウザー確認はTauriメニュー配信やnativeウィンドウサイズの試験ではない。

再ビルドappを起動し、macOS表示メニューからPreviewがOFF/ONになることをAXで確認。
既存文書は編集せず、新規ファイルダイアログもキャンセルした。
この環境のLocal Assist起動メニューはdisabledだったため、実生成・取消・反映は未追試。
当該native操作後の変更は停止待ちの案内文のみで、最後に再ビルドした。

## 表示fixtureと原寸画像

Vite起動後に `docs/reviews/2026-09-09-v3-ui-c1/fixture.html` を開く。
[fixture source](fixture.tsx)は実コンポーネントを使う開発用入口。アプリbundleの入口ではない。

- [提案面960×640](review-960.png): `?surface=review`
- [長い提案・blocked 960×640](review-long-blocked-960.png): `?surface=review&long=true&blocked=true`
- [会話面473×782](assist-unavailable-473.png): `?surface=assist`
- [会話面dark 400×600](assist-dark-400.png): `?surface=assist&theme=dark`

提案は明示的なfixtureデータ。Applyは意図したfixtureエラーを返し、文書を変更しない。
表示切替とエラー後の案保持を確認。100行追加の比較でも下端操作が画面内に残った。
別窓部品はブラウザー環境の実際の利用不可状態を表示し、可用性・モデル生成を偽装しない。
400×600で入力欄下端588px、横overflowなし。native最小サイズの合格とはしない。

## 合評の依頼文

> 48233e1c以降の3つの区切りをまとめてお願いします。
> R3の4入口が共通操作を通ること、R4のlive workspace focus、LA-0の責務分け、
> UI-C1の対象・会話・入力と提案の下端操作を確認してください。
> 特に、停止待ちの前案を読めても反映・破棄はできないこと、既存の単回Apply/stale/Undo境界を
> 維持していることを見たいです。画像は表示fixture、2,100件等はローカル実行記録です。

## 次の区切りと未完了

- UI-C2: session/requestを検証した「本体の該当提案を確認」導線。
  現在は既存の本体提案面を使う。別窓から任意のアクティブDiffを開く代替は入れていない。
- UI-Cの全画面化、実System生成→停止待ち→前案→反映→Undoのnative通し確認は未完了。
  今回は既存浮動レビュー面を維持。資料07の文書列全体への置換はまだ行っていない。
- IME/VoiceOver・200%・全テーマ・性能・旧OSはUI-Gへ継続。
  UI-A時点のReader背景sidebarのVoiceOver仮想カーソルも未受入。
- 小さな修正ごとに外部レビューで止めず、独立コミットを積み、次のまとまった導線で合評する。
