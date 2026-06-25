# Current Status

Status: Operational
Scope: Current implementation state and next safe actions
Authority: High
Last reviewed: 2026-06-25 (v0.34.0 build 46 package candidate)

## Current State

- `Hazakura Editor` is a Tauri desktop app for Markdown-first safe text editing.
- Current package/app version: `0.34.0` across npm, Tauri, Cargo, and lockfile metadata.
- Mac App Store listing: `Hazakura Editor`
  (`https://apps.apple.com/jp/app/hazakura-editor/id6778637880?mt=12`).
- Published Mac App Store version: `0.32.0`, with the v0.32 Editor /
  Reader Position Bridge shipped as a public update. Hazakura Local
  Assist remains available as a preview on-device writing companion.
- Latest GitHub source / local-app tag: `v0.32.0`.
- Latest local App Store / TestFlight package candidate: `0.34.0` build
  `46`, generated on 2026-06-25 after the native PDF print fix and
  v0.34 cleanup:
  `src-tauri/target/universal-apple-darwin/release/bundle/pkg/HazakuraEditor-0.34.0-build46-mas.pkg`.
  Local package generation, App Store surface smoke, signed app
  distribution probe, `pkgutil --check-signature`, strict `codesign`
  verification, `Info.plist` version/build checks, package SHA-256, and
  sandbox preview checks passed. SHA-256:
  `78ce80cd1bcefd462241ec365679c5842a933dcd52ae3944b9d89b9467b5ec30`.
  Raw App Store Connect upload, processing, TestFlight install /
  launch, and App Review logs are not tracked in this repository unless
  separately recorded.
- Source-level `v0.34` native PDF print fix is implemented. PDF print no
  longer writes a browser-readable temporary file and opens it through
  OS handoff; it now creates an app-owned native print webview, triggers
  the system print panel from inside the app boundary, and keeps the
  main-window / filename / HTML-content guards on the Rust side. The old
  browser-based print command path and stale tests were removed. The
  user reported the manual PDF print flow as working before this package
  candidate was generated. This does not add a generic opener, shell
  input, external browser dependency, or Agent Workbench surface to the
  App Store lane.
- Source-level `v0.33` EPUB Export v1 Polish is implemented. EPUB export
  remains an explicit active-document action over Markdown source, but
  user-facing copy now presents it as `EPUB書き出し` / `EPUB Export`
  instead of beta copy. The archive builder keeps the compatible
  `buildEpubBetaArchive()` wrapper and adds
  `buildEpubBetaArchiveWithReport()` so callers can distinguish a
  successful archive from non-fatal image replacement warnings. The first
  report type is `image-unavailable`; successful exports with replaced
  images now report a warning status rather than a silent success. EPUB
  nav/content XHTML now uses the selected language metadata instead of
  hardcoding `ja`. No Book Workspace, cover editor, advanced metadata,
  navigation editor, in-app EPUBCheck, external validator launch, or
  second EPUB document model was added. A 2026-06-25 proof-close pass
  generated an external fixture EPUB from Japanese Markdown with a local
  image, external-image warning, links, code, table, task list, and
  page-break hint; archive inspection confirmed nav/content XHTML,
  packaged local image, `image-unavailable` warning output, `ja`
  XHTML language metadata, and unchanged source hash. External
  `epubcheck` completed with 0 fatal errors / 0 errors / 0 warnings.
  The `0.33.0` App Store / TestFlight package candidate is now generated
  as build `41`; upload, Apple processing, TestFlight install / launch,
  and App Review remain outside this repository state. Source/local proof
  passed with focused EPUB / export hook / status tests, full
  `npm run test`, `npm run build:vite`, `npm run build`, App Store
  surface smoke, local distribution probe, package signature check,
  sandbox preview smoke, and `git diff --check`. Built-app manual EPUB
  smoke remains blocked in this host because LaunchServices failed to
  open the generated local preview bundle with `kLSNoExecutableErr`
  even though bundle inspection found the executable, version `0.33.0`,
  bundled notices, helper executable, and valid ad-hoc code signature.
