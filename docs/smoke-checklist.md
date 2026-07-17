# Smoke Checklist

Status: Operational
Scope: Current manual smoke checks
Authority: Medium
Last reviewed: 2026-07-17 (Theme G media M0–M4 palette + smoke)

Use this checklist after changes to file operations, saving, preview rendering, L Mode, Diff / explicit change review, Agent Workbench, workspace behavior, theme/status display, keyboard focus, or release packaging.

Historical smoke logs and old per-release notes are archived in `docs/archive/operations/smoke-checklist-through-v0.10-doc-refactor.md` and `docs/archive/operations/smoke-checklist-version-notes-through-v0.18.md`.

## Smoke Environment Boundary

Use Vite / browser smoke only for frontend-only rendering checks that do not require Tauri runtime APIs. The browser surface cannot prove native app behavior that depends on `@tauri-apps/api` `invoke`, native dialogs, window/menu integration, bundled sidecar helpers, filesystem permissions, app launch state, or macOS signing / bundle metadata.

When a checklist item covers file open/save, workspace folders, app menus, close/quit handling, L Mode behavior, or Hazakura Local Assist behavior that must be judged inside the packaged desktop shell, run `npm run build` and launch `src-tauri/target/release/bundle/macos/Hazakura Editor.app`. This local smoke bundle is helper-enabled and launchable, but it is not the signed App Store sandbox submit artifact. Use the signed TestFlight build for App Store-lane proof, and use the Developer / GitHub bundle for Agent Workbench checks. If that environment is unavailable or blocked, report the smoke as blocked/skipped and keep automated checks limited to unit tests, Vite build, Tauri build, bundle metadata, and codesign evidence. Do not claim manual app smoke passed from browser-only evidence.

For a repeatable local packaged-app launch/window proof, run:

```bash
npm run smoke:macos-window
```

This builds the current macOS lanes unless `SKIP_BUILD=1` is set,
launches the Developer / GitHub `Hazakura Editor Dev.app` bundle, and
uses `CoreGraphics` / `CGWindowListCopyWindowInfo` to confirm an
onscreen layer-0 app window. It proves the built bundle can surface a
visible app window on this Mac; it does not prove native dialog
selection, Hazakura Local Assist transaction review, TestFlight, App Store
sandbox behavior, or notarization.

## v1.10 Single-document Structure Smoke

Run this after the automated gates and before treating v1.10 as packaged-app
proven. Generate deterministic local-only documents:

```bash
npm run smoke:fixtures:v1.10-structure
```

The command prints the actual OS temporary output directory. It contains
`structure-overview.md` and `long-section.md`. The generator writes no tracked
fixture and uses no user workspace or cloud folder.

1. Build and launch the current desktop bundle with `npm run build` (or reuse
   that exact fresh build). Open the generated folder as the workspace.
2. Open `structure-overview.md`, show Outline, and confirm frontmatter headings
   are absent. Confirm H1/H2/H3/H5 indentation, a normal page-break row, and a
   trailing page-break row. Select each kind and confirm the Editor moves to its
   source line without changing the source or dirty state.
3. Confirm Outline shows suggestions for the duplicate navigation label, empty
   heading, and H2→H5 level jump. Open `long-section.md` and confirm the 800-line
   section receives the long-section suggestion. These are notes only: Save,
   Save As, Preview, e-book, PDF, and EPUB actions remain available.
4. In `structure-overview.md`, use the upward control on `第一場面`. Confirm
   only `###` becomes `##`, the tab becomes dirty, and no file write occurs.
   Use `Cmd+Z` once and confirm the complete original source returns; Redo may
   be used to restore the edit.
5. Exercise H1/H6 boundaries and confirm the unavailable direction is disabled.
   Start Japanese IME composition in the Editor and, before committing it,
   activate a heading-level control. Confirm the structural edit is refused and
   the composing text remains intact. Commit/cancel composition, then retry.
6. Repeat one level change, use Save As to a disposable `.md`, and confirm the
   same tab/session continues with the edited source and normal Undo behavior.
   The original generated fixture must remain unchanged unless it was explicitly
   chosen as the save destination.
7. With auto-backup enabled, make an unsaved level change, wait for the normal
   backup interval, close/terminate through the existing recovery smoke method,
   and restore the draft. Confirm the edited heading is restored as a dirty
   buffer and Save remains explicit. Record path-backed and pathless results
   separately; do not infer signed TestFlight recovery from a Developer bundle.
8. Check the normal page break in e-book mode and an exported EPUB. Confirm the
   shared interpretation matches Outline, while the trailing marker is dropped
   from rendered/exported output. Confirm no manifest, database, second editable
   pane, automatic correction, or section-move surface appears.

Record items 2–8 separately. `npm run smoke:macos-window` proves only a visible
packaged window and does not replace these interactions.

Current representative result (2026-07-14): a fresh local bundle opened the
generated temporary workspace. Item 2's frontmatter exclusion, hierarchy,
normal/trailing page-break display and item 3's three overview suggestions plus
803-line suggestion passed. Item 4 passed for H3→H2, dirty state, and one-step
`Cmd+Z` restoration to the original clean source. Source-line jump breadth and
items 5–8 were not exercised; do not infer IME, Save As, recovery, e-book/EPUB,
or signed TestFlight proof from this representative run.

## v1.12 OKF Starter Scaffold Smoke

1. Open a workspace folder.
2. Create from each entry point at least once across a smoke pass:
   Command Palette, folder context menu, sidebar **新規 (+)**, and OS **File → 知識フォルダのひな形**.
3. Confirm a new uniquely named folder appears, `index.md` opens, and no existing files were overwritten.
4. Confirm `log.md` uses the actual local creation date (`YYYY-MM-DD`), not the source-template date.
5. With the sidebar New menu, confirm expanded state is announced and Arrow keys / Home / End / Escape move or restore focus correctly.
6. Run `知識フォルダ（OKF）を点検` on the new folder root. Required findings should be empty (advice-only is OK).
7. If tree refresh or `index.md` open is intentionally made unavailable, confirm creation remains on disk and the partial failure stays visible in status.
8. Template bodies live under `src/features/okf/scaffoldTemplates/assets/` (rewriteable Markdown assets).
9. Spec pin authority: `docs/okf-spec-pin.md` (review + scaffolds share one pin; upgrade co-updates both).

Representative result (2026-07-15): template analysis, creation integration,
partial-failure status, keyboard menu semantics, strict Rust path/text bounds,
and non-recursive cleanup tests passed. Full frontend (**180 files / 1536
tests**), Rust (**362 passed / 2 explicit host-integration ignored / 0 failed**),
Vite, App Store preview build, and sandbox/helper entitlement verification
passed. A developer-app hands-on pass then created minimal/book-like trees via
Command Palette, root context menu, sidebar New, and OS File menu. Existing
roots remained intact with `-2` collision names; all four `log.md` files used
`2026-07-15`; `index.md` opened; Escape closed the New menu; explicit OKF review
reported no required compatibility problem. Intentional post-create partial
failure remains verified by automated integration coverage.

## v1.11 OKF Draft Compatibility Smoke

Generate the deterministic local-only OKF bundle with:

```bash
npm run smoke:fixtures:v1.11-okf
```

1. Open the generated bundle in the freshly built desktop app.
2. Run Command Palette `知識フォルダ（OKF）を点検`. Confirm the bounded disk
   snapshot note and the required / OKF preparation / improvement / reference
   hierarchy without rendered workspace HTML or images.
3. Use `開いて修正` on a finding. Confirm the existing Safe Editor tab opens,
   the panel leaves the editing path, and the editor moves to the finding line
   when an offset is available.
4. Make and save one disposable-fixture correction. Run
   `変更後に再点検` or invoke the command again and confirm a fresh disk result.
5. Run the same review from a folder context menu. Start a scan and confirm
   Cancel is available; after failure/cancel, confirm Rerun preserves the last
   completed result until replacement.

This local built-app flow is not signed TestFlight evidence. Repeat the core
review → edit → save → recheck path after TestFlight installation.

Current representative result (2026-07-15): the fresh `1.11.0` local bundle
passed Command Palette and folder-context entry, result hierarchy, existing-tab
`開いて修正`, saved disposable-fixture correction, and explicit recheck. The
fresh disk result reduced required findings from two to one. Automated cancel,
budget, symlink, UTF-8, and concurrent-scan coverage also passed. The signed
submit app and pkg passed local signature, sandbox/helper entitlement,
version/build metadata, and checksum verification. TestFlight installation,
spoken VoiceOver, and the inherited wider S4 interaction matrix remain separate.

## v1.3 Daily Trust Test Intake

v1.3 is currently a source lane over the `1.2.0` package baseline. Run the
full automated gates before treating any manual result as release evidence.

### Automated gates

1. `npm run test`.
2. `npm run build:vite`.
3. `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`.
4. `cargo test --manifest-path src-tauri/Cargo.toml`.
5. `npm run build`.
6. `git diff --check`.
7. Focused Save As, Local Assist review, e-book TOC, PDF preset/dialog/request,
   and modal keyboard tests listed in `docs/archive/operations/v1.3-followup.md`.

### Built-app interaction smoke

8. **Save As continuity.** Open a pathless Markdown tab, enter enough text to
   scroll, place a non-empty selection, and make at least two edits. Use Save
   As to save as `.md`. Confirm the selection and scroll position remain,
   Undo reverses the latest pre-save edit, and Redo restores it. Repeat Save
   As cancellation and confirm the session is unchanged. A real extension
   change such as `.md` to `.html` may remount for parser correctness.
9. **Local Assist review decision.** Apply a Local Assist proposal. Confirm
   the review bar shows `採用` and `破棄`, Diff still opens/closes, `採用`
   retains a dirty unsaved buffer without writing the file, and `破棄`
   restores the complete before-buffer. Open ordinary File Diff and Recovery
   review once to confirm their read-only/restore actions were not relabeled.
10. **Reading Focus TOC context.** Use a document with H1/H2 chapters and at
    least three H3/H4 subheadings in one chapter. Confirm the TOC shows the
    first two names plus `ほか1件`, shows measured page progress only for the
    current chapter, and still jumps to the chapter opener rather than an
    estimated H3 page.
11. **A4 PDF margin presets.** Export the same multi-page manuscript with
    `狭い`, `標準`, and `広い`. Render at least pages 1 and 2 of each PDF.
    Before choosing a preset, confirm the dialog states whether unsaved changes
    are included, how unavailable images are reported, and that the concrete
    `.pdf` destination is chosen in the next Save dialog.
    Confirm all pages remain A4, the content inset visibly increases from
    narrow to wide on every inspected page, normal images/tables/code remain
    readable, and canceling either dialog writes no file. File creation alone
    does not pass this item.

### Current v1.3 smoke status

Full automated gates pass: Vitest 123 files / 1109 tests, Rust 301 tests,
Vite, Rust format, and the helper-enabled app build. Representative built-app
checks passed for Save As Undo continuity, Local Assist `採用` with a dirty
buffer, Reading Focus TOC context, and rendered pages 1 and 2 from all three
six-page A4 PDF presets. The exact remaining edges in items 8-11 (selection /
scroll / Redo / cancel, Local Assist discard and ordinary review labels,
`ほか1件` plus chapter-opener click, and PDF images plus cancel) remain extended
RC smoke and must not be inferred from the representative run. A later focused
standard-margin fixture verified a six-column table, readable fenced/inline code,
all 30 rows of a long table across five A4 pages, and the final sentence in macOS
Preview after the export-only table/code regression fix.

## 1.2.0 Candidate Test Intake

`1.2.0` is the v1.2 Polish And Expectation Setting candidate. It does
not add a new product surface; it deepens command discovery, context-menu
containment, and EPUB export expectations. Run the items below before
treating `1.2.0` as built-app proven. Detailed steps live in the named
sections that follow this intake.

### Automated gates (source level)

These must pass before any manual interaction smoke:

1. `npm test` — full Vitest suite (121 files / 1083 tests).
2. `cargo test --manifest-path src-tauri/Cargo.toml` — full Rust suite.
3. `npm run build:vite` — TypeScript + Vite build (chunk-size warning is known).
4. `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`.
5. `npm run build` — launchable helper-enabled local smoke lane.
6. `git diff --check`.
7. `npm audit` (0 vulnerabilities) and `cargo audit` (triaged warnings only).
8. Focused regression tests: `src/components/editor/SlashMenu.test.tsx`
   (viewport containment) and
   `src/hooks/commandPalette/useCommandPaletteController.test.ts`
   (localized `みだし` search).

### Manual interaction smoke (built app)

Use the latest built desktop app, not browser-only Preview. Grouped by
the v1.2 change area; full step detail is in the sections below.

9. **Command discovery (v1.2).** See "v1 Workspace Marker / Right-click
   Slash Command Smoke", items 6, 7, and 10: open the command palette
   (`Cmd+Shift+P`), confirm the same safe Markdown actions as the
   right-click slash menu, confirm a selected range is preserved on
   table insertion, and confirm Japanese / kana search (`見出し` /
   `みだし`) finds the English-labelled heading command.
10. **Context-menu viewport containment (v1.2).** See the same section,
    item 8: right-click near the bottom edge (opens upward), near the
    right edge (aligns from the right), and near the left edge (stays
    inside the 8px inset). Confirm `Escape`, running a command, and
    clicking outside close the menu.
11. **EPUB export scope note (v1.2).** See "v0.33 EPUB Export Smoke":
    open the EPUB export action and confirm the metadata dialog carries
    the in-app scope note (e-book Mode is a reading preview, the EPUB
    targets a single Markdown document, Hazakura is not a full EPUB
    production tool) in both Japanese and English.
12. **No-regression surface.** Confirm the command palette and slash
    menu expose only the existing allowlisted Markdown insertion /
    wrapper actions. Confirm no arbitrary command execution, formatting
    toolbar, Git status, background indexing, or new Agent / Review
    surface appears. Confirm Markdown source stays canonical and Save
    remains explicit after every action above.

### Local package evidence

13. The signed `1.2.0` App Store / TestFlight candidate pkg passes
    package signature and checksum verification, enforced App Store
    entitlement probe, and sandbox-preview smoke. Per-build pkg path /
    SHA-256 live in `docs/internal/app-store-candidates/latest.json`.
