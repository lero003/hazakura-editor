# Current Work

Status: Operational
Scope: UI-B1修正とUI-B2のまとめレビュー
Authority: High
Last reviewed: 2026-09-09

## Current Phase

v2.9は2026-09-09にオーナーが審査通過・公開を報告。次はv3.0の
**UI/UX刷新・アプリとしての完成度・Local Assist architecture整理**を進める。
全体計画は[v3製品計画](v3-product-completion-plan.md)、Assistの技術条件は
[Local Assist plan](v2.9-v3-local-assist-plan.md)。公開buildと候補sourceの対応は未確認。

## 現在の区切り — UI-B1修正とUI-B2のまとめレビュー

UI-A1はオーナー提供の再レビューでR1/R2 CLOSED、UI-B進行GO。
UI-B1の外部指摘R1（既存Preview入口）/R2（かなふみ）を01e9290eで修正。
UI-B2の開始画面・えるモードを9b3cffccで実装した。
[まとめレビュー資料・画像・依頼文](reviews/2026-09-09-v3-ui-b2/README.md)が今回の入口。

- ローカル自動: 全2,089件、App Store surface111件、typecheck/Vite/preview build成功。
- ブラウザー: 既存Preview入口→「書く」→広幅復帰、かなふみ、開始画面の下書き復元、
  えるモード960×640/1440×850とモード往復後Undoを確認。
- native実操作・IME/VoiceOver・200%表示・全テーマは今回未確認。
  Reader背景sidebarのVoiceOver仮想カーソルもUI-Gへ残す。

## 次の1スライス

1. オーナーからまとめレビューを依頼し、R1/R2再判定と開始画面/えるモードの合評を受ける。
2. 指摘反映とUI-Bの残る受入を進める。文字最大設定を200%やnative試験の代わりにしない。
3. 製品計画の次段LA-0は責務棚卸しから別スライスで進める。

必須修正を独立コミット→隣接UIを1スライス→共通レビュー資料とpush、の区切りを継続する。
UI-B全体、UI-C〜G、LA-0以降は未完了。SDK/runtime再編はUI外枠と分ける。

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
