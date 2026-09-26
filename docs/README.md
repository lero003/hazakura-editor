# Documentation Index

Status: Operational
Scope: Current documentation map
Authority: High
Last reviewed: 2026-09-26

This directory separates current guidance from historical material. Use current documents for implementation and release decisions. Use `docs/archive/` only for past rationale or old planning context.

Agent entry rules live in `AGENTS.md`。v3.1はApple審査を通過して公開済み（2026-09-25オーナー報告）。
開発版は3.2.0の依存更新候補。`current-work.md` → `current-status.md` →
`releases/3.2.0-dependency-acceptance-draft.md` の順に読む。
過去の候補・実機未確認・GitHub公開は別証跡として保持する。
v3.2後のメモ系・縦書きは採用方針。`roadmap.md` と
`post-v3.1-writing-completion-draft.md` に方向性と未確定の詳細を分けて記録する。

## Current Canonical Docs

- `product-brief.md`: product direction, users, non-goals, and assist direction.
- `security-boundary.md`: safety constraints for file handling and execution boundaries.
- `agent-workbench-boundary.md`: optional CLI-agent workbench trust boundary.
- `assist-surface-strategy.md`: assist-surface direction (incl. conversational UX + Core AI intent).
- `local-assist-conversational-edit-ux.md`: **v2.6 conversation / Diff design SoT**.
- `core-ai-production-models.md`: **v3.1 production model identities, pinned asset recipe, and activation gates**.
- `mlx-m0-preflight-design.md`: completed M-0a System / wire boundary and M-0b entry gate.
- `current-work.md`: **v3.2依存更新の現行キュー**とv3.1以前の候補記録。
- `roadmap.md`: **v3.2依存更新と、採用したメモ系・縦書きの方向性**。
- `v3-product-completion-plan.md`: **v3全体計画**。添付UI資料の採否・着手順・完成判定。
- `v2.9-v3-local-assist-plan.md`: **current technical plan** for Local Assist / AFM / Core AI.
- `v2.8-plan.md`: published-line planning history; unshipped U-3/U-4/G-1 moved to the next plan.
- `v2.6-plan.md`: **v2.6 plan** (conversation + separate Diff review; store published, GitHub tag pending).
- `v2.5-plan.md`: **v2.5 plan** (workspace control; Assist deferred; later Core AI).
- `v2.4-plan.md`: **closed** Book depth plan (historical for `2.4.0`).
- `v2-external-review-synthesis-2026-07-18.md`: four-agent review pool for v2 (advisory; not the active queue).
- `v2-qwen-ux-proposal-synthesis-2026-07-21.md`: Qwen UX pack triage (advisory; L Mode corrections; not the active queue).
- `current-status.md`: current implementation and release state.
- `okf-spec-pin.md`: shared OKF pin, co-update surfaces, and version-upgrade process.
- `v1.8-plus-product-review-roadmap.md`: completed v1.8–v1.12 bridge (historical + gate wording).
- `v1.13-plus-refinement-roadmap.md`: **parked** post-v1.12 theme pools.
- `v1.xx-image-media-boundary-plan.md`: Theme G image preview/export consent, Preferences, materialize.
- `v1.10-single-document-structure-design.md`: completed v1.10 structure contract.
- `v1.11-okf-draft-preview-design.md`: completed v1.11 OKF compatibility contract.
- `v1.12-okf-scaffold-design.md`: closed / published v1.12 scaffold contract.
- `v1.13-interaction-clarity-plan.md`: Theme A candidate pool (much shipped in v1.13).
- `l-mode-plan.md`: active source-preserving L Mode writing-surface direction.
- `ebook-mode-epub-export-plan.md`: active single-document e-book and EPUB planning detail.
- `superpowers/specs/2026-07-02-v2-book-scope-design.md`: v2 Book Scope design SoT (Proposal).

## Current Operational Docs

- `development-automation.md`: recurring agent/automation operating rules.
- `external-agent-review-workflow.md`: external implementation agent plus Codex review workflow.
- `source-release-checklist.md`: source-preview release readiness.
- `dmg-preview-checklist.md`: warning-expected DMG preview readiness.
- `app-store-build.md`: public-safe Mac App Store build, signing, and smoke boundary.
- `releases/3.2.0-dependency-acceptance-draft.md`: v3.2の更新範囲、検証結果、実機受け入れ。
- `releases/3.1.0-app-store-release-notes.md`: 3.1.0公開前の掲載文・受入項目の記録。
- `releases/3.1.0-app-store-listing-copy.en-US.md`: 英語のConnect入力欄別の掲載文パケット。転記値の正本は `international-launch/app-store-en-US.json`。
- `release-pre-check.md`: last-mile release hygiene.
- `smoke-checklist.md`: manual smoke checklist.
- `handoff.md`: concise handoff for the next coding agent.
- `mlx-m0a-external-review-brief.md`: `00f179ab..HEAD` review focus and local evidence.

## Current Planning Docs

Active planning surface (intentionally small):