14. `npm run smoke:macos-window` confirms an onscreen packaged window.
    It does not replace manual interaction smoke.

### Built-app smoke status note

As of this intake, built-app right-click / command-palette / EPUB-dialog
interaction smoke (items 9-11) has not been exercised end-to-end on a
`1.2.0` candidate; only window-launch smoke passed. Treat items 9-14 as
open release checks, not as passed.

## App Store Surface Auto Smoke

Run this before submission-facing builds, metadata review, or App
Review-note finalization when the concern is App Store / Developer lane
separation:

```bash
npm run smoke:app-store-surface
```

This lightweight smoke groups the source-level checks that the App
Store lane hides Agent Workbench / CLI Agent commands and settings,
allows the Hazakura Local Assist surface and helper configuration, avoids
visible developer-lane badges, and covers the retired Review Desk
proposal-import path at source level. It does not prove signed
bundle identity, sandbox behavior, native file-picker interaction,
external network absence, App Store Connect processing, or TestFlight
user flows.

## v0.32 Editor / Reader Position Bridge Built-App Smoke

Run this before treating the v0.32 editor / reader bridge as ready for
App Store review. Use the latest built desktop bundle, not browser-only
Preview, because this flow depends on the real editor surface, right-pane
mode controls, Reading Focus, restored dirty buffers, and native focus.

1. Open a saved multi-heading Markdown document in the built app.
2. Put the editor caret or visible scroll position in a later chapter,
   open e-book Mode, and confirm the reader opens near that chapter
   rather than at the document start.
3. Move within e-book Mode, enter `集中して読む`, then use `編集に戻る`.
   Confirm the editor returns to the same chapter area or a nearby
   source line; exact rendered-page coordinates are not expected.
4. Move within the right-pane one-page reader and confirm the editor
   area follows to the same chapter area or a nearby source line without
   needing to enter Reading Focus.
5. While moving between the right-pane one-page reader and the Reading
   Focus spread reader, confirm the visible chapter/page remains linked
   rather than each surface keeping a stale independent position.
6. Create a new unsaved Markdown tab with at least two headings, move the
   reader to a later chapter, then create or switch to another unsaved
   Markdown tab. Confirm the second tab does not inherit the first
   untitled tab's e-book chapter/page position. Switch back and confirm
   the first tab's reader position is still coherent.
7. Exercise one recovered dirty-buffer path: either restore an
   auto-backup through the backup comparison flow or restore a saved
   draft after relaunch. Open e-book Mode and return from Reading Focus.
   Confirm the buffer remains dirty/unsaved, Save is still explicit, and
   the reader/editor bridge follows the restored contents rather than a
   stale disk copy.
8. While in any of the above flows, confirm Preview, L Mode, Diff /
   Review, and saved Markdown source remain source-preserving. The reader
   must not rewrite Markdown, auto-save, or create a second document
   model.
9. Record the result as normal / unsaved / recovered separately. A local
   window launch smoke, unit tests, or Vite build is useful evidence but
   does not replace these interaction checks.

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

28. In the Preferences dialog, the "Typewriter mode" toggle appears as a sub-option under the L Mode toggle, indented and dimmed when L Mode is off. In kana menu mode, confirm its hint is natural kana copy and contains no garbled Latin fragment.
29. With typewriter mode ON, the active line stays vertically centered in the viewport as the cursor moves or typing advances the collapsed caret. The scroller's `scroll-behavior: smooth` makes the recenter feel like a soft drift, not a snap. With it OFF, the editor uses the normal top-anchored flow.
30. With typewriter mode ON, make a range selection with Shift+Arrow and confirm the viewport does not jump just because a selection range is active.
31. Toggle the setting from the Preferences dialog and confirm the change takes effect without restarting the app.
32. In the Preferences theme selector with kana menu language, confirm the
    theme hint does not contain split-word corruption such as
    `じょうけ ん て ま す`.
33. In the Preferences auto-backup setting with kana menu language, confirm
    the hint uses `ほぞんしていない` rather than the kanji `未保存`.

## Safe Editor Core

Run when file I/O, tabs, close behavior, or save logic changes:

1. Open a throwaway workspace.
2. Create a Markdown file with New File and confirm existing-file overwrite is refused.
3. Edit and Save a file.
4. Confirm LF / CRLF and final-newline behavior are preserved unless explicitly changed.
5. Trigger an external-change conflict and confirm overwrite is stopped.
6. Trigger or simulate a save failure and confirm local edits remain recoverable.
7. Close a dirty tab and confirm Save / Discard / Cancel behavior.
8. Confirm the tab close button reads visually as a close affordance, not a plain circle or dirty/status marker: the `x` / icon is visible enough on hover and focus-visible, remains distinct from the dirty dot, and stays reachable for text tabs and image-preview tabs.
9. Close the app with dirty tabs and confirm Save All / Discard All / Cancel behavior.
10. Confirm intentionally discarded edits are not offered as recovery drafts after restart.
11. Confirm Japanese IME composition does not trigger save, search, close, open, or tab-close shortcuts.

## Workspace File Operations

Run when the file tree or workspace commands change:

1. Open a throwaway workspace.
2. Use the sidebar `+` to create a file and a folder.
3. Use a folder context menu to create a child file/folder.
4. Rename a file and confirm open tabs, dirty state, and comparison anchors remain coherent.
5. Move a file/folder to Trash and confirm user confirmation appears before destructive action.
6. Confirm paths outside the selected workspace cannot be targeted.
7. Treat workspace-internal drag/drop Move as experimental unless this exact flow is freshly confirmed in the built app.
8. In normal mode, collapse the left workspace sidebar and confirm the restore rail remains visible; restore it and confirm the file tree returns without changing the selected workspace or active tab.
9. Enter L Mode and confirm the normal sidebar restore rail is not shown; use the L Mode workspace button to open and close its temporary file-tree drawer.

## Preview And Authoring

Run when Markdown preview, image assets, export, or authoring helpers change:

1. Confirm sanitized Markdown preview renders headings, lists, tables, code blocks, blockquotes, task checkboxes (`- [ ]` / `- [x]` as display-only checkbox glyphs, not raw marker text), and local workspace-relative images such as `assets/...` and `docs/images/...`.
2. For a manuscript in a child folder with `../assets/cover.png`, open the project parent as the workspace and confirm the image appears in Preview, exported HTML, and PDF. Reopen only the child folder and confirm all three surfaces show a blocked note with **outside-workspace** reason and parent-folder next action (Theme G M0/M1). Also confirm a drag-dropped `assets/...` image loads and a missing workspace image shows a **load-failed** note.
3. Confirm external `https://` image URLs stay blocked by default (remote Preference off) and show a **remote** reason without a live `<img src="https://…">`. Absolute outside paths show **absolute-outside**.
4. Click a workspace-relative Markdown link to a supported text file and confirm it opens as an app tab without leaving the current app shell.
5. Click an external Markdown link such as `https://hazakura.dev/` and confirm the main app WebView does not navigate away; the link opens in the OS default browser/new external window.
6. Paste or drag-drop an image and confirm `assets/<hash>.<ext>` is created and Markdown image syntax is inserted.
7. Export HTML and confirm local workspace images are inlined and the saved file uses the same preview CSS as the live preview pane (`.markdown-preview` rules, no theme-specific overrides inlined).
8. Export PDF and confirm the selected `.pdf` file is created without opening a browser or macOS print dialog, and that the rendered Markdown content is present.
9. Insert a Markdown table and confirm the app does not imply row/column table editing beyond the implemented helper.

