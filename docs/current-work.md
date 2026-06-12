# Current Work

Status: Operational
Scope: Active v0.19 App Store submission-candidate smoke and submission-prep routing
Authority: High
Last reviewed: 2026-06-12

## Purpose

Start here when choosing the next small `Hazakura Editor` slice.
This file is the current work queue. Older v0.17 App Store-quality
request packets and closeout evidence live under
`docs/archive/operations/app-store-v0.17/`, and the completed v0.18
pre-review automation slices remain below as historical evidence for
the current v0.19 submission candidate.

Keep every slice small, verifiable, and inside the Markdown-first Safe
Editor boundary.

## Product Boundary

- Safe Editor remains primary.
- Markdown/text source remains canonical.
- Do not add Git, LSP, terminal, arbitrary command execution, plugins,
  project-wide indexing, auto-apply, or auto-commit.
- Workspace file operations stay bounded to the selected workspace.
- Agent Workbench remains a separate, explicit Developer / GitHub lane
  trust boundary and is not part of the App Store lane.

## Automation Slice Protocol

Use this section for recurring or unattended pre-review automation.

- Pick exactly one slice from the Pre-Review Automation Order table.
- Prefer the first open slice whose required environment is available.
- Keep the slice inside its named files/surface; do not bundle nearby
  polish.
- Before code changes, write or identify the focused regression/smoke
  that proves the issue.
- End each run as one of:
  - `implemented`: code/docs changed and the listed checks passed.
  - `manual-blocked`: the next proof needs the user's Mac, TestFlight,
    App Store Connect, certificate, or accessibility setting.
  - `verified no-op`: inspection showed no useful small change is safe
    or necessary.
- Update this file, `docs/smoke-checklist.md`, or `docs/handoff.md`
  only when the state, evidence, or next slice actually changes.

## Pre-Review Automation Order

| Order | Slice | Run Type | Automation Exit |
|---|---|---|---|
| 1 | App Store lane Move to Trash external-process review | Code / lane decision | `implemented`: App Store lane uses native Trash or cannot reach Move to Trash; focused Rust/UI tests pass; TestFlight smoke item remains if local signing is unavailable. `manual-blocked`: only signed TestFlight proof remains. |
| 2 | Workspace persistence before App Review | Code / TestFlight smoke | `implemented`: repeated launch/relaunch and outside-active-tab restore are covered by regression tests and local app evidence where possible. `manual-blocked`: signed TestFlight proof remains. |
| 3 | Pasted image decoded-size cap / `data:image` wording | Code + docs | `implemented`: oversized pasted payloads are rejected before unsafe memory growth, normal image paste still works, user-facing copy/docs match decoded-byte policy. |
| 4 | Direct save fallback failure safety | Code / test | `implemented`: failure-injection coverage proves direct fallback failures leave edits dirty/recoverable and do not report success; recovery is improved only if the test proves it is needed. |
| 5 | Status bar encoding / line-ending de-duplication | UI polish | `implemented`: duplicate passive `UTF-8` / `LF` labels are removed while dropdown controls, dirty/save state, and compact layout remain intact. |
| 6 | Core Safe Editor quality probe | Focused investigation / small fixes | `implemented`: one high-risk basic surface such as open/save/close, restore/recovery, preview, diff/review, workspace files, standalone files, image handling, keyboard/IME, or error recovery is inspected and any discovered narrow issue is fixed with focused proof. `verified no-op`: focused inspection finds no useful small fix. |
| 7 | Third-party license packet | Docs / release prep | `implemented`: notices are refreshed/reviewed against `package-lock.json` and `src-tauri/Cargo.lock`, bundled-resource probe passes, and any required upstream notices are included. |
| 8 | About metadata finalization | Config / bundle smoke | `implemented`: Tauri bundle metadata or documented canonical About surface is finalized and built-bundle About behavior is verified. |
| 9 | Pre-review regression evidence | CI or local evidence | `implemented`: either a small CI workflow exists or local release-readiness evidence is archived for the listed commands; signing/Transporter remain local account-bound. |
| 10 | Auto-backup filename uniqueness | Code / verified no-op | `implemented`: same-second backup collision is reproduced and fixed. `verified no-op`: focused inspection cannot reproduce a realistic overwrite risk. |
| 11 | Light accessibility sanity | Manual smoke / adjacent fixes | Keep as a lightweight pass only: keyboard reachability, focus escape/Tab behavior, readable labels, and obvious contrast on the selected core surface. Defer live VoiceOver / Increase Contrast depth unless the user's Mac is available or a concrete issue appears. |
| 12 | Help copy overlap cleanup | Product copy | Keep for human/Codex review unless explicitly assigned with tight wording constraints. |

