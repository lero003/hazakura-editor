# Handoff

Status: Operational
Scope: Short handoff for the next coding agent
Authority: Medium
Last reviewed: 2026-06-12 (v0.18 release prep)

## Current State

- `Hazakura Editor` is at `0.18.0`.
- User-facing app identity is capitalized as `Hazakura Editor`. The
  App Store preview bundle is `Hazakura Editor.app`; current docs and
  smoke paths should use that name rather than the older lowercase
  display form.
- Latest published downloadable preview is `v0.18.0` warning-expected DMG preview.
- `v0.18.0` is ad-hoc signed, not Developer ID signed, not notarized, and expected to show macOS security warnings.
- Current active lane is v0.18 follow-up polish and App Store submission prep.
- Start from `docs/current-work.md`.
- Markdown preview task checkboxes are complete for v0.18: Preview renders
  `- [ ]` / `- [x]` as inert display-only checkbox glyphs without
  changing saved Markdown.
- Normal mode workspace sidebar collapse / restore is complete for
  v0.18. L Mode still owns its separate temporary file-tree drawer.
- App Store preview packaging remains helper-free: `frontendDist` is
  explicit in the App Store configs and the sandbox entitlement includes
  `com.apple.security.network.client` for the Tauri/WebKit runtime.
  In the v0.18 release-prep session, `open -n` on the ad-hoc App Store
  preview bundle failed with `RBSRequestErrorDomain Code=5`; the
  Developer / GitHub lane app and mounted DMG app launched. Treat
  App Store-lane launch as a separate submission-prep follow-up.
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
- Generated macOS app bundles now include repository-root `LICENSE`
  and `THIRD_PARTY_NOTICES.md` under `Contents/Resources/`.
  `scripts/probe-macos-distribution.sh` verifies those files for the
  App Store lane.

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

Submission-prep items in the same queue include App Store Connect /
TestFlight validation, App Review Notes final copy, Privacy Policy /
metadata, final third-party notice content review, and manual
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
- v0.18 release evidence:
  `docs/releases/0.18.0-warning-expected-dmg-preview.release.md`

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
- Do not move or replace published `v0.18.0` tags/assets silently.

## Verification Guidance

- Latest release-prep slice: v0.18 version surfaces are aligned across
  npm, Tauri, Cargo, Help About, Support Diagnostics, current docs, and
  release notes. The v0.18 warning-expected DMG prerelease was
  published and remote-verified on 2026-06-12; use the v0.18 release
  note and release checklists before making broader
  distribution-readiness claims.
- For docs-only work, run `git diff --check`.
- For code changes, follow `docs/development-automation.md`.
- For UI behavior changes, update or exercise `docs/smoke-checklist.md`.
- Do not claim manual smoke passed unless it was actually exercised.
