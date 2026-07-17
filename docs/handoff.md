# Handoff

Status: Operational
Scope: Short handoff for v1.14 local candidate after published v1.13
Authority: Medium
Last reviewed: 2026-07-18 (v1.14.0 source candidate; store 1.13.0)

## Current State

- Package/app version in tree: **`1.14.0`** (local source candidate).
- Published Mac App Store: **`1.13.0`** (user-reported 2026-07-18). Do not
  reopen without a reproduced hotfix. Tags and published assets are immutable.
- Latest recorded GitHub source tag: **`v1.12.0`** (source archive only). No
  `v1.13.0` / `v1.14.0` source tags are claimed here.
- Local package provenance: ignored
  `docs/internal/app-store-candidates/latest.json`.
- **v1.14 Keep box is source-complete for a candidate cut** (not store-ready by
  docs alone). Inventory and draft App Store copy:
  `docs/releases/1.14.0-app-store-release-notes.md`. Queue:
  `docs/current-work.md`.
- Review follow-up fixed Space-key activation for the always-visible e-book
  edit action and realigned the CSS / living-doc contract tests with the boxed
  v1.14 state.
- Reproduced PDF Reference 150% mouse friction is fixed in source: the PDF
  stage now owns both scroll axes, ordinary wheel input moves vertically then
  horizontally at the vertical edge, and trackpad two-axis input stays native.
- The returning Start Panel now removes repeated explanatory paragraphs,
  keeps long action wording in accessible names, places basic actions before
  recents, and uses a compact two-column recent-folder list with safe overflow.

### v1.14 Keep summary (one line each)

- Continuity: same-name tabs parent folder; Reference retained toggle; recent
  workspaces; shared sticky right-pane header.
- Trust: export path/warnings; Assist lock & not-saved; Import draft status.
- Writing Loop: Preview vs e-book purpose; e-book edit-here; Outline hints +
  heading Undo status.
- OKF: scaffold pre-create file list; first-fix “open to edit” card.

### Still open evidence

- Full hands-on / TestFlight coverage of the Keep set. A local App Store
  preview build and basic macOS window smoke pass, but do not cover the full
  interaction checklist.
- Narrow-window tab truncation, VoiceOver speech, long-doc / IME breadth.
- Theme G signed export recheck and pin-to-assets Undo (carry-over from 1.13).
- Hands-on packaged PDF Reference 150% check with a standard mouse: confirm
  one scrollbar owner, vertical-to-horizontal wheel handoff, Shift+wheel, and
  unchanged trackpad two-axis panning.

### Latest verification

- Current Start Panel source: focused Start Panel / locale / CSS tests (3 files
  / 19 tests), `npm run typecheck`, `npm test` (193 files / 1622 tests),
  `npm run smoke:app-store-surface` (10 files / 107 tests), and `npm run build`.
- The preceding candidate also passed
  `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`,
  `cargo test --manifest-path src-tauri/Cargo.toml` (362 passed / 2 ignored),
  `npm run build`, and `SKIP_BUILD=1 npm run smoke:macos-window`; packaged
  standard-mouse interaction remains separate evidence.

### Deferred residual (after candidate, optional)

- Tab overflow; nav history “back”; global status TTL; dependency cadence
  (`@codemirror/view` **6.43.2** pin).

## Durable Pins

- Safe Editor primary; Markdown/text source canonical.
- No Book Scope, indexing, auto-apply, auto-save, second editable buffer.
- App Store lane: no Agent Workbench / external CLI agent.
- Import Assist: on-device, edit-before-save, no cloud OCR auto-save.
- OKF: explicit, bounded, read-only review + explicit scaffold; no auto-repair.
- PDF export path remains direct PDF export (not macOS print UI).

## Next For Agents

1. Prefer residual polish or verification over new feature expansion.
2. One hypothesis per run; Keep / Iterate / Revert with evidence.
3. Do not tag, upload, submit, or publish without explicit user approval.
4. On security/path/AI surfaces, re-read `docs/security-boundary.md`.
5. Start from `docs/current-work.md` and `docs/current-status.md`.

## Key Paths

| Need | Path |
|------|------|
| Next slice | `docs/current-work.md` |
| Status truth | `docs/current-status.md` |
| v1.14 draft notes | `docs/releases/1.14.0-app-store-release-notes.md` |
| Refinement rails | `docs/v1.13-plus-refinement-roadmap.md` |
| Smoke | `docs/smoke-checklist.md` |
| App Store build | `docs/app-store-build.md` |
| v2 boundary | `docs/superpowers/specs/2026-07-02-v2-book-scope-design.md` |