Order 1 is implemented as of 2026-06-12. Order 2 is implemented at the
code-regression level as of 2026-06-12. Order 3 is implemented as of
2026-06-12. Order 4 is implemented as of 2026-06-12. Order 5 is
implemented as of 2026-06-12. Order 6 is implemented as of 2026-06-12
through the Recent Files surface-removal core probe. Order 7 is
implemented as of 2026-06-12. Order 8 is implemented as of
2026-06-12. Order 9 is implemented as of 2026-06-12 through archived
local regression evidence. Order 10 is implemented as of 2026-06-12.
Order 11 is implemented as of 2026-06-12 through the Help-document
scroll-region keyboard reachability pass.
Order 12 is implemented as of 2026-06-12 through a focused Privacy
Policy / Local Data Disclosure role-split copy pass.
The remaining Move
to Trash and workspace-persistence proofs are signed TestFlight smoke,
tracked under the submission-prep manual smoke items unless TestFlight
specifically reopens the Trash or workspace restore behavior. The
pre-review automation table is currently exhausted; the next recurring
quality run should use the Active UX Queue, starting with one Core Safe
Editor quality probe whose risk hypothesis can be inspected or smoked.

## Active UX Queue

Pick one item at a time.

| Priority | Slice | Acceptance |
|---|---|---|
| P1 | Core Safe Editor quality probe | When concrete queue items are exhausted, inspect one basic high-risk surface instead of adding broad tests: open/save/close, restore/recovery, preview, diff/review, workspace file operations, standalone files, image handling, keyboard/IME, or error recovery. State the risk hypothesis, run a focused source/app inspection or smoke, then either fix the smallest issue found or close as `verified no-op`. |
| P2 | Light accessibility sanity | Keep accessibility as a light sanity pass adjacent to core surfaces: keyboard reachability, focus escape/Tab behavior, readable labels, and obvious contrast. Do not prioritize broad accessibility audits over basic editor quality unless a concrete accessibility failure is observed. |

## External-Agent Friendly Queue

Use this when handing work to an external implementation agent. Prefer
debugging, small implementation fixes, and evidence-backed refactors
over copy-heavy or product-voice-sensitive work.

| Fit | Candidate | Scope |
|---|---|---|
| Good | L Mode quality investigation | Pick one reproduced L Mode issue or one measurable quality gap only: caret, IME, Backspace/Delete, hidden markers, lists, dividers, links, tables, images, visual overlap, source preservation, or performance baseline. Do not add a new editing model or contenteditable surface. |
| Good | Theme quality investigation | Pick one concrete theme issue only: contrast, focus visibility, status/error readability, dialog readability, or Increase Contrast behavior. Do not redesign palettes or add theme customization. |
| Good | Core Safe Editor quality probe | Inspect one basic surface with a clear risk hypothesis, then fix only a reproduced issue or close as `verified no-op`. Prefer open/save/close, restore/recovery, preview, diff/review, workspace files, standalone files, image handling, keyboard/IME, or error recovery. |
| Good | Focused refactor for a verified bug | Refactor only when it directly fixes or tests one observed user-facing problem. Keep ownership boundaries and public behavior stable. |
| Poor fit | Help copy overlap cleanup | This is product voice and submission copy work. Keep it for human/Codex review unless explicitly assigned with tight wording constraints. |
| Poor fit | Broad accessibility audit | Keep accessibility to lightweight sanity checks adjacent to core surfaces unless a concrete failure is observed or the user's Mac is available for live VoiceOver / Increase Contrast work. |

## Completed v0.18 Slices

- 2026-06-12: Core Safe Editor preview/export CSS variable guard is
  implemented. Export HTML and Print to PDF standalone preview HTML now
  define the `--status-bg` / `--status-text` variables used by the live
  Markdown preview CSS for code blocks and blocked-image placeholders,
  so exported documents do not silently lose those preview colors. A
  focused `useDocumentExport` regression test pins the exported HTML
  variable contract without changing Markdown rendering, save behavior,
  or preview link routing.