- Source-level v1 workspace / slash-command fit-and-finish is
  implemented. The workspace tree now shows existing-tab-derived open
  and dirty markers for files inside the selected workspace, reusing
  `isDirty()` so unsaved content, line-ending, and encoding changes align
  with the tab bar. Pathless untitled tabs, workspace-external tabs,
  directories, and image-only preview state do not create workspace
  markers. The editor content area now opens the existing slash-command
  menu from right-click; it preserves selection when invoked inside the
  selection, otherwise moves the cursor to the clicked editor position.
  This surfaces the existing allowlisted Markdown wrappers and insert
  helpers without adding a formatting toolbar, Git status, background
  indexing, new Agent / Review commands, arbitrary command execution, or
  a broader workspace model. Verification passed with focused workspace
  / editor slash tests, full `npm run test`, `npm run build:vite` (with
  the usual Vite chunk-size warning), and `git diff --check`. Built-app
  visual smoke remains blocked by the same local preview launch failure
  described above, not passed.
- Source-level `v0.32` Editor / Reader Position Bridge work is in
  progress after the user reported light `0.31` testing as problem-free.
  The current implementation records e-book chapter start lines, opens
  e-book Mode near the current editor / visible scroll position, keeps
  stale stored reader pages from overriding the next entry point, and
  returns from Reading Focus through an optional approximate `sourceLine`
  before falling back to the chapter heading. The e-book reader now also
  resets location by document key rather than only by path, so pathless
  unsaved tabs do not inherit another untitled tab's reader position;
  `AppWorkspace` regression coverage now pins this tab-id separation
  through the parent reader-location state. Same-document reader
  location updates are now also synced back into mounted `EBookPane`
  instances, so the right-pane one-page reader and Reading Focus spread
  reader stay on the same chapter/page state instead of drifting apart.
  Right-pane one-page reader navigation now also drives the editor to the
  reader's approximate source line, so read, notice, and edit can happen
  without entering Reading Focus first; passive source edits and chapter
  reclassification do not push the editor position back from the reader.
  Local build and window-launch smoke passed for the generated preview
  app; built-app interaction checks for normal, unsaved, and recovered
  documents remain pending. A release-hygiene follow-up removed a
  machine-local review-note path from the current docs; current
  added-line greps for local paths, development-note markers, and
  credential-like strings are empty.
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
- The `0.29.1` helper-enabled App Store update has been reported as
  approved and released on 2026-06-23. It carries the v0.29 AI assist
  review API alignment plus the v0.29.01 Hazakura Local Assist
  responsiveness hardening. The v0.28 Safety, Quality, and AI Review
  Foundation lane is implemented / accepted locally, and the v0.29 shape
  retires the standalone Review Desk screen while preserving the internal
  candidate comparison primitive for AI assist plumbing. A 2026-06-21
  static review of the Hazakura Local Assist App Store lane is triaged in
  `docs/current-work.md`. Source-level fixes cover the
  `apple-assist.html` App Store Vite entrypoint, safe default `none`
  assist surface, command-palette/menu active-setting gate, no startup
  main-shell availability probe, `Hazakura Local Assist` visible naming,
  softer Local Assist network wording, short probe timeout separation,
  and helper error hygiene that avoids Foundation Models
  `debugDescription` in user-facing error envelopes. `0.29.1` also adds
  request-scoped streaming preview, target-editor generation lock,
  shorter user prompts, clearer Local Assist availability settings, and
  reduced Markdown preview flicker during editing. Build `33` supersedes
  builds `31` and `32` as the local package evidence used for the final
  review cycle. Build `30` is superseded by `0.29.1`; build `29`
  delivery succeeded earlier on 2026-06-22, but it used the previous
  Apple-branded helper executable name. A 2026-06-21 user-side light
  built-app smoke confirmed the dedicated Local Assist UI opens, the
  helper is absent from Activity Monitor memory before opening the Local
  Assist window, and a simple request can be generated/applied and
  checked through the diff/update flow. Local pre-review regression,
  package, payload, dependency-audit, bundle metadata, license-resource,
  and bundle-size evidence remains archived under
  `docs/archive/operations/` or summarized in `docs/current-work.md`; it
  should no longer drive the main queue unless older App Store evidence
  is explicitly needed.
- The current Hazakura Local Assist source surface separates visible
  preset labels from internal action IDs. Pressing a preset inserts its
  concrete request sentence into the editable request field, and the live
  helper receives a fixed base instruction plus separated action, visible
  request text, target text, and surrounding context. The visible helper
  presets are intentionally trimmed to the compact set (proofread,
  summarize, translate, next ideas, shorten), while hidden action IDs can
  still support free-form fallback and older payloads. Candidate text is
  sanitized before application if a live model echoes Hazakura prompt
  boundary markers. All presets follow the same explicit, unsaved,
  diff-reviewable AI edit transaction flow.
