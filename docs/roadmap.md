# Roadmap

Status: Operational
Scope: Active release lane and future planning boundaries
Authority: Medium
Last reviewed: 2026-06-13 (v0.20 UX planning)

## Current Position

`Hazakura Editor` is a Markdown-first safe editor. It is not an IDE,
Git client, general terminal, plugin platform, project analyzer, or
automatic agent-apply system.

Current release state:

- Latest published source / local-app release: `v0.19.0`.
- Latest published downloadable preview: `v0.18.0` warning-expected DMG preview.
- Current package/app version: `0.19.0`.
- Active lane: v0.19 App Store submission-candidate smoke and App
  Store submission prep.
- Current work queue: `docs/current-work.md`.

Historical phase details now live in release notes and archive files:

- `docs/releases/`
- `docs/archive/roadmaps/`
- `docs/archive/operations/app-store-v0.17/`

## Product Boundary

These boundaries stay active across roadmap changes:

- Safe Editor remains the primary product surface.
- Markdown/text source remains canonical.
- Default Safe Editor Mode has no general terminal, arbitrary command
  execution, Git client, LSP, plugin system, project-wide indexing,
  auto-apply, or auto-commit behavior.
- Agent Workbench is a separate Developer / GitHub lane trust boundary:
  explicit, consent-gated, allowlisted providers only, selected
  workspace root only, one active session, no restore, no auto-apply.
- Manual Review Desk entry points are hidden for the current App
  Store-oriented surface. Diff, recovery review, and Apple Local Assist
  edit review remain explicit, unsaved, and inspectable.
- Workspace file operations stay bounded to the selected workspace and
  must not become a full file manager.

## v0.18 UX Polish

Goal: make the current Safe Editor experience easier to use before
submission work hardens around it.

Use `docs/current-work.md` as the queue. The near-term UX priority is a
Core Safe Editor quality probe, with lightweight accessibility sanity
kept adjacent to the selected surface.

Recently completed:

- Help copy overlap cleanup: the in-app Privacy Policy now stays
  public-copy oriented, while Local Data Disclosure retains technical
  details such as workspace backup paths, preview/export routing, App
  Store lane omissions, and process/network boundaries.
- Auto-backup filename uniqueness: rapid snapshots for the same
  workspace file no longer overwrite each other within the same second;
  backup filenames now include milliseconds and a bounded collision
  suffix while recovery listing remains newest-first.
- Status bar encoding / line-ending de-duplication: normal Safe Editor
  mode removes duplicate passive `UTF-8` / `LF`-style detail values when
  the trailing encoding and line-ending dropdowns already expose those
  active values; L Mode keeps the passive detail because those controls
  are hidden.
- Direct save fallback failure safety: the sandbox-oriented direct write
  fallback now attempts to restore original bytes if a direct write or
  sync fails after partially changing the selected file, while keeping
  the normal atomic save path unchanged.
- App Store lane Move to Trash external-process review: the App Store
  lane now uses the native macOS Trash API instead of `osascript` /
  AppleEvents, with signed TestFlight smoke still tracked separately.
- Workspace persistence before App Review: repeated launch / relaunch
  and outside-active-tab restore are pinned by code-level regression
  tests, with signed TestFlight smoke still tracked separately.
- Encoding-only dirty indication and auto-backup coverage: `TabBar`
  and the auto-backup loop now share the same `isDirty()` contract
  used elsewhere, and `encoding` is part of the auto-backup
  signature so repeated ticks do not pile up duplicates.
- WorkspaceTree rename-state markup cleanup: the rename `<input>`
  is rendered as a non-button row instead of being nested inside
  the row `<button>`, avoiding a nested-interactive-control
  VoiceOver / focus / click / blur risk.
- Markdown preview task checkboxes: `- [ ]` and `- [x]` render as
  display-only task checkboxes in Preview without changing saved
  Markdown.
- Left workspace sidebar collapse / restore: normal mode has a
  reversible restore rail, while L Mode keeps its separate temporary
  workspace drawer.
- Pasted image decoded-size cap: `save_pasted_image` rejects decoded
  pasted image payloads above the existing 20 MB local image boundary
  before allocating the decoded buffer; status and docs distinguish this
  from the separate small `data:image` preview/export inline cap.
- About metadata finalization: the base Tauri bundle metadata now sets
  the macOS About publisher and copyright source inherited by the
  local helper-free App Store preview and other build lanes.

Out of scope for this lane:

- New product surfaces.
- Git, LSP, terminal, plugin, project-wide indexing, or arbitrary
  command behavior.
- Preview DOM editing, `contenteditable`, HTML saved model, hidden
  save-time rewriting, or broad WYSIWYG structural editing.
- Certificate, notarization, upload, or App Store account work unless
  explicitly picked from the submission-prep queue.

## App Store Submission Prep

Goal: prepare the reviewable App Store lane without mixing it with the
Developer / GitHub preview lane.

