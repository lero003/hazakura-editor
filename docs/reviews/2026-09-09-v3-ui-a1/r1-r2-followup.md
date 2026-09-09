# UI-A1 — R1/R2表示境界の修正

Status: R1/R2 CLOSED by external rereview
Scope: `codex/v3`、レビュー対象`3420fa8b`からの操作回帰修正のみ
Authority: Review evidence
Last reviewed: 2026-09-09

## 変更

修正・回帰テストのコミット: `4e304a1c`。

- **R1:** L Modeの浮動タブだけをAppShell直下へ戻した。ドラッグ領域と同じ
  stacking contextで既存の90/88を使う。通常タブは文書列に残す。
- **R2:** 集中Readerと本全体Readerに共通の表示境界を適用。
  文書列をhidden/inertにし、sidebarとresizerも既存のReader配置に合わせて隠す。
  Reader自身はworkspace内で表示し続ける。Editorは条件付きで破棄しない。
- 新しいモードstate、CSSのz-index変更、保存・AI・native実装変更はない。
  UI-Bへの横展開は含めていない。

## 自動検証

- 追加3テストが修正前に失敗し、修正後に成功することを確認。
  AppShellでは浮動タブとdrag bandの親、Reader中の浮動タブ非表示、Editorの同一性を検証。
  AppWorkspaceではBook Scopeの「本全体を読む」から実Readerを開き、文書列のhidden/inert、
  Readerが隠れないこと、Escape往復とEditor DOM保持を検証。
- `npm run typecheck`成功。
- `npm test`: 238ファイル、**2,078テスト成功**。
- `npm run smoke:app-store-surface`: 10ファイル、**111テスト成功**。
- `npm run build:vite`、`npm run build`成功。後者は既存Swift helperを含む
  ローカルApp Store preview、ad-hoc署名。既存の大きなJS chunk警告あり。
- nativeソースは変更していないためRustテストは再実行していない。

## 実画面での追試

外部レビューの最小HTMLとは別に、アプリ全体のブラウザー表示と再ビルドした
macOSアプリを使用した。nativeは既存プロセスを終了後、生成されたbundleから起動し直した。
専用の2章fixtureのみを操作し、未保存の試験追記はUndoで戻した。元の文書とworkspaceへ復帰した。

| 確認 | 結果・証拠の範囲 |
|---|---|
| R1クリック命中先 | ブラウザーの実DOMで、修正前はdrag band、修正後はタブ内の要素。通常クリックで選択・閉じるも成功 |
| R1 native浮動タブ | 座標クリックでone.mdへ切替、two.mdを左へドラッグして順序変更、閉じるボタンでtwo.mdのみ閉じた |
| R1 Editor保持 | 追記→L Mode→通常編集→Undoで元の本文とclean状態に復帰 |
| R2 native Reader | サイドバーの本→2章を選択→本全体を読む。タブ・表示ツールが消え、右上の「閉じる」中央への座標クリックで戻った |
| R2キーボード | 初期フォーカスは閉じる。Shift+Tabで末尾の章編集、Tabで閉じるへ循環。背景タブはAX treeにも現れない |
| R2 Editor保持 | 追記→本全体Reader→Escape→EditorでUndo。元の本文とclean状態に復帰 |

![本全体Reader・修正後のnative画面](r2-native-reader.png)

余白でのnative drag操作は実行したが、ウィンドウ座標の移動量は取得できていない。
そのため余白dragの受入は未完了として残す。選択範囲そのものの往復保持、IME/VoiceOver、
旧OS・全テーマ・署名配布候補の受入、Apple提出・公証・公開もこの追試では証明していない。
GitHub Actionsの成功証跡を追加したものではなく、上記はローカルの結果。

## 再レビューと次

オーナー提供の再レビュー（対象68d05f85）でR1/R2 CLOSED、UI-B進行GO。
R3は非ブロッカー。workspace.cssには既にsidebar/railのdisplay:noneがある。
UI-B1で集中Readerのcomputed displayとAX非露出を確認したが、VoiceOver受入はUI-Gに残す。
現在の入口は[UI-B1レビュー](../2026-09-09-v3-ui-b1/README.md)。


`3420fa8b..codex/v3`でR1/R2の表示境界と回帰テストを確認する。
通常編集の二層構造と高さは維持する。「確認」は対象選択、「Diff」は比較面の表示切替。
UI-Bでは高さ640pxと文字拡大時に紙面の上下余白を重ねすぎない。
