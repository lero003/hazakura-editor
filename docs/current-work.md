# Current Work

Status: Operational
Scope: v3 UI-A1実装レビューと次のスライス
Authority: High
Last reviewed: 2026-09-09

## Current Phase

v2.9は2026-09-09にオーナーが審査通過・公開を報告。次はv3.0の
**UI/UX刷新・アプリとしての完成度・Local Assist architecture整理**を進める。
全体計画は[v3製品計画](v3-product-completion-plan.md)、Assistの技術条件は
[Local Assist plan](v2.9-v3-local-assist-plan.md)。公開buildと候補sourceの対応は未確認。

## 現在の区切り — UI-A1レビューR1/R2修正

`codex/v3` を基点 `a94623b7` から作成し、計画→遷移契約→共通外枠→回帰確認をコミット済み。
上段の書く/読む/確認・保存、専用タブ行、文書表示ツールを既存の状態/保存処理に接続した。
[レビュー依頼書と画像](reviews/2026-09-09-v3-ui-a1/README.md)を入口に、配置・遷移を先に確認する。

- 修正: L Mode浮動タブをshell直下へ置き、本全体Reader中は背後の文書列を非表示・inert化。
  [R1/R2追試記録](reviews/2026-09-09-v3-ui-a1/r1-r2-followup.md)。Editor DOMとUndoを保持する。
- 自動: frontend全2,078件、App Store surface111件、typecheck成功。
- ビルド: ローカルApp Store preview成功。公開/提出の候補ではない。
- ブラウザー: light/dark、960幅、読む再選択、編集へ戻る、Undo、L Modeの出入りを確認。
- native追試: 浮動タブの選択/閉じる/並替え、本全体Readerの座標クリック/Tab循環/往復後Undo。
- 残る受入: 余白dragの移動量、IME/VoiceOver、実AI、旧OS、全テーマ、実ファイル保存のnative smoke。

## 次の1スライス

1. 外部レビューR1/R2の修正差分を再確認する。二層構造・確認対象選択・寸法の方向はレビューで支持された。
2. UI-Bの通常編集/Preview紙面へ進む。高さ640pxと文字拡大時に上下余白を重ねすぎない。
3. native受入を別記録で実施。ブラウザー画像をnative検証の代わりにしない。

[UI-A0の配置・遷移契約](v3-ui-a0-navigation.md)と[v3製品計画](v3-product-completion-plan.md)に従う。
UI-B〜GとLA-0以降は未着手。新SDK/runtime再編はUI外枠と分ける。

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
