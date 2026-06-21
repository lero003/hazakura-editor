# Current Status

Status: Operational
Scope: Current implementation state and next safe actions
Authority: High
Last reviewed: 2026-06-21 (v0.29 Hazakura Local Assist review triage)

## Current State

- `Hazakura Editor` is a Tauri desktop app for Markdown-first safe text editing.
- Current package/app version: `0.29.0` across npm, Tauri, Cargo, and lockfile metadata.
- Mac App Store listing: `Hazakura Editor`
  (`https://apps.apple.com/jp/app/hazakura-editor/id6778637880?mt=12`).
- Published Mac App Store version: `0.26.0`, reported released on
  2026-06-20 after App Review completion.
- Latest GitHub source / local-app tag: `v0.27.0`.
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
- The helper-free App Store update for `0.26.0` has been reported as
  released on 2026-06-20 after App Review completion. The tracked local
  package evidence is build `21`, generated on 2026-06-20 after the
  Japanese `電子書籍` label correction:
  `src-tauri/target/universal-apple-darwin/release/bundle/pkg/HazakuraEditor-0.26.0-build21-mas.pkg`.
  SHA-256:
  `1cc4f694334badc7a408c0e61278ee40b340a0939378d082de9bfe41e44df515`.
  Raw App Store Connect, TestFlight, and App Review logs are not tracked
  in this repository.
- The helper-free App Store package candidate for `0.27.0` is build
  `22`, generated on 2026-06-20 after the `v0.27.0` source / local-app
  tag:
  `src-tauri/target/universal-apple-darwin/release/bundle/pkg/HazakuraEditor-0.27.0-build22-mas.pkg`.
  SHA-256:
  `3cf8a09dcf4b3fd81d50ad330d552c0e7de30ec56713b2fc4b4f2a62ae913ff7`.
  Local signature, entitlement, helper-absence, bundled-notice, and
  package SHA checks passed. App Store Connect upload, processing,
  TestFlight, App Review, and release handling are not tracked in this
  repository unless separately recorded.
- The latest generated helper-free App Store package evidence for `0.28.0` is build
  `26`, generated on 2026-06-21 after the v0.28 safety / quality /
  AI review foundation slice and the later top-chrome quieting pass:
  `src-tauri/target/universal-apple-darwin/release/bundle/pkg/HazakuraEditor-0.28.0-build26-mas.pkg`.
  SHA-256:
  `32b2e0dfee55c793b4cac5a127657cc7d2fe8b32af4341102acf387ad60dcd88`.
  Local App Store surface smoke, package signature, entitlement,
  helper-absence, bundled-notice, supported-OS, and package SHA checks
  passed. App Store Connect upload, processing, TestFlight, App Review,
  and release handling are not tracked in this repository unless
  separately recorded.
- Pre-approval human-side App Store lane smoke on 2026-06-12 passed launch,
  basic document creation/open, preview/export, image paste/drag-drop,
  App Store surface omission, dirty-close confirmation, Move to Trash,
  and network observation. Save As UX remains an observation, workspace
  restore is acceptable with a residual Google Drive /
  quit-before-interaction risk, and live accessibility was partial at
  that checkpoint. A `Cmd+Shift+F` global-search result activation bug
  found during smoke has a focused code-level fix.
- Older public tags and release assets remain immutable.
- Current active work is v0.29 AI assist review API alignment. The v0.28
  Safety, Quality, and AI Review Foundation lane is implemented /
  accepted locally, and the current v0.29 shape retires the standalone
  Review Desk screen while preserving the internal candidate comparison
  primitive for AI assist plumbing. A 2026-06-21 static review of the
  Hazakura Local Assist App Store lane is now triaged in
  `docs/current-work.md`. Source-level fixes now cover the
  `apple-assist.html` App Store Vite entrypoint, safe default `none`
  assist surface, command-palette/menu active-setting gate, no startup
  main-shell availability probe, `Hazakura Local Assist` visible naming,
  softer Local Assist network wording, short probe timeout separation,
  and helper error hygiene that avoids Foundation Models
  `debugDescription` in user-facing error envelopes. Remaining
  pre-submission risk is formal signed submit-lane smoke. A
  2026-06-21 user-side light built-app smoke confirmed the dedicated
  Local Assist UI opens, the helper is absent from Activity Monitor
  memory before opening the Local Assist window, and a simple request can
  be generated/applied and checked through the diff/update flow. Local
  pre-review
  regression, package, payload, dependency-audit, bundle metadata,
  license-resource, and bundle-size evidence remains archived under
  `docs/archive/operations/` or summarized in `docs/current-work.md`; it
  should no longer drive the main queue unless a new App Store build is
  prepared.