- `roadmap.md` — **v3.2依存更新と、採用したメモ系・縦書きの方向性**
- `post-v3.1-writing-completion-draft.md` — **メモ系・縦書きの計画詳細**。方向性は採用、UI・保存方式・版割りは未確定。AIによるメモ作成・推敲は品質再評価後
- `current-work.md` — 3.2.0候補の現行作業とv3.1以前の履歴
- `releases/3.2.0-dependency-acceptance-draft.md` — 自動ゲート・実機受け入れの作業表
- `v3-product-completion-plan.md` — v3全体とUI刷新の計画
- `v2.9-v3-local-assist-plan.md` — active technical plan, attachment reconciliation and acceptance
- `v2.8-plan.md` — historical writing-companion plan
- `v2.6-plan.md` — historical A-1–A-4 conversation / Diff review plan
- `releases/3.0.0-source-tag.release.md` — v3.0.0公開の記録（2026-09-14公開・GitHub source tag `v3.0.0`）と候補証跡
- `releases/3.0.0-app-store-release-notes.md` — v3.0.0の準備文案（公開掲載は短縮版）
- `releases/2.6.2-source-tag.release.md` — 2.6.2 note; Mac App Store published; GitHub source tag pending
- `releases/2.6.2-app-store-release-notes.md` — App Store What's New for published `2.6.2` (user-confirmed 2026-08-28; staged rollout)
- `releases/2.6.1-source-tag.release.md` — prior local candidate note; tag pending
- `releases/2.6.0-source-tag.release.md` — prior A-1–A-4 source-preview candidate note; tag pending
- `releases/2.8.0-source-tag.release.md` — v2.8公開報告と過去の候補証跡
- `releases/2.7.0-source-tag.release.md` — historical local source/package candidate boundary
- `releases/2.7.0-app-store-release-notes.md` — candidate App Store copy; not published
- `v2.5-plan.md` — closed workspace-control release plan
- `local-assist-conversational-edit-ux.md` — conversation / Diff design SoT
- `assist-surface-strategy.md` — Assist + later Core AI whitelist intent
- `core-ai-c0-design.md` — C-0 design and locked Core AI boundary; implementation status is in current-work and core-ai-production-models.
- `core-ai-production-models.md` — Gemma 4 candidate lock, reproducible Apple-hosted asset preparation, and remaining activation gates.
- `core-ai-model-source-abstraction.md` — **v3.1 の C-3（スライス2まで実装）**: Apple-hosted 以外のローカル/外部 resource folder を同じモデルとして扱う設計と実装ゲート。
- `core-ai-c0-external-review-2026-08-27.md` — four-lens advisory review of that spike; does not override the queue.
- `mlx-m0-preflight-design.md` — completed OS-27-before preflight; no MLX runtime
- `mlx-m0a-external-review-brief.md` — external review packet for `00f179ab..HEAD`
- `v2.4-plan.md` — closed Book depth plan
- `superpowers/specs/2026-07-02-v2-book-scope-design.md` — v2 Book design SoT
- `v2-external-review-synthesis-2026-07-18.md` — consolidated external review candidates
- `v2-qwen-ux-proposal-synthesis-2026-07-21.md` — Qwen UX proposal triage (advisory)
- `okf-spec-pin.md` + closed v1.10 / v1.11 / v1.12 contracts
- `v1.8-plus-product-review-roadmap.md` — closed bridge
- `v1.13-plus-refinement-roadmap.md` — parked themes
- `v1.xx-image-media-boundary-plan.md` — Theme G (parked with refinement)
- `l-mode-plan.md`, `ebook-mode-epub-export-plan.md`

Completed lane plans, retired proposals, and speculative future notes live under
`archive/`. Detailed pre-v1.x roadmap narratives:
`archive/roadmaps/roadmap-historical-phases-through-v1.x.md`.

## Local-Only Internal Notes

Keep account-specific App Store Connect notes, certificate names, signing
identity strings, screenshots, contact details, or private review drafts
under `docs/internal/` or `*.local.md`. Those paths are intentionally
git-ignored and should not be referenced from public-facing docs.

## Historical And Archive Areas

- `archive/`: old setup notes, early MVP plans, superseded roadmaps, older goal prompts, past release review briefs, and detailed status history.
- `releases/`: release-note bodies used for published or prepared GitHub Releases.
- `archive/reviews/`: historical review gates and design decisions that may still be referenced from code comments.
- `archive/roadmaps/`: superseded or extracted historical roadmap narratives.
- `archive/operations/app-store-v0.17/`: v0.17 App Store-quality request packets, closeout, smoke, and performance evidence.
- `archive/operations/current-work-through-v1.0.md`: completed v0.18-v0.36 implementation logs and pre-v1.0 submission-prep evidence moved out of `current-work.md` during the v1.1 slim-down.
- `archive/operations/handoff-detail-through-v1.0.md`: v0.18-v1.0 handoff detail, completed-slice history, and per-version verification records moved out of `handoff.md`.
- `archive/operations/app-store-build-history-through-v0.34.md`: per-version App Store package-candidate notes and SHA-256 records for v0.18-v0.34 moved out of `app-store-build.md`.
- `archive/operations/smoke-checklist-version-notes-through-v0.18.md`: version-specific smoke observations for v0.11-v0.19 moved out of `smoke-checklist.md`.
- `archive/operations/pre-release-fix-plan-2026-06-13.md`: completed review-derived pre-release code-quality fix queue.
- `archive/operations/quality-inventory-v1.6.md`: closed v1.6 cross-cutting quality inventory.
- `archive/operations/v1.1-v1.2-followup.md`, `archive/operations/v1.3-followup.md`, and `archive/operations/v1.7-trust-scale-plan.md`: completed lane follow-ups and evidence.
- `archive/planning/`: older planning memos, including commercial-quality baseline, authoring-feature readiness, and product-copy drafts.
- `archive/planning/v0.27-refinement-slice-plan.md`: completed v0.27 execution memo.
- `archive/reviews/import-assist-boundary-review-v1.6.md`: shipped v1.6 Import Assist boundary review.

- [v3 UI-A1レビュー](reviews/2026-09-09-v3-ui-a1/README.md): 共通外枠・文書ナビの実装、画像、残る受入。
