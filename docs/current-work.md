# Current Work

Status: Operational
Scope: D1-R1修正とD2a比較面から保存衝突の安全な戻り方へ
Authority: High
Last reviewed: 2026-09-10

## Current Phase

v2.9は2026-09-09にオーナーが審査通過・公開を報告。次はv3.0の
**UI/UX刷新・アプリとしての完成度・Local Assist architecture整理**を進める。
全体計画は[v3製品計画](v3-product-completion-plan.md)、Assistの技術条件は
[Local Assist plan](v2.9-v3-local-assist-plan.md)。公開buildと候補sourceの対応は未確認。

## 現在の区切り — D1-R1・UI-D2a

オーナー提供レビューでC2-R1 CLOSED、D1画像/候補一覧GO。
バックアップDiffがstaleでも復元できるP1を3de6b926で修正した。
read完了時とApply直前にsnapshot/session・実Editor本文を確認し、
既存のCodeMirror置換APIで1回のUndoへ載せる。ディスクへ自動保存しない。

独立コミットaeb697f7でD2aの比較対象表示・初回focus・保存衝突比較のsession検証を追加。
[まとめ資料・原寸画像](reviews/2026-09-10-v3-ui-d2/README.md)が現行の入口。
ローカル全2,144件・表示境界111件、typecheck/Vite/native preview成功。
960×640のブラウザーfixture確認。CI・native実操作・IME/VoiceOver受入とは区別する。

## 次のまとまった区切り

1. D1-R1/D2aを合評。stale復元拒否と実Editor Undo、比較focusの境界を確認する。
2. UI-D2b: 保存衝突ダイアログの対象表示と安全な戻り方。閉じる/Escapeは表示だけを閉じ、
   衝突情報を保持する。既存keepEditingAfterConflictは衝突を消すので、そのまま流用しない。
   Save As・比較へ接続し、背景の入力境界をAppShell経由で確認する。
3. nativeでバックアップ比較→編集→復元拒否、再比較→復元→Undoと、
   C2別タブ→該当提案→Diff→反映→Undo・停止待ちを受入。

各実装は独立コミットと検証を維持。D2全体、画像倍率、復元比較の一体化、
UI-B/UI-Cの通し受入、UI-D後半〜G、LA-1以降は未完了。

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
