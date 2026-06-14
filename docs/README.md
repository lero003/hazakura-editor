# Documentation Index

Status: Operational
Scope: Current documentation map
Authority: High
Last reviewed: 2026-06-10

This directory separates current guidance from historical material. Use current documents for implementation and release decisions. Use `docs/archive/` only for past rationale or old planning context.

Start with `current-work.md` when choosing the next UX, App Store
submission-prep, or quality-polish slice.

## Current Canonical Docs

- `product-brief.md`: product direction, users, non-goals, and assist direction.
- `security-boundary.md`: safety constraints for file handling and execution boundaries.
- `agent-workbench-boundary.md`: optional CLI-agent workbench trust boundary.
- `assist-surface-strategy.md`: future assist-surface direction.
- `current-work.md`: active v0.18 UX and submission-prep work queue.
- `roadmap.md`: active release sequence and phase boundaries.
- `current-status.md`: current implementation and release state.

## Current Operational Docs

- `development-automation.md`: recurring agent/automation operating rules.
- `external-agent-review-workflow.md`: external implementation agent plus Codex review workflow.
- `source-release-checklist.md`: source-preview release readiness.
- `dmg-preview-checklist.md`: warning-expected DMG preview readiness.
- `app-store-build.md`: public-safe helper-free Mac App Store build, signing, and smoke boundary.
- `pre-release-fix-plan.md`: review-derived code-quality fixes to complete before release, excluding smoke execution.
- `smoke-checklist.md`: manual smoke checklist.
- `handoff.md`: concise handoff for the next coding agent.

## Current Planning Backlogs

- `l-mode-plan.md`: L Mode / えるモード source-preserving WYSIWYG Accuracy Ramp planning memo.
- `ebook-mode-epub-export-plan.md`: v0.21+ e-bookモード / EPUB export planning memo.
- `apple-local-assist-distribution-plan.md`: Apple Local Assist / App Store distribution planning memo.
- `apple-local-assist-writing-companion-plan.md`: Apple Local Assist Writing Companion / external Assist Window UX direction.

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
- `archive/planning/`: older planning memos, including commercial-quality baseline, authoring-feature readiness, and product-copy drafts.
