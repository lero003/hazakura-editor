# Current Status

Status: Operational
Scope: Current implementation state and next safe actions
Authority: High
Last reviewed: 2026-06-20 (v0.26 release prep)

## Current State

- `Hazakura Editor` is a Tauri desktop app for Markdown-first safe text editing.
- Current package/app version: `0.26.0` across npm, Tauri, Cargo, and lockfile metadata.
- Mac App Store listing: `Hazakura Editor`
  (`https://apps.apple.com/jp/app/hazakura-editor/id6778637880?mt=12`).
- Latest GitHub source / local-app tag: `v0.26.0`.
- Latest published downloadable preview: `v0.20.0` warning-expected DMG preview.
- `v0.18.0` is a Developer / GitHub lane preview, ad-hoc signed, not Developer ID signed, not notarized, and expected to show macOS security warnings.
- The helper-free App Store lane delivered `0.18.0` build `4` to
  TestFlight on 2026-06-12 with no reported Apple validation warnings;
  basic TestFlight launch / save smoke passed.
- The `0.19.0` App Store lane passed App Review and was published on
  2026-06-18, based on the user-provided public listing above. The
  tracked submit-lane candidate for that approval was build counter
  `14`; local package and signing evidence remain historical release
  evidence, not the next active queue.
- The helper-free App Store update for `0.25.0` has been reported as
  released on 2026-06-20. The tracked local package evidence is build
  `18`, generated on 2026-06-19:
  `src-tauri/target/universal-apple-darwin/release/bundle/pkg/HazakuraEditor-0.25.0-build18-mas.pkg`.
  Raw App Store Connect, TestFlight, and App Review logs are not tracked
  in this repository.
- The next helper-free App Store package candidate for `0.26.0` is local
  build `20`, generated on 2026-06-20:
  `src-tauri/target/universal-apple-darwin/release/bundle/pkg/HazakuraEditor-0.26.0-build20-mas.pkg`.
  SHA-256:
  `30a6a72ba8dd40e15943f8725284e3de548d4b3bd8a87887e7d9486915bbe361`.
  It has not been uploaded to App Store Connect in this repository
  state.
- Pre-approval human-side App Store lane smoke on 2026-06-12 passed launch,
  basic document creation/open, preview/export, image paste/drag-drop,
  App Store surface omission, dirty-close confirmation, Move to Trash,
  and network observation. Save As UX remains an observation, workspace
  restore is acceptable with a residual Google Drive /
  quit-before-interaction risk, and live accessibility was partial at
  that checkpoint. A `Cmd+Shift+F` global-search result activation bug
  found during smoke has a focused code-level fix.
- Older public tags and release assets remain immutable.
- Current active work is post-approval documentation closeout and the
  next product slice. Local pre-review regression, package, payload,
  dependency-audit, bundle metadata, license-resource, and bundle-size
  evidence remains archived under `docs/archive/operations/` or
  summarized in `docs/current-work.md`; it should no longer drive the
  main queue unless a new App Store build is prepared.
- The v0.20 Sakura workspace ergonomics slice is implemented locally:
  the main chrome can collapse / restore the workspace sidebar, the
  central editor pane keeps a thin bottom full-path copy bar for the
  active file, Markdown preview hierarchy is more card-like, and the
  selected workspace file has Sakura-specific accenting. The tab-row
  new-file `+` affordance was removed after visual review; New File
  remains available through existing menu, shortcut, and workspace-file
  actions. Workspace switching dropdowns remain deferred to preserve the
  simple single-workspace model.
- The v0.25 native-feeling Safe Editor chrome polish Phase 1 code/CSS pass
  is implemented: traffic-light-safe drag / no-drag rules, subtle editor
  focus visibility, truthful mode active state, e-book chrome token cleanup,
  segmented right-pane mode controls, and tokenized Diff row backgrounds.
  Human-side spot check found no blocker; keep targeted manual smoke as
  the final proof for actual macOS titlebar dragging and click hit-testing.
  The CSS-only glass follow-up was dropped (scrap-and-build); v0.25 now
  moves into native vibrancy via `window-vibrancy` with the macOS
  deployment target raised to macOS 26. See
  `docs/native-macos-appearance-plan.md`.

## Current Product Boundary

- Safe Editor remains the primary product surface.
- Markdown/text source remains the saved document model.
- Default Safe Editor Mode has no Git client, LSP, general terminal,
  arbitrary command execution, plugin system, project-wide indexing,
  auto-apply, or auto-commit behavior.
