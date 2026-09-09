# Current Work

Status: Operational
Scope: C2-R1修正とUI-D1から次の安全な確認面へ
Authority: High
Last reviewed: 2026-09-10

## Current Phase

v2.9は2026-09-09にオーナーが審査通過・公開を報告。次はv3.0の
**UI/UX刷新・アプリとしての完成度・Local Assist architecture整理**を進める。
全体計画は[v3製品計画](v3-product-completion-plan.md)、Assistの技術条件は
[Local Assist plan](v2.9-v3-local-assist-plan.md)。公開buildと候補sourceの対応は未確認。

## 現在の区切り — C2-R1・UI-D1

オーナー提供レビューでC1追修正CLOSED、C2は条件付きGO。移動要求の寿命管理を
5f6c1588で修正し、navigationIdで結果/invoke失敗/期限を照合する。
mainはタブ切替とnative focusを合わせて4秒、別窓は5秒。会話変更・提案置換・反映/破棄で古い待機を失効する。

独立したUI-D1を798e45bcで実装。画像の読み取り専用・実寸・読込/失敗表示、
バックアップ一覧の比較案内とキーボード境界を整えた。
[まとめ資料・原寸画像](reviews/2026-09-10-v3-ui-d1/README.md)が現行の入口。

ローカル全2,122件・表示境界111件・Rust 383件成功（2件ignored）。
typecheck/Vite/native preview・署名整合成功。ブラウザーfixtureで画像と候補一覧を確認。
C2のnative窓間focus、実System通し操作、IME/VoiceOver/200%は未受入。
独立UI-Dはオーナー指示により並行進行し、UI-Cの受入済みとは扱わない。

## 次のまとまった区切り

1. UI-D2: 参照比較と保存衝突の対象表示・安全な戻り方。実データと既存再検証を維持する。
2. 復元候補一覧と比較の統合は別区切り。現在のUI-D1は候補選択→既存比較を保つ。
3. C2修正/UI-D1を合評し、native実Systemで別タブ→該当提案→Diff→反映→Undo、停止待ちを受入。

各実装は独立コミットと検証を維持。画像倍率、比較一体化、保存衝突ダイアログ、
UI-B/UI-Cの通し受入、UI-D全体〜G、LA-1以降は未完了。

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
