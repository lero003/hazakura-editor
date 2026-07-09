# Documentation Index

Status: Operational
Scope: Current documentation map
Authority: High
Last reviewed: 2026-07-01

This directory separates current guidance from historical material. Use current documents for implementation and release decisions. Use `docs/archive/` only for past rationale or old planning context.

Start with `current-work.md` when choosing the next UX, post-approval,
or quality-polish slice.

## Current Canonical Docs

- `product-brief.md`: product direction, users, non-goals, and assist direction.
- `security-boundary.md`: safety constraints for file handling and execution boundaries.
- `agent-workbench-boundary.md`: optional CLI-agent workbench trust boundary.
- `assist-surface-strategy.md`: future assist-surface direction.
- `current-work.md`: active queue (v1.6 Import Assist; v1.5 closed before edohigan).
- `quality-inventory-v1.6.md`: cross-cutting quality gaps and deferred items for the v1.6 lane.
- `roadmap.md`: active lane and future phase boundaries.
- `current-status.md`: current implementation and release state.
- `import-assist-boundary-review.md`: v1.6 Import Assist Phase 1 boundary sign-off.
- `edohigan-theme-plan.md`: post-v1.5 江戸彼岸 theme notes (not part of v1.5 release).

## Current Operational Docs

- `development-automation.md`: recurring agent/automation operating rules.
- `external-agent-review-workflow.md`: external implementation agent plus Codex review workflow.
- `source-release-checklist.md`: source-preview release readiness.
- `dmg-preview-checklist.md`: warning-expected DMG preview readiness.
- `app-store-build.md`: public-safe Mac App Store build, signing, and smoke boundary.
- `smoke-checklist.md`: manual smoke checklist.
- `handoff.md`: concise handoff for the next coding agent.

## Current Planning Backlogs

- `l-mode-plan.md`: L Mode / えるモード source-preserving WYSIWYG Accuracy Ramp planning memo.
- `ebook-mode-epub-export-plan.md`: v0.21+ e-bookモード / EPUB export planning memo.
- `ai-markdown-ingest-plan.md`: explicit AI Markdown proposal ingest and Diff / Review planning memo.
- `native-macos-appearance-plan.md`: v0.25 native-feeling Safe Editor chrome planning memo.
- `post-v0.25-product-refinement-plan.md`: post-App-Store refinement lens for raising product grade without adding heavy surfaces.
- `v1.1-v1.2-followup.md`: user-observed post-v1 continuity, review, image, export, and polish queue.
- `v1.3-followup.md`: current Daily Trust source evidence, boundaries, and
  remaining built-app/PDF smoke.
- `speculative-local-ai-future-plan.md`: v3.x-or-later local AI re-evaluation after book / review maturity.
- `apple-local-assist-distribution-plan.md`: Hazakura Local Assist / App Store distribution planning memo.
- `apple-local-assist-writing-companion-plan.md`: Hazakura Local Assist Writing Companion / external Assist Window UX direction.
- `edohigan-theme-plan.md`: v1.6 江戸彼岸ジョークテーマの実装メモと残課題 (花びらシェーダー調整中)。

## Local-Only Internal Notes

Keep account-specific App Store Connect notes, certificate names, signing
identity strings, screenshots, contact details, or private review drafts
under `docs/internal/` or `*.local.md`. Those paths are intentionally
git-ignored and should not be referenced from public-facing docs.

## Historical And Archive Areas

- `archive/`: old setup notes, early MVP plans, superseded roadmaps, older goal prompts, past release review briefs, and detailed status history.
- `releases/`: release-note bodies used for published or prepared GitHub Releases.
- `archive/reviews/`: historical review gates and design decisions that may still be referenced from code comments.
- `archive/operations/app-store-v0.17/`: v0.17 App Store-quality request packets, closeout, smoke, and performance evidence.
- `archive/operations/current-work-through-v1.0.md`: completed v0.18-v0.36 implementation logs and pre-v1.0 submission-prep evidence moved out of `current-work.md` during the v1.1 slim-down.
- `archive/operations/handoff-detail-through-v1.0.md`: v0.18-v1.0 handoff detail, completed-slice history, and per-version verification records moved out of `handoff.md`.
- `archive/operations/app-store-build-history-through-v0.34.md`: per-version App Store package-candidate notes and SHA-256 records for v0.18-v0.34 moved out of `app-store-build.md`.
- `archive/operations/smoke-checklist-version-notes-through-v0.18.md`: version-specific smoke observations for v0.11-v0.19 moved out of `smoke-checklist.md`.
- `archive/operations/pre-release-fix-plan-2026-06-13.md`: completed review-derived pre-release code-quality fix queue.
- `archive/planning/`: older planning memos, including commercial-quality baseline, authoring-feature readiness, and product-copy drafts.
- `archive/planning/v0.27-refinement-slice-plan.md`: completed v0.27 execution memo.
