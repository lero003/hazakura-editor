# C2-R1追修正・UI-D1 画像とバックアップ選択

Status: Implemented; external review pending
Scope: 移動試行の寿命管理、読み取り専用画像、比較から入るバックアップ選択
Authority: Review evidence
Last reviewed: 2026-09-10

比較基点 `f74c0131`、ブランチ `codex/v3`。
オーナー提供レビューでC1追修正CLOSED、C2条件付きGOを受領。
今回の修正に対する外部再判定はまだない。独立した次のUI-D1も進めた。

| コミット | 区切り |
| --- | --- |
| `5f6c1588` | C2-R1: navigationId、待機の失効、mainの全体期限 |
| `798e45bc` | UI-D1: 画像面とバックアップ選択の表示・操作 |

## C2-R1

提案は従来のconversationId + requestId + documentSessionIdで識別する。
それと別に「見る」操作ごとにnavigationIdを採番し、native要求・main結果に含める。
Rustの有界ID検査とdeny_unknown_fieldsも対応。Apply/DiscardにはnavigationIdを混ぜない。

- 結果通知は現在のnavigationIdにも一致する場合だけ受理する。
- invoke失敗と5秒タイマーは、その試行オブジェクトが現在も有効な場合だけ待機を終了する。
- 新しい会話・完了提案の置換・反映/破棄は古い待機と失敗表示を失効させる。
- mainは受信時から4秒で、タブ選択とnative focus応答の両方を制限する。
  再renderで期限を延ばさず、期限後や別試行の完了をregion focus/成功通知に使わない。

nativeへ既に渡したOSの前面化自体を取り消すAPIではない。期限後のDOM focusと
成功扱いを防ぐ設計であり、nativeの応答順は引き続き実機受入対象。
生成/取消/Apply所有者・source・Undo・no auto-saveは変更していない。

React renderのfake timer試験で、A移動待ち→新会話B→A期限、同案への再試行→古い結果、
再試行→古いinvoke失敗を確認。mainのnative応答を保留して期限切れ→再試行→古い応答も確認。
純粋な提案照合と移動試行照合が別であることも固定した。
追加5件は実装と併せた回帰試験で、旧実装を用いた独立redの記録ではない。

## UI-D1

**画像:** 読み取り専用表示、実際に読み込んだ画像のnaturalWidth/Height、既存バイト数を表示。
淡い市松背景、名前が折り返すヘッダー、下端の情報列を加えた。
読み込み中・失敗を3言語で表示し、別URLへ切り替えると前の状態を持ち越さない。
既存URLと制限をそのまま使い、画像を再圧縮・保存・原稿へ挿入しない。
倍率/100%/panはまだ追加していない。既存の領域内縮小を維持し、小画像は拡大しない。

**バックアップ選択:** 各候補に「現在の編集と比較」を明示。
候補選択は従来どおりbackup-vs-bufferへ渡す。日時とバイト数を使い、全文一括走査は追加しない。
一覧だけをスクロールし、文書名・説明・閉じる操作を残す。
実態に合わせてlistbox/optionから通常のリストとボタンへ変更。
Tab循環・IME変換中のEscape除外・閉じた後のfocus復帰を追加した。

添付13/24の方向を採用した段階的な実装であり、モック完全再現ではない。
候補一覧と比較の一体化、復元後の通しUndo、新しい衝突ダイアログ、参照比較の対象カードは次の区切り。
既存の復元/保存/衝突handlerとsource更新契約には触れていない。

## 検証

| 種類 | 今回のローカル証跡 |
| --- | --- |
| frontend全体 | 245ファイル / 2,122件成功 |
| App Store表示境界 | 111件成功 |
| Rust | 383件成功 / 2件ignored / 失敗0 |
| typecheck / cargo fmt check | 成功 |
| Vite / native preview | App Store previewのad-hoc appビルド成功 |
| bundle | codesign deep/strict verify成功。提出署名・公証ではない |
| GitHub CI | この数値はローカル試験。CI成功証跡と混同しない |

2,109→2,122はC2試行照合/競合5件、画像3件、バックアップ選択5件。
バックアップの可視性判定だけjsdomでgetClientRectsを補い、実キーボード操作とは分けている。
UI-D1の新規受入試験も実装と併せて追加した。

## 表示証拠

[fixture source](fixture.tsx)はVite専用。製品bundleの入口ではなく、候補は明記したサンプル。
画像はリポジトリ内の実画像を使用。候補のクリック先は表示fixtureであり実復元を行わない。

- [バックアップ960×640](backup-960.png): 20候補でも文書名と閉じる操作を保持。操作列下端は約604px。
- [暗色・かな480×640](backup-dark-kana-480.png): 狭幅ストレス条件。横overflowなし。native最小幅の合格とはしない。
- [画像960×640](image-960.png): 読み取り専用・実寸688×688・307,180 Bを表示。

初回の表示確認では候補一覧が対象文書名を縦に潰したため、一覧以外の縮小を止めて再確認した。
C2 native窓間操作・実System・実IME・VoiceOver・200%・全テーマ、実バックアップ復元→Undoは未受入。
App Store設定の既存未コミット変更は保持。版数・提出・タグ・公開アセットは変更していない。

## 合評依頼

> f74c0131以降のC2-R1修正とUI-D1をまとめてお願いします。
> navigationIdによる再試行の分離、会話切替時の失効、mainの期限後のregion focus抑止を確認してください。
> UI-D1は画像の読み取り専用・実寸・失敗表示と、比較から入るバックアップ一覧です。
> 画像の切替、長い文書名、多い候補、Tab/Escape/focus復帰を見たいです。
> 候補を選ぶだけで反映/保存しない既存契約を保ち、比較統合・画像倍率・衝突UIはまだ未実装です。
> 検証値はローカル、PNGは表示fixture。native通し受入とは区別しています。
