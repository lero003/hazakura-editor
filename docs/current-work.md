# Current Work

Status: Operational
Scope: Active v0.18 pre-review bug fixing and submission-prep routing
Authority: High
Last reviewed: 2026-06-12

## Purpose

Start here when choosing the next small `Hazakura Editor` slice.
This file is the current work queue.  Older v0.17 App Store-quality
request packets and closeout evidence now live under
`docs/archive/operations/app-store-v0.17/`.

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
| 6 | Manual accessibility smoke | Manual smoke / small fixes | `manual-blocked`: live VoiceOver or Increase Contrast is unavailable. `implemented`: any discovered focus/contrast issue is fixed narrowly and recorded. |
| 7 | Third-party license packet | Docs / release prep | `implemented`: notices are refreshed/reviewed against `package-lock.json` and `src-tauri/Cargo.lock`, bundled-resource probe passes, and any required upstream notices are included. |
| 8 | About metadata finalization | Config / bundle smoke | `implemented`: Tauri bundle metadata or documented canonical About surface is finalized and built-bundle About behavior is verified. |
| 9 | Pre-review regression evidence | CI or local evidence | `implemented`: either a small CI workflow exists or local release-readiness evidence is archived for the listed commands; signing/Transporter remain local account-bound. |
| 10 | Auto-backup filename uniqueness | Code / verified no-op | `implemented`: same-second backup collision is reproduced and fixed. `verified no-op`: focused inspection cannot reproduce a realistic overwrite risk. |
| 11 | Help copy overlap cleanup | Product copy | Keep for human/Codex review unless explicitly assigned with tight wording constraints. |

Order 1 is implemented as of 2026-06-12. The remaining Move to Trash
proof is signed TestFlight smoke, tracked under the submission-prep
manual smoke items; the next open automation slice is Order 2 unless
TestFlight specifically reopens the Trash behavior.

## Active UX Queue

Pick one item at a time.

| Priority | Slice | Acceptance |
|---|---|---|
| P0 | Workspace persistence before App Review | Treat the TestFlight workspace loss observations as bugs, not product spec: (1) opening a workspace and repeatedly quitting/relaunching must retain the selected workspace root, and (2) quitting/relaunching while the active tab is outside the workspace must still retain the selected workspace root. Reproduce both shapes first, then add narrow persistence/restore regression coverage before changing behavior. The workspace selection should disappear only after an explicit user action or unrecoverable authorization failure with a visible reauthorization path. |
| P1 | Pasted image decoded-size cap / `data:image` wording | `save_pasted_image` should reject oversized pasted image payloads before unbounded memory growth. Add a base64-length preflight where practical, enforce a decoded byte cap aligned with the existing 20 MB image limit, localize the user-facing error, and align Help/docs wording to decoded image bytes rather than vague data-URI length. Verify paste/drag-drop still writes supported PNG/JPEG/GIF/WebP images into `assets/`. |
| P1 | Direct save fallback failure safety | The App Sandbox direct-file fallback can use a truncate-and-write path when temp-file creation is denied. Add focused failure coverage for partial write / sync failure behavior: local edits must remain dirty/recoverable, the UI must not imply success, and any feasible original-bytes recovery should be attempted before reporting failure. Keep the normal atomic save path unchanged. |
| P1 | Manual accessibility smoke | Code-level observation recorded in `docs/smoke-checklist.md` and `docs/archive/operations/v0.18-manual-accessibility-smoke-observation.md` (Help readability, full keyboard-only traversal, VoiceOver tab-bar announcement, Increase Contrast). Live VoiceOver and Increase Contrast observation items still pending on the user's Mac. Baseline dialogs partially observed; `MoveToTrashConfirmDialog` focus management now wired (see Completed v0.18 Slices). |
| P1 | Status bar encoding / line-ending de-duplication | Remove the passive duplicate status labels such as `UTF-8` and `LF` from the lower status area when the encoding / line-ending change dropdowns already expose those values. Keep the actual change controls and save semantics intact; verify compact widths do not leave awkward gaps or hide important dirty/save state. |
| P2 | Auto-backup filename uniqueness | Auto-backup filenames currently use second-resolution timestamps. If focused tests can reproduce same-second overwrite/collision risk, add milliseconds, a monotonic counter, or a short random suffix so rapid backups do not overwrite each other. Keep recovery listing newest-first and path containment unchanged. |
| P2 | Help copy overlap cleanup | Separate Privacy Policy, Local Data Disclosure, Support Diagnostics, About, and Open Source Acknowledgements so each page has one job. |

## External-Agent Friendly Queue

Use this when handing work to an external implementation agent. Prefer
debugging, small implementation fixes, and evidence-backed refactors
over copy-heavy or product-voice-sensitive work.

