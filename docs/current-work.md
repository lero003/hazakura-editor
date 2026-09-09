# Current Work

Status: Operational
Scope: D2b衝突保持修正とUI-E1構造案内の合評
Authority: High
Last reviewed: 2026-09-10

## Current Phase

v2.9は2026-09-09にオーナーが審査通過・公開を報告。次はv3.0の
**UI/UX刷新・アプリとしての完成度・Local Assist architecture整理**を進める。
全体計画は[v3製品計画](v3-product-completion-plan.md)、Assistの技術条件は
[Local Assist plan](v2.9-v3-local-assist-plan.md)。公開buildと候補sourceの対応は未確認。

## 現在の区切り — D2b追修正・UI-E1

D2bの外部指摘を11e33fb7で修正。通常入力はconflict/errorを保持する。
Save As失敗は元sessionの未解決衝突を維持してglobalError/statusへ通知する。
dismissはsession別Map、別タブ往復でも同じ衝突の再表示を抑え、明示reopenは当該sessionだけ解除。
バックアップ左対象のtooltipは実バックアップ名へ戻した。

938f92e8でUI-E1の構造案内を実装。既存Outlineデータを見出し/構造確認で切り替える。
移動/手動レベル変更/上限案内を維持し、独自解析・自動変更を追加しない。
[最新合評資料](reviews/2026-09-10-v3-ui-e1/README.md)が現行入口。

ローカル全2,155件・表示境界111件、typecheck/Vite/native preview/署名整合成功。
実Editor入力経路を検証。960×640のブラウザーfixture確認。native操作受入/CIとは別。

## 次のまとまった区切り

1. D2b追修正・UI-E1を合評。Return→入力の衝突保持、Save As失敗、A→B→Aを確認。
2. native Save As取消/成功、IME/VoiceOver、構造移動→手動変更→Undoを受入。
3. UI-Eの残り: 検索・読む→章編集・出力/取り込みを機能別に整理する。
4. C2の実System通し受入は別に継続。

**順序訂正:** 正本のUI-Eは04/05/09/10/11/12、設定はUI-F。
前回の引き継ぎで「UI-E設定」と書いたのは誤り。正本計画の順序を変更したわけではない。
画像倍率・復元比較一体化・UI-B/UI-C通し受入・UI-E残り〜G・LA-1以降は未完了。

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
