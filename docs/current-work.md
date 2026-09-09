# Current Work

Status: Operational
Scope: UI-B追修正、LA-0、UI-C1から次の導線へ
Authority: High
Last reviewed: 2026-09-09

## Current Phase

v2.9は2026-09-09にオーナーが審査通過・公開を報告。次はv3.0の
**UI/UX刷新・アプリとしての完成度・Local Assist architecture整理**を進める。
全体計画は[v3製品計画](v3-product-completion-plan.md)、Assistの技術条件は
[Local Assist plan](v2.9-v3-local-assist-plan.md)。公開buildと候補sourceの対応は未確認。

## 現在の区切り — UI-B追修正・LA-0・UI-C1

前回R1/R2は外部CLOSED、UI-B2大筋GO。R3〜R5を45fbc027で修正。
[LA-0所有者](v3-local-assist-ownership.md)を62dc5f42で確定し、
会話表示と提案の操作列をb2dda7f1で実装した。
[まとめ資料・原寸画像](reviews/2026-09-09-v3-ui-c1/README.md)が現行の入口。

全2,100件・表示境界111件・typecheck/Vite/native previewはローカル成功。
ブラウザーで狭幅shortcut/Palette、nativeでPreviewメニュー開閉を確認。
Assistは表示fixtureと既存回帰試験。実System通し確認・IME/VoiceOver/200%は未受入。

## 次のまとまった区切り

1. UI-C2: 別窓からsession/requestを検証して本体の該当提案を確認する導線。
2. UI-C本体の表示領域と、生成→停止待ち→前案→Diff→反映→Undoを通し確認。
3. UI-B追修正、LA-0、UI-Cをまとめて外部合評へ。小修正ごとにレビュー待ちで止めない。

各実装は独立コミットと検証を維持。実System・IME/VoiceOver・200%・全テーマなどの
受入を表示fixtureで代替しない。UI-B全体/UI-C全体・UI-D〜G・LA-1以降は未完了。

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
