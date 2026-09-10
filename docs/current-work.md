# Current Work

Status: Operational
Scope: E2/E3競合修正とUI-E4a書き出し外枠の合評
Authority: High
Last reviewed: 2026-09-10

## Current Phase

v2.9は2026-09-09にオーナーが審査通過・公開を報告。次はv3.0の
**UI/UX刷新・アプリとしての完成度・Local Assist architecture整理**を進める。
全体計画は[v3製品計画](v3-product-completion-plan.md)、Assistの技術条件は
[Local Assist plan](v2.9-v3-local-assist-plan.md)。公開buildと候補sourceの対応は未確認。

## 現在の区切り — 非同期競合修正・UI-E4a

88b8613bでR1/R2を修正。openが副作用を出す前に要求を検査し、並行openの登録sessionを揃える。
5e897c21でReaderの初期復元を明示移動時に終了。R1〜R3はローカル回帰確認済み、外部再レビュー待ち。
d52e7f9dでEPUB/PDF外枠を共通化し、対象表示・設定スクロール・固定フッターを整理。
[最新資料](reviews/2026-09-10-v3-ui-e4/README.md)で3単位をまとめて合評する。

ローカル全2,180件・表示境界113件、typecheck/Vite/native preview/署名整合成功。
Rust fmt/383件成功（2件ignored）。960×640のEPUB/PDF表示を確認。native/IME/VoiceOver/200%とは区別。

## 次のまとまった区切り

1. 競合修正/E4a合評。native検索→連続結果操作→Close→読む→章編集→入力/Undoを通し確認。
2. UI-E4b: HTML/取り込みの既存操作を整理。形式内切替や確定前Importステージは現状未実装。
3. 書き出したEPUB/PDF成果物、保存先取消/失敗、UI-F設定、UI-G横断受入へ。C2実Systemも別途残る。

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
