# Current Work

Status: Operational
Scope: UI-G2 設定レール/現在地の合評とnative受入
Authority: High
Last reviewed: 2026-09-10

## Current Phase

v2.9は2026-09-09にオーナーが審査通過・公開を報告。次はv3.0の
**UI/UX刷新・アプリとしての完成度・Local Assist architecture整理**を進める。
全体計画は[v3製品計画](v3-product-completion-plan.md)、Assistの技術条件は
[Local Assist plan](v2.9-v3-local-assist-plan.md)。公開buildと候補sourceの対応は未確認。

## 現在の区切り — UI-G2

G1の未コミット分だった設定の左レール化を引き取り、カテゴリの現在地を本文スクロールから導出。
レールは左180px・淡い塗り＋左2pxバー、狭幅/低い有効領域は横並びの枠線＋塗りで示す。
[実装と証跡](reviews/2026-09-10-v3-ui-g2/README.md)で合評する。

ローカル258ファイル・2,220件、表示境界117件が成功。7テーマの実描画で左バー最小4.16:1。
960×640/1440×850/760×640/960×400/480×320の予備確認はnative 200%やVoiceOver合格を意味しない。
Rust無変更・cargo test未実行。原稿/生成/保存の所有権は維持。

## 次のまとまった区切り

1. G2合評。レール幅/アイコン/現在地の見せ方/Help導線の採否を決める。
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
