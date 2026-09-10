# Current Work

Status: Operational
Scope: UI-F2 設定カテゴリ・文字設定・Help導線の合評
Authority: High
Last reviewed: 2026-09-10

## Current Phase

v2.9は2026-09-09にオーナーが審査通過・公開を報告。次はv3.0の
**UI/UX刷新・アプリとしての完成度・Local Assist architecture整理**を進める。
全体計画は[v3製品計画](v3-product-completion-plan.md)、Assistの技術条件は
[Local Assist plan](v2.9-v3-local-assist-plan.md)。公開buildと候補sourceの対応は未確認。

## 現在の区切り — UI-F2

外部レビューで書き出し排他/nativeメニューP2 CLOSED、UI-F1 GO。
cb7353cdでテーマ説明の読み上げ関連付け、fe9e1d4aでカテゴリ移動と4文字サイズ見本、
f3ea3605で設定/既存Helpの往復を追加。[最新資料](reviews/2026-09-10-v3-ui-f2/README.md)で合評する。

設定カテゴリは全項目を保持して本文内だけをスクロールし、見出しへfocusする。
Helpは既存文書・診断へ移り、Agent設定への新しい入口や永続stateを追加しない。
ローカル全2,206件・表示境界113件、スクロール修正後の近接17件が成功。
960×640でカテゴリ移動とHelp往復を確認。native/VoiceOver/IME/200%受入とは区別。

## 次のまとまった区切り

1. F2合評。設定項目の欠落/配布レーン、カテゴリ移動、Help往復とキーボードを確認。
2. UI-G: 低い画面・200%・VoiceOverと、設定変更後の本文/Reader/Undo/再起動を通し確認。
3. Assist実可用性・Helpの現行文言を棚卸し。既存誤説明があれば小修正し、生成/Apply所有権は変えない。
4. 出力成果物・取り込み・C2実Systemの残受入も継続する。

UI-Eは04/05/09/10/11/12、設定はUI-F。本の構成一覧・見開きの全面刷新、画像倍率、200%は未完了。

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
