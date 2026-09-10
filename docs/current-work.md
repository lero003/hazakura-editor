# Current Work

Status: Operational
Scope: モック対応の残課題A〜H（判断・実機）とnative受入
Authority: High
Last reviewed: 2026-09-10

## Current Phase

v2.9は2026-09-09にオーナーが審査通過・公開を報告。次はv3.0の
**UI/UX刷新・アプリとしての完成度・Local Assist architecture整理**を進める。
全体計画は[v3製品計画](v3-product-completion-plan.md)、Assistの技術条件は
[Local Assist plan](v2.9-v3-local-assist-plan.md)。公開buildと候補sourceの対応は未確認。

## 現在の区切り — 狭い窓のサイドバー（画面23）

≤1100pxではサイドバーを**表示上だけ**畳む（保存設定を持たず、利用者の開閉は幅が変わるまで優先）。
1440=開く／1024=畳む／トグルで開く／1440へ戻すと元の描画、を実測。`matchMedia` 購読のフックと
純関数に分離し、localStorage へ書かないことをテストで固定。[実装と証跡](reviews/2026-09-11-v3-compact-sidebar/README.md)。

ローカル264ファイル・2,326件、typecheck・Vite・App Store surface 117件が成功。
残差：1024で畳むとエディタ564pxで2面（モック目安630px）。container閾値780pxのためで、調整はオーナー判断。

## 直前の区切り — 設定の外枠寸法

設定ダイアログをモックの基準寸法へ（1100×752、左レール200px、レールのパディング23×14・項目min-height40px、
アイコンなし）。低い窓では縮む。実測は1440×850で1100×752、960×640で912×592（横スクロールなし）。
[実装と証跡](reviews/2026-09-10-v3-settings-frame/README.md)。

## 直前の区切り — focus ring・ガター境界・領域境界

レビュー指摘に沿って、**focusの自動検査が実UIのリングを見ていなかった**問題を閉じた。薄めたリング9箇所を
意味トークン `--focus-ring`（既定 `var(--accent)`）へ置換（light 2.40:1 → 5.85:1、shokou 2.11:1 → 4.30:1）。
`--cm-gutter-border` を全テーマ `var(--border)` に一本化（yakou 1.22:1 → 1.55:1 等）し、
**タブ群→文書・文書→ステータスの2境界だけ** `--border-strong`（約2.2:1）へ。証跡の日付もJSTへ是正。
[実装と証跡](reviews/2026-09-10-v3-focus-and-boundaries/README.md)。

ローカル261ファイル・2,314件、typecheck・Vite・App Store surface 117件が成功。

## 直前の区切り — 「実装途中感」3点の手直し

サイドバーの「No folder open」二重表示、上部ツールバーの「Hazakura Editor」二重表示、
プレビュー上端の空白（表示ツールバー行の右半分が単色98.8%で空いていた）を直した。
[実装と証跡](reviews/2026-09-10-v3-rough-edges/README.md)。

ローカル260ファイル・2,309件が成功。

## 直前の区切り — UI 第二調整（境界線の階層）

段階2（light/darkへモック配色、chrome面トークン新設）を外部レビューでAPPROVE。面の分離は実測1.06〜1.13:1で
「1pxの罫線が分離を担う」状態だったため、オーナー判断で **B案＝面の構造は変えず罫線だけ一段強める** を実施。
`--border` を紙面比 1.54〜1.55、`--border-strong` を 2.18〜2.22（差0.63〜0.68）へ全7テーマで揃え、
focus（`--accent` のoutline）3:1以上と `theme-palette.json` ＝ CSS `--chrome-surface` の同値を自動検査に固定した。
[実装と証跡](reviews/2026-09-10-v3-border-hierarchy/README.md)。

ローカル259ファイル・2,304件、typecheck・Vite・App Store surface 117件が成功。cargo test 383件も段階2で確認済み。
実描画で罫線の画素が `#dce2d9`→`#c7d2c5` に変わることを同座標で確認。

## 次のまとまった区切り

モック対応（棚卸しの1〜6）は**すべて完了**。残りは [棚卸し§6](v3-mock-gap-inventory.md) に8件：

| # | 課題 | 種別 |
| --- | --- | --- |
| A | 1024で本文が564pxに留まる（container閾値780pxの判断） | オーナー判断 |
| B | 設定の「本文書体」「行間」の独立設定が無い | 別タスク（モックも明記） |
| C | 画面24 画像プレビューの参考寸法との差が未計測 | 実機 |
| D | Help導線（レール最下部の「使い方」）の採否 | 判断 |
| E | Diff行の背景をモック値へ寄せるか | 別スライス |
| F | L Mode の紙と文字の既定値 | 判断 |
| G | native受入（VoiceOver／200%／実機／半透過ナビ実シェーダー） | 実機 |
| H | CI（combined statusが付かない） | 運用 |
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
