# Current Work

Status: Operational
Scope: Save As通知の帰属修正とUI-E2検索面の合評
Authority: High
Last reviewed: 2026-09-10

## Current Phase

v2.9は2026-09-09にオーナーが審査通過・公開を報告。次はv3.0の
**UI/UX刷新・アプリとしての完成度・Local Assist architecture整理**を進める。
全体計画は[v3製品計画](v3-product-completion-plan.md)、Assistの技術条件は
[Local Assist plan](v2.9-v3-local-assist-plan.md)。公開buildと候補sourceの対応は未確認。

## 現在の区切り — Save As通知修正・UI-E2

外部レビューで前回D2b指摘4点CLOSED、UI-E1 GO。
追加P2（Save As失敗がglobalError経由で別文書へ漏れる）を1f0158a5で修正。
失敗はglobalErrorへ残さず、対象文書名/理由付きstatusへ通知する。
実表示hookまで通し、別タブと衝突解除後の双方で古いactiveErrorが出ないことを検証。

7da932abでUI-E2の検索面を整理。対象フォルダ・範囲説明・Closeを常設し、
既存query/rows/summary/結果移動は維持。Close時は既存focus経路でEditorへ戻す。
[最新資料](reviews/2026-09-10-v3-ui-e2/README.md)で合評する。

ローカル全2,159件・表示境界111件、typecheck/Vite/native preview/署名整合成功。
960×640のfixture、Tab→Close→Escapeを確認。native実検索/Reader往復、IME/VoiceOver、200%は未受入。

## 次のまとまった区切り

1. Save As通知修正/E2合評。別文書へエラーが残らず、検索対象/結果/上限が正確なこと。
2. UI-E3: 読む→章編集の既存導線を整理。既存findMatches→searchSourceLineを維持し、別検索stateを増やさない。
3. nativeの検索結果→編集/Reader、Save As取消/成功、IME/VoiceOver、構造変更→Undoを受入。
4. 出力/取り込み、UI-F設定、UI-G横断受入とLA-1以降は後続。C2実System受入も別途残る。

UI-Eは04/05/09/10/11/12、設定はUI-F。画像倍率・復元比較一体化・UI-B/UI-C通し受入も未完了。

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