- 2026-06-12: Core Safe Editor malformed external Markdown link
  guard is implemented. Preview / Help external-link normalization now
  rejects `http:` / `https:` links that omit the explicit `//host`
  separator before they can be handed to the OS external-open path,
  matching the existing Rust command boundary. Workspace-relative
  Markdown links, allowed external links, unsafe-scheme blocking, and
  in-app text-open routing remain unchanged.
- 2026-06-12: Tab close affordance clarity is implemented. Text-file
  tabs and image-preview tabs now expose the close control as a stable
  `x` button rather than a plain circular mark, while retaining the
  existing tab selection, dirty-dot, keyboard navigation, and
  `aria-label` behavior. Focused component coverage pins the text and
  image close controls plus dirty-tab description, and focused CSS
  coverage keeps the close affordance distinct from the dirty dot.
- 2026-06-12: External-window routing for Markdown / Help links is
  implemented. Markdown preview clicks still open supported
  workspace-relative text links inside the app, while explicit
  `http:` / `https:` / `mailto:` / `tel:` clicks from Preview, Help
  documents, and Support Diagnostics are intercepted before WebView
  navigation and routed through a bounded Tauri external-open command.
  Unsupported files, absolute paths, workspace-outside links, and unsafe
  schemes remain blocked; focused frontend tests pin Preview, Help,
  Diagnostics, local-link preservation, and unsafe-scheme behavior, and
  Rust tests pin the command allowlist.
- 2026-06-12: Core Safe Editor image-preview close regression
  coverage is implemented. A focused `useImagePreview` test now pins
  that closing a directly opened standalone image preview clears the
  image surface and returns to the previous text tab, preserving the
  read-only image-preview-as-tab contract without changing workspace
  file operations or save behavior.
- 2026-06-12: Help copy overlap cleanup is implemented as a
  narrow Privacy Policy / Local Data Disclosure role split. The in-app
  Privacy Policy now stays public-copy oriented, avoids the
  `.hazakura/backups/...` implementation path and `fetch` wording, and
  points to local preferences plus optional recovery / backup data at a
  high level. Local Data Disclosure keeps the technical storage,
  preview/export, App Store lane, and network/process detail. Focused
  Help-pane coverage pins that the Privacy Policy does not absorb the
  technical disclosure details again.
- 2026-06-12: Light accessibility sanity is implemented as a narrow
  Help-surface pass. The Privacy Policy / Local Data Disclosure / About
  / Open Source Acknowledgements Help documents and the Support
  Diagnostics pane now expose their long body scroll container as a
  named `region` with `tabIndex=0`, so keyboard-only users can focus
  the scroll area before reading or paging through long Help text.
  Focused tests pin both the read-only Help shell and diagnostics JSON
  shell. Live VoiceOver and Increase Contrast checks remain manual
  smoke items on the user's Mac rather than code-level claims.
- 2026-06-12: Auto-backup filename uniqueness is implemented.
  Focused Rust regression coverage reproduced same-second snapshot
  overwrite risk for a single workspace file. Backup filenames now
  include milliseconds and use a bounded numeric suffix only when a
  same-name file already exists, so rapid snapshots remain distinct
  while staying under `.hazakura/backups/<relative-path>/`. Recovery
  listing remains newest-first, with filename tie-breaking for
  same-timestamp files.
- 2026-06-12: Pre-review regression evidence is archived in
  `docs/archive/operations/v0.18-pre-review-regression-evidence-2026-06-12.md`.
  The local gate pass includes `npm ci`, `npm run build:vite`,
  `npm test`, `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`,
  `cargo test --manifest-path src-tauri/Cargo.toml`, `npm audit`,
  `cargo audit -f src-tauri/Cargo.lock`, `npm run build`, and the
  macOS distribution probe. The first Rust full-test run had one
  transient Agent Workbench PATH propagation failure; the focused rerun
  and a full rerun passed, so this remains evidence to watch rather than
  a product bug claim. Signed TestFlight smoke, App Review submission,
  and account-bound distribution proof remain separate.
