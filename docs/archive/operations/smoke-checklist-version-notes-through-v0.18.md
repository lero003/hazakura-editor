# Smoke Checklist Version-Specific Notes Through v0.19

Status: Archive
Scope: Historical version-specific smoke observations (v0.11, v0.18, v0.19) moved out of docs/smoke-checklist.md
Authority: Low
Last reviewed: 2026-06-29

This file preserves the version-specific TestFlight observations, App Store
candidate smoke notes, and release-candidate focus lists that previously
lived in `docs/smoke-checklist.md`. They are point-in-time observation
records for superseded versions, not reusable checklists. The current
smoke checklist is `docs/smoke-checklist.md`.

---


## v0.18 TestFlight Basic Smoke



Observation on 2026-06-12 for helper-free App Store lane version
`0.18.0` / build `4`:

- TestFlight distribution succeeded with no reported Apple validation
  warnings.
- Basic launch passed on the TestFlight build.
- Basic save flow passed on the TestFlight build.
- Pre-review bug follow-up observed: repeatedly quitting/relaunching
  can lose the selected workspace instead of retaining it.
- Pre-review bug follow-up observed: if the active tab is outside the
  selected workspace when the app quits/restarts, the workspace may not
  be retained.
- Pre-review UI follow-up observed: the lower status area can show
  passive `UTF-8` / `LF` style labels even though the change dropdowns
  already expose those values; remove the duplicate passive labels while
  keeping the dropdown controls. Code-level follow-up is implemented
  after this TestFlight build; include the status bar in the next signed
  build smoke only if the App Review lane needs user-facing confirmation.

Track these under `docs/current-work.md` before App Review submission.

This does not replace the fuller App Store / TestFlight manual smoke
items below.

## v0.19 App Store Candidate Smoke Focus



Run these on the signed `0.19.0` TestFlight build before App Review
submission:

1. Workspace restore: open a workspace, quit/relaunch several times,
   then repeat with an outside-workspace tab active. The selected
   workspace should remain available or show a clear reauthorization
   path.
2. Move to Trash: confirm the App Store lane decision. Either the
   operation is unavailable, or workspace file/folder trashing succeeds
   through the native Trash path without `osascript`, AppleEvents, or
   automation entitlements.
3. Image paste / drag-drop: supported PNG/JPEG/GIF/WebP images under
   the 20 MB decoded/file cap save into `assets/`; oversized pasted-image
   payloads fail cleanly without crashing or implying success.
4. Save fallback safety: direct-open file save failures should leave
   local edits dirty/recoverable and must not show a successful save.
5. Dirty close: `Cmd+Q` and the red close button show the expected dirty
   tab/app-close confirmation and preserve recoverability on save
   failure.
6. Network observation: record whether any external network
   communication appears. The expected App Store lane result is no
   app-data external network access.
7. App Store surface boundary: confirm the command palette, native menu,
   Preferences, and visible chrome do not expose `Agent`, `CLI Agent`,
   dev mode, arbitrary command execution, or hidden Review Desk entry
   points. For helper-enabled v0.29+ builds, Local Assist may be visible
   only as the explicit writing companion surface and must not behave as
   a CLI agent, external AI provider, or automatic rewrite path.
8. Accessibility: complete live VoiceOver, keyboard-only traversal, and
   Increase Contrast checks for the tab bar, file tree, dirty dialogs,
   Preferences, Help, and status/error rows.

## v0.19 Human-Side App Store Lane Smoke Note



Human-side smoke notes received on 2026-06-12 for the App Store lane
candidate. The source note did not record a final App Store Connect
build number, so keep this as partial manual evidence until the exact
TestFlight build is tied to the upload record.

Passed:

- First launch.
- New Markdown creation.
- Opening an existing Markdown file through user selection.
- Preview and HTML export.
- Image paste and drag/drop under sandboxed file access.
- App Store surface omission: Agent Workbench, CLI Agent, dev mode, and
  Hazakura Local Assist were not visible.