## Theme G Media Boundaries Smoke (v1.13+)

Run after Theme G media work (M0–M4) or before treating media consent as
packaged-app proven. Prefer a **fresh desktop bundle** (`npm run build` or
Developer app), not browser-only Preview. Defaults must stay safe: remote Off,
outside-local Ask, export materialize On, no silent Markdown rewrite.

### Fixtures (manual, throwaway)

1. Create a temp tree, e.g. `media-smoke/book/chapter.md` and
   `media-smoke/assets/cover.png` (any small PNG).
2. In `chapter.md` put:
   - `![cover](../assets/cover.png)` (outside-workspace when root is `book/`)
   - `![remote](https://example.com/does-not-need-to-exist.png)` (blocked by default)
   - optional: `![ok](assets/local.png)` after pinning or drag-drop into `book/assets/`

### M0 — Honest block reasons

1. Open **`book/`** as the workspace (not `media-smoke/`). Open `chapter.md`, show Preview.
2. Confirm the cover image is **not** shown as an `<img>` from disk outside root.
3. Confirm a blocked note with reason for **workspace-外相対** / next action mentioning
   parent workspace or assets, and stable machine key available in DOM if inspected
   (`data-hazakura-image-block="outside-workspace"`).
4. Confirm remote shows **remote** reason without network flash or live remote `src`.

### M1 — Outside-local consent

1. With outside policy **許可してから読む** (default), click
   **「この画像の親フォルダを許可して表示」** on the cover note.
2. Confirm the cover image appears in Preview after approve (current tab only).
3. Open e-book for the same doc and confirm the same image policy (approved root shared).
4. Close the tab and open `chapter.md` again. Confirm **許可してから読む** asks
   again and does not reuse the previous parent-folder approval.
5. Switch to **すべて読む（OS が許可した範囲）** and confirm the local cover can
   load without the per-folder control. Confirm this does not enable remote URL
   loading while the separate remote toggle is Off.
6. Restore **許可してから読む** and confirm the current tab returns to the
   explicit blocked/approve path.

### M2 — Remote Preference (default Off)

1. Confirm Settings **Preview でリモート画像を読み込む** is Off; remote stays blocked.
2. Turn **On**, reopen Preview, confirm https remote may load **or** fail soft with
   load-failed / network error — never silent blank without a note. Confirm **http://**
   remains blocked if you try a non-TLS URL.
3. Turn remote **Off** again before other smoke (keep default-safe evidence).

### M3 — Export materialize

1. With cover approved (M1) and materialize **On** (default), export **HTML**,
   **PDF**, and **EPUB**. Confirm the cover is embedded when resolvable; the PDF
   first page is not blank, and EPUB XHTML points to a packaged `OEBPS/images/…`
   resource instead of displaying the original path. Remote remains not packaged
   unless remote Pref is On and materialize On.
2. Turn materialize **Off**, export once, confirm outside/remote are not newly
   fetched into the package; blocked notes or warnings remain honest.
3. Restore materialize **On**. Confirm Markdown source on disk is unchanged
   throughout (no silent path rewrite).

### M4 — Pin external images (Command Palette)

1. Keep remote Preview **Off** and include one `https` image. Run pin, decline the
   warning, and confirm no remote request, asset copy, or source change occurs.
2. Run pin again and approve the warning; a missing remote may fail soft, while
   the local outside-workspace image can still be pinned.
3. With `book/` workspace, `chapter.md` still using `../assets/cover.png`, open
   Command Palette and run **外部画像を assets に固定…** /
   **Pin external images into assets…**.
4. Confirm status reports pinned count and **save to keep on disk**.
5. Confirm buffer is dirty, Markdown now references `assets/…` under the workspace,
   and a new file exists under workspace `assets/`.
6. **Cmd+Z** once restores the previous Markdown (one Undo step). Redo may restore
   the pin edit.
7. Save explicitly; confirm disk source matches the pinned paths. Confirm Preview
   loads the new workspace-relative image without outside approval.
8. Refuse path: with Assist generation lock or IME composition active if available,
   confirm pin is refused without partial rewrite (Assist-lock message or status).

### Preferences surface

1. Open Settings → **表示とメディア** / **Display & media**.
2. Confirm two outside modes (ask / allow), remote toggle + privacy hint,
   materialize toggle. Confirm no remembered-folder option remains.
3. Confirm Japanese / English / kana labels are readable (no raw English key leaks
   in ja/kana UI).

Record pass/fail per subsection. `npm run smoke:macos-window` does **not** replace
these interactions. Do not claim App Store / TestFlight proof from Developer bundle
alone.

## v0.33 EPUB Export Smoke

Run this before treating the v0.33 EPUB export polish as ready for
TestFlight or v1 release-candidate claims. This is manual app proof, not
an in-app EPUB validator workflow.

1. Open a Japanese Markdown document with ATX headings, body prose,
   a workspace-local image, an external image URL, an external link,
   a code block, a table, and a blank-line-flanked standalone `---`
   page-break hint.
2. Choose the EPUB export action and confirm the metadata dialog is
   labelled `EPUB書き出し` / `EPUB Export`, with editable title, author,
   and language fields. Confirm the scope note states that e-book Mode is
   a reading preview, the exported EPUB targets a single Markdown
   document, and Hazakura is not a full EPUB production tool (Japanese
   and English copy both present).
   Confirm the same dialog states whether unsaved changes are included, how
   unavailable images are reported, and that the concrete `.epub` destination
   is chosen in the next Save dialog.
3. Save the `.epub` and confirm a successful export status appears. If
   the document includes an unavailable image, confirm the status says
   the EPUB was saved with image warnings rather than silently claiming a
   clean export.
4. Inspect the generated archive outside the app. Confirm nav/content
   XHTML exist, headings appear in navigation, the selected language is
   reflected in `lang` / `xml:lang`, workspace-local images are packaged,
   external images are replaced with an in-content warning, links remain
   links, code blocks remain readable, tables keep basic borders, and
   page-break hints split the content XHTML and OPF spine in reading order.
5. Confirm the export does not rewrite Markdown source, create a second
   document model, launch EPUBCheck, run external validators, or expose
   cover / navigation editor / advanced metadata workflows.
6. If `epubcheck` is used, run it manually outside the app and record the
   result as external evidence. Do not treat the app as having launched
   or automated validation.

Latest external proof note: on 2026-06-25, a proof fixture EPUB was
generated outside the app UI from Japanese Markdown containing headings,
a local image, an external image, link, code block, table, task list, and
page-break hint. Archive inspection confirmed nav/content XHTML,
packaged local image, external-image warning output, `ja` XHTML language
metadata, links, code, table, page-break output, and unchanged source
hash. External `epubcheck` completed with 0 fatal errors / 0 errors /
0 warnings. This does not replace built-app export dialog/status smoke.

