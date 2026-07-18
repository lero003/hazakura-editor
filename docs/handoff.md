# Handoff

Status: Operational
Scope: v2 Book Scope vertical slice + candidate proof; v1.14 in App Store review
Authority: Medium
Last reviewed: 2026-07-18 (Help expansion + version 2.0.0)

## Current State

- Package/app version in tree: **`2.0.0`** (tag `v2.0.0` not claimed until cut).
- Published Mac App Store (last confirmed in docs): **`1.13.0`**.
- **v1.14 submitted** for App Store review (user-reported 2026-07-18). Early
  look OK. Publication not claimed until the user reports it. Tree version is
  ahead of that submission candidate.
- **Active phase: v2.0 source candidate** (Book Scope + Help + version bump).
  Residual polish, broad evidence matrix, and optional Keep boxes are parked.
- **First Alpha spine is in source:** existing sidebar Files / Book switch,
  explicit Markdown selection, app-private workspace order, unavailable-entry
  retention/recheck, chapter switching through the existing single editor,
  and Rust path/symlink/100-chapter validation.
- **Explicit chapter suggestions are in source:** Book view can run the existing
  bounded/cancellable OKF snapshot on demand, prioritize root `index.md` links,
  append remaining readable `.md` paths, and open the result as an unsaved
  checkbox draft. It adds no startup/background scan or persistent scan cache.
- **Whole-book reader is in source:** explicit Book action, saved scope order,
  live dirty buffers before disk, chapter-relative image/link bases, 32 MiB
  total budget, visible unavailable/skipped notices, and edit return through
  the existing tab path. It is read-only and does not create a second buffer.
- **Book Scope export is in source:** PDF and EPUB dialogs explicitly choose
  Current file or whole book. Book output uses scope order, live dirty buffers,
  and each chapter's own document path. Preflight checks unavailable chapters,
  up to 100 workspace images, missing headings, and EPUB metadata; unavailable
  chapters block Book export before a destination is chosen.
- **Book Scope UX quieting is in source:** settled list = read/edit primary;
  suggest only in empty/edit setup; recheck only when unavailable; quieter
  path/label density; shorter OKF review intro.
- **Help expansion is in source:** native Help menu / Command Palette → Books
  and knowledge folders…; About/diagnostics derive `2.0.0` from package
  metadata. Saving or cancelling Book chapter selection restores trigger focus.
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

### Help + version 2.0.0 slice

- `npm run typecheck` — pass.
- `npm test` — 201 files / 1,664 tests pass.
- `npm run build:vite` — pass (existing large-chunk warning only).
- `npm run smoke:app-store-surface` — 10 files / 107 tests pass.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` — pass.
- `cargo test --manifest-path src-tauri/Cargo.toml` — 367 pass / 2
  host-dependent ignored.
- `npm audit --audit-level=high` — 0 vulnerabilities.
- `cargo audit --file src-tauri/Cargo.lock` — exit 0; 18 allowed known
  Tauri/Linux and unmaintained transitive warnings, no vulnerability finding.
- `npm run build` — helper live probes and helper-enabled App Store preview
  build pass. Bundle version is `2.0.0`, deep/strict code-sign verification
  passes, and packaged window launch smoke shows an onscreen app window.
- Version surfaces: package.json, package-lock root, tauri.conf.json,
  Cargo.toml, Cargo.lock package; About Help and diagnostics read package
  metadata rather than repeating a separate version literal.
- Tag / App Store pkg / upload **not** performed.

### Prior candidate proof (Book interaction breadth)

- Earlier same-day Book Scope export/reader smoke remains the last direct
  interaction evidence for the multi-file spine. All automated, Rust, audit,
  package, signing, and launch gates above were re-run after the UX review.

## Durable Pins

- Safe Editor primary; Markdown/text source canonical (per file in v2).
- No indexing, auto-apply, auto-save, second editable buffer as default.
- App Store lane: no Agent Workbench / external CLI agent.
- Import Assist: on-device, edit-before-save, no cloud OCR auto-save.
- OKF: explicit, bounded review + explicit scaffold; no auto-repair.
- v2: explicit user-selected Book Scope only; base OKF ≠ Hazakura Book order.
- PDF export path remains direct PDF export (not macOS print UI).

## Next For Agents

1. Tree is **`2.0.0`** with Help. Human-only next: tag, pkg, submit, publish.
2. Do not rebuild the proven Book Scope spine without reproduced friction.
   Take one verifiable slice per run.
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
| v2.0 store draft | `docs/releases/2.0.0-app-store-release-notes.md` |
| v1.14 store notes | `docs/releases/1.14.0-app-store-release-notes.md` |
| Parked refinement | `docs/v1.13-plus-refinement-roadmap.md` |
| Smoke | `docs/smoke-checklist.md` |
| App Store build | `docs/app-store-build.md` |

Local package provenance remains in
`docs/internal/app-store-candidates/latest.json`; do not copy per-build paths or
hashes into this handoff.
