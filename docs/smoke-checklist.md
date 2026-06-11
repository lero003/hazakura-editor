# Smoke Checklist

Status: Operational
Scope: Current manual smoke checks
Authority: Medium
Last reviewed: 2026-06-12 (v0.18 TestFlight basic smoke)

Use this checklist after changes to file operations, saving, preview rendering, L Mode, Diff / explicit change review, Agent Workbench, workspace behavior, theme/status display, keyboard focus, or release packaging.

Historical smoke logs and old per-release notes are archived in `docs/archive/operations/smoke-checklist-through-v0.10-doc-refactor.md`.

## Smoke Environment Boundary

Use Vite / browser smoke only for frontend-only rendering checks that do not require Tauri runtime APIs. The browser surface cannot prove native app behavior that depends on `@tauri-apps/api` `invoke`, native dialogs, window/menu integration, bundled sidecar helpers, filesystem permissions, app launch state, or macOS signing / bundle metadata.

When a checklist item covers file open/save, workspace folders, app menus, Apple Local Assist live helper behavior, Agent Workbench provider launch, close/quit handling, or L Mode behavior that must be judged inside the packaged desktop shell, run the built app from `src-tauri/target/release/bundle/macos/Hazakura Editor.app` on a Mac that can launch it. If that environment is unavailable or blocked, report the smoke as blocked/skipped and keep automated checks limited to unit tests, Vite build, Tauri build, bundle metadata, and codesign evidence. Do not claim manual app smoke passed from browser-only evidence.

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
  keeping the dropdown controls.

Track these under `docs/current-work.md` before App Review submission.

This does not replace the fuller App Store / TestFlight manual smoke
items below.

## v0.18 Pre-Review Smoke Focus

Run these on the signed TestFlight build before App Review submission:

1. Workspace restore: open a workspace, quit/relaunch several times,
   then repeat with an outside-workspace tab active. The selected
   workspace should remain available or show a clear reauthorization
   path.
2. Move to Trash: confirm the App Store lane decision. Either the
   operation is unavailable, or workspace file/folder trashing succeeds
   through the native Trash path without `osascript`, AppleEvents, or
   automation entitlements.
3. Image paste / drag-drop: supported PNG/JPEG/GIF/WebP images under
   the cap save into `assets/`; oversized pasted-image payloads fail
   cleanly without crashing or implying success.
4. Save fallback safety: direct-open file save failures should leave
   local edits dirty/recoverable and must not show a successful save.
5. Dirty close: `Cmd+Q` and the red close button show the expected dirty
   tab/app-close confirmation and preserve recoverability on save
   failure.
6. Network observation: record whether any external network
   communication appears. The expected App Store lane result is no
   app-data external network access.
7. Accessibility: complete live VoiceOver, keyboard-only traversal, and
   Increase Contrast checks for the tab bar, file tree, dirty dialogs,
   Preferences, Help, and status/error rows.

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

## L Mode v0.11+ (WYSIWYG-tier writing surface)

Run when the L Mode extension, the GFM parser base, the lMode stylesheet, the prose font tokens, or the empty-placeholder / typewriter / image-widget code changes.

### Inline rendering

1. Enter L Mode with `Cmd+Shift+L` and confirm `*italic*` shows as italic text (no visible `*`); `**bold**` shows bold; `~~struck~~` shows with a strikethrough.
2. Confirm `[text](url)` shows as the link text only, in the accent color, with no visible brackets or URL.
3. Confirm inline code reads as prose with a thin accent underline, not as a colored code chip on a heavy background.

### Block rendering

