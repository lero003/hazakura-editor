# Handoff

## Current State

- `hazakura editor` published `v0.10.0` as a warning-expected DMG preview, framed as **L Mode Alpha Preview**.
- Version surfaces remain aligned at `0.10.0`; no next release candidate is open yet.
- Current release body: `docs/releases/0.10.0-warning-expected-dmg-preview.release.md`.
- Current status source: `docs/current-status.md`.

## Recent Changes

- Docs were pruned for the v0.10 release lane.
- `docs/current-status.md` was compacted from a long change log into a current-state document.
- Historical detailed status was archived at `docs/archive/status/current-status-through-2026-06-04.md`.
- Old setup notes, initial MVP/planning docs, superseded goal prompts, v0.6 release review brief, and the unpublished v0.1 DMG proposal moved under `docs/archive/`.
- New indexes were added at `docs/README.md`, `docs/archive/README.md`, and `docs/releases/README.md`.
- `v0.10.0` was tagged and published, with DMG assets re-downloaded and verified after publication.

## Decisions

- Current docs in `docs/` are authoritative for implementation and release decisions.
- `docs/archive/` is historical context only. Do not use archived files as current product scope unless a current doc explicitly reactivates them.
- Historical Review Desk review docs now live in `docs/archive/reviews/`; code comments reference those archive paths directly.
- Older `.release.md` files stay in `docs/releases/` as release-note evidence; unpublished proposals belong in `docs/archive/releases/`.

## Verification

- Release gates passed before publication: `npm ci`, `npm run typecheck`, `npm test`, `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo test --manifest-path src-tauri/Cargo.toml`, `npm run build:vite`, `npm run build`, `npm audit`, `cargo audit --file src-tauri/Cargo.lock`, and `npm run build:dmg-preview`.
- Local artifact verification passed: checksum, `hdiutil verify`, built and mounted app metadata, and `codesign --verify --deep --strict --verbose=2`.
- `spctl -a -vv -t open` rejected the ad-hoc signed app with `source=Insufficient Context`, as expected for this warning-expected preview.
- Remote GitHub Release assets were re-downloaded into a fresh temp directory and passed checksum, `hdiutil verify`, mounted-app metadata, and codesign verification.
- Docs checks passed: `git diff --check`, current-doc old-reference scan, and current-doc local Markdown link check.

## Risks / Unknowns

- The `v0.10.0` tag points at the release-prep commit; `main` has a later post-publication docs-sync commit.
- GitHub reported one moderate vulnerability notice during push; `npm audit` still reported 0 vulnerabilities locally.
- `docs/releases/` still contains historical release-note evidence; this is intentional because release verification can depend on it.

## Next Actions

- For v0.11 planning, keep assist behavior detachable and route candidate output through Review Desk or Diff.
- If doing more docs cleanup, prefer tightening release-note structure, not resurrecting archived planning docs.

## Avoid

- Do not treat archived early MVP or post-v0.5 planning notes as current roadmap.
- Do not move published release evidence out of `docs/releases/` without checking links and release workflow expectations.
