# Handoff

Status: Operational
Scope: Short handoff for the next coding agent
Authority: Medium
Last reviewed: 2026-06-11 (App Store review display-name polish)

## Current State

- `Hazakura Editor` is at `0.17.0`.
- User-facing app identity is capitalized as `Hazakura Editor`. The
  App Store preview bundle is `Hazakura Editor.app`; current docs and
  smoke paths should use that name rather than the older lowercase
  display form.
- Latest published downloadable preview is `v0.17.0` warning-expected DMG preview.
- `v0.17.0` is ad-hoc signed, not Developer ID signed, not notarized, and expected to show macOS security warnings.
- Current active lane is v0.18 UX polish and submission prep.
- Start from `docs/current-work.md`.
- Markdown preview task checkboxes are complete for v0.18: Preview renders
  `- [ ]` / `- [x]` as inert display-only checkbox glyphs without
  changing saved Markdown.
- Normal mode workspace sidebar collapse / restore is complete for
  v0.18. L Mode still owns its separate temporary file-tree drawer.
- App Store preview black-screen smoke is fixed for the helper-free
  preview lane: `frontendDist` is explicit in the App Store configs and
  the sandbox entitlement includes `com.apple.security.network.client`
  for the Tauri/WebKit runtime.
- Sandboxed workspace restore stores an app-scoped security-scoped
  bookmark for user-selected workspace folders and resolves it on
  restart. Older path-only state can still fall back to the
  reauthorization status hint.
- Direct-open standalone files can save even when the parent folder
  cannot create a sibling temp file: `save_text_file` keeps the normal
  atomic path, then falls back to direct existing-file write only on
  temp-create `PermissionDenied`.
- Directly opened PNG/JPEG/GIF/WebP files can preview without an active
  workspace through `open_image_file`; workspace-tree image preview
  still uses `open_workspace_image` and its root containment check.
- App Store lane Settings hides Apple Local Assist-specific preference
  rows; Developer / GitHub lane can still expose those assist controls.

## Current Work Queue

Use `docs/current-work.md` for the active queue. The current highest
priority UX items are:

1. Manual accessibility smoke.
2. Help copy overlap cleanup.
3. `data:image` size wording alignment.

Recently completed: direct-open standalone file save now handles the
App Sandbox-style case where the selected file itself is writable but
creating `.hazakura-note.tmp` next to it is denied. Direct-open image
files now route to read-only image preview instead of text open failure
when no workspace is active. Workspace restore also preserves the last
good persisted state when a restore attempt produces an empty live
result, and standalone-file `saveActiveTab` is pinned for the
no-workspace case. L Mode table Backspace / Delete, table caret
movement coverage, floating-control focus visibility, encoding-only
dirty indication, WorkspaceTree rename markup, Markdown preview task
checkboxes, normal mode sidebar collapse / restore, App Store preview
startup, and sandboxed workspace bookmark restore are also complete for
v0.18.

Submission-prep items in the same queue include App Store
entitlement/signing lane definition, App Review Notes final copy,
Privacy Policy / metadata, third-party license packet review, and manual
accessibility smoke.

## Source Docs

- Current work: `docs/current-work.md`
- Current implementation state: `docs/current-status.md`
- Phase boundaries: `docs/roadmap.md`
- Product boundary: `docs/product-brief.md`
- Security boundary: `docs/security-boundary.md`
- Agent Workbench boundary: `docs/agent-workbench-boundary.md`
- Manual smoke: `docs/smoke-checklist.md`
- Release gates: `docs/source-release-checklist.md`,
  `docs/dmg-preview-checklist.md`, `docs/release-pre-check.md`
- v0.17 release evidence:
  `docs/releases/0.17.0-warning-expected-dmg-preview.release.md`

## Archive Notes

- v0.17 App Store-quality request packets and closeout evidence moved to
  `docs/archive/operations/app-store-v0.17/`.
- Older commercial-quality, authoring-readiness, and product-copy drafts
  moved to `docs/archive/planning/`.
- WorkspaceTree v0.17 accessibility decision moved to
  `docs/archive/reviews/workspace-tree-accessibility-decision-v0.17.md`.
- Historical release notes remain in `docs/releases/`.

## Boundaries To Preserve

- Safe Editor remains primary.
- Markdown/text source remains canonical.
- Do not add Git, LSP, terminal, arbitrary command execution, plugins,
  project-wide indexing, auto-apply, or auto-commit.
- Agent Workbench remains optional, allowlisted, one-session, no-restore,
  and outside the App Store lane.
- Do not move or replace published `v0.17.0` tags/assets silently.

## Verification Guidance

- Latest verified slice: `cargo fmt --manifest-path
  src-tauri/Cargo.toml -- --check`, `cargo test --manifest-path
  src-tauri/Cargo.toml`, focused frontend tests for Settings / Agent
  Workbench / Help / command palette, `npm run build:vite`, `npm run
  build`, App Store preview bundle metadata checks, helper-omission
  check, and `git diff --check` passed on 2026-06-11 after the App
  Store review display-name / settings polish.
- Latest packaged-app release evidence remains the v0.17
  warning-expected DMG preview; use the linked release note and
  release checklists before making distribution-readiness claims.
- For docs-only work, run `git diff --check`.
- For code changes, follow `docs/development-automation.md`.
- For UI behavior changes, update or exercise `docs/smoke-checklist.md`.
- Do not claim manual smoke passed unless it was actually exercised.