4. Confirm a GFM table renders with a bold header row, body rows, a thin border, and muted pipe separators; the `| --- | --- |` delimiter row is not visible.
5. Confirm `---` on its own line shows as a horizontal divider line (not as raw `---` text).
6. Confirm `- [ ]` and `- [x]` list items show as checkbox glyphs (☐ / ☑) instead of the raw marker text.
7. Click a task-list checkbox and confirm the underlying `[ ]` / `[x]` toggles, the doc is now dirty, and the displayed glyph flips.
8. Confirm fenced code blocks render as a quiet inset (left rule, muted background, generous breathing) with subtle line numbers down the gutter.
9. Confirm blockquotes render as a pull-quote (italic, slightly larger, thin left rule, no background fill).
10. Confirm `- item` bullet lists show a quiet `•` and `1. item` ordered lists show `1.` / `2.` / `3.` re-numbered per list (not the source numbers), with `tabular-nums` so the column doesn't shift.
11. Confirm `![alt](url)` images render as a centered figure with a soft drop shadow; when the alt text is non-empty, an italic caption appears below the image. Unresolved / out-of-workspace images render a quiet dashed placeholder instead.

### Magazine-feel typography

12. Confirm the prose body uses the serif stack (New York / Hiragino Mincho / Yu Mincho / Georgia), not the previous sans-serif default.
13. Confirm the FIRST H1 of a document is centered, large, and carries its own bottom rule. Subsequent H1s render in the section-heading voice (left-aligned, smaller) so multi-section documents don't read as a series of titles.
14. Confirm H2 is a clear section break, H3 a subsection, H4-6 progressively smaller. H1 and H2 carry a thin bottom rule; the prose body sits at full opacity between them.
15. Confirm the body has comfortable line-height (≈ 1.78) at 15px body size, reading-width is constrained to a centered column no wider than ~720px, and the soft "paper" gradient is visible at the top of the editor.
16. Confirm the body absolute font size feels quiet enough to read for long stretches (a v0.11+ reduction from the earlier 17px; jump rate between body and headings is preserved).

### Layout stability

17. Confirm the document layout does NOT shift horizontally as the cursor moves between lines. Markdown markers stay hidden on every line; toggling L Mode off is the only way to see the source.
18. Confirm lines that are NOT under the cursor are softly dimmed (opacity, color shift, light desaturation); the active line stands out at full opacity. The fade transitions smoothly as the cursor moves.
19. Confirm the scrollbar is hidden by default and revealed only on hover or while scrolling.
20. Confirm an effectively empty document shows a centered "L" mark + "書き始める…" / "Start writing…" placeholder instead of an empty area.
21. Confirm toggling L Mode off restores the normal editor (markers visible, no dimming, no inline rendering) and the saved file is byte-identical to the L Mode state.

### Active-line structural tag reveal (no layout shift)

