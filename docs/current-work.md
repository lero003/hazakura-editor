# Current Work

Status: Operational
Scope: UI-C1追修正とUI-C2実装後の通し確認
Authority: High
Last reviewed: 2026-09-09

## Current Phase

v2.9は2026-09-09にオーナーが審査通過・公開を報告。次はv3.0の
**UI/UX刷新・アプリとしての完成度・Local Assist architecture整理**を進める。
全体計画は[v3製品計画](v3-product-completion-plan.md)、Assistの技術条件は
[Local Assist plan](v2.9-v3-local-assist-plan.md)。公開buildと候補sourceの対応は未確認。

## 現在の区切り — UI-C1追修正・UI-C2

オーナー提供レビューでUI-B R3〜R5 CLOSED、LA-0 GO、UI-C1 GO。
C1の反映/破棄ロック説明、disabled表示、停止待ちの受入記録を修正。
UI-C2は16e438ebで実装し、別窓から本体の該当提案へ移る導線と
Apply/Discard通知をconversation/request/document sessionで照合する。
[まとめ資料](reviews/2026-09-09-v3-ui-c2/README.md)が現行の入口。

ローカル全2,109件・表示境界111件・Rust 383件成功（2件ignored）。
typecheck/Vite/native preview成功。最終配置変更後の関連20件も成功。
960×640のブラウザーfixtureでblocked文言・無効表示・操作列を確認。
C2のnative窓間focus、実System通し操作、IME/VoiceOver/200%は未受入。

## 次のまとまった区切り

1. native実Systemで生成→別タブ→「この提案を見る」→Diff→反映→Undoを確認。
   停止待ちの前案・反映/破棄不可、閉じた文書/新session/古い通知の拒否も見る。
2. UI-C本体の表示領域、小さい別窓、IME/VoiceOverを確認し、C1追修正/C2を合評へ。
3. UI-Cの受入後、既定計画のUI-D（参照・復元・保存衝突）へ進む。

各実装は独立コミットと検証を維持。実System・IME/VoiceOver・200%・全テーマなどの
受入を表示fixtureで代替しない。UI-B全体/UI-C全体・UI-D〜G・LA-1以降は未完了。

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
