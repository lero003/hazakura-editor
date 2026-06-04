# Smoke Checklist

Status: Operational
Scope: Current manual smoke checks
Authority: Medium
Last reviewed: 2026-06-04 (active-smoke refactor)

Use this checklist after changes to file operations, saving, preview rendering, L Mode, Review Desk, Agent Workbench, workspace behavior, theme/status display, keyboard focus, or release packaging.

Historical smoke logs and old per-release notes are archived in `docs/archive/operations/smoke-checklist-through-v0.10-doc-refactor.md`.

## v0.10 Release-Candidate Focus

Run these before treating v0.10 as ready to publish:

1. Launch the latest built app from `src-tauri/target/release/bundle/macos/hazakura editor.app`.
2. Confirm default Safe Editor startup has no Git UI, general terminal, arbitrary command/path field, provider-add UI, auto-apply, or auto-commit behavior.
3. Open a Markdown document with headings, lists, links, code blocks, and long paragraphs.
4. Enter and exit L Mode with `Cmd+Shift+L`.
5. Confirm saved Markdown source is unchanged by entering/exiting L Mode.
6. Confirm long-document mouse and keyboard scrolling work in L Mode.
7. Confirm keyboard navigation can focus/edit line-level positions in long wrapped paragraphs.
8. Confirm inactive Markdown markers are suppressed and active/hovered markers reveal enough source context to edit safely.
9. Confirm reference-style link markers do not visually break reading/editing.
10. Confirm code blocks remain readable.
11. Confirm floating chrome/status text is theme-aware and readable.
12. Confirm normal mode, Preview, Diff, Review Desk, export, and copy behavior still use Markdown source, not rendered preview content.

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

## Preview And Authoring

Run when Markdown preview, image assets, export, or authoring helpers change:

1. Confirm sanitized Markdown preview renders headings, lists, tables, code blocks, blockquotes, task checkboxes, and local workspace asset images.
2. Confirm external image URLs and unsafe local image paths are blocked.
3. Paste or drag-drop an image and confirm `assets/<hash>.<ext>` is created and Markdown image syntax is inserted.
4. Export HTML and confirm local image assets are inlined when expected.
5. Use Print to PDF handoff and confirm the print-ready layout is readable.
6. Insert a Markdown table and confirm the app does not imply row/column table editing beyond the implemented helper.

## Review Desk

Run when Review Desk or candidate comparison changes:

1. Confirm Review Desk is not a persistent top-chrome primary action.
2. Open Review Desk via `Cmd+Shift+R`, View menu, and `/review`.
3. Paste a Markdown candidate and press Compare.
4. Confirm the diff preview compares active buffer against candidate text.
5. Confirm candidate editor changes after Compare invalidate the old preview/apply state.
6. Confirm active-tab switches, active-buffer edits, and compared-tab close make the preview stale and disable Apply.
7. Press Apply candidate and confirm the buffer changes, the file remains unsaved, and Save is still explicit.
8. Confirm close button and shortcut close both reset candidate input, preview, stale banner, and errors.

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

## Reporting

When reporting smoke:

- State the app build or dev server used.
- State which section was exercised.
- State exact blockers when smoke was skipped or blocked.
- Do not claim manual smoke passed unless the interaction was actually performed.
