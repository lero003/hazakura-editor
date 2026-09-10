# Current Work

Status: Operational
Scope: UI-E4b HTML・取り込みの合評とUI-F準備
Authority: High
Last reviewed: 2026-09-10

## Current Phase

v2.9は2026-09-09にオーナーが審査通過・公開を報告。次はv3.0の
**UI/UX刷新・アプリとしての完成度・Local Assist architecture整理**を進める。
全体計画は[v3製品計画](v3-product-completion-plan.md)、Assistの技術条件は
[Local Assist plan](v2.9-v3-local-assist-plan.md)。公開buildと候補sourceの対応は未確認。

## 現在の区切り — UI-E4b

外部レビューでE2/E3のR1〜R3 CLOSED、UI-E4a GO。
a0cfdd30でguarded openの開始status残りを修正。
66591038でHTML対象確認、47036d74で取り込みの下書き/元資料表示を整理。
[最新資料](reviews/2026-09-10-v3-ui-e4b/README.md)で3単位をまとめて合評する。

ローカル全2,189件・表示境界113件、typecheck/Vite/native preview/署名整合成功。
960×640のHTML表示確認はnative/IME/VoiceOver/200%とは区別する。

## 次のまとまった区切り

1. E4b合評。HTML確認→保存先取消/成功→成果物確認、取り込み→修正→保存/Undoをnativeで確認。
2. UI-F設定の既存項目・分類・説明を整理。永続設定や新providerは増やさない。
3. EPUB/PDF成果物、UI-G横断受入、Reader/検索の実操作を継続。C2実Systemも別途残る。

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