- The `v0.29.01` Hazakura Local Assist responsiveness lane is implemented
  and packaged as `0.29.1`: heavy Foundation Models generation is
  separated from UI responsiveness, the active target editor is locked
  while generation is in flight, app-known progress and streaming preview
  appear in the Assist Window, and only the final result enters the
  existing unsaved AI edit transaction / Diff review path.
- The latest generated helper-enabled App Store package evidence for
  `0.29.1` is build `33`, generated on 2026-06-22 after Local Assist
  streaming responsiveness, prompt simplification, review-facing settings
  polish, and the Markdown preview flicker fix.
  Local App Store surface smoke, live helper build smoke, signed app
  probe, package signature, package metadata, helper-name, helper
  entitlement, `productbuild --synthesize`, and sandbox preview checks
  passed.
  SHA-256:
  `f2ae163a61ab7b8ea0084c043c030f629b5bc39eba23b4d7d64e0b8769cd2ec4`.
  Earlier build `29` was reported as delivered through Transporter on
  2026-06-22 after the helper sandbox entitlement fix; build `30`
  superseded it for the helper-name change, build `31` superseded build
  `30` for the `0.29.1` Local Assist responsiveness candidate, and build
  `33` superseded build `31` after the preview flicker fix. The user
  reported App Review approval and public release on 2026-06-23. Raw App
  Store Connect, TestFlight, and App Review logs are not tracked in this
  repository unless separately recorded.
- The published `0.32.0` App Store lane includes Hazakura Local Assist as
  a narrow preview on-device writing companion. Agent Workbench, CLI
  Agent launch, arbitrary command execution, external AI/API calls,
  provider-add UI, and network fallback remain outside the App Store lane.
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
  progress. Markdown source remains canonical; the reader/editor bridge
  is source-line approximate rather than rendered-page exact. Whole-book
  page numbering remains deferred.
- EPUB export is available from the File menu and command palette as an
  explicit active-document export action. It writes a minimal
  `.epub` archive from the current Markdown source with XHTML content,
  generated heading navigation, dialog-scoped Title / Author / Language
  metadata, workspace image resources where readable, allowed small
  `data:image` resources, and a small stylesheet. The EPUB path strips
  Preview-only markup before XHTML output, handles inline Markdown in
  headings for navigation, ignores YAML frontmatter for export
  navigation/content, turns blank-line-flanked standalone `---` / `===`
  into explicit page-break hints, generates per-export UUID identifiers,
  and writes `dcterms:modified` from export time. It reports non-fatal
  image replacement warnings after successful export and uses the
  selected language metadata on generated XHTML. It is not a second
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
- Hazakura Local Assist preview as an availability-gated, on-device
  writing assist surface. Presets insert visible, editable request text
  and generated results use explicit unsaved AI edit transactions. The
  published `0.29.1` App Store lane exposes it as a preview local AI
  writing companion; older installed App Store builds may still omit the
  helper until users update.
- Optional Developer / GitHub lane Agent Workbench, separated from and
  hidden in the App Store lane.
- Help-readable Store-document drafts and Support Diagnostics UI.

## Release Evidence

Use release notes for detailed historical evidence:

- `docs/releases/0.32.0-app-store-submission-candidate.release.md`
- `docs/releases/0.31.0-app-store-submission-candidate.release.md`
- `docs/releases/0.29.1-app-store-submission-candidate.release.md`
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

- `docs/current-work.md`: current `v0.30-v1.0 Reader UX Stabilization`
  queue plus post-`0.29.1` release evidence.
- `docs/archive/planning/v0.27-refinement-slice-plan.md`: historical v0.27
  execution phases for large-document rendering, One Editing Space,
  flow-preserving editing, and status bar cleanup.