- 2026-06-12: About metadata finalization is implemented. The base
  Tauri config now sets `bundle.publisher` to `Hazakura Lab` and
  `bundle.copyright` to
  `Copyright (c) 2026 Hazakura Lab. All rights reserved.`, so the
  macOS About panel built from `src-tauri/src/menu.rs` has canonical
  publisher and copyright data across inherited build lanes. The local
  helper-free App Store preview bundle's `Info.plist` now includes
  `NSHumanReadableCopyright` with the expected value.
- 2026-06-12: Third-party license packet refresh is implemented for
  the current lockfiles. `THIRD_PARTY_NOTICES.md` now records the
  2026-06-12 `package-lock.json` runtime scan result, the
  `cargo metadata --locked` refresh command, and an appendix for
  resolved Cargo graph entries that were present in the lockfile graph
  but not previously named explicitly. The packaged app-bundle notice
  surface remains `LICENSE` plus `THIRD_PARTY_NOTICES.md`; final legal
  review, full license text packet decisions, and icon source
  provenance remain distribution-review tasks rather than app behavior
  changes.
- 2026-06-12: Recent Files surface removal is implemented as the Order
  6 Core Safe Editor quality probe. The misleading file-level recent
  surface no longer appears on the start panel or native File menu, and
  legacy `hazakura-note-recent-files` localStorage entries are removed
  on read/write instead of being migrated forward. `Recent Folders`,
  explicit Open / Open Folder, workspace restore, standalone-file open,
  and normal save paths remain unchanged. README, Help privacy copy, and
  the workspace-file smoke wording now refer only to retained recent
  folder behavior where applicable.
- 2026-06-12: Status bar encoding / line-ending de-duplication is
  implemented. In normal Safe Editor mode, the passive status detail now
  removes the active tab's currently selected `UTF-8` / `LF`-style
  format values because the trailing encoding and line-ending dropdowns
  already expose and change those values. The full detail remains in the
  hover title, the dropdown controls remain visible, and L Mode keeps
  the previous passive detail because those focusable controls are hidden
  there. Focused `StatusBar` coverage pins the normal-mode de-duplication
  while keeping the dirty/save live region and L Mode control removal
  intact.
- 2026-06-12: Direct save fallback failure safety is implemented.
  The App Sandbox direct-file fallback still only runs when the normal
  atomic temp-file path cannot create the temp file with
  `PermissionDenied`, but that direct path now reads the original bytes
  before truncating. If the direct write or sync fails after a partial
  write, it attempts to restore the original bytes before returning an
  error, so the frontend keeps the tab dirty/recoverable and never sees
  a successful save response. Focused Rust failure-injection coverage
  pins both successful original-byte restoration and the honest
  restore-failed error path; the existing direct fallback success test
  remains green.
- 2026-06-12: App Store lane Move to Trash external-process review is
  implemented. `move_workspace_entry_to_trash` now calls the native
  macOS `NSFileManager` Trash API from Rust through the existing
  `objc2` / `NSURL` bridge instead of launching `osascript` or relying
  on AppleEvents. Workspace containment checks, main-window label
  gating, destructive confirmation UI, and auto-backup cleanup remain
  unchanged. Focused Rust coverage for the trash happy path, missing
  path, outside-workspace rejection, Agent Window label rejection, and
  auto-backup cleanup passes. Signed TestFlight smoke still needs to
  confirm the App Store-lane user flow before App Review.
- 2026-06-12: Workspace persistence before App Review is implemented
  at the code-regression level. Focused inspection confirmed the
  repeated launch / relaunch path is pinned by
  `useWorkspaceStatePersistence.test.ts`, while the outside-active-tab
  and partial-restore path is covered across
  `useWorkspaceStatePersistence.test.ts`, `useWorkspaceRestore.test.ts`,
  and `storage.test.ts`. A follow-up regression now covers the
  "launch, restore state arrives, immediately quit before the restore
  latch settles" path: clean app-exit persistence may flush when live
  tabs or a live workspace root are already present, but still skips the
  truly empty pre-restore state so the last good bookmark is not erased.
  The focused command
  `npm run test -- src/hooks/workspace/useWorkspaceStatePersistence.test.ts src/hooks/workspace/useWorkspaceRestore.test.ts src/lib/storage.test.ts src/hooks/app/useAppExitConfirmation.test.tsx`
  passes with 4 files / 39 tests. Signed TestFlight smoke still needs to
  repeat the user-facing workspace-retention flow before App Review.