- The current source App Store lane now reopens Hazakura Local Assist as a
  narrow on-device writing companion. Agent Workbench, CLI Agent launch,
  arbitrary command execution, external AI/API calls, provider-add UI,
  and network fallback remain outside the App Store lane.
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
- The standalone Review Desk screen is retired from the current
  App Store-safe surface. Diff, recovery review, and Hazakura Local Assist
  transaction review remain explicit; the internal candidate comparison
  primitive still must not auto-save, auto-apply, launch helpers, or call
  external AI/API by itself.
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
  drafts, external-change conflicts, and Hazakura Local Assist edits.
- Hazakura Local Assist alpha as an availability-gated, on-device assist
  surface with explicit unsaved AI edit transactions. The current source
  App Store lane may expose it; older published App Store builds may still
  omit the helper until a new build is uploaded, approved, and released.
- Optional Developer / GitHub lane Agent Workbench, separated from and
  hidden in the App Store lane.
- Help-readable Store-document drafts and Support Diagnostics UI.

## Release Evidence

Use release notes for detailed historical evidence:

- `docs/releases/0.27.0-source-tag.release.md`
- `docs/releases/0.28.0-app-store-submission-candidate.release.md`
- `docs/releases/0.27.0-app-store-submission-candidate.release.md`
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

- `docs/current-work.md`: current v0.29 AI assist review API queue plus
  completed v0.28 foundation and v0.27 refinement notes.
- `docs/archive/planning/v0.27-refinement-slice-plan.md`: historical v0.27
  execution phases for large-document rendering, One Editing Space,
  flow-preserving editing, and status bar cleanup.
- `docs/roadmap.md`: phase order and future boundaries.
- `docs/product-brief.md`: durable product direction and non-goals.
- `docs/security-boundary.md`: safe editor constraints.
- `docs/agent-workbench-boundary.md`: implemented Agent Workbench trust boundary.
- `docs/l-mode-plan.md`: L Mode source-preserving writing-surface direction.
- `docs/assist-surface-strategy.md`: assist-surface direction.
- `docs/post-v0.25-product-refinement-plan.md`: post-App-Store
  refinement lens.
- `docs/apple-local-assist-distribution-plan.md`: Hazakura Local Assist and lane planning.
- `docs/apple-local-assist-writing-companion-plan.md`: Hazakura Local Assist companion UX direction.
- `docs/app-store-build.md`: public-safe App Store build/signing boundary.

## Next Safe Actions

1. For post-approval cleanup, keep App Store-specific evidence public-safe
   and archive only completed version-specific material; canonical build
   and boundary docs stay live for future submissions.
2. For the next product slice, start with `docs/current-work.md`. v0.29
   is the selected AI assist review API lane. First prefer the accepted
   Hazakura Local Assist pre-submission fixes still remaining in
   `docs/current-work.md`: signed/built-app smoke for the corrected
   full signed submit-lane smoke and packaging proof. Keep the App Store path limited to Hazakura Local Assist,
   with no external Agent surface; do not add Book Workspace Alpha, hidden multi-file book
   manifests, structural book-workspace information architecture, Native
   Vibrancy Phase 2, cover editing, or an EPUB document model unless that
   lane is explicitly opened.
3. For the current `0.29.0` source lane, build `27` is reserved in the
   App Store submit config as the next build counter. The latest generated
   local package evidence remains `0.28.0` build `26` after the
   top-chrome quieting pass.
   User-side upload / review work is outside this repository unless new
   evidence is explicitly recorded.
   For a future App Store submission, start with `docs/app-store-build.md`;
   use `npm run release:candidate -- --with-app-store-pkg` for local
   signed package checkpoints, keep account-specific notes under ignored
   `docs/internal/` files, and treat certificate, provisioning, signing,
   notarization, upload, TestFlight smoke, and review handling as
   explicit distribution-lane work. Do not update tracked release docs
   for every generated package; record public-safe evidence only when a
   package is uploaded, submitted, or selected as release evidence.
4. For Hazakura Local Assist, use `docs/assist-surface-strategy.md`,
   `docs/apple-local-assist-distribution-plan.md`, and
   `docs/apple-local-assist-writing-companion-plan.md`; keep direct
   buffer edits as explicit AI edit transactions.
5. For future release checkpoints, use the version-specific release
   note plus the release checklists. Do not tag or publish without
   explicit approval.
