# Current Work

Status: Operational
Scope: UI-G3 紙面/ナビ面トークンの合評とnative受入
Authority: High
Last reviewed: 2026-09-10

## Current Phase

v2.9は2026-09-09にオーナーが審査通過・公開を報告。次はv3.0の
**UI/UX刷新・アプリとしての完成度・Local Assist architecture整理**を進める。
全体計画は[v3製品計画](v3-product-completion-plan.md)、Assistの技術条件は
[Local Assist plan](v2.9-v3-local-assist-plan.md)。公開buildと候補sourceの対応は未確認。

## 現在の区切り — UI-G3

モックの「紙面」と「ナビ面」を意味トークン（`--surface-paper` / `--nav-surface`）として新設し、全7テーマで定義。
読む・書く面は不透明な紙面、サイドバー・chrome・設定レールはナビ面。エディタ面 `--cm-bg` も紙面トークンへ統一。
補助文字のコントラストを全テーマ4.5:1以上に調整。[実装と証跡](reviews/2026-09-10-v3-theme-paper/README.md)。
モックとの差の棚卸しは[v3-mock-gap-inventory.md](v3-mock-gap-inventory.md)。

ローカル258ファイル・2,242件、表示境界が成功。7テーマの実測で本文10.08〜16.56、補助4.66〜6.24。
Rust無変更・cargo test未実行。nativeの200%・VoiceOver・実機確認は未実施。

## 次のまとまった区切り

1. G3合評。紙面の暖かさ／ナビ面の緑みをさらに強めるか（今回はモック値に忠実で差は控えめ）。
2. 01 開始画面の2ペイン構造（左のヒーロー＝ナビ面、右の一覧＝紙面）。
3. 設定の外枠寸法（1100px参考）・レール幅200px・Help導線、UI-G受入表のnative操作。
4. 実IME→Reader→章編集→Undo、出力成果物、取り込み→編集→保存、C2実Systemを継続。
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
