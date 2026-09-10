# Current Work

Status: Operational
Scope: UI-G4 開始画面2ペインの合評とnative受入
Authority: High
Last reviewed: 2026-09-10

## Current Phase

v2.9は2026-09-09にオーナーが審査通過・公開を報告。次はv3.0の
**UI/UX刷新・アプリとしての完成度・Local Assist architecture整理**を進める。
全体計画は[v3製品計画](v3-product-completion-plan.md)、Assistの技術条件は
[Local Assist plan](v2.9-v3-local-assist-plan.md)。公開buildと候補sourceの対応は未確認。

## 現在の区切り — UI-G4

モック画面01の開始画面を2ペイン化（左＝ナビ面のブランド＋大きな明朝コピー＋開始操作、右＝紙面の「続きから」一覧）。
一覧の行はアイコン・名前・補足パス・日時（今日／昨日／9月7日）。履歴0件でも主要操作を残し、案内文を出す。
[実装と証跡](reviews/2026-09-10-v3-ui-g4/README.md)。モックとの差の棚卸しは[v3-mock-gap-inventory.md](v3-mock-gap-inventory.md)。

ローカル259ファイル・2,248件が成功。1440×850で左右720pxずつ、1024×748で縦積みを実測。
Rust無変更・cargo test未実行。VoiceOver・200%・native実操作は未実施。

## 次のまとまった区切り

1. G4合評。開始画面の細部（押下の手応え、長いパスの省略、補足カードの採否）。
2. 段階2：文字色・アクセント・境界線を全テーマでモック方向へ（要オーナー判断）。
3. 設定の外枠寸法（1100px参考）・レール幅200px・Help導線。
4. UI-G受入表のnative操作（VoiceOver／200%／再起動後設定／別窓同期）、実IME→Reader→章編集→Undo。
5. 受入前にv3完成や配布候補合格としない。未受入を実行記録に基づいて閉じる。

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
