# Current Work

Status: Operational
Scope: v2.8公開後のv2.9 Local Assist改善キュー
Authority: High
Last reviewed: 2026-09-08

## Current Phase

v2.8は2026-09-08にオーナーが公開を報告。公開済み版を再提出するキューは閉じる。
ソース版は2.8.0のまま。公開build、PR #40の包含、実機smokeの詳細、GitHub tagは
今回未確認であり、公開報告から補完しない。過去の候補証跡は
`docs/releases/2.8.0-source-tag.release.md` に残す。

**次はv2.9のSystem-only改善。v3.0でAFM活用と共通基盤、v3.1でCore AIの
DL・管理・切り替え。** 版別の受け入れ条件・添付案との差分は
`docs/v2.9-v3-local-assist-plan.md` を正本とする。

## Active Queue — v2.9

1. **2.9-01 / 02:** 取消・遅延応答・対象変更・前案復帰・一度だけ反映の既存テストを確認。
   完成案と追加指示の4,000 / 4,001文字境界を失敗テストへ固定し、継続可否を説明できる最小修正。
   同内容のテストを増やすための再実装はしない。
2. **2.9-03 / 04:** System責務整理、エラー案内、案の生成元情報とU-4。互換性を保つ小スライス。
3. **2.9-05 / 06:** 日本語評価・予算観測、U-3最小改善、実モデルとnative別窓→Diff→反映→Undoの確認。
4. G-1は任意評価。27 SDK調査・依存更新は独立レーンとし、通常のv2.9を待たせない。

1 run = 1検証可能スライス。未検証項目は実装済み/実機済みと扱わない。
生成と本文反映を分離し、既存Apply・Undo・保存境界を維持する。

## Completed / Held

| 対象 | 扱い |
|---|---|
| v2.0–v2.6 | 既存のBook・執筆・会話/Diff基盤。公開/候補の個別証跡はrelease文書の履歴 |
| v2.7候補 | 過去の凍結候補。別途公開されたとは推定せず、再提出を現行キューにしない |
| v2.8 | 公開報告済み。U-1別窓会話とM-0a/H-1の実装を維持 |
| M-0a / H-1 | Systemモデル再利用・Rust-owned fail-closed wireは完了。MLX実行ではない |
| C-1 / C-2 | v3.1へ配置。identity・manifest・配信/AOT・比較評価・D24/D20が揃うまでHOLD |
| v3.0基盤 | Systemで共通契約を実装・検証してよい。Core AI資産解決・selectedIdの非System書き込みはC-2 |
| D17 | tokenCountは観測用。強制予算制限は実測と別途の契約改訂後 |
| MLX M-0b | C-2と27 SDKレーン後、別の製品/安全/配布レビューまでHOLD |

## Parked

U-5「整える」入口、文体/用語ルール、明示章参照、縦書き、anydoc、残余Book改善、
広範なa11y監査は主キューに混ぜない。再現した保存・復元等の重大問題は優先する。
Web検索、背景index、永続チャットDB、任意URLモデル、auto-applyは採用しない。

## Next Gates

- 長い完成案の扱いを2.9-02のacceptanceに固定する。
- v3.0はSystemの実生成・日本語品質・旧OS起動を確認。モデル未選定で停止しない。
- v3.1開始前に本番identity・revision・ライセンス・配信/AOT・manifestを確定し、
  C-1実装と同じ系列で配布/通信の開示を更新する。
- 公開済み版は再現blockerのhotfixのみ。タグ・公開アセットはimmutable。
  新しい提出・公開・GitHub Releaseは今回の文書整理には含めない。

## Sources

- `docs/current-status.md`: 実装・公開状態
- `docs/roadmap.md`: 版別の一覧
- `docs/v2.9-v3-local-assist-plan.md`: 次期計画と受け入れ条件
- `docs/assist-surface-strategy.md` / `docs/core-ai-c0-design.md`: Assist境界・C-0契約
- `docs/local-assist-conversational-edit-ux.md`: 会話・対象・Diff契約
- `docs/security-boundary.md` / `docs/smoke-checklist.md`: 守る境界・実機確認
