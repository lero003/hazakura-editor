# Current Work

Status: Operational
Scope: UI-G1 状態/文言/reflowの合評とnative受入
Authority: High
Last reviewed: 2026-09-10

## Current Phase

v2.9は2026-09-09にオーナーが審査通過・公開を報告。次はv3.0の
**UI/UX刷新・アプリとしての完成度・Local Assist architecture整理**を進める。
全体計画は[v3製品計画](v3-product-completion-plan.md)、Assistの技術条件は
[Local Assist plan](v2.9-v3-local-assist-plan.md)。公開buildと候補sourceの対応は未確認。

## 現在の区切り — UI-G1

F2は外部GO、テーマ説明P3 CLOSED。
Settings未probeの断定を修正し、Local AssistがactiveならSettingsを開いた際にも既存probeを使用。
Helpのremote image/明示Apply説明を揃え、低い有効領域でSettings/Help本文の到達性を調整。
[最新資料とUI-G受入表](reviews/2026-09-10-v3-ui-g1/README.md)で合評する。

ローカル全2,209件・表示境界117件、近接46件・最終Help21件が成功。
960×640と480×320のreflow予備確認はnative 200%やVoiceOver合格を意味しない。
Rust無変更・再実行なし。原稿/生成/保存の所有権は維持。

## 次のまとまった区切り

1. G1合評。未確認→probe済状態と、Helpの画像許可/AI通信禁止の区別を確認。
2. UI-G受入表のnative操作を埋める。VoiceOverのテーマ説明/Reader背景、200%、再起動後設定を優先。
3. 実IME→Reader→章編集→Undo、出力成果物、取り込み→編集→保存、C2実Systemを継続。
4. 受入前にv3完成や配布候補合格としない。未受入を実行記録に基づいて閉じる。

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
