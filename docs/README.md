# Documentation Index

Status: Operational
Scope: 現行の参照先・更新先と、参照専用資料の区分
Authority: High（文書の案内。仕様・現状は各正本）
Last reviewed: 2026-11-25

作業手順は [AGENTS.md](../AGENTS.md) から。ここには版番号や候補の進捗を転記しない。

## 日常で使う文書

| 知りたいこと・更新すること | 正本 | 更新する時 |
|---|---|---|
| 次に何を進めるか | [作業キュー](current-work.md#active-queue) | 着手可否・優先順・保留条件が変わった時 |
| 実装・検証・配布で何が事実か | [現状](current-status.md) | 実装、実行した検証、公開・候補状態が変わった時 |
| どこへ向かうか | [ロードマップ](roadmap.md) | 方針・段階・対象範囲を採用または変更した時。日々の進捗は載せない |
| 何を作らないか・どこまで許すか | [製品の境界](product-brief.md)・[信頼境界](security-boundary.md) | 各契約そのものが変わった時 |
| 自動化の運用ルール | [開発自動化](development-automation.md) | 作業・検証の手順が変わった時。現行フェーズは作業キューを参照 |

同じ情報を複数の文書で更新しない。判断の正本を更新し、他は必要なときだけリンクする。
[引き継ぎ](handoff.md)は補助資料。担当交代に必要な作業上の注意がある時だけ使い、現状やキューの写しにしない。

## 対象を触るときだけ使う文書

| 対象 | 参照先 |
|---|---|
| 手動の受け入れ・外部レビュー | [実機スモーク](smoke-checklist.md)・[外部エージェントレビュー](external-agent-review-workflow.md) |
| 配布・署名 | [App Storeビルド](app-store-build.md)・[公開前確認](release-pre-check.md)・[ソース公開](source-release-checklist.md)・[DMGプレビュー](dmg-preview-checklist.md) |
| テーマ候補 | [v3.4.1の変更と確認範囲](releases/3.4.1-edohigan-scene.md)・[v3.4テーマの受け入れ記録](releases/3.4.0-theme-atmosphere.md)。次に行う受け入れは作業キューへ |
| Local Assist / Core AI | [Assist方針](assist-surface-strategy.md)・[会話とDiff](local-assist-conversational-edit-ux.md)・[実装と残る技術ゲート](v2.9-v3-local-assist-plan.md)・[モデルと配布条件](core-ai-production-models.md)・[外部モデルの設計](core-ai-model-source-abstraction.md) |
| Developer向けCLI連携 | [Agent Workbenchの境界](agent-workbench-boundary.md) |
| OKF | [pinと更新規則](okf-spec-pin.md)・[点検契約](v1.11-okf-draft-preview-design.md)・[ひな形契約](v1.12-okf-scaffold-design.md)。契約部分を参照し、旧候補の状態を読み替えない |
| 読み書き・媒体 | [L Mode](l-mode-plan.md)・[e-book / EPUB](ebook-mode-epub-export-plan.md)・[Book Scope](superpowers/specs/2026-07-02-v2-book-scope-design.md)・[画像の同意境界](v1.xx-image-media-boundary-plan.md)。現行仕様の根拠と将来案を区別する |
| メモ・縦書き | [採用方針](roadmap.md#メモと縦書き)・[設計例と受け入れ条件](post-v3.1-writing-completion-draft.md)。採用範囲・版割りはロードマップを優先 |
| 第二世代 `next/` | [macOSネイティブ再構築・Phase 0–5・棚卸し](roadmap.md#第二世代設計)、[着手範囲](current-work.md#active-queue)、[実装・検証状態](current-status.md#第二世代--macosネイティブ再構築)、[ビルド・テスト・起動](../next/README.md)。第一世代のTauri版の開発・配布とは別 |

## 日常では使わない文書（根拠・履歴のみ）

- [過去の計画とレビュー](archive/)、[版別記録](releases/)、[調査・レビュー記録](reviews/)は、特定の判断や候補の検証範囲を確認するときだけ読む。上の表のように現行文書が参照する資料でも、記録の時点と対象を超えて運用指示や公開保証にはしない。
- `docs/` 直下の旧版計画も同じ扱い。[v2.4](v2.4-plan.md)・[v2.5](v2.5-plan.md)・[v2.6](v2.6-plan.md)・[v2.8](v2.8-plan.md)、[v3 UI刷新](v3-product-completion-plan.md)、[v3.3の依存整理](dependency-autonomy-plan.md)、[v3.4 S0〜S10の計画](theme-atmosphere-brushup-plan.md)は判断の経緯を残すために保持する。旧キューは再開しない。
- [MLX事前調査](mlx-m0-preflight-design.md)や旧UX提案、保留中の案は、明示的に再評価する時だけ読む。採用済みの要件や着手候補とは区別する。
- `current-status.md`・`current-work.md`・`handoff.md` 内の過去セクションも当時の記録。新規作業は各文書の冒頭と、現行の作業キューから判断する。既存の参照を保つため、過去文書の一括移動・削除は行わない。

## ローカル専用

アカウント・証明書・連絡先などの個別情報は `docs/internal/` または `*.local.md`（Git管理外）へ置き、公開向け文書には載せない。