## v1 Workspace Marker / Right-click Slash Command Smoke

Run this before treating the v1 workspace marker and right-click
slash-command fit-and-finish as built-app proven. Use the packaged
desktop app, because this checks actual CodeMirror focus, context-menu
handling, and workspace-tree rendering.

1. Open a workspace with at least two Markdown files, then open both
   files as tabs.
2. Confirm the active file remains visually distinct in the workspace
   tree and both open files show a subtle open marker.
3. Edit the inactive open tab without saving. Confirm the workspace tree
   shows it as open and unsaved, matching the tab dirty dot. Repeat with
   an encoding-only or line-ending-only dirty change when practical.
4. Save the dirty file and confirm the unsaved marker clears while the
   open marker remains.
5. Open an untitled tab and a file outside the selected workspace.
   Confirm neither creates a workspace-tree marker.
6. In the editor, select text and right-click inside the selection.
   Confirm the slash-command menu opens and a wrapper command such as
   bold, italic, inline code, or link applies to the selected source text
   without saving automatically.
7. Right-click with no selection and run an insert command such as a
   heading, task list, or table. Confirm the insertion happens at the
   clicked editor position.
8. Confirm `Escape`, running a command, and clicking outside the editor /
   menu close the slash-command menu. The workspace tree and tab bar
   context menus should keep their existing behavior. Right-click near the
   bottom edge and confirm the menu opens upward; repeat near the left and
   right edges and confirm it remains inside an 8px viewport inset.
9. Repeat a light check in L Mode's workspace drawer. The marker state
   should match the normal workspace sidebar and should not imply Git
   status, background indexing, or a full file-manager model.
10. v1.2 command discovery alignment: open the command palette
    (`Cmd+Shift+P`) and confirm the same safe Markdown actions reachable
    from the right-click slash menu are also in the palette — at minimum
    headings, bullet / numbered / task lists, quote, code block, divider,
    image, strikethrough, bold, italic, inline code, link, and the
    3-column table plus today's date / current time. With a selected range,
    confirm table insertion does not delete the selection. The palette is a
    single command surface for these actions, not a second system. With the
    menu language set to Japanese or kana, search for `見出し` / `みだし`
    and confirm the English-labelled heading command is discoverable.

Latest local app note: on 2026-06-30, `npm run smoke:macos-window` rebuilt
the App Store preview and Developer / GitHub lanes, launched `Hazakura
Editor Dev.app`, confirmed an onscreen 1280x820 window, and quit it. This
proves packaged window launch only; the right-click containment and
localized Command Palette interaction steps above remain manual smoke.

## Help Link Routing

Run when the Help document shell, Support Diagnostics intro, Markdown
link routing, or external URL handling changes:

1. Open Help / Privacy Policy / Local Data Disclosure / About / Open Source Acknowledgements.
2. Click any public URL shown in the Help body or footer, such as the privacy/support site URL, and confirm the Preferences / Help dialog and main app shell remain visible.
3. Confirm the URL opens in the OS default browser/new external window.
4. Confirm unsafe schemes such as `javascript:` do not open externally and do not navigate the app WebView.
5. Open Support Diagnostics and repeat the same check for links in the diagnostics Help intro.

## Retired Review Desk Surface / AI Review

Run when retired Review Desk exposure, candidate comparison, or App
Store surface visibility changes:

1. Open a text file and confirm the normal chrome does not show a manual
   Review Desk entry point.
2. Close all text tabs or switch to a non-text/image-only surface and
   confirm no Review Desk entry point appears.
3. Confirm `Cmd+Shift+R` does not reload the WebView or move focus
   unexpectedly, and does not open a hidden Review Desk surface.
4. Confirm View menu, command palette, and slash menu do not add manual
   Review Desk open actions.
5. Confirm active-tab versus disk review still opens through the existing
   Diff / Review changes route.
6. Confirm auto-backup restore review still applies only to the compared
   document, leaves the file unsaved, and keeps Save explicit.
7. Confirm Hazakura Local Assist edit review still exposes diff, discard, and
   close decisions without auto-saving.

2026-06-21 local Developer / GitHub app note:

- `npm run smoke:macos-window` rebuilt the macOS lanes and confirmed
  `Hazakura Editor Dev.app` showed an onscreen window.
- The earlier Review Desk native file-import smoke was retired before
  release. The current source-level smoke covers absence of manual Review
  Desk entry points and preservation of the internal candidate comparison
  primitive.
- This is local Developer / GitHub app evidence only. It is not signed
  App Store / TestFlight, sandbox, upload, or notarization proof.

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

## Hazakura Local Assist (v0.12 live local preview)

Run when `src/lib/tauri/appleAssist.ts`, `src-tauri/src/commands/apple_assist.rs`, `src-tauri/src/commands/apple_assist_supervisor.rs`, `src-helpers/apple-assist/`, `useAppleAssistAvailability`, `useAppleAssistCandidate`, `src/lib/locale/appleAssist.ts`, or the Hazakura Local Assist companion / command palette entries change.

1. Build the live helper with `npm run build:apple-assist-helper:live`; confirm the probe smoke returns an availability envelope. On a Mac where Apple Foundation Models is available and `SystemLanguageModel.default.supportsLocale()` is true, optionally run `HAZAKURA_APPLE_ASSIST_LIVE_SMOKE_GENERATE=1 npm run build:apple-assist-helper:live` and confirm a candidate or honest error envelope.
2. Confirm helper-enabled builds emit `dist/apple-assist.html` and that `npm run build:developer-preview` / `npm run build:app-store-preview` bundle `Contents/MacOS/hazakura-local-assist-helper` and sign it with the local app bundle.
3. Open the Hazakura Local Assist window in the built app and confirm it renders the Local Assist companion UI, not the Safe Editor shell/start panel. It must not expose `ファイルを開く`, `フォルダを開く`, `新規ファイル`, workspace browser, Preview/e-book controls, or other main-window file/workspace actions.
4. Confirm clicking first-party UI in the Hazakura Local Assist window never shows `Command is not allowed from window 'apple-assist'.` If that message appears, record it as an entrypoint/capability isolation bug, not as an acceptable user-facing error.
5. Confirm the Settings / Agent Workbench Preferences surface does not list Hazakura Local Assist as a CLI agent provider — it is a separate Assist Surface provider class.
6. Launch the built app and confirm `hazakura-local-assist-helper` is not running before the Local Assist surface is explicitly opened. Opening the command palette alone must not spawn the helper or show Foundation Models errors.
7. Confirm no menu entry, status bar item, autosave path, or background timer runs Hazakura Local Assist generation without an explicit user request.
8. In the built app, select `Hazakura Local Assist (Preview)`, restart if prompted, open the companion from normal editor, choose a preset such as `校正だけ` or `読みやすく`, and confirm the preset inserts editable request text before sending.
9. Repeat item 8 in L Mode. Confirm the compact AI-change affordance appears and `差分を開く` / `差分を閉じる` works.
10. Choose `要約`, `続きの案`, or `章レビュー`; confirm it follows the same unsaved AI edit transaction / Diff review flow rather than a separate result-only display.
11. Confirm Agent Window and Hazakura Local Assist Window still replace rather than coexist as the primary external companion.
12. Confirm user-visible status/error copy does not expose raw helper error text, Foundation Models `debugDescription`, prompts, hidden instructions, broad document excerpts, file paths, secrets, or provider internals.
13. (Supervisor regression, optional) Build the fixture helper with `npm run build:apple-assist-helper:fixture` and run `HAZAKURA_APPLE_ASSIST_HELPER_FIXTURE=binaries/hazakura-local-assist-helper-aarch64-apple-darwin cargo test apple_assist_supervisor --manifest-path src-tauri/Cargo.toml`.