- 2026-06-12: Pasted image decoded-size cap / `data:image` wording is
  implemented. `save_pasted_image` now computes the decoded base64 byte
  length before allocating the decoded buffer and rejects pasted images
  above the existing 20 MB image boundary with a user-visible status
  reason. Normal PNG paste and drag/drop image import still write
  supported files into `assets/` through the existing hash-based naming
  and workspace containment checks. README and Help copy now distinguish
  pasted decoded image bytes from the separate small `data:image`
  preview/export inline cap.
- 2026-06-11: Workspace restore / standalone save regression slice.
  `useWorkspaceStatePersistence` no longer overwrites the
  user's last good persisted state when the restore latch
  flips to `true` with an empty live result
  (`tabs = []`, `workspaceRootPath = null`). The
  sandbox-loss / moved-folder / missing-file path now
  preserves the persisted state, including the
  security-scoped bookmark, so the next launch can
  re-attempt the restore or the start panel can
  re-authorize the same folder. Already-empty persisted
  state remains unaffected.
  A new unit suite (`useWorkspaceStatePersistence.test.ts`)
  pins the new contract across five cases:
  pre-restore, empty-restore with non-empty storage,
  bookmark-only storage, already-empty storage, and
  post-restore mirroring. A new
  `useSaveActions` test
  (`saveActiveTab saves a dirty standalone file when
  no workspace is open`) pins the standalone-file
  save path so a future refactor cannot silently
  short-circuit `save_text_file` for tabs that were
  opened outside a workspace. The `useWorkspaceRestore`
  and `useSaveActions` test suites stay green; `npm
  test` and `npm run build:vite` pass.
- 2026-06-11: Direct-open standalone file save fallback.
  `save_text_file` now keeps the normal atomic temp-file replace path,
  but falls back to direct existing-file write when the temp file cannot
  be created with `PermissionDenied`. This preserves the App Sandbox /
  direct file-picker case where the user-selected file itself is
  writable but creating a sibling `.hazakura-note.tmp` file is not.
  Directly opened local image files now route to read-only image preview
  without requiring an active workspace, while workspace file-tree image
  previews still use the workspace-root containment check. Existing-temp-
  file clobber protection is unchanged.
- 2026-06-11: L Mode table Backspace / Delete now preserves
  normal Markdown semantics: a selection that is strictly
  inside a single cell (e.g. a double-clicked word) falls
  through to the standard CodeMirror handler, while an
  explicit whole-body-line selection still triggers the
  row delete shortcut. Tests pin both shapes; the existing
  v0.18 `MoveToTrashConfirmDialog`, encoding-only dirty,
  preview task checkboxes, left-sidebar restore rail,
  preview startup, sandboxed bookmark restore, and
  `WorkspaceTree` rename DOM slices stay green.
- 2026-06-11: `MoveToTrashConfirmDialog` now follows the same
  focus-management pattern as the v0.7 dirty-tab / app-close
  dialogs: it owns a dialog ref and a Cancel button ref, the
  central `useDialogInitialFocus` lands focus on the Cancel
  button on open, the central `useModalKeyboardGuard` traps
  Tab / Shift+Tab inside the dialog, and Escape routes to
  `cancelPendingTrash`. The dialog copy, visual styling,
  Tauri command, workspace path validation, and trash
  execution logic are unchanged. New tests cover the
  component (`MoveToTrashConfirmDialog.test.tsx`), the focus
  hook (`useDialogInitialFocus.test.tsx`), and the keyboard
  guard (`useModalKeyboardGuard.test.tsx`); the existing
  dirty-tab / app-close / preferences Esc + Tab behaviour
  stays pinned.
- 2026-06-11: Encoding-only dirty indication is now consistent across
  the shared `isDirty()` contract, `TabBar`, and the auto-backup
  loop. Encoding-only changes surface the TabBar dirty dot and
  accessible "unsaved" description and are eligible for auto-backup
  with `encoding` included in the backup signature so repeated
  ticks do not pile up duplicates. The actual byte rewrite still
  happens on the next save via the encoding selector.
