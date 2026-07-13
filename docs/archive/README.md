# Documentation Archive

Status: Archive
Scope: Retired planning, operational prompts, and historical evidence
Authority: Low
Last reviewed: 2026-07-14

This directory preserves old material without letting it guide current implementation by accident.

Use current docs in `docs/` for decisions. Read archived files only when you need historical rationale, old release evidence, or context for why a current boundary exists.

## Contents

- `planning/`: initial product plans, completed phase execution memos, early MVP scope, old setup notes, deferred RPC exploration, post-v0.5 memo material, older commercial-quality baseline, authoring-readiness notes, Local Assist helper-path design history, and product-copy drafts.
- `operations/`: superseded goal prompts, automation prompt collections, completed fix plans, and local evidence notes.
- `operations/current-work-through-v1.0.md`: completed v0.18-v0.36 implementation logs and pre-v1.0 submission-prep evidence moved out of `docs/current-work.md` during the v1.1 slim-down. Use `docs/current-work.md` for the active queue.
- `operations/handoff-detail-through-v1.0.md`: v0.18-v1.0 implementation logs, completed-slice history, and per-version verification records moved out of `docs/handoff.md`. Use `docs/handoff.md` for the current handoff.
- `operations/app-store-build-history-through-v0.34.md`: per-version App Store package-candidate notes and SHA-256 records for v0.18-v0.34 moved out of `docs/app-store-build.md`.
- `operations/smoke-checklist-version-notes-through-v0.18.md`: version-specific TestFlight, App Store candidate, release-candidate, and accessibility smoke observations for v0.11-v0.19 moved out of `docs/smoke-checklist.md`.
- `operations/app-store-v0.17/`: v0.17 App Store-quality request packets, closeout, smoke, and performance evidence. Use `docs/current-work.md` for current work instead.
- `releases/`: old release review briefs or release proposals that are not current release bodies.
- `roadmaps/`: superseded roadmap sequences.
- `reviews/`: historical review gates and design decisions.
- `reviews/import-assist-boundary-review-v1.6.md`: shipped v1.6 Import Assist boundary review.
- `operations/quality-inventory-v1.6.md`: closed v1.6 cross-cutting quality inventory.
- `operations/v1.1-v1.2-followup.md`, `operations/v1.3-followup.md`, and `operations/v1.7-trust-scale-plan.md`: completed lane follow-ups and evidence.
- `status/`: long-form historical current-status logs.
- `superpowers/`: completed `plans/` and `specs/` from `docs/superpowers/`
  for versions that are already published on the App Store and no longer
  referenced from current docs. Move a `superpowers/` plan or spec here
  when its target version ships and current docs no longer cite it;
  keep the active (still-cited) specs under `docs/superpowers/`.
- `superpowers/specs/2026-07-02-import-assist-design.md`: shipped v1.6
  Import Assist proposal specification.

Do not move archived content back into current docs unless the current roadmap or implementation has made it active again.
