# Documentation Index

Status: Operational
Scope: Current documentation map
Authority: High
Last reviewed: 2026-07-22 (v2.3.0 local candidate)

This directory separates current guidance from historical material. Use current documents for implementation and release decisions. Use `docs/archive/` only for past rationale or old planning context.

Agent entry rules live at the repository root: `AGENTS.md`. **Active phase is
the v2.3.0 Book UX candidate (includes v2.1 search).** Start with `current-work.md`
and `roadmap.md`. Published v2.0.0 stays immutable; other residual / evidence
pools are parked.

## Current Canonical Docs

- `product-brief.md`: product direction, users, non-goals, and assist direction.
- `security-boundary.md`: safety constraints for file handling and execution boundaries.
- `agent-workbench-boundary.md`: optional CLI-agent workbench trust boundary.
- `assist-surface-strategy.md`: future assist-surface direction.
- `current-work.md`: **v2.1 candidate queue** (bounded Reader search; other slices parked).
- `roadmap.md`: **v2.1 candidate phase**, published v2.0 boundary, future v2.x practicalization.
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
- `release-pre-check.md`: last-mile release hygiene.
- `smoke-checklist.md`: manual smoke checklist.
- `handoff.md`: concise handoff for the next coding agent.

## Current Planning Docs

Active planning surface (intentionally small):

- `roadmap.md` — **v2 phase** + parked residual
- `current-work.md` — next v2 slices
- `superpowers/specs/2026-07-02-v2-book-scope-design.md` — v2 design SoT
- `v2-external-review-synthesis-2026-07-18.md` — consolidated external review candidates
- `v2-qwen-ux-proposal-synthesis-2026-07-21.md` — Qwen UX proposal triage (post-2.0 thinking)
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
