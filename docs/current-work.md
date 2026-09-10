# Current Work

Status: Operational
Scope: UI 第二調整（境界線の階層）と「実装途中感」3点の解消、native受入
Authority: High
Last reviewed: 2026-09-10

## Current Phase

v2.9は2026-09-09にオーナーが審査通過・公開を報告。次はv3.0の
**UI/UX刷新・アプリとしての完成度・Local Assist architecture整理**を進める。
全体計画は[v3製品計画](v3-product-completion-plan.md)、Assistの技術条件は
[Local Assist plan](v2.9-v3-local-assist-plan.md)。公開buildと候補sourceの対応は未確認。

## 現在の区切り — 「実装途中感」3点の手直し

サイドバーの「No folder open」二重表示、上部ツールバーの「Hazakura Editor」二重表示、
プレビュー上端の空白（表示ツールバー行の右半分が単色98.8%で空いていた）を直した。
[実装と証跡](reviews/2026-09-11-v3-rough-edges/README.md)。

ローカル260ファイル・2,309件、typecheck・Vite・App Store surface 117件が成功。

## 直前の区切り — UI 第二調整（境界線の階層）

段階2（light/darkへモック配色、chrome面トークン新設）を外部レビューでAPPROVE。面の分離は実測1.06〜1.13:1で
「1pxの罫線が分離を担う」状態だったため、オーナー判断で **B案＝面の構造は変えず罫線だけ一段強める** を実施。
`--border` を紙面比 1.54〜1.55、`--border-strong` を 2.18〜2.22（差0.63〜0.68）へ全7テーマで揃え、
focus（`--accent` のoutline）3:1以上と `theme-palette.json` ＝ CSS `--chrome-surface` の同値を自動検査に固定した。
[実装と証跡](reviews/2026-09-11-v3-border-hierarchy/README.md)。

ローカル259ファイル・2,304件、typecheck・Vite・App Store surface 117件が成功。cargo test 383件も段階2で確認済み。
実描画で罫線の画素が `#dce2d9`→`#c7d2c5` に変わることを同座標で確認。

## 次のまとまった区切り

1. ~~「実装途中感」の3点~~ **完了**（上記）。
2. chrome と紙面の境目（ステータス上端・タブ下）だけ `--border-strong` を使うか（面差1.06:1の補い方）。
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