Latest light manual note: on 2026-06-21, user-side built-app smoke
confirmed the dedicated Hazakura Local Assist UI opened, the helper was
not present in Activity Monitor memory before opening the Local Assist
window, and a simple request could be generated/applied and checked
through the diff/update flow. Treat this as light local confidence, not
as signed submit-lane, TestFlight, or App Review proof.

## Release Packaging

Run when preparing a warning-expected DMG preview:

1. Follow `docs/source-release-checklist.md` for source gates.
2. Build the warning-expected DMG with `npm run build:dmg-preview`.
3. Verify checksum with `shasum -c`.
4. Verify image with `hdiutil verify`.
5. Mount the DMG and inspect the contained app metadata.
6. Run `codesign --verify --deep --strict --verbose=2` on the built or mounted app.
7. Confirm `codesign -dv --verbose=4` reports `Authority=Developer ID Application:` for the Developer / GitHub app.
8. Run `spctl` and confirm any rejection or inconclusive result is described as expected for a not-notarized preview build, not as a codesign failure.
9. After GitHub Release publication, download assets into a fresh temp directory and repeat checksum, DMG, mounted-app metadata, and codesign verification.


## v1 / v0.36 Golden Manuscript Smoke

Run this before treating the current v0.36 source state as ready to
freeze for v1.0. The Golden Manuscript is
`docs/samples/golden-manuscript.md` — a realistic Japanese long-form
document that exercises every v1 surface in one pass. Use the latest
built desktop app (or TestFlight build), not browser-only Preview,
because this covers native file dialogs, e-book pagination, Local Assist
transactions, recovery, and relaunch.

### Preparation

1. Copy `docs/samples/golden-manuscript.md` into a throwaway workspace
   folder so workspace-relative image references resolve. Add a small
   PNG image at `assets/sample.png` if you want to exercise image
   display inline (the manuscript references it optionally).

### Golden-path checklist

Check each item against the Golden Manuscript. Record normal / unsaved /
recovered state separately where relevant.

1. **New File**: create a new Markdown tab, paste the Golden Manuscript
   content. Confirm headings, paragraphs, lists, blockquote, table, code
   block, and horizontal rule all render in the editor.
2. **Open**: open the saved `golden-manuscript.md` from the workspace.
   Confirm the content loads and the workspace tree shows it as open.
3. **Save / Save As**: save the file. Use Save As to create a copy.
   Confirm both files are coherent (known limitation: Save-As resets
   scroll/undo before the v1.1 editor-session-id follow-up).
4. **L Mode**: enter L Mode (`Cmd+Shift+L`). Confirm headings render
   hierarchically, paragraphs flow as serif prose, the blockquote shows
   as a pull-quote, the table shows with borders, and the horizontal
   rule shows as a divider. Exit L Mode and confirm source is unchanged.
5. **Preview**: confirm the preview pane renders all elements. If a
   workspace image was added, confirm it displays. Confirm the external
   link is clickable and opens in the OS browser.
   When Preview is disabled in Preferences and the menu language is kana,
   confirm the reason is shown in kana rather than the kanji `無効`.
6. **e-book Mode**: open e-book Mode. Confirm the manuscript paginates
   across H1 / H2 chapter groups, with H3+ headings staying inside the
   current chapter. Confirm page navigation (next/prev) works, one
   action does not skip over pages or multiple chapters, and the
   horizontal rule acts as a chapter or page-break hint. Confirm images
   display if present and the reader position does not jump backward
   after images finish loading.
7. **Spread View**: if the viewport is wide enough, confirm the
   two-page spread renders and page navigation moves by the spread
   width.
8. **Heading jump**: in the editor, use heading navigation or outline
   to jump to a later chapter. Confirm the preview / e-book reader
   follows to the same area without a one-beat lag.
9. **Editor / reader return**: in e-book Mode, enter `集中して読む`
   (Reading Focus), then use `編集に戻る`. Confirm the editor returns
   to the same chapter area.
10. **EPUB export**: export the manuscript as EPUB. Confirm the
    metadata dialog, successful export status, and that all elements
    (headings, table, code block, links, page-break hints) appear in
    the generated archive. Run `epubcheck` manually outside the app.
    Open the exported EPUB in an actual reader such as Apple Books or
    Kindle Previewer and confirm blank-line-flanked `---` / `===`
    markers become real page boundaries in the reading order.
11. **Local Assist**: select a paragraph in Chapter 4 (the Local Assist
    review text). Run a Local Assist action (`読みやすく` or `要約`).
    Confirm the result opens in Diff review, can be discarded without
    saving, and the editor returns to the original state. Confirm the
    assist-lock prevents edits while a generation is in flight, and that its
    live status announcement follows the active English / Japanese / kana
    menu language.
12. **Diff / Discard**: after generating a Local Assist result, open
    the diff view, confirm the before/after is correct, then discard.
    Confirm the buffer is unchanged and the tab is not dirty.
13. **Recovery**: edit the file to trigger an auto-backup. Relaunch the
    app. Use Restore from Auto-Backup, confirm the backup-vs-buffer
    comparison opens, apply the backup, confirm the tab is dirty and
    Save is still explicit.
14. **Relaunch**: quit the app with the workspace and multiple tabs
    open. Relaunch. Confirm the workspace and tabs are restored.
15. **Large document**: paste the Golden Manuscript content 10× into a
    single tab. Confirm typing, scrolling (especially trackpad inertial
    scroll in Preview), and heading jumps remain smooth.
16. **Trackpad inertial scroll**: in Preview, use a trackpad to inertial-
    scroll a tall document. Confirm smooth motion without stutter or
    fighting.
17. **Scrollbar drag**: drag the editor scrollbar, release, then scroll
    with wheel/trackpad. Confirm the editor does not stick near the
    previous caret position.
18. **prefers-reduced-motion**: enable "Reduce Motion" in System
    Settings → Accessibility → Display. Confirm animations (dialog
    open, toast, slash menu, save affirmation) are suppressed.
19. **Keyboard repeat guard**: in e-book Mode, hold the next-page key
    long enough for OS key repeat to fire. Confirm only the first key
    press advances the reader until the key is released and pressed
    again.
20. **Reference Compare discovery**: confirm `参照ファイルを横に開く…` is
    available from the native File menu and Command Palette. Right-click a
    supported workspace file and an open text tab; confirm both show
    `参照として横に開く` and open the selected file as the read-only **right**
    reference preview without replacing the active editable Markdown in the
    center. Confirm this is not Diff layout.
    Confirm L Mode is visually separated from the right-pane controls and
    `参照` is selected while the reference is visible. Switch from `参照` to
    Preview, then back to `参照`; confirm the same reference returns without a
    picker. Use the in-pane close action and confirm the reference session ends.
