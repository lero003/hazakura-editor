# Documentation Index

Status: Operational
Scope: Current documentation map
Authority: High
Last reviewed: 2026-07-15 (v1.11 OKF draft contract accepted)

This directory separates current guidance from historical material. Use current documents for implementation and release decisions. Use `docs/archive/` only for past rationale or old planning context.

Start with `current-work.md` when choosing the next UX, post-approval,
or quality-polish slice.

## Current Canonical Docs

- `product-brief.md`: product direction, users, non-goals, and assist direction.
- `security-boundary.md`: safety constraints for file handling and execution boundaries.
- `agent-workbench-boundary.md`: optional CLI-agent workbench trust boundary.
- `assist-surface-strategy.md`: future assist-surface direction.
- `current-work.md`: active v1.11 OKF compatibility queue and release boundary.
- `roadmap.md`: active lane and future phase boundaries.
- `current-status.md`: current implementation and release state.
- `v1.8-plus-product-review-roadmap.md`: accepted v1.9, v1.10, v1.11 OKF / distribution-confidence, and v2 sequencing.
- `v1.10-single-document-structure-design.md`: completed v1.10 implementation and verification contract.
- `v1.11-okf-draft-preview-design.md`: active OKF v0.1 Draft compatibility and v1.11 verification contract.
- `l-mode-plan.md`: active source-preserving L Mode writing-surface direction.
- `ebook-mode-epub-export-plan.md`: active single-document e-book and EPUB planning detail.

## Current Operational Docs

- `development-automation.md`: recurring agent/automation operating rules.
- `external-agent-review-workflow.md`: external implementation agent plus Codex review workflow.
- `source-release-checklist.md`: source-preview release readiness.
- `dmg-preview-checklist.md`: warning-expected DMG preview readiness.
- `app-store-build.md`: public-safe Mac App Store build, signing, and smoke boundary.
- `release-pre-check.md`: last-mile release hygiene.
- `smoke-checklist.md`: manual smoke checklist.
- `handoff.md`: concise handoff for the next coding agent.

## Current Planning Docs

The active planning surface is intentionally small: `v1.8-plus-product-review-roadmap.md`,
`v1.11-okf-draft-preview-design.md`, `l-mode-plan.md`, and
`ebook-mode-epub-export-plan.md`. Completed lane plans,
retired proposals, and speculative future notes live under `archive/`.

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
- `archive/operations/quality-inventory-v1.6.md`: closed v1.6 cross-cutting quality inventory.
- `archive/operations/v1.1-v1.2-followup.md`, `archive/operations/v1.3-followup.md`, and `archive/operations/v1.7-trust-scale-plan.md`: completed lane follow-ups and evidence.
- `archive/planning/`: older planning memos, including commercial-quality baseline, authoring-feature readiness, and product-copy drafts.
- `archive/planning/v0.27-refinement-slice-plan.md`: completed v0.27 execution memo.
- `archive/reviews/import-assist-boundary-review-v1.6.md`: shipped v1.6 Import Assist boundary review.
