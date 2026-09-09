# Current Work

Status: Operational
Scope: v2.9公開後のv3実装準備
Authority: High
Last reviewed: 2026-09-09

## Current Phase

v2.9は2026-09-09にオーナーが審査通過・公開を報告。次はv3.0の
**UI/UX刷新・アプリとしての完成度・Local Assist architecture整理**を進める。
全体計画は[v3製品計画](v3-product-completion-plan.md)、Assistの技術条件は
[Local Assist plan](v2.9-v3-local-assist-plan.md)。公開buildと候補sourceの対応は未確認。

## 次の1スライス — UI-A0 → UI-A1

1. 添付 `20260909_hazakura-ui-implementation` の共通ルール、画面02、対応原寸PNGとHTMLを確認。
   資料基準a94623b7と今回HEADは一致。実装着手時に再照合する。
2. AppTopChrome / DocumentMetaBar / AppWorkspaceの既存操作・メニュー・設定の移行先を表にする。
   書く/読む/確認と既存sidePaneMode・参照・画像・Book Scopeの遷移を固定する。
   確認対象が複数/0件の扱い、未保存編集・選択・Undo保持を受け入れにする。
3. UI-A1で共通トークン・タブと文書操作の分離・通常編集02の外枠を実装。
   既存保存/編集処理に接続し、利用者設定とCodeMirrorを維持する。
4. 02の同条件画像比較、frontendの検証、配布面の確認を行う。
   native titlebar、IME、VoiceOverの未実施を分けて記録する。

今回完了したのは資料受入と計画。UI-A0の全機能棚卸し、UI-A1の実装は未着手。
1ランで24画面を作り直さず、以後のUI-B〜GとLA-0以降は全体計画に従う。

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
