# Current Work

Status: Operational
Scope: v3 UI-B1実装レビューと次のスライス
Authority: High
Last reviewed: 2026-09-09

## Current Phase

v2.9は2026-09-09にオーナーが審査通過・公開を報告。次はv3.0の
**UI/UX刷新・アプリとしての完成度・Local Assist architecture整理**を進める。
全体計画は[v3製品計画](v3-product-completion-plan.md)、Assistの技術条件は
[Local Assist plan](v2.9-v3-local-assist-plan.md)。公開buildと候補sourceの対応は未確認。

## 現在の区切り — UI-B1紙面と狭幅のレビュー

UI-A1はオーナー提供の再レビューでR1/R2 CLOSED、UI-B進行GO。
UI-B1では通常ソースの連続した紙面と行間、Previewの明朝・枠・余白を調整した。
文書領域780px以下では「編集/プレビュー」を一面ずつ表示し、広幅では保存済み分割幅へ戻る。
[UI-B1レビュー資料と画像](reviews/2026-09-09-v3-ui-b1/README.md)が今回の入口。

- 自動: frontend全2,081件、App Store surface111件、typecheck/Vite build成功。
- ビルド: ローカルApp Store preview成功。今回のnative実操作・署名配布候補の受入は未実施。
- ブラウザー: light/dark、960×640、編集22px/Preview24px、表示切替/広幅復帰/Undo、
  長い表・コード・URL・画像未許可、集中ReaderとL Modeへの隣接経路を確認。
- R3: 既存CSSにsidebar/railの非表示ルールあり。集中Readerでcomputed displayとAX非露出を確認。
  VoiceOver仮想カーソルはUI-Gの未完了受入として残す。

## 次の1スライス

1. UI-B1の紙面、狭幅切替の位置・文書幅780pxの閾値をレビューする。
2. UI-B2で開始画面01・えるモード03を個別に整える。今回の本文設定・Readerの表示境界を保持する。
3. 選択/スクロール継続、native IME/VoiceOver、200%表示を追加確認する。
   22px/24pxの最大設定テストを200%試験やnative合格の代わりにしない。

[UI-A0の配置・遷移契約](v3-ui-a0-navigation.md)と[v3製品計画](v3-product-completion-plan.md)に従う。
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
