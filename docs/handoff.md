# Handoff

## Current State

- `hazakura editor` is preparing `v0.10.0` as a warning-expected DMG preview release candidate, framed as **L Mode Alpha Preview**.
- Version surfaces are aligned at `0.10.0`; tag creation and GitHub Release publication still require explicit user approval.
- Current release body: `docs/releases/0.10.0-warning-expected-dmg-preview.release.md`.
- Current status source: `docs/current-status.md`.

## Recent Changes

- Docs were pruned for the v0.10 release lane.
- `docs/current-status.md` was compacted from a long change log into a current-state document.
- Historical detailed status was archived at `docs/archive/status/current-status-through-2026-06-04.md`.
- Old setup notes, initial MVP/planning docs, superseded goal prompts, v0.6 release review brief, and the unpublished v0.1 DMG proposal moved under `docs/archive/`.
- New indexes were added at `docs/README.md`, `docs/archive/README.md`, and `docs/releases/README.md`.

## Decisions

- Current docs in `docs/` are authoritative for implementation and release decisions.
- `docs/archive/` is historical context only. Do not use archived files as current product scope unless a current doc explicitly reactivates them.
- Historical Review Desk review docs now live in `docs/archive/reviews/`; code comments reference those archive paths directly.
- Older `.release.md` files stay in `docs/releases/` as release-note evidence; unpublished proposals belong in `docs/archive/releases/`.

## Verification

- `git diff --check` passed.
- Trailing-whitespace scan over `README.md` and `docs/**/*.md` found no issues.
- Current-doc old-reference scan passed after excluding `docs/archive/**`.
- Current-doc local Markdown link check passed, with intentional smoke-check example paths excluded.

## Risks / Unknowns

- No code or app behavior changed in the docs cleanup.
- Full release gates were not rerun for this docs-only cleanup.
- `docs/releases/` still contains historical release-note evidence; this is intentional because release verification can depend on it.

## Next Actions

- If releasing v0.10.0, use `hazakura-note-release-candidate`, rerun the release verification loop, and publish only after explicit approval.
- If doing more docs cleanup, prefer tightening release-note structure, not resurrecting archived planning docs.

## Avoid

- Do not treat archived early MVP or post-v0.5 planning notes as current roadmap.
- Do not move published release evidence out of `docs/releases/` without checking links and release workflow expectations.