| Fit | Candidate | Scope |
|---|---|---|
| Good | Pasted image decoded-size cap | Add the decoded-size guard and focused tests around `save_pasted_image`; align docs/error wording with the implemented 20 MB limit. Do not change workspace image preview policy beyond what the cap requires. |
| Good | Direct save fallback failure safety | Add failure-injection coverage for the direct write fallback and improve recovery only if the test proves a user-visible data-loss risk. Do not weaken external-change fingerprint checks. |
| Good | L Mode quality investigation | Pick one reproduced L Mode issue or one measurable quality gap only: caret, IME, Backspace/Delete, hidden markers, lists, dividers, links, tables, images, visual overlap, source preservation, or performance baseline. Do not add a new editing model or contenteditable surface. |
| Good | Theme quality investigation | Pick one concrete theme issue only: contrast, focus visibility, status/error readability, dialog readability, or Increase Contrast behavior. Do not redesign palettes or add theme customization. |
| Good | Workspace persistence before App Review | Debug only the observed persistence shapes where repeated app launch/quit or an outside-workspace active tab can cause the selected workspace root to be absent after restart. Keep the fix near workspace state persistence / restore and avoid changing direct-open file permissions or workspace file operations. |
| Good | Status bar encoding / line-ending de-duplication | Remove redundant passive `UTF-8` / `LF` style labels while preserving the existing dropdown controls, status/dirty affordances, and compact status-bar layout. |
| Good | Auto-backup filename uniqueness | If reproducible, make backup names unique within the same second while preserving recovery list sorting and cleanup behavior. |
| Good | Focused refactor for a verified bug | Refactor only when it directly fixes or tests one observed user-facing problem. Keep ownership boundaries and public behavior stable. |
| Poor fit | Help copy overlap cleanup | This is product voice and submission copy work. Keep it for human/Codex review unless explicitly assigned with tight wording constraints. |
| Poor fit | Live VoiceOver / Increase Contrast observation | Requires the user's Mac accessibility settings and real interaction. Do not outsource unless that environment is explicitly available. |

## Completed v0.18 Slices

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
| P0 | TestFlight / App Store Connect validation | The helper-free App Store submit lane is defined in `docs/app-store-build.md`. 2026-06-12 evidence: the signed `HazakuraEditor-0.18.0-mas.pkg` upload reached TestFlight distribution with no reported Apple validation warnings, and basic TestFlight launch / save smoke passed. Remaining proof before broader App Store-ready claims: fuller manual smoke on the TestFlight build, final metadata, and App Review submission / approval evidence. The fuller smoke should explicitly cover workspace persistence, image paste/drag-drop, dirty `Cmd+Q` / red-close behavior, no external network communication, accessibility live checks, and the App Store-lane Move to Trash decision. The earlier ad-hoc App Store preview `open -n` failure remains non-blocking unless it reproduces on the signed TestFlight build. |
| P1 | App Review Notes final copy / attachments | Private review-note draft and store-copy material exist outside the public docs. Final pass should attach screenshots or reviewer evidence as needed, keep account/contact-specific text out of tracked docs, and preserve the App Store lane omission claim for CLI Agent / Agent Workbench / Apple Local Assist. Prepare concise reviewer-note answers for the non-obvious App Store lane facts: `network.client` exists for Tauri/WebKit bundled asset loading under App Sandbox rather than app-data networking; script-like file extensions open as inert text only and are never executed; the App Store lane omits Apple Local Assist helper, Agent Workbench, CLI Agent launch, dev mode, arbitrary command execution, and external AI/API calls. |
| P1 | Public metadata final pass | Privacy Policy URL is `https://hazakura.dev/hazakura-editor/privacy/`. Remaining metadata work is support URL, category / keywords / age rating / screenshots, and App Store Connect field-by-field review. |
| P1 | About metadata finalization | `src-tauri/src/menu.rs` builds the macOS About panel from Tauri bundle `copyright` and `publisher`, but the current Tauri configs do not set those values. Before App Review, either set the bundle metadata for all relevant lanes or document why the in-app Help About surface is the canonical legal/about surface. Verify the built App Store bundle's About panel after any metadata change. |
| P1 | Third-party license packet | `LICENSE` and `THIRD_PARTY_NOTICES.md` now ship inside the generated app bundle, while the in-app Open Source Acknowledgements remain a readable summary. Before submission, refresh/review the notice contents against `package-lock.json` and `src-tauri/Cargo.lock`, include any required full license texts / upstream notices, and re-run the bundled-resource distribution probe. |
| P1 | Pre-review regression evidence | There is no tracked GitHub Actions workflow for the latest follow-up commits. Before App Review, either add a small CI workflow or run and archive local evidence for the release-readiness gates: `npm ci`, `npm run build:vite`, `npm test`, `cargo test --manifest-path src-tauri/Cargo.toml`, `npm run build`, `npm audit`, `cargo audit`, and `git diff --check`. Keep signing / Transporter as local account-bound steps. |
| P2 | Bundle-size follow-up | Measure first. Split Help / Diagnostics / Assist chunks only if it reduces real startup or review risk. |

## Completed Submission-Prep Slices

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