- Agent Workbench is optional and explicit. It may host one allowlisted
  `codex`, `opencode`, `pi`, or `claude` provider session in the
  selected workspace after restart-required enablement and
  responsibility-boundary consent.
- Manual Review Desk entry points are hidden for the current App
  Store-oriented surface. Diff, recovery review, and Apple Local Assist
  edit review remain explicit, unsaved, and inspectable.
- Workspace file operations are bounded to the selected workspace.
  Workspace-internal drag/drop Move remains experimental; New File, New
  Folder, Rename, and Move to Trash are the dependable file-tree
  operations.

## Implemented Surface Summary

- Safe open/edit/save for Markdown and text files, including LF / CRLF,
  final-newline, UTF-8 BOM, Shift-JIS, and EUC-JP handling.
- The sandbox-oriented direct save fallback preserves the normal atomic
  save path, and when direct write / sync fails after a partial write it
  attempts to restore the original bytes before reporting failure.
- Read-only preview for user-selected local PNG/JPEG/GIF/WebP image files
  up to 20 MB, including directly opened files outside the selected
  workspace.
- Clipboard image paste now rejects decoded PNG/JPEG/GIF/WebP payloads
  above the same 20 MB image boundary before allocating the decoded
  buffer; drag/drop image import keeps the existing 20 MB file-size cap.
- Multi-tab editor with dirty-tab close protection, app/window close
  confirmation, save-conflict recovery, and explicit draft recovery.
- No-workspace New File creates an untitled standalone Markdown tab
  without writing to disk. Save on a pathless untitled tab routes
  through Save As before writing, then the saved tab becomes an ordinary
  standalone file tab.
- The e-book right-pane toggle stays visible in the mode cluster when no
  active document is available, but is disabled and inactive until an
  editor document can drive the reading surface. Image preview keeps the
  control disabled even if a text tab remains open behind it, so stale
  prior-document content is not exposed from the button state.
- Normal Safe Editor chrome now exposes a main-chrome workspace sidebar
  toggle routed through the existing sidebar collapse flow. New File
  remains available through the native menu, keyboard shortcut, command
  palette, and bounded workspace-file actions rather than a tab-row `+`
  button.
- Auto-backup snapshots for a workspace file remain distinct even when
  multiple backups are captured in the same second; filenames include
  millisecond precision with a bounded collision suffix, and recovery
  listing stays newest-first.
- Normal Safe Editor mode can collapse and restore the left workspace
  sidebar without changing the file-tree model or L Mode drawer.
- The normal-mode status bar avoids duplicating the active `UTF-8` /
  `LF`-style format values in the passive detail when the trailing
  encoding and line-ending dropdowns already expose them.
- The misleading file-level Recent Files surface is removed from the
  start panel and native File menu. Legacy file-recent localStorage is
  cleared, while Recent Folders and explicit Open / Open Folder remain.
- The macOS About panel inherits canonical Tauri bundle metadata:
  publisher `Hazakura Lab` and
  `Copyright (c) 2026 Hazakura Lab. All rights reserved.`.
- Sanitized Markdown preview, local workspace image handling,
  standalone HTML export, and Print to PDF handoff.
- e-book Mode is a display-only right-pane reading surface for the active
  Markdown document. It uses the existing Preview safety pipeline,
  heading-based chapter splitting, CSS Columns pseudo-pagination for the
  active chapter, and a fixed reader footer with chapter-local page
  progress. Markdown source remains canonical; right-pane 2-up and
  whole-book page numbering remain deferred.
- EPUB export beta is available from the File menu and command palette
  as an explicit active-document export action. It writes a minimal
  `.epub` archive from the current Markdown source with XHTML content,
  generated heading navigation, dialog-scoped Title / Author / Language
  metadata, workspace image resources where readable, allowed small
  `data:image` resources, and a small stylesheet. The EPUB path strips
  Preview-only markup before XHTML output, handles inline Markdown in
  headings for navigation, ignores YAML frontmatter for export
  navigation/content, turns blank-line-flanked standalone `---` / `===`
  into explicit page-break hints, generates per-export UUID identifiers,
  and writes `dcterms:modified` from export time. It is not a second
  document model and does not claim reader-perfect pagination, vertical
  writing, cover asset management, multi-file book ordering, or in-app
  validator proof.
- Markdown preview and Help document links keep supported
  workspace-relative text files inside the app, but route explicit
  `http:` / `https:` / `mailto:` / `tel:` clicks to the OS default
  browser/app without navigating the main WebView.