- `docs/roadmap.md`: phase order and future boundaries.
- `docs/product-brief.md`: durable product direction and non-goals.
- `docs/security-boundary.md`: safe editor constraints.
- `docs/agent-workbench-boundary.md`: implemented Agent Workbench trust boundary.
- `docs/l-mode-plan.md`: L Mode source-preserving writing-surface direction.
- `docs/ebook-mode-epub-export-plan.md`: e-book Mode / EPUB export
  planning and source-preserving reader/export boundaries.
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
2. For the next product slice, start with `docs/current-work.md`.
   The active lane is `v0.30-v1.0 Reader UX Stabilization`; the current
   product proof task is v0.34 v1.0 Release Candidate / Golden
   Manuscript smoke after the native PDF print fix and build `46`
   package evidence; the native PDF print flow has user-side manual
   smoke, while the v0.32 reader bridge, v0.33 EPUB, workspace marker,
   and right-click slash-command fit-and-finish still need built-app
   interaction / visual smoke where the local host can launch the app.
   A 2026-06-25 read of the
   editor, preview, e-book reader, and stylesheet surfaced these gaps in
   what `v0.29.1` plus `v0.30-v0.33` already ship; they stay inside the
   Safe Editor boundary:
   - Slice A Reader Stability: E-book reader renders `marked` +
     `DOMPurify` synchronously per keystroke with no debounce
     (`EBookPane.tsx:118,214`) while `PreviewPane` debounces at 200ms;
     pagination measurement forces a per-child reflow on every render,
     resize, and image-load (`EBookPane.tsx:298,346,379`;
     `ebookPagination.ts:67`); the known scroll-stick symptom traces to
     unconditional `contentDOM.blur()` on scrollbar `mousedown`
     (`EditorPane.tsx:581`); `renderMarkdown` does five sequential HTML
     parses (`markdown.ts:19`); the preview->editor scroll-sync reads
     `scrollHeight` per event and its 80ms sync-source guard does not
     cover a full trackpad inertial scroll, so the editor write-back
     fights the OS inertia every frame and Preview stutters under
     trackpad inertial scrolling (`usePreviewScrollSync.ts:130`).
   - Slice B Token / Motion Coherence: `tokens.css` is sound but
     execution above it leaks undefined tokens (Local Assist Apply
     button falls back to blue `#2f7eb8`; slash-menu badge references
     undefined `--info`), bare `ease` keywords, and `transition: all`;
     `prefers-reduced-motion` is only partially covered; the global
     `button:hover` translateY lift reads as web-app bounce rather than
     book calm.
   - Slice C Robustness: `goToLine` single-rAF reports scroll ratio
     before CodeMirror's async `scrollIntoView` settles (fixed: double-rAF);
     the `EditorPane` imperative handle deps omit `readOnly` (fixed:
     insertText/applyMarkdownFormat/insertTable gated); the assist apply
     path closes over `activeTab.id` rather than a validated `tabId`
     (fixed: explicit tabId). Save-As rekey remount is deferred to v1.1.
   Keep the v1
   path focused on a single-document Safe Markdown Book Editor with
   Local Assist Review: Flow View, Spread View, editor/reader position
   bridge, initial EPUB export polish, and v1 RC smoke. Hazakura Local
   Assist follow-up should be observation-driven unless a concrete
   safety, review, App Store, availability, generation failure,
   responsiveness, or transaction-boundary issue appears. Do not add
   Book Workspace Alpha,
   hidden multi-file book manifests, structural book-workspace
   information architecture, Native Vibrancy Phase 2, cover editing,
   external AI/API providers, Agent Workbench in the App Store lane, or
   an EPUB document model unless that lane is explicitly opened. If RC
   proof exposes a file-intake blocker, keep it to one bounded slice such
   as larger readable local images or additional text-open file
   extensions, preserving binary detection, file-size warnings, workspace
   boundaries, and no background project indexing.
   After v1.0, do not rush straight to v2.0; use v1.x to deepen the
   single-document product, especially EPUB export, Diff / Review
   ergonomics, provenance, movement between writing / reading layers,
   and observation-driven Local Assist polish.
3. For the latest local App Store / TestFlight package candidate,
   `0.34.0` build `46`
   is the latest local package evidence. It includes the v0.34 native
   PDF print fix, v0.33 EPUB Export v1 Polish, the workspace marker and
   right-click slash-command source work, and the v1.0 RC pre-RC
   quality-slice planning pass.
   Upload, Apple processing, TestFlight install / launch, and App Review
   handling remain explicit distribution-lane work outside this
   repository unless public-safe evidence is recorded.
   The published `0.32.0` App Store lane is the latest released
   version; its build `36` package is historical release evidence and
   should not be confused with the new `0.34.0` candidate.
   Do upload / App Store Connect work only when explicitly requested.
   For future App Store submissions, start with `docs/app-store-build.md`;
   use `npm run release:candidate -- --with-app-store-pkg` for local
   signed package checkpoints, keep account-specific notes under ignored
   `docs/internal/` files, and treat certificate, provisioning, signing,
   notarization, upload, TestFlight smoke, and review handling as
   explicit distribution-lane work.
4. For Hazakura Local Assist, use `docs/assist-surface-strategy.md`,
   `docs/apple-local-assist-distribution-plan.md`, and
   `docs/apple-local-assist-writing-companion-plan.md`; keep direct
   buffer edits as explicit AI edit transactions.
5. For future release checkpoints, use the version-specific release
   note plus the release checklists. Do not tag or publish without
   explicit approval.