Use `docs/current-work.md` and `docs/app-store-build.md`.
Keep account-specific App Store Connect notes, certificate names,
signing identities, screenshots, contact details, and private reviewer
copy under ignored `docs/internal/` files.

Required work:

- Define the official App Store entitlement / signing / provisioning
  path.
- Finalize App Review Notes, Privacy Policy URL, support URL,
  screenshots, category, keywords, age rating, and metadata.
- Review complete third-party license material from lockfiles.
- Keep macOS About metadata verified in built App Store-lane bundles
  after config changes.
- Complete fuller TestFlight smoke, including workspace restore,
  image paste/drag-drop, dirty close, no external network observation,
  accessibility checks, and the App Store-lane Move to Trash decision.
- Capture pre-review regression evidence locally or in CI before
  submission; signing and Transporter can remain local account-bound
  steps.
- Confirm App Store lane omits CLI Agent / Agent Workbench execution
  surfaces, Apple Local Assist helper, and external AI/API calls.
- Keep all submitted-build claims tied to verified local or App Store
  Connect evidence.

Do not claim App Store signed, submitted, approved, TestFlight-ready,
Developer ID signed, notarized, or production-ready status until that
lane is actually completed and verified.

## v0.20 Sakura Workspace Ergonomics

Goal: refine the normal Safe Editor surface around the Sakura visual
language without turning the app into a file manager or IDE.

Use `docs/current-work.md` as the queue. Keep the first slice focused on
the existing Safe Editor chrome:

- Make the workspace sidebar collapse / restore control easier to find
  from the main chrome, while keeping the current file-tree model.
- Move the active file path context into a thin bottom full-path copy
  bar in the central editor pane, clipped safely for long paths.
- Strengthen Markdown preview hierarchy with card-like emphasis for
  important blocks, headings, code, and quote/readout areas.
- Use Sakura accenting to make the selected workspace file state clearer.
- Keep the bottom status bar concise: breadcrumb / position / file stats
  can be clarified, but do not reintroduce duplicate `UTF-8` / `LF`
  labels that are already exposed as controls.
- Keep New File on the existing menu, shortcut, command-palette, and
  workspace-file paths rather than a tab-row `+` affordance.

Explicitly deferred:

- Workspace switching dropdowns. The simple single-workspace model is
  still preferable until a later UX pass proves the extra state is worth
  the complexity.
- Multi-workspace sessions, background indexing, Git status, LSP,
  terminal, plugin, or arbitrary command behavior.

First slice status: implemented locally on 2026-06-13 with focused
React/CSS coverage, `npm run build:vite`, and `npm run test`; the
tab-row new-file `+` affordance was removed after visual review on
2026-06-14.

v0.21+ follow-up: the v0.20 compact status detail is a stopgap. A later
UX slice should split status metadata into priority-aware fields instead
of one long `statusDetail` string, keep line-ending / encoding controls
always reachable, and move lower-priority document details into hover,
popover, or adaptive secondary display.

## Distribution Lanes

Current preview releases are warning-expected DMG previews unless the
user opens a different lane.

The intended stable distribution shape remains two public binary lanes:

- App Store build: Safe Editor + L Mode + Diff / explicit change review,
  without External Agent Workbench, CLI launch, Apple Local Assist helper,
  or external AI/API calls.
- Developer / GitHub build: the same base plus optional Apple Local
  Assist and Agent Workbench for allowlisted local CLI providers.

Use:

- Source-preview release rules: `docs/source-release-checklist.md`
- Warning-expected DMG rules: `docs/dmg-preview-checklist.md`
- Final release hygiene: `docs/release-pre-check.md`
- Release-note evidence: `docs/releases/`

Developer ID signing, notarization, updater work, installer packaging,
and stable distribution remain explicit future distribution-lane work.

## Future Product Direction

Keep future product work source-preserving and narrow:

- L Mode: continue improving readability and editing stability through
  CodeMirror decorations, widgets, CSS, and focused editing behavior.
  Use `docs/l-mode-plan.md`.
- Apple Local Assist: keep it as an explicit, on-device, availability-
  gated writing companion with unsaved, diff-reviewable edits. Use
  `docs/assist-surface-strategy.md` and
  `docs/apple-local-assist-writing-companion-plan.md`.
- e-book Mode / EPUB export: keep it as a Markdown-source-preserving
  EPUB simulation and explicit export direction for v0.21+. Use
  `docs/ebook-mode-epub-export-plan.md`.
- Native macOS appearance: explore a more native-feeling macOS 26+
  interface, with macOS 27 treated as a future verification target. Use
  `docs/native-macos-appearance-plan.md`.
- Agent Workbench: keep it optional, allowlisted, one-session, no-restore,
  and outside the App Store lane. Use `docs/agent-workbench-boundary.md`.

Any broader WYSIWYG editing model, database-like workspace layer,
collaboration feature, updater, plugin system, or automated agent-apply
flow needs a fresh product-boundary decision before implementation.