21. **Reference PDF raster**: import a multi-page PDF and confirm the **right**
    reference shows the actual page image rather than only the filename/page
    alt text, while the draft remains editable in the center. Exercise
    next/previous page, fit width, and 150%; keep the existing CSP unchanged
    (`data:` allowed, `blob:` not required). At 150%, confirm the page is 1.5
    times the fitted pane width and every edge can be reached with native
    scrolling. Focus the zoomed page and confirm Arrow keys plus Page Up / Page
    Down pan the page without changing the PDF page. While a page is
    rendering, confirm the live status announces localized loading copy rather
    than an ellipsis-only placeholder. With the menu language set to kana,
    confirm the 150% control announces `かくだい`; then force a stale PDF
    handle and confirm the error uses kana copy while an unknown diagnostic
    detail remains visible. In the editor's find bar, confirm the kana
    previous-match button is announced as `まえへ`.
22. **Pathless recovery cleanup failure**: with a disposable localStorage
    failure fixture, exercise Save As, Restore, Discard, dirty-tab close, and
    Discard All. Confirm the requested edit/close action still completes, the
    status says recovery cleanup/storage is unavailable instead of plain
    success, and a stale candidate is treated as possible on relaunch. Then
    repeat with storage available and confirm the candidate is removed.
23. **Text-reference DOM budget**: open a 5,000-line Japanese text reference in
    a narrow pane and confirm wrapping, scrolling, selection, and copy remain
    correct. Then open disposable fixtures just over 1.5M characters and just
    over 50,000 logical lines. Confirm both fail with the localized size reason,
    the editable buffer is unchanged, and an already-open reference is not
    replaced. Generate the deterministic disposable set with
    `npm run smoke:fixtures:v1.8-reference`; it writes only to the OS temporary
    directory unless an explicit output directory is supplied.
24. **Search-surface keyboard / VoiceOver semantics**: open Quick Open,
    Command Palette, and Global Search. Confirm VoiceOver announces each as a
    modal search surface, reports the active result while Arrow Up / Down keeps
    focus in the text field, and announces Global Search progress / summary.
    Switch through English, Japanese, and kana; confirm the missing-workspace
    hint and a runtime search failure follow the active language, retain useful
    diagnostic detail, and do not also announce the zero-match state.
    Confirm Enter runs the active result, Escape closes the surface, and IME
    conversion Enter / arrows are not intercepted.
25. **Localized rename VoiceOver name**: switch the menu language through
    English, Japanese, and kana. Start inline rename for both a file and a
    folder; confirm VoiceOver announces the localized rename action together
    with the original entry name, while Enter commits and Escape cancels.

### v1.1 Continuity Evidence (2026-06-29)

- Built app: README -> AGENTS -> README restored the Editor cursor/scroll
  and Preview region independently.
- Built app: Preview -> e-book Mode -> Preview restored the Preview region.
- Built app: a safe local Markdown link opened the documentation index;
  returning to README restored the prior Editor and Preview areas.
- Local Recovery: with Auto Backup explicitly enabled, the timed `.bak`
  captured an unsaved marker, forced termination left the saved source
  unchanged, relaunch restored the workspace/draft, and explicit Restore
  produced a dirty buffer. Auto Backup was returned to its prior off state.
- Google Drive Recovery: `manual-blocked`; no dedicated disposable fixture
  existed, so user cloud content was not created or scanned.

### v1.8 Daily Trust Evidence (2026-07-12)

- `SKIP_BUILD=1 npm run smoke:macos-sandbox-preview` passed against the latest
  source-built App Store preview. Deep signature verification succeeded; the
  app carried sandbox, user-selected read/write, and app-scoped bookmark
  entitlements; both bundled helpers carried sandbox + inherit entitlements.
- On 2026-07-13, the latest local App Store preview bundle passed
  `SKIP_BUILD=1 bash scripts/smoke-macos-window.sh` with an onscreen
  1282x822 window. A packaged AX-tree inspection of the same bundle exposed
  the Japanese tab row/list, tab close names, pane controls, workspace tree,
  and Editor region; this does not claim spoken VoiceOver or signed TestFlight
  interaction.
- Window launch smoke was intentionally not run because the script first quits
  an existing app with the same bundle ID. This pass did not interrupt the
  user's running Hazakura Editor and does not claim picker interaction.
- `npm run build:macos-lanes` produced the separate-ID Developer bundle, and
  `SKIP_BUILD=1 npm run smoke:macos-window` confirmed its `1280x820` window.
  Using a disposable `/private/tmp/hazakura-v1.8-smoke` fixture, the native
  picker opened a workspace; `reference.txt` opened read-only beside the active
  Markdown editor, and Preview -> Reference preserved the reference session.
- A second disposable, ad-hoc separate-ID app was force-terminated with an
  unsaved pathless `untitled.md`. Relaunch offered `Restore draft`; restoring
  opened a new unsaved tab and preserved `RECOVERY-MARKER-2026-07-12`. This
  proves the local Developer/ad-hoc interaction path only; signed TestFlight
  picker, pathless recovery, and VoiceOver interaction remain follow-up proof.
- T-1 L Mode continuity was exercised in the rebuilt separate-ID Developer app.
  With `reference.txt` loaded and a fresh unsaved edit in `manuscript.md`, L Mode
  hid the Reference pane without closing its session. Returning to edit mode
  restored the same read-only reference, and `Command-Z` removed only the edit
  made before the L Mode remount. This is local Developer evidence; repeat the
  Markdown/non-Markdown and signed TestFlight breadth before a v1.8 candidate.
- S-2 deterministic Rust recheck on 2026-07-13 ran the full suite three times
  serially on current HEAD. Each run passed **338 tests / 2 explicit
  host-integration ignored / 0 failed**; this does not replace the interactive
  bookmark/Trash host checks.
- S-1 packaged missing-workspace smoke on 2026-07-13 used a fresh isolated-ID
  Developer bundle with no restored workspace. `⌘⇧F` opened Global Search and
  exposed the `Find in files…` combobox plus `Open a workspace to search its
  files`, without a false zero-match message. With the workspace path then
  replaced by a regular file in a disposable fixture, searching `marker`
  surfaced `Selected workspace path is not a folder.` without a false
  zero-match result; the fixture directory was restored afterward.
- App Store sandbox preview recheck on 2026-07-13: `SKIP_BUILD=1 npm run
  smoke:macos-sandbox-preview` passed on current HEAD. The app and both helper
  deep signatures were valid; app sandbox, user-selected read/write,
  app-scoped bookmark, and helper sandbox + inherit entitlements were verified.
  Picker interaction and signed TestFlight behavior remain separate evidence.
