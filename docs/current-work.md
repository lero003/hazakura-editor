# Current Work

Status: Operational
Scope: D2b保存衝突面の合評と次のUI区切りへ
Authority: High
Last reviewed: 2026-09-10

## Current Phase

v2.9は2026-09-09にオーナーが審査通過・公開を報告。次はv3.0の
**UI/UX刷新・アプリとしての完成度・Local Assist architecture整理**を進める。
全体計画は[v3製品計画](v3-product-completion-plan.md)、Assistの技術条件は
[Local Assist plan](v2.9-v3-local-assist-plan.md)。公開buildと候補sourceの対応は未確認。

## 現在の区切り — UI-D2b

オーナー提供レビューでD1-R1 CLOSED、D2a GO。非ブロッカーのバックアップ名表示と
比較Close/復元後のfocusを調整し、eb12766eでD2b保存衝突面まで実装した。
[まとめ資料](reviews/2026-09-10-v3-ui-d2b/README.md)が現行の入口。

衝突ダイアログを閉じても本文/衝突は変えない。既存の比較・Save Asへ明示操作で接続。
本文をアンマウントせず、portal外をinertにする。global keyboard/nativeメニューの
文書操作も停止する（通常の終了確認は許可）。既存keepEditingAfterConflictとは別の表示state。

ローカル全2,150件・表示境界111件、typecheck/Vite/native preview成功。
実Editorのfocus先へUndo、AppShellのportal境界とDOM維持を確認。
ブラウザーfixtureの960×640確認。CI/native実操作/実IME/VoiceOver受入とは区別する。

## 次のまとまった区切り

1. D2b合評。戻る/Escapeで衝突保持、比較しても書かない、Save As取消、focus復帰を確認する。
2. nativeで保存衝突→戻る/比較/Save As、バックアップ再比較→復元→直後の⌘Zを受入する。
3. UI-Eの既存設定再配置へ進む。新しい設定/既定値は増やさない。
4. C2 nativeの別タブ→該当提案→Diff→反映→Undo・停止待ちは引き続き別受入。

画像倍率、復元比較一体化、UI-B/UI-Cの通し受入、UI-E〜G、LA-1以降は未完了。

## Held / Separate Work

- モデルDL・管理・切り替えはv3.1のC-1/C-2ゲート待ち。MLX M-0bも停止を維持。
- 新しい書体/行間/永続設定、native別窓、Importの確定前ステージ、画像倍率は別仕様。
- UI刷新とnative runtime再編・新SDK採用を同じ変更へ混ぜない。
- 保存済み原稿、既存Apply/Undo/no auto-save、R2-cの完了/取消mutex境界を広げない。
- App Store設定の既存未コミット変更を保持。署名・公開タグ・アセットを変更しない。

## Sources

- [現状](current-status.md) / [引き継ぎ](handoff.md)
- [v3製品計画](v3-product-completion-plan.md) / [版別方向](roadmap.md)
- [安全境界](security-boundary.md) / [Assist境界](assist-surface-strategy.md)
- [実機確認](smoke-checklist.md) / [公開前確認](release-pre-check.md)
- [v2.9品質履歴](reviews/2026-09-08-v2.9-quality-hardening.md) / [候補証跡](releases/2.9.0-source-tag.release.md)