22. With the cursor on a heading line, a small chip ("H1" / "H2" / "H3" / "H4" / "H5" / "H6") appears in the LEFT MARGIN of the line. The chip is muted, monospaced, and reads as chrome rather than as a body character.
23. Move the cursor between an H1, an H2, and a paragraph; the heading chip follows the cursor and the prose text DOES NOT shift horizontally (the chip is absolutely positioned in the margin, not part of the line's content flow).
24. With the cursor on a blockquote line, a ">" chip appears in the left margin of every blockquote line spanned by the selection.
25. With the cursor on the FIRST or LAST line of a fenced code block, a "```" chip appears in the left margin (the intermediate lines of the block stay quiet).
26. The chip is invisible on dimmed (non-active) lines — only the active line and lines spanned by a multi-line selection show chips.
27. On a viewport at the minimum comfortable width, the chip remains fully inside the editor's visible area (no clipping at the left edge).

### Typewriter mode (optional setting)

28. In the Preferences dialog, the "Typewriter mode" toggle appears as a sub-option under the L Mode toggle, indented and dimmed when L Mode is off.
29. With typewriter mode ON, the active line stays vertically centered in the viewport as the cursor moves or typing advances the collapsed caret. The scroller's `scroll-behavior: smooth` makes the recenter feel like a soft drift, not a snap. With it OFF, the editor uses the normal top-anchored flow.
30. With typewriter mode ON, make a range selection with Shift+Arrow and confirm the viewport does not jump just because a selection range is active.
31. Toggle the setting from the Preferences dialog and confirm the change takes effect without restarting the app.

## Safe Editor Core

Run when file I/O, tabs, close behavior, or save logic changes:

1. Open a throwaway workspace.
2. Create a Markdown file with New File and confirm existing-file overwrite is refused.
3. Edit and Save a file.
4. Confirm LF / CRLF and final-newline behavior are preserved unless explicitly changed.
5. Trigger an external-change conflict and confirm overwrite is stopped.
6. Trigger or simulate a save failure and confirm local edits remain recoverable.
7. Close a dirty tab and confirm Save / Discard / Cancel behavior.
8. Close the app with dirty tabs and confirm Save All / Discard All / Cancel behavior.
9. Confirm intentionally discarded edits are not offered as recovery drafts after restart.
10. Confirm Japanese IME composition does not trigger save, search, close, open, or tab-close shortcuts.

## Workspace File Operations

Run when the file tree or workspace commands change:

1. Open a throwaway workspace.
2. Use the sidebar `+` to create a file and a folder.
3. Use a folder context menu to create a child file/folder.
4. Rename a file and confirm open tabs, dirty state, recents, and comparison anchors remain coherent.
5. Move a file/folder to Trash and confirm user confirmation appears before destructive action.
6. Confirm paths outside the selected workspace cannot be targeted.
7. Treat workspace-internal drag/drop Move as experimental unless this exact flow is freshly confirmed in the built app.
8. In normal mode, collapse the left workspace sidebar and confirm the restore rail remains visible; restore it and confirm the file tree returns without changing the selected workspace or active tab.
9. Enter L Mode and confirm the normal sidebar restore rail is not shown; use the L Mode workspace button to open and close its temporary file-tree drawer.

## Preview And Authoring

Run when Markdown preview, image assets, export, or authoring helpers change:

1. Confirm sanitized Markdown preview renders headings, lists, tables, code blocks, blockquotes, task checkboxes (`- [ ]` / `- [x]` as display-only checkbox glyphs, not raw marker text), and local workspace-relative images such as `assets/...` and `docs/images/...`.
2. Confirm external image URLs and unsafe local image paths are blocked.
3. Paste or drag-drop an image and confirm `assets/<hash>.<ext>` is created and Markdown image syntax is inserted.
4. Export HTML and confirm local workspace images are inlined and the saved file uses the same preview CSS as the live preview pane (`.markdown-preview` rules, no theme-specific overrides inlined).
5. Use Print to PDF handoff and confirm the print-ready layout matches what Export HTML produces (serif body, page-break controls, no theme colors leaking into print).
6. Insert a Markdown table and confirm the app does not imply row/column table editing beyond the implemented helper.

## Manual Review Desk Entry Points

Run when Review Desk entry points, candidate comparison, or App Store surface visibility changes:

1. Confirm Review Desk is not a persistent top-chrome primary action.
2. Confirm `Cmd+Shift+R`, View menu, command palette, and slash menu do not expose a manual Review Desk open action.
3. Confirm `Cmd+Shift+R` does not reload the WebView or move focus unexpectedly.
4. Confirm active-tab versus disk review still opens through the existing Diff / Review changes route.
5. Confirm auto-backup restore review still applies only to the compared document, leaves the file unsaved, and keeps Save explicit.
6. Confirm Apple Local Assist edit review still exposes diff, discard, and close decisions without auto-saving.

## Auto-Backup Restore

Run when auto-backup storage, the restore picker, or backup-vs-buffer comparison changes:

1. Open a throwaway workspace and edit a file until at least one auto-backup is written.
2. Open the picker via the command palette (`Restore from Auto-Backup…`).
3. Confirm the picker lists backups newest-first with timestamp and size, scoped to the active file.
4. Select an entry and confirm the Compare pane opens with a backup-vs-buffer diff (the live buffer is compared against the selected backup).
5. Press "Restore this backup" and confirm the buffer is replaced with the backup contents, the tab is marked dirty, the Compare pane closes, and Save is still explicit.
6. Before pressing "Restore this backup", switch to another open tab; confirm the backup still applies to the compared document path, not the currently active unrelated tab.
7. Press `Esc` or the close button and confirm the picker closes without touching the buffer.
8. Confirm entries that resolve outside the workspace are refused (not loaded, not listed).

## Agent Workbench

Run when Agent Workbench, provider availability, terminal sizing, or Agent Window changes:

1. Confirm Agent Workbench is hidden unless explicitly enabled and restart-applied.
2. Confirm responsibility-boundary consent is required before launch.
3. Confirm only allowlisted providers appear: `codex`, `opencode`, `pi`, `claude`.
4. Confirm provider-not-found states show searched paths without installing or configuring providers.
5. Launch one installed provider in a trusted throwaway workspace.
6. Confirm terminal input goes only to the running provider process.
7. Resize the Agent surface and confirm the TUI remains usable.
8. Stop the session and confirm UI state cleans up.
9. Confirm provider-made file edits surface as ordinary external on-disk changes in Safe Editor.

## Apple Local Assist (v0.12 live local preview)

Run when `src/lib/tauri/appleAssist.ts`, `src-tauri/src/commands/apple_assist.rs`, `src-tauri/src/commands/apple_assist_supervisor.rs`, `src-helpers/apple-assist/`, `useAppleAssistAvailability`, `useAppleAssistCandidate`, `src/lib/locale/appleAssist.ts`, or the Apple Assist companion / command palette entries change.

1. Build the live helper with `npm run build:apple-assist-helper:live`; confirm the probe smoke returns an availability envelope. On a Mac where Apple Foundation Models is available and `SystemLanguageModel.default.supportsLocale()` is true, optionally run `HAZAKURA_APPLE_ASSIST_LIVE_SMOKE_GENERATE=1 npm run build:apple-assist-helper:live` and confirm a candidate or honest error envelope.
2. Confirm `npm run build:developer-preview` bundles `Contents/MacOS/hazakura-apple-assist-helper` and signs it with the local app bundle. Confirm `npm run build:app-store-preview` does not bundle the helper.
3. Confirm the Settings / Agent Workbench Preferences surface does not list Apple Local Assist as a CLI agent provider — it is a separate Assist Surface provider class.
4. Confirm no menu entry, status bar item, autosave path, or background timer runs Apple Local Assist generation without an explicit user request.
5. In the built app, select `Apple Local Assist (Experimental)`, restart if prompted, open the companion from normal editor, issue a rough request, and confirm the buffer becomes dirty without auto-saving.
6. Repeat item 5 in L Mode. Confirm the compact AI-change affordance appears and `差分を開く` / `差分を閉じる` works.
7. Confirm Agent Window and Apple Assist Window still replace rather than coexist as the primary external companion.
8. (Supervisor regression, optional) Build the fixture helper with `npm run build:apple-assist-helper:fixture` and run `HAZAKURA_APPLE_ASSIST_HELPER_FIXTURE=binaries/hazakura-apple-assist-helper-aarch64-apple-darwin cargo test apple_assist_supervisor --manifest-path src-tauri/Cargo.toml`.

## Release Packaging

Run when preparing a warning-expected DMG preview:

1. Follow `docs/source-release-checklist.md` for source gates.
2. Build the warning-expected DMG with `npm run build:dmg-preview`.
3. Verify checksum with `shasum -c`.
4. Verify image with `hdiutil verify`.
5. Mount the DMG and inspect the contained app metadata.
6. Run `codesign --verify --deep --strict --verbose=2` on the built or mounted app.
7. Run `spctl` and confirm rejection/insufficient context is described as expected only for ad-hoc, not-notarized preview builds.
8. After GitHub Release publication, download assets into a fresh temp directory and repeat checksum, DMG, mounted-app metadata, and codesign verification.

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
  scroll on the live dialog still pending.
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
the user's Mac. The `MoveToTrashConfirmDialog`
focus-management gap is now closed in code; only the live
keyboard / VoiceOver observation on the user's Mac is
still pending.

## Reporting

When reporting smoke:

- State the app build or dev server used.
- State which section was exercised.
- State exact blockers when smoke was skipped or blocked.
- Do not claim manual smoke passed unless the interaction was actually performed.
