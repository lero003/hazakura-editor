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

## Active Queue — v2.9レビュー

1. **2.9-01 / 02:** 安全契約の既存回帰、完成案4,000 / 4,001コードポイント境界、
   超過後の前案復帰と再依頼を自動検証済み。
2. **2.9-03 / 04:** System共通検査とエラー分類、実応答に基づく生成元保持/表示を実装。
   非同期の失敗通知も分類を経由し、形式不明の案は再依頼を案内する。
3. **2.9-05:** 自作12原稿の評価CLI、明示token観測を実装。実モデルで54回を評価し48回で
   完成案を取得。helper取消後の再生成も確認。モデル品質の未達は残り、全合格ではない。
4. **2.9-06 / U-3:** 元/案/未反映/反映/破棄の既存UIを維持して確認。
   nativeで見つかった英語の完了表示と区切り文字混入を修正。詳細・実機確認範囲は
   [v2.9レビュー](reviews/2026-09-08-v2.9-local-assist.md)を参照。
5. **次:** 外部コードレビュー、残る日本語/Markdown品質と実機smoke。G-1は任意比較評価、
   27 SDK・依存更新は独立レーン。通常レーンへ未評価のruntime/schemaを追加しない。

各変更を検証可能なスライスとしてコミットする。生成と本文反映を分離し、既存Apply・Undo・
保存境界を維持する。実装済み/自動検証済みを、未実施の実機・品質合格と同一視しない。
C-1/C-2のHOLDは今回のSystem改善では解除しない。

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

- 2.9-02は長い完成案を切り捨てず拒否し、有効な前案を保持する仕様に固定済み。
  次は評価の品質課題と外部レビューを確認する。
- v3.0はSystemの実生成・日本語品質・旧OS起動を確認。モデル未選定で停止しない。
- v3.1開始前に本番identity・revision・ライセンス・配信/AOT・manifestを確定し、
  C-1実装と同じ系列で配布/通信の開示を更新する。
- 公開済み版は再現blockerのhotfixのみ。タグ・公開アセットはimmutable。
  新しい提出・公開・GitHub Releaseは今回のソース開発には含めない。

## Sources

- `docs/current-status.md`: 実装・公開状態
- `docs/roadmap.md`: 版別の一覧
- `docs/v2.9-v3-local-assist-plan.md`: 次期計画と受け入れ条件
- `docs/assist-surface-strategy.md` / `docs/core-ai-c0-design.md`: Assist境界・C-0契約
- `docs/local-assist-conversational-edit-ux.md`: 会話・対象・Diff契約
- `docs/security-boundary.md` / `docs/smoke-checklist.md`: 守る境界・実機確認