- 2026-06-11: Markdown preview task checkboxes now render `- [ ]` and
  `- [x]` as inert display-only checkbox glyphs in Preview. Saved
  Markdown remains unchanged; task items suppress the normal list marker
  so the checkbox glyph does not overlap. Focused preview tests and
  smoke checklist coverage were updated.
- 2026-06-11: Normal mode can collapse and restore the left workspace
  sidebar through a visible restore rail. The file-tree model is
  unchanged, and L Mode continues to own its separate temporary
  workspace drawer.
- 2026-06-11 / 2026-06-12: App Store preview builds no longer open to a
  blank WebKit surface. The helper-free App Store configs keep
  `frontendDist: "../dist"`. A later ad-hoc App Store preview carrying
  sandbox entitlements failed with `RBSRequestErrorDomain Code=5`, while
  the Developer / GitHub app and mounted DMG app launched. `npm run build`
  now produces a launchable helper-free local smoke bundle and leaves
  App Store sandbox entitlement proof to
  `npm run smoke:macos-sandbox-preview` or the signed submit / TestFlight
  lane.
- 2026-06-11: Restarting a sandboxed preview can restore a selected
  workspace through an app-scoped security-scoped bookmark. Older
  path-only state still skips stale folder paths without a global error
  and surfaces the existing reauthorization status hint.
- 2026-06-11: `WorkspaceTree` rename state is rendered as a
  non-button row instead of nesting the rename `<input>` inside
  the row `<button>`, avoiding a nested-interactive-control
  VoiceOver / focus / click / blur risk flagged in
  `docs/archive/reviews/workspace-tree-accessibility-decision-v0.17.md`.
  Normal file and directory rows still keep the button-based
  model; `Enter` / `Escape` / `blur` behavior and the
  auto-focus + select on entry are preserved. Existing v0.17
  pinned tests (aria-expanded, loading disabled state, rename
  Enter / Escape / blur, compare Escape with and without
  rename, empty-area click, file / directory context menu,
  target-directory drop) stay green, and three new tests pin
  the non-button rename DOM, the auto-focus + select on
  entry, and the directory rename row shape.

## Submission-Prep Queue

These are not ordinary UX polish and may require human account,
certificate, or App Store Connect access.

| Priority | Slice | Acceptance |
|---|---|---|
| P0 | TestFlight / App Store Connect validation | The helper-free App Store submit lane is defined in `docs/app-store-build.md`. 2026-06-12 evidence: the signed `HazakuraEditor-0.18.0-mas.pkg` upload reached TestFlight distribution with no reported Apple validation warnings, and basic TestFlight launch / save smoke passed. Current candidate: `0.19.0` with App Store build counter `7`. Human-side smoke on 2026-06-12 passed launch, basic document creation/open, preview/export, image paste/drag/drop, App Store surface omission, and dirty-close confirmation, but left Save As UX, workspace restore, Move to Trash, network observation, and live accessibility checks partial or unconfirmed. Remaining proof before broader App Store-ready claims: upload / Apple validation for the `0.19.0` candidate, fuller manual smoke on the resulting TestFlight build, final metadata, and App Review submission / approval evidence. The earlier ad-hoc App Store preview `open -n` failure remains non-blocking unless it reproduces on the signed TestFlight build. |
| P1 | App Review Notes final copy / attachments | Private review-note draft and store-copy material exist outside the public docs. Final pass should attach screenshots or reviewer evidence as needed, keep account/contact-specific text out of tracked docs, and preserve the App Store lane omission claim for CLI Agent / Agent Workbench / Apple Local Assist. Prepare concise reviewer-note answers for the non-obvious App Store lane facts: `network.client` exists for Tauri/WebKit bundled asset loading under App Sandbox rather than app-data networking; script-like file extensions open as inert text only and are never executed; the App Store lane omits Apple Local Assist helper, Agent Workbench, CLI Agent launch, dev mode, arbitrary command execution, and external AI/API calls. |
| P1 | Public metadata final pass | Privacy Policy URL is `https://hazakura.dev/hazakura-editor/privacy/`. Remaining metadata work is support URL, category / keywords / age rating / screenshots, and App Store Connect field-by-field review. |
| P1 | About metadata finalization | `src-tauri/src/menu.rs` builds the macOS About panel from Tauri bundle `copyright` and `publisher`, but the current Tauri configs do not set those values. Before App Review, either set the bundle metadata for all relevant lanes or document why the in-app Help About surface is the canonical legal/about surface. Verify the built App Store bundle's About panel after any metadata change. |
| P1 | Third-party license packet | `LICENSE` and `THIRD_PARTY_NOTICES.md` now ship inside the generated app bundle, while the in-app Open Source Acknowledgements remain a readable summary. Before submission, refresh/review the notice contents against `package-lock.json` and `src-tauri/Cargo.lock`, include any required full license texts / upstream notices, and re-run the bundled-resource distribution probe. |
| P1 | Pre-review regression evidence | There is no tracked GitHub Actions workflow for the latest follow-up commits. Before App Review, either add a small CI workflow or run and archive local evidence for the release-readiness gates: `npm ci`, `npm run build:vite`, `npm test`, `cargo test --manifest-path src-tauri/Cargo.toml`, `npm run build`, `npm audit`, `cargo audit`, and `git diff --check`. Keep signing / Transporter as local account-bound steps. |
| P2 | Bundle-size follow-up | Measure first. Split Help / Diagnostics / Assist chunks only if it reduces real startup or review risk. |

