# Handoff

Status: Operational
Scope: Short handoff for the next coding agent
Authority: Medium
Last reviewed: 2026-06-12 (v0.18 Help copy overlap cleanup)

## Current State

- `Hazakura Editor` is at `0.18.0`.
- User-facing app identity is capitalized as `Hazakura Editor`. The
  App Store preview bundle is `Hazakura Editor.app`; current docs and
  smoke paths should use that name rather than the older lowercase
  display form.
- Latest published downloadable preview is `v0.18.0` warning-expected DMG preview.
- `v0.18.0` is ad-hoc signed, not Developer ID signed, not notarized, and expected to show macOS security warnings.
- The helper-free App Store lane delivered `0.18.0` build `4` to
  TestFlight on 2026-06-12 with no reported Apple validation warnings;
  basic TestFlight launch / save smoke passed.
- Current active lane is v0.18 pre-review bug fixing, fuller
  TestFlight smoke, and App Store submission prep.
- Start from `docs/current-work.md`.
- Markdown preview task checkboxes are complete for v0.18: Preview renders
  `- [ ]` / `- [x]` as inert display-only checkbox glyphs without
  changing saved Markdown.
- Normal mode workspace sidebar collapse / restore is complete for
  v0.18. L Mode still owns its separate temporary file-tree drawer.
- App Store preview packaging remains helper-free: `frontendDist` is
  explicit in the App Store configs. `npm run build` skips App Store
  sandbox entitlements so the generated `Hazakura Editor.app` can launch
  for local smoke. Use `npm run smoke:macos-sandbox-preview` or the signed
  submit / TestFlight lane for sandbox-entitlement proof.
- Sandboxed workspace restore stores an app-scoped security-scoped
  bookmark for user-selected workspace folders and resolves it on
  restart. Older path-only state can still fall back to the
  reauthorization status hint.
- TestFlight use found workspace persistence follow-ups before App
  Review. Code-level regression coverage now pins repeated relaunch and
  outside-active-tab restore behavior; signed TestFlight fuller smoke
  still needs to repeat the user-facing flow before App Review.
- TestFlight use found one status-area cleanup follow-up before App
  Review. Code-level UI coverage now removes duplicate passive
  `UTF-8` / `LF` style labels in normal Safe Editor mode while
  preserving the dropdown controls and dirty/save status affordances.
- External-window routing for Markdown / Help links is implemented:
  Preview, Help documents, and Support Diagnostics intercept explicit
  `http:` / `https:` / `mailto:` / `tel:` clicks before WebView
  navigation and hand them to a bounded external-open Tauri command.
  Workspace-relative supported text links still open inside the app;
  unsafe schemes and unsupported/local-outside targets stay blocked.
- App Store-lane Move to Trash external-process review is implemented:
  `move_workspace_entry_to_trash` now calls native macOS
  `NSFileManager` Trash handling from Rust through the existing
  `objc2` / `NSURL` bridge. It no longer launches `osascript` or relies
  on AppleEvents. Signed TestFlight smoke still needs to confirm the
  user flow before App Review.
- External static review also promoted direct save fallback failure
  coverage for the truncate-and-write path used when sandboxed temp-file
  creation is denied. Pasted image decoded-size guarding is now complete:
  pasted PNG/JPEG/GIF/WebP data is rejected above the 20 MB decoded
  image boundary before allocation.
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
- Pre-review regression evidence is archived at
  `docs/archive/operations/v0.18-pre-review-regression-evidence-2026-06-12.md`.
  The local gates passed after one transient Rust full-test failure was
  cleared by focused and full reruns.

## Current Work Queue

Use `docs/current-work.md` for the active queue. The current highest
priority UX items are:

1. Tab close affordance clarity.
2. Core Safe Editor quality probe.
3. Light accessibility sanity adjacent to the selected core surface.

Recently completed: External-window routing for Markdown / Help links
now keeps workspace-relative text links in-app while handing explicit
external URL clicks to the OS default browser/app. Help copy overlap
cleanup now keeps the in-app Privacy Policy public-copy oriented while
Local Data Disclosure owns technical implementation details such as
workspace backup paths and preview/export routing. Auto-backup filenames
now stay unique for rapid
same-second snapshots by adding millisecond precision and a bounded
collision suffix while keeping recovery listing newest-first.
Direct-open standalone file save now handles the
App Sandbox-style case where the selected file itself is writable but
creating `.hazakura-note.tmp` next to it is denied. Direct-open image
files now route to read-only image preview instead of text open failure
when no workspace is active. Workspace restore also preserves the last
good persisted state when a restore attempt produces an empty live
result, and standalone-file `saveActiveTab` is pinned for the
no-workspace case. L Mode table Backspace / Delete, table caret
movement coverage, floating-control focus visibility, encoding-only
dirty indication, WorkspaceTree rename markup, Markdown preview task
checkboxes, pasted image decoded-size guarding, normal mode sidebar
collapse / restore, App Store preview startup, and sandboxed workspace
bookmark restore are also complete for v0.18.

Submission-prep items in the same queue include fuller TestFlight smoke,
App Review Notes final copy, Privacy Policy / metadata, and remaining
account-bound App Review evidence. External review notes worth preserving:
prepare reviewer-note answers for `network.client`, inert script-like
file associations, App Store lane omissions, and Move to Trash; do not
treat low-risk icon size, known Vite chunk warnings, or Help copy
overlap as blockers unless they reproduce as concrete review or
usability failures.

Recurring automation should use `docs/current-work.md`'s
`Pre-Review Automation Order` before the generic automation preference
list. Each run should pick exactly one open slice and close it as
`implemented`, `manual-blocked`, or `verified no-op`.

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
  published and remote-verified on 2026-06-12. The helper-free
  App Store lane also reached TestFlight as `0.18.0` build `4` with no
  reported Apple validation warnings, and basic launch / save smoke
  passed. Use the v0.18 release note, `docs/app-store-build.md`, and
  release checklists before making broader distribution-readiness
  claims.
- For docs-only work, run `git diff --check`.
- For code changes, follow `docs/development-automation.md`.
- For UI behavior changes, update or exercise `docs/smoke-checklist.md`.
- Do not claim manual smoke passed unless it was actually exercised.
- Current known local worktree caveat: a pre-existing
  `src-tauri/tauri.conf.appstore.json` `bundleVersion` bump to `6` may
  remain unstaged; do not fold it into unrelated quality slices unless
  the App Store lane explicitly asks for that build-number change.
