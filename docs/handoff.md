# Handoff

Status: Operational
Scope: Short handoff for the next coding agent
Authority: Medium
Last reviewed: 2026-06-11 (v0.18 UX polish slices)

## Current State

- `hazakura editor` is at `0.17.0`.
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

## Current Work Queue

Use `docs/current-work.md` for the active queue. The current highest
priority UX items are:

1. WorkspaceTree rename-state markup cleanup.
2. Encoding-only dirty indication / auto-backup coverage.

Recently completed: Markdown preview task checkboxes now render
`- [ ]` / `- [x]` as display-only checkbox glyphs in Preview without
changing saved Markdown.
Left workspace sidebar collapse / restore is also complete in normal
mode without changing the file-tree model.
App Store preview packaged-app smoke now renders the start screen
instead of a blank WebKit surface.

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

- Latest verified slice: `npm test`, `npm run build`, `codesign
  --verify --deep --strict --verbose=2`, entitlement inspection,
  embedded asset string inspection, packaged-app launch/log smoke, and
  `git diff --check` passed on 2026-06-11 after the Markdown preview
  checkbox, Help-doc drift, workspace sidebar collapse, and App Store
  preview black-screen fixes. A Vite/browser smoke also confirmed
  normal-mode sidebar collapse / restore DOM state.
- For docs-only work, run `git diff --check`.
- For code changes, follow `docs/development-automation.md`.
- For UI behavior changes, update or exercise `docs/smoke-checklist.md`.
- Do not claim manual smoke passed unless it was actually exercised.