- Dirty-tab `Cmd+Q` and red-window-button close confirmation.
- Move to Trash appeared to work normally in the tested App Store lane
  build.
- Network observation did not show a concrete issue in the tested
  flow.

Partial / needs another pass:

- Save / Save As worked enough not to corrupt data, but Save As felt
  surprising because the original file could appear to close as a clean
  unedited tab after saving under another name. Treat as UX observation,
  not a release-blocking data-loss claim unless reproduced.
- Workspace restore remained within the user's acceptable range after
  follow-up smoke, though the Google Drive / quit-before-interaction edge
  should stay a residual risk until the exact signed TestFlight build is
  tied to the upload record.
- Workspace-outside active-tab restore remains tied to the same
  workspace persistence uncertainty.
- VoiceOver was partially usable, but fuller accessibility coverage is
  deferred rather than treated as complete for the candidate.
- `Cmd+Shift+F` global search returned results, but clicking a result did
  not open the file. Code-level follow-up now routes result activation to
  the existing workspace-file opener and line jump handler.

Unknown / still required:

- Full live VoiceOver, keyboard-only traversal, and Increase Contrast
  checks.
- Tab close affordance should be rechecked on the exact signed build;
  the human note reported the close `x` was not visible enough.

## v0.11 Release-Candidate Focus



Run these before treating v0.11.0 as ready to publish:

1. Launch the latest built app from `src-tauri/target/release/bundle/macos/Hazakura Editor.app`.
2. Confirm default Safe Editor startup has no Git UI, general terminal, arbitrary command/path field, provider-add UI, auto-apply, or auto-commit behavior.
3. Open a Markdown document with headings, lists, links, code blocks, and long paragraphs.
4. Enter and exit L Mode with `Cmd+Shift+L`.
5. Confirm saved Markdown source is unchanged by entering/exiting L Mode.
6. Confirm long-document mouse and keyboard scrolling work in L Mode.
7. Confirm keyboard navigation can focus/edit line-level positions in long wrapped paragraphs.
8. Confirm inactive Markdown markers are suppressed and active/hovered markers reveal enough source context to edit safely.
9. Confirm reference-style link markers do not visually break reading/editing.
10. Confirm code blocks, tables, blockquotes, task checkboxes, HR, ordered/bullet lists, and images remain readable as display-only L Mode rendering.
11. Confirm floating chrome/status text is theme-aware and readable.
12. Confirm auto-backup restore opens backup-vs-buffer review, applies only to the compared document, marks the tab dirty, and does not save automatically.
13. Confirm normal mode, Preview, Diff / explicit change review, export, and copy behavior still use Markdown source, not rendered preview content.

## v0.18 Manual Accessibility Smoke


## v0.18 Manual Accessibility Smoke

Code-and-observation pass on 2026-06-11. Do not claim this slice
"passed" until the pending live observation items below are run on
the user's Mac. Detailed code-level walk-through is archived in
[`docs/archive/operations/v0.18-manual-accessibility-smoke-observation.md`](../archive/operations/v0.18-manual-accessibility-smoke-observation.md).

### Build / environment

- Built app target for pending live observation:
  `src-tauri/target/release/bundle/macos/Hazakura Editor.app`
  (v0.18.0, ad-hoc, not notarized; warning-expected). The built
  app was NOT launched in this smoke pass; live observation
  items below still need a manual run on the user's Mac.
- macOS host: macOS 26.5.1, `Darwin keinoMac-Studio.local`, arm64.
- Frontend: `npm run build:vite` → `✓ built in 141ms`, 303 modules
  transformed, no errors.
- Tests: `npm test` → 80 files / 658 tests pass, including the
  v0.18 dirty-description cases in
  `src/components/app/AppTopChrome.test.tsx`.
- VoiceOver: installed (`/System/Library/CoreServices/VoiceOver.app`)
  but disabled in the current user session.
- Increase Contrast: off in the current user session.