- Source a11y follow-up on 2026-07-13 added an explicit `aria-live="polite"`
  contract to the Reference Compare empty-editor hint. Focused AppWorkspace
  coverage and the full frontend suite passed; the narrow-pane Draft /
  Reference toggles now also expose `aria-pressed` inside a localized named
  toolbar and have a focused regression. This improves the source
  announcement/selection path but does not claim spoken VoiceOver or signed
  TestFlight. Locale coverage also pins the same toolbar key set and the
  English / Japanese / kana labels; the contextual Slash command listbox and
  open-file tab row/list and primary Editor pane have corresponding localized
  accessible-name regressions. Workspace file rows also expose localized open /
  unsaved state labels in the source tree contract; loading and per-folder
  truncation notices are localized through the same file-ops copy. Text and
  image tab close controls use the active English / Japanese / kana locale
  rather than an English-only accessible name. Dirty tab descriptions use the
  same localized unsaved-state copy. The Editor full-path copy button uses a
  kana accessible name when the menu language is kana.
  Reference Text/Image panes use the kana read-only role label instead of an
  English fallback when the menu language is kana.
- App Store surface smoke on 2026-07-13: `npm run smoke:app-store-surface`
  passed (**10 files / 99 tests**) for pane controls, Command Palette, settings,
  review-state, and distribution-lane contracts.
- Local PDF visual follow-up on 2026-07-13 rendered pages 1–3 of the existing
  nine-page export with Poppler. No clipping was visible and all four sampled
  page corners were white. Poppler reported a local `Adobe-Japan1` language-
  pack limitation, so a Japanese Markdown fixture was exported separately and
  opened in macOS Preview; Japanese glyphs were visible within the A4 margins,
  and Preview's accessibility tree exposed the same text. This closes the local
  Developer visual check; signed TestFlight export breadth remains open.
- S-3 used the deterministic `smoke:fixtures:v1.8-reference` output in the
  separate-ID Developer app. The 5,000-line Japanese reference wrapped in the
  narrow pane, scrolled through `END-MARKER-5000`, and allowed marker selection.
  The 1,500,001-character and 50,001-line fixtures both failed with the localized
  English/Japanese limit reason while `EDITOR-BUFFER-MARKER` and the original
  reference remained unchanged. A full-reference copy was then pasted into a
  disposable editor buffer and the `END-MARKER-5000` tail was confirmed; the
  fixture was restored to its original SHA-256 without reading clipboard contents
  directly. Repeat this breadth on signed TestFlight before a v1.8 candidate.
- The latest-HEAD separate-ID Developer bundle opened Quick Open, Command
  Palette, and Global Search by keyboard. Its macOS accessibility tree exposed
  localized Japanese and kana dialog/combobox names for Command Palette and
  Global Search, plus localized Japanese pane toggle and splitter labels.
  Focus/active-result semantics and Escape dismissal remained intact. This was
  an AX-tree inspection, not actual VoiceOver speech. On 2026-07-13, the
  installed public `1.7.0` build `85` repeated `⌘⇧P` / `⌘⇧F` and native
  `表示`-menu traversal successfully; this is public-build keyboard/menu
  evidence only. Repeat the spoken flow and signed TestFlight breadth before
  a v1.8 candidate.
- The latest-HEAD separate-ID Developer bundle displayed the shared
  source/image/destination preflight summary in both PDF and EPUB settings.
  A follow-up export included unsaved markers in both generated formats without
  changing the source file. The EPUB archive retained Japanese metadata, two
  ordered content documents, and the unavailable-image replacement. The PDF
  background fix rendered nine A4 pages with white sampled edges on every page.
  Poppler reported a local `Adobe-Japan1` language-pack limitation during this
  proof; the local Developer Japanese-glyph check is recorded above. Repeat
  both exports on a signed TestFlight candidate.
- S-1 source-level failure/limit review on 2026-07-13 passed the Global Search
  accessibility/error checks (**3 frontend files / 16 tests**), Rust workspace
  search cap/error checks (**14 tests**), and PDF export bounded-failure checks
  (**7 tests**). No source defect was reproduced at that source-only checkpoint;
  the later isolated packaged missing-workspace and workspace-path failure
  smoke is recorded above.
- T-2 source-level cleanup review on 2026-07-13 added a pathless `Discard All`
  regression (**12 tests** in `useTabCloseFlow.test.tsx`). A failed recovery
  cleanup emits the explicit status and still completes the close; relaunch
  with a stale candidate and signed TestFlight interaction remain manual.
- T-3 PDF/image Reference smoke on 2026-07-13 selected the disposable
  `/private/tmp/hazakura-valid-text.pdf` in the separate-ID Developer bundle
  and opened workspace `reference-image.png` through the file-tree context
  menu. The right Reference pane showed read-only PDF page controls and the
  image while the center `EDITOR-BUFFER-MARKER` remained intact. This proves
  local PDF/image handling only; `ReferenceTextPane.test.tsx`,
  `ReferencePdfPane.test.tsx`, `useReferenceCompareActions.test.ts`, and
  `AppWorkspace.test.tsx` close/replace wiring and stale-raster checks passed
  (**48 tests** in
  the combined focused pass).
  Additional matrix cases and signed TestFlight interaction remain open.
- T-3 packaged Reference replacement follow-up on 2026-07-13 closed and
  reopened `reference-image.png`, then replaced it with the nine-page
  `/private/tmp/hazakura-v1.8-export-proof-20260712-fixed.pdf`. Page 2/9,
  fit-page, and 150% controls all worked in the separate-ID Developer bundle;
  the center `EDITOR-BUFFER-MARKER` remained intact. The Reference column was
  then narrowed to 25%; the image stayed contained and the marker remained
  intact. This extends local
  image/PDF matrix evidence only; signed TestFlight and spoken VoiceOver checks
  remain open.
- T-3 external-change follow-up on 2026-07-13 temporarily moved
  `reference-image.png` out of the disposable workspace without deleting it.
  The Reference pane showed `The reference file has changed on disk.` and an
  explicit `Reload`; restoring the path and reloading returned the read-only
  image. This closes the local source-deletion/reload behavior boundary only.
- P2 theme budget smoke on 2026-07-13 rebuilt the Developer bundle after
  connecting Edohigan's resident WebGL overlay to the shared intensity-aware
  DPR/frame budget. CRT, Edohigan, and Shinkai menu switches were exercised;
  after each boot animation the editor and Preview still exposed the original
  `EDITOR-BUFFER-MARKER`. CRT's intentionally low-readability appearance is
  expected. This proves local Developer behavior, not signed TestFlight,
  spoken VoiceOver, or measured device FPS.
- S-4 purpose-led discovery smoke on 2026-07-13 rebuilt the separate-ID
  Developer bundle and inspected its macOS accessibility tree in kana. The
  five Preview / Reference / e-book / Outline / Diff controls exposed
  localized task-oriented Help strings, while the editor, reference, and
  Preview markers remained intact. This proves the packaged tooltip/AX copy;
  signed TestFlight breadth and spoken VoiceOver remain open.

### Reporting

Record the build number, which items passed / failed / were skipped,
and any v0.36-specific regression found. Do not claim the RC is ready
until items 1-14 pass on a signed TestFlight build, and do not claim
the v0.36 page-turn / EPUB page-break proof until items 6, 10, and 19
are actually exercised.



When reporting smoke:

- State the app build or dev server used.
- State which section was exercised.
- State exact blockers when smoke was skipped or blocked.
- Do not claim manual smoke passed unless the interaction was actually performed.
