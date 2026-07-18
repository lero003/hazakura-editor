# Handoff

Status: Operational
Scope: v2 Book Scope Alpha + explicit chapter suggestions; v1.14 in App Store review
Authority: Medium
Last reviewed: 2026-07-18 (explicit chapter suggestion draft in source)

## Current State

- Package/app version in tree: **`1.14.0`** (source tag `v1.14.0`).
- Published Mac App Store (last confirmed in docs): **`1.13.0`**.
- **v1.14 submitted** for App Store review (user-reported 2026-07-18). Early
  look OK. Publication not claimed until the user reports it.
- **Active phase: v2 Book Scope development.** Residual polish, broad
  evidence matrix, and optional `v1.15+` boxes are parked.
- **First Alpha spine is in source:** existing sidebar Files / Book switch,
  explicit Markdown selection, app-private workspace order, unavailable-entry
  retention/recheck, chapter switching through the existing single editor,
  and Rust path/symlink/100-chapter validation.
- **Explicit chapter suggestions are in source:** Book view can run the existing
  bounded/cancellable OKF snapshot on demand, prioritize root `index.md` links,
  append remaining readable `.md` paths, and open the result as an unsaved
  checkbox draft. It adds no startup/background scan or persistent scan cache.
- Value / multi-file narrative and **Help expansion** are **v2 ship polish**
  (when OKF multi-file feel is good enough), not a pre-implementation essay.
- Design SoT:
  `docs/superpowers/specs/2026-07-02-v2-book-scope-design.md`.
- Queue: `docs/current-work.md`. Roadmap: `docs/roadmap.md`.

### v1.14 Keep summary (shipped in review candidate)

- Continuity: same-name tabs; Reference retained toggle; recent workspaces;
  shared sticky right-pane header; PDF 150% scroll fix.
- Trust: export path/warnings; Assist lock & not-saved; Import draft status.
- Writing Loop: Preview vs e-book; e-book edit-here; Outline hints + heading Undo.
- OKF: scaffold pre-create list; first-fix open guidance.

### Parked (not main queue)

- Tab overflow; nav history “back”; status TTL; dep cadence.
- Full TestFlight / VoiceOver / narrow / long-doc evidence matrix.
- Theme G signed export recheck breadth.

## Verification (2026-07-18)

- `npm run typecheck` — pass.
- `npm test` — 198 files / 1,644 tests pass.
- `npm run build:vite` — pass (existing large-chunk warning only).
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` — pass.
- `cargo test --manifest-path src-tauri/Cargo.toml` — 366 pass / 2 ignored
  host-dependent tests.
- `npm run smoke:app-store-surface` — 10 files / 107 tests pass.
- `npm run build` — App Store preview bundle built successfully; notarization
  was not attempted.
- `smoke:macos-window` against the resulting `Hazakura Editor.app` — onscreen
  main window confirmed.
- Interactive Book Scope smoke passed in the built app: nested selection,
  reorder, dirty chapter switching/return, scope-external file opening,
  relaunch restoration, external deletion/unavailable retention, in-app
  rename tracking, and confirmed Trash removal. The narrow follow-up localizes
  lazy-folder status and unavailable reasons.

## Durable Pins

- Safe Editor primary; Markdown/text source canonical (per file in v2).
- No indexing, auto-apply, auto-save, second editable buffer as default.
- App Store lane: no Agent Workbench / external CLI agent.
- Import Assist: on-device, edit-before-save, no cloud OCR auto-save.
- OKF: explicit, bounded review + explicit scaffold; no auto-repair.
- v2: explicit user-selected Book Scope only; base OKF ≠ Hazakura Book order.
- PDF export path remains direct PDF export (not macOS print UI).

## Next For Agents

1. **Continue v2** with whole-book reading over the explicit scope, then the
   explicit Current file / Book Scope EPUB/PDF export + preflight lane. Do not
   rebuild the completed selection/order/suggestion spine.
2. One verifiable slice per run. Do not front-load Help essays before the
   multi-file feel exists.
3. Hotfix only for reproduced v1.14 review or daily-use blockers.
4. Do not invent a mandatory `v1.15` feature train before v2.
5. Do not upload, submit, publish, move tags, or attach release assets without
   explicit user approval.
6. On security/path/AI/multi-file surfaces, re-read
   `docs/security-boundary.md` and the v2 design boundary section.

## Key Paths

| Need | Path |
|------|------|
| Next slice | `docs/current-work.md` |
| Phase / path | `docs/roadmap.md` |
| v2 design | `docs/superpowers/specs/2026-07-02-v2-book-scope-design.md` |
| Status truth | `docs/current-status.md` |
| OKF pin | `docs/okf-spec-pin.md` |
| v1.14 store notes | `docs/releases/1.14.0-app-store-release-notes.md` |
| Parked refinement | `docs/v1.13-plus-refinement-roadmap.md` |
| Smoke | `docs/smoke-checklist.md` |
| App Store build | `docs/app-store-build.md` |

Local package provenance remains in
`docs/internal/app-store-candidates/latest.json`; do not copy per-build paths or
hashes into this handoff.
