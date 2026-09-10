# Current Work

Status: Operational
Scope: UI 段階2（配色・chrome面）の合評とnative受入
Authority: High
Last reviewed: 2026-09-10

## Current Phase

v2.9は2026-09-09にオーナーが審査通過・公開を報告。次はv3.0の
**UI/UX刷新・アプリとしての完成度・Local Assist architecture整理**を進める。
全体計画は[v3製品計画](v3-product-completion-plan.md)、Assistの技術条件は
[Local Assist plan](v2.9-v3-local-assist-plan.md)。公開buildと候補sourceの対応は未確認。

## 現在の区切り — UI 段階2（文字色・アクセント・境界線・chrome面）

モックに等価な定義があるlight/darkへ配色を通し（light §5、dark `.dark`ブロック）、
chrome（ツールバー・タブ・ステータス）を `--chrome-surface` として意味トークンに追加（全7テーマ）。
サイドバーは `--nav-surface` のまま。透明タイトルバー色（`theme-palette.json`）も追従。
[実装と証跡](reviews/2026-09-10-v3-theme-stage2/README.md)。

ローカル259ファイル・2,269件、typecheck・Vite・App Store surface 117件・cargo fmt・cargo test 383件が成功。
実測は chrome vs 紙面 1.06:1（light）/1.07:1（dark）、境界線 1.31:1 / 1.48:1 で、
**面の分離は1pxの罫線が担う**（モック自身のC08「重要な境界3:1目安」と衝突）。第二調整の論点として残した。
accent面の文字が全テーマ検査で yakou 2.40:1 / crt 1.70:1 と基準未満だったため濃色インクへ修正した。

## 次のまとまった区切り

1. 第二調整：面の分離の強さ（A=モック値のまま／B=境界線を強める／C=面で分ける）をオーナーが選ぶ。
2. モックに等価定義がない5テーマ（yakou/shokou/edohigan/shinkai/crt）の文字色・境界線。
3. 設定の外枠寸法（1100px参考）・レール幅200px・Help導線。画面16/05/23/24。
4. UI-G受入表のnative操作（VoiceOver／200%／再起動後設定／別窓同期）、実IME→Reader→章編集→Undo。
5. Diff行の背景（モックの追加`#E8F1E6`／削除`#F8E9E7`）を既存トークンへ寄せるかは別スライス。
6. 受入前にv3完成や配布候補合格としない。未受入を実行記録に基づいて閉じる。

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