- L Mode / えるモード as a source-preserving CodeMirror presentation
  layer, not a separate saved document model.
- Diff / explicit change review for active editor changes, recovery
  drafts, external-change conflicts, and Apple Local Assist edits.
- Optional Apple Local Assist alpha in the Developer / GitHub lane as an
  availability-gated, on-device assist surface with explicit unsaved AI
  edit transactions. The published App Store lane omits this helper,
  forces Assist Surface off, and hides command-palette assist / agent
  settings entries.
- Optional Developer / GitHub lane Agent Workbench, separated from the
  App Store lane.
- Help-readable Store-document drafts and Support Diagnostics UI.

## Release Evidence

Use release notes for detailed historical evidence:

- `docs/releases/0.26.0-source-tag.release.md`
- `docs/releases/0.26.0-app-store-submission-candidate.release.md`
- `docs/releases/0.25.0-source-tag.release.md`
- `docs/releases/0.25.0-app-store-submission-candidate.release.md`
- `docs/releases/0.19.0-source-tag.release.md`
- `docs/releases/0.20.0-app-store-submission-candidate.release.md`
- `docs/releases/0.20.0-warning-expected-dmg-preview.release.md`
- `docs/releases/0.18.0-warning-expected-dmg-preview.release.md`
- `docs/releases/0.17.0-warning-expected-dmg-preview.release.md`
- `docs/releases/0.16.0-warning-expected-dmg-preview.release.md`
- `docs/releases/0.15.0-warning-expected-dmg-preview.release.md`
- `docs/releases/0.14.0-source-tag.release.md`
- `docs/releases/0.13.0-source-tag.release.md`
- `docs/releases/0.12.0-source-tag.release.md`

For future releases, use:

- `docs/source-release-checklist.md`
- `docs/dmg-preview-checklist.md`
- `docs/release-pre-check.md`
- `docs/smoke-checklist.md`

The detailed v0.17 App Store-quality queue, closeout, performance
baseline, and smoke evidence are archived under
`docs/archive/operations/app-store-v0.17/`.

## Active Planning Sources

- `docs/current-work.md`: current post-approval, v0.26 polish / EPUB export planning, and quality queue.
- `docs/roadmap.md`: phase order and future boundaries.
- `docs/product-brief.md`: durable product direction and non-goals.
- `docs/security-boundary.md`: safe editor constraints.
- `docs/agent-workbench-boundary.md`: implemented Agent Workbench trust boundary.
- `docs/l-mode-plan.md`: L Mode source-preserving writing-surface direction.
- `docs/assist-surface-strategy.md`: assist-surface direction.
- `docs/post-v0.25-product-refinement-plan.md`: post-App-Store
  refinement lens.
- `docs/apple-local-assist-distribution-plan.md`: Apple Local Assist and lane planning.
- `docs/apple-local-assist-writing-companion-plan.md`: Apple Local Assist companion UX direction.
- `docs/app-store-build.md`: public-safe App Store build/signing boundary.

## Next Safe Actions

1. For post-approval cleanup, keep App Store-specific evidence public-safe
   and archive only completed version-specific material; canonical build
   and boundary docs stay live for future submissions.
2. For UX work, start with `docs/current-work.md`. The current v0.26
   product queue has completed no-workspace New File / Save As and
   e-book empty-state affordance polish, initial EPUB export beta,
   EPUBCheck evidence, metadata settings, and manual page-break
   semantics. Keep each slice small and source-preserving; do not add
   cover editing or an EPUB document model.
3. For a future App Store submission, start with `docs/app-store-build.md`;
   use `npm run release:candidate -- --with-app-store-pkg` for local
   signed package checkpoints, keep account-specific notes under ignored
   `docs/internal/` files, and treat certificate, provisioning, signing,
   notarization, upload, TestFlight smoke, and review handling as
   explicit distribution-lane work. Do not update tracked release docs
   for every generated package; record public-safe evidence only when a
   package is uploaded, submitted, or selected as release evidence.
4. For Apple Local Assist, use `docs/assist-surface-strategy.md`,
   `docs/apple-local-assist-distribution-plan.md`, and
   `docs/apple-local-assist-writing-companion-plan.md`; keep direct
   buffer edits as explicit AI edit transactions.
5. For future release checkpoints, use the version-specific release
   note plus the release checklists. Do not tag or publish without
   explicit approval.