### Pending live observation checklist

Run these on the live built app, on a real Mac, with the user's
actual accessibility settings. Mark each item only after the
interaction is actually performed.

1. Help readability
   1. Open Help / Privacy Policy / Local Data Disclosure /
      Support Diagnostics / About / Open Source Acknowledgements.
   2. Confirm headings, body, links, scroll, and narrow-width
      readability. Five-document structure, anchor integrity,
      and `.privacy-tab-panel-scroll` body are pinned in code
      (see archive); the scroll affordance on a long document
      still needs a live check.
2. Full keyboard-only traversal (mouse not used)
   1. Use `Tab` / `Shift+Tab` / `Enter` / `Space` / `Esc` /
      arrow keys to traverse the Safe Editor baseline, tab
      bar, sidebar collapse / restore, status bar controls,
      Preferences, Help surfaces, and close dialogs.
   2. Record any focus that is invisible, trapped,
      unrecoverable, or fires an unintended action.
   3. Specifically confirm the `MoveToTrashConfirmDialog`
      focus behaviour on the live built app. The code-side
      wiring is in place: initial focus lands on the Cancel
      button via `useDialogInitialFocus`, Tab / Shift+Tab
      are trapped inside the dialog via
      `useModalKeyboardGuard`, and Escape routes to
      `cancelPendingTrash`. The live observation is still
      needed because the code-level tests do not cover the
      user-facing keyboard traversal on the user's Mac.
3. VoiceOver tab-bar announcement
   1. VoiceOver on (`Cmd+F5`), `VO+→` to the tab bar.
   2. Confirm text tab / dirty tab / image preview tab /
      close button read with the right role and description.
   3. Confirm dirty tab is read as "unsaved" and that the
      encoding-only dirty slice did not regress the
      description.
   4. Confirm the visible close control is not confused with
      the dirty dot: the hover / focus-visible close affordance
      reads as close while the dirty dot remains only the
      unsaved-state marker.
4. Increase Contrast
   1. System Settings → Accessibility → Display → Increase
      contrast: on. Re-launch the built app.
   2. Confirm tab dirty dot, focus ring, sidebar restore
      rail, Help text, buttons, status / error rows, and
      dialogs are all legible. The CSS rules in
      `src/styles/a11y.css` under
      `@media (prefers-contrast: more)` should activate
      automatically.
   3. Return Increase Contrast to off and confirm the app
      reverts to the regular look without a restart.

### Result summary (2026-06-11)

- Help readability: code-level observed; long-document
  scroll on the live dialog still pending. 2026-06-12
  follow-up: the Help-document body scroll container and
  Support Diagnostics scroll container are now named
  `region`s with `tabIndex=0`, and focused tests pin that
  keyboard-only users can reach the scroll area before
  paging through long Help text.
- Full keyboard-only traversal: baseline dialogs
  **partially observed** —
  `MoveToTrashConfirmDialog` now lands initial focus on
  the Cancel button, traps Tab / Shift+Tab inside the
  dialog, and routes Escape to `cancelPendingTrash` (see
  the v0.18 Completed slice in `docs/current-work.md`).
  New component + hook tests pin this behaviour and the
  existing dirty-tab / app-close / preferences Esc + Tab
  routing stays green. Live observation on the user's Mac
  is still pending.
- VoiceOver tab-bar announcement: code-level observed
  (encoding-only dirty description pinned by the existing
  AppTopChrome test); live observation pending on the
  user's Mac.
- Increase Contrast: code-level observed
  (`prefers-contrast: more` rules in
  `src/styles/a11y.css`); live observation pending on the
  user's Mac.

Active UX Queue still lists `Manual accessibility smoke`
until the pending live observation items above are run on
the user's Mac. The Help-document scroll-region
keyboard-reachability gap is closed in code; the
`MoveToTrashConfirmDialog`
focus-management gap is now closed in code; only the live
keyboard / VoiceOver observation on the user's Mac is
still pending.