## Completed Submission-Prep Slices

- 2026-06-12: App Store lane command-palette assist omission is
  implemented. The command palette no longer exposes `agent.*`,
  `appleAssist.*`, Apple Local Assist window, or `Assist Settings…`
  commands when the App Store lane disables both CLI Agent and Apple
  Local Assist surfaces. `npm run smoke:app-store-surface` now groups
  the lightweight App Store surface-omission tests for repeatable
  pre-submission automation.
- 2026-06-12: v0.18 TestFlight delivery evidence recorded. The
  signed `HazakuraEditor-0.18.0-mas.pkg` upload completed and the
  resulting `0.18.0` / build `4` TestFlight distribution showed no
  reported Apple validation warnings. Basic TestFlight launch and save
  smoke passed. Keep raw Transporter logs and account/request metadata
  out of tracked docs; record only public-safe build/result summaries.
- 2026-06-12: Tauri bundle resources now automatically include
  repository-root `LICENSE` and `THIRD_PARTY_NOTICES.md` in generated
  macOS app bundles. `scripts/probe-macos-distribution.sh` verifies
  `Contents/Resources/LICENSE` and
  `Contents/Resources/THIRD_PARTY_NOTICES.md` for App Store lane
  checks, so notice omission fails the distribution probe instead of
  remaining a manual memory item.
- 2026-06-11: Helper-free App Store build / signing lane is defined.
  `npm run build:app-store-preview` and
  `npm run build:app-store-submit` use App Store-specific Tauri config,
  omit `bundle.externalBin`, use the minimal App Sandbox entitlement file,
  and keep Developer / GitHub lane helper behavior separate. The remaining
  App Store Connect work is upload / validation / TestFlight evidence, not
  initial lane definition.
- 2026-06-11: `scripts/probe-macos-distribution.sh` now checks the app
  bundle for `com.apple.security.app-sandbox` and the Developer / GitHub
  lane helper for `com.apple.security.inherit`, matching the inherited
  sandbox helper model instead of reporting a misleading helper sandbox miss.

## Where To Look

- Current implementation truth: `docs/current-status.md`
- Phase order and boundaries: `docs/roadmap.md`
- Product and safety boundaries: `docs/product-brief.md`,
  `docs/security-boundary.md`, `docs/agent-workbench-boundary.md`
- Manual smoke: `docs/smoke-checklist.md`
- Release gates: `docs/source-release-checklist.md`,
  `docs/dmg-preview-checklist.md`, `docs/release-pre-check.md`
- Private App Review draft: ignored `docs/internal/` files only
- Historical v0.17 App Store-quality work:
  `docs/archive/operations/app-store-v0.17/`

## Do Not Use As Current

- `docs/archive/operations/app-store-v0.17/quality-agent-requests.md`
- `docs/archive/operations/app-store-v0.17/external-agent-requests.md`
- `docs/archive/operations/app-store-v0.17/current-work-closeout.md`

Those files are retained as evidence and background only.  They should
not be the starting point for new UX work.
