# Handoff

Status: Operational
Scope: Short handoff for the next coding agent
Authority: Medium
Last reviewed: 2026-06-23 (v0.30 paged flow first slice)

## Current State

- `Hazakura Editor` `0.29.1` has been reported approved and released on
  the Mac App Store on 2026-06-23. Hazakura Local Assist is now public as
  a preview on-device writing companion. The latest local App Store
  package evidence for that review cycle is build `33`, generated after
  Local Assist responsiveness hardening, prompt/review polish, and the
  Markdown preview flicker fix. Raw App Store Connect, TestFlight, and
  App Review logs remain outside this repository unless explicitly
  recorded later.
- The next product slice should start from `docs/current-work.md` and
  treat `0.29.1` as shipped. The active lane is `v0.30-v1.0 Reader UX
  Stabilization`. The first code-level v0.30 e-book Mode paged flow
  slice is now implemented: e-book Mode stays on the simulated book page
  surface, has no Preview-like Flow/Page toggle, and turns vertical
  wheel / trackpad gestures into page movement while preserving
  chapter/page location across right-pane switches. Treat `Flow` in
  this lane as lower-friction movement through book pages, not as one
  continuous scrolling Preview document. Human-side built-app
  observation accepted the general behavior and requested faster wheel
  response; the threshold was halved so a shorter vertical wheel /
  trackpad gesture advances the page. Remaining v0.30 proof should
  focus on real long Japanese Markdown reading feel, large-document
  behavior, and the v0.32 editor cursor / reader location bridge.
  Verification for this slice passed with focused e-book / side-pane /
  CSS tests, full `npm run test`,
  `npm run build:vite` (with the usual Vite chunk-size warning), and
  `git diff --check`.
  After v1.0, do not rush straight into v2.0; use v1.x to deepen the
  single-document product first: EPUB export, Diff / Review ergonomics,
  provenance, movement between writing / reading layers, distribution
  polish when needed, and observation-driven Local Assist polish.
  Hazakura Local Assist follow-up should be observation-driven unless a
  concrete safety, review, App Store, availability, generation failure,
  responsiveness, or transaction-boundary issue appears. Do not reopen
  cancellation copy, Book Workspace, Agent Workbench, broader AI ingest,
  external AI/API providers, or auto-apply behavior unless the user
  explicitly opens that lane.
- User-facing app identity is capitalized as `Hazakura Editor`. The
  App Store preview bundle is `Hazakura Editor.app`; current docs and
  smoke paths should use that name rather than the older lowercase
  display form.
- Mac App Store listing:
  `https://apps.apple.com/jp/app/hazakura-editor/id6778637880?mt=12`.
- Latest published downloadable GitHub preview is `v0.20.0` warning-expected DMG preview.
- `v0.18.0` is ad-hoc signed, not Developer ID signed, not notarized, and expected to show macOS security warnings.
- The helper-free App Store lane delivered `0.18.0` build `4` to
  TestFlight on 2026-06-12 with no reported Apple validation warnings;
  basic TestFlight launch / save smoke passed.
- The `0.19.0` helper-free App Store lane passed App Review and was
  published on 2026-06-18. The tracked submit-lane candidate for that
  approval used App Store build counter `14`. The local App Store
  release-candidate package was
  `src-tauri/target/universal-apple-darwin/release/bundle/pkg/HazakuraEditor-0.19.0-build14-mas.pkg`
  with SHA-256
  `9d5164a9cf508242dbe6f7612e4d29167065d1c7b0cb884f6ed610723625f0cf`;
  it declares minimum macOS 15.0 and passed `pkgutil --check-signature`.
- The helper-free App Store update for `0.25.0` has been reported as
  released on 2026-06-20. The tracked local package evidence is build
  `18`:
  `src-tauri/target/universal-apple-darwin/release/bundle/pkg/HazakuraEditor-0.25.0-build18-mas.pkg`
  with SHA-256
  `211ed7ffa935929cb4d3e31e88b6d9034c08a2335876e3f3fbf61a90e4400b61`.
  Local packaging/signing checks passed on 2026-06-19. Raw App Store
  Connect, TestFlight, and App Review logs are not tracked in this
  repository.
- The helper-free App Store package candidate for `0.27.0` is build
  `22`:
  `src-tauri/target/universal-apple-darwin/release/bundle/pkg/HazakuraEditor-0.27.0-build22-mas.pkg`
  with SHA-256
  `3cf8a09dcf4b3fd81d50ad330d552c0e7de30ec56713b2fc4b4f2a62ae913ff7`.
  Local `pkgutil --check-signature`, app metadata, required entitlement,
  helper-absence, bundled-notice, and SHA checks passed on 2026-06-20.
  App Store Connect upload / processing / TestFlight / App Review work
  is handled outside this repository unless explicitly recorded later.
- The latest generated helper-free App Store package evidence for `0.28.0` is build
  `26`:
  `src-tauri/target/universal-apple-darwin/release/bundle/pkg/HazakuraEditor-0.28.0-build26-mas.pkg`
  with SHA-256
  `32b2e0dfee55c793b4cac5a127657cc7d2fe8b32af4341102acf387ad60dcd88`.
  Local App Store surface smoke, package signature, app metadata,
  required entitlement, helper-absence, bundled-notice, supported-OS,
  and SHA checks passed on 2026-06-21. App Store Connect upload /
  processing / TestFlight / App Review work is handled outside this
  repository unless explicitly recorded later.
- Start from `docs/current-work.md`; v0.27 execution is complete for
  source-tag purposes and remains documented in
  `docs/archive/planning/v0.27-refinement-slice-plan.md`.
- v0.28 P0 L Mode image-policy parity is implemented locally. L Mode no
  longer renders `http:` / `https:` image URLs directly and now shares
  Preview's supported `data:image` MIME, strict base64, and 2 MB
  Markdown-inline cap policy. Workspace image files continue through the
  bounded workspace-image command; EPUB packaged image policy remains a
  separate future concern.
- v0.28 P1 workspace search encoding parity is implemented locally.
  Workspace search now reuses the file-open decode helpers for UTF-8,
  UTF-8 BOM, Shift-JIS, and EUC-JP after the existing binary / size
  guards. Undecodable files still skip rather than broadening supported
  encodings.
- v0.28 P2 system handoff hardening is implemented locally. External URL
  opening, Finder / file-manager reveal, and print-browser handoff now
  use one fixed OS handoff helper with static platform command templates.
  Print handoff rejects path-like or non-HTML file names before creating
  the temporary file.
- v0.29 AI assist review API alignment is active on top of the completed
  v0.28 foundation. The standalone Review Desk screen, normal chrome
  entry point, manual candidate editor, and Markdown / text candidate
  file-import UI are retired before release. The internal candidate
  comparison primitive remains for AI assist plumbing:
  `useReviewDeskState.runCandidateCompare` can build a source-labelled
  `candidate` CompareCase and diff view without auto-save or auto-apply.
  `smoke:app-store-surface` now checks retired Review Desk exposure
  through chrome / command tests and keeps the internal primitive test.
  The current source App Store lane now exposes Hazakura Local Assist while
  keeping Agent Workbench / CLI Agent hidden.
  `Cmd+Shift+R` remains reserved only to avoid WebView reload. Next useful
  work should stay narrow: source-level fixes are now in place for the
  accepted Hazakura Local Assist pre-submission risks around
  `apple-assist.html` App Store entrypoint inclusion, no startup
  main-shell availability probe, safe default `none`, active preference
  gating for command palette / app menu, visible `Hazakura Local Assist`
  naming, softer Local Assist network wording, short probe timeout
  separation, helper error hygiene, preview-oriented user copy, clearer
  Apple Intelligence availability guidance, a compact companion window,
  and a fixed-height short scrollable progress log with request-group
  separators. Local Assist presets now separate UI labels from internal
  `actionId`s while keeping the concrete request sentence visible and
  editable in the request field; the live helper receives a fixed base
  instruction plus separated action, visible request text, target text,
  and surrounding context. All presets follow the same explicit,
  unsaved, diff-reviewable AI edit transaction flow. The bundled helper
  executable is now named `hazakura-local-assist-helper` in active Tauri
  configs, helper build outputs, signing/probe/smoke scripts, and
  current docs; the old Apple-branded process name is retired from
  active shipping surfaces. 2026-06-21
  user-side light built-app smoke confirmed
  the dedicated Local Assist UI opens, the helper is absent from Activity
  Monitor memory before opening the companion, and a simple request can be
  generated/applied and checked through the diff/update flow. Next, keep
  any remaining proof work on formal signed submit-lane smoke and
  packaging boundaries. File/paste /
  multi-file proposal ingest remains deferred until a fresh boundary
  review reopens it.
- Latest docs cleanup keeps current entry points lighter: README now
  summarizes feature areas instead of listing every implemented behavior,
  roadmap keeps a short shipped-phase summary for v0.18-v0.26, and
  completed v0.27 / pre-release fix plans live under `docs/archive/`.
  Generated artifact cleanup is exposed as a dry-run-first npm script;
  do not remove `src-tauri/target` unless disk cleanup is intentionally
  requested.
- v0.27 Phase 1 large-document initial rendering stabilization is
  accepted as closed at `b2126c14` plus this docs-only follow-up.
  `PreviewPane` clears stale content before paint, shows a theme-bound
  preview loading surface, and defers Markdown rendering to the next
  animation frame. Startup workspace restore now keeps the editor pane
  on a theme-bound restore loading surface while restored tabs are
  still opening, instead of briefly falling back to the start panel.
  Human-side large-document built-app smoke confirmed the central editor
  text renders normally.
- Deferred: applying the theme before React startup remains a valid UX
  request, but the boot-theme attempt caused hard-to-isolate real-app
  CodeMirror / Tauri first-paint layout failures. Keep it out of v0.27
  Phase 1; revisit only as a separate real-app DevTools debug slice.
- v0.27 Phase 2 One Editing Space minimal context retention is
  implemented and accepted after human-side right-pane built-app smoke
  confirmed chapter / page handoff across mode switches. The concrete
  disconnect was e-book Mode losing its active chapter / page when
  switching to another right-pane mode and back. `SidePane` now keeps the
  reader location for the active document and restores it into
  `EBookPane` on remount. It is intentionally session-local and does not
  introduce persistence, indexing, or a second document model.
- v0.27 Phase 3 Flow-Preserving Editing is implemented locally at
  focused-regression level and accepted after human-side heading-jump
  built-app smoke found no interaction discomfort. `goToLine()` now
  waits one animation frame after dispatching the CodeMirror line jump
  and reports the settled editor pixel scroll ratio, so scroll sync /
  HUD consumers do not depend only on the later browser scroll event and
  avoid the target-line-ratio mismatch seen in long documents. The
  unresolved residual issue is central-editor manual scrolling, not
  Outline jumps: after the first successful large movement, trackpad /
  wheel / scrollbar scrolling can appear to stay near the previous focus
  area and behave like text selection. A scroll-sync feedback hypothesis
  was explored, but scrollbar testing still reproduced the issue, so no
  behavior change is kept from that attempt. Hold this for a later
  focused CodeMirror scrollbar / pointer handling / WebView scrolling
  investigation unless it becomes release blocking. The remaining editor
  / Preview visual drift is lower priority unless it makes navigation
  feel broken. The broader editing-position history idea remains
  unimplemented.
- v0.27 Phase 4 status bar structure cleanup is implemented locally and
  has passed full local verification. Active document status metadata is now split
  into primary detail (file type, byte size, character count, and
  large-file warning when present) and secondary detail (encoding, line
  ending, final-newline state, cursor / selection, and heading context).
  Normal mode shows primary detail and keeps secondary detail in
  hover/title while LF / CRLF and encoding selectors remain reachable.
  L Mode keeps format controls hidden and shows the combined detail,
  preserving its quiet focused-writing surface. A follow-up also hides
  the developer-build badge from L Mode and exposes Review / Diff /
  Outline as independent right-pane controls.
- The completed review-derived pre-release code-quality fix queue now lives
  in `docs/archive/operations/pre-release-fix-plan-2026-06-13.md`.
  Manual smoke, TestFlight, App Store Connect, and reviewer-note work remain
  outside that historical fix queue.
- v0.20 Sakura workspace ergonomics P0 is implemented locally: the main
  chrome can collapse / restore the workspace sidebar, the central
  editor pane uses a thin bottom full-path copy bar instead of a top
  file-name header, Markdown preview has a card-like reading surface,
  and Sakura theme gives the selected workspace file a clearer accent.
  The tab-row new-file `+` affordance was removed after visual review;
  New File remains on existing menu, shortcut, command-palette, and
  workspace-file paths. Workspace switching remains deferred.
- v0.24 e-book Mode single-page polish is implemented locally:
  the active chapter reader now pages the rendered chapter body with
  CSS Columns under `.ebook-page-flow`, keeps reader chrome outside
  columns, uses `column-fill: auto`, and treats page counts as a
  Hazakura simulation rather than an EPUB-reader guarantee. The reader
  now wraps the viewport in `.ebook-page-sheet` and adds a fixed footer
  outside the columns with chapter title plus chapter-local page
  progress. Right-pane 2-up was intentionally deferred: it needs roughly
  900px of width and should be revisited only as a future occupied
  reading mode, not as a right-pane toggle.
- Roadmap direction after v0.25: v0.26 is now a polish and initial EPUB
  export lane before heavier AI proposal ingest. Keep it focused on
  no-workspace New File / Save As, e-book empty-state affordance, and
  explicit EPUB export from Markdown source.
- v0.26 no-workspace New File / Save As is implemented locally:
  no-workspace New File creates a pathless untitled Markdown tab without
  writing to disk, Save routes that tab through Save As, and saved tabs
  rekey to ordinary standalone file paths. Pathless untitled tabs are
  not persisted as restorable file paths or recovery drafts, and they do
  not show an empty full-path copy bar.
- v0.26 e-book empty-state polish is implemented locally: the e-book
  right-pane toggle stays visible when no active document is available,
  but is disabled and inactive until an editor document can drive the
  reading surface. Image preview keeps the control disabled even if a
  text tab remains open behind it, and L Mode continues to hide the
  normal meta bar controls. Verification passed with focused app chrome
  / side-pane tests, `npm run test`, `npm run build:vite`, and
  `git diff --check`.
- v0.26 initial EPUB export beta is implemented locally: File menu and
  command palette expose `Export EPUB (Beta)...`, the active Markdown
  source is written through a save dialog as a minimal `.epub`, and the
  archive includes XHTML content, heading-based navigation, package
  metadata, and a small stylesheet. It remains a beta export: no external
  validator launch, cover editor, vertical writing, or reader-perfect
  pagination claim. Title / Author / Language input, workspace-image
  resource packaging, per-export UUID identifiers, and export-time
  `dcterms:modified` are now implemented in follow-up slices.
- Markdown preview task checkboxes are complete for v0.18: Preview renders
  `- [ ]` / `- [x]` as inert display-only checkbox glyphs without
  changing saved Markdown.
- Normal mode workspace sidebar collapse / restore is complete for
  v0.18. L Mode still owns its separate temporary file-tree drawer.
- App Store preview packaging is helper-enabled for Hazakura Local Assist:
  `frontendDist` and `bundle.externalBin` are explicit in the App Store
  configs. `npm run build` skips App Store sandbox entitlements so the
  generated `Hazakura Editor.app` can launch for local smoke. Use
  `npm run smoke:macos-sandbox-preview` or the signed submit / TestFlight
  lane for sandbox-entitlement proof.
- App Store submit packaging now builds `aarch64`, `x86_64`, and
  `universal-apple-darwin` Hazakura Local Assist helper sidecars, then runs
  `scripts/sign-app-store-submit-app.mjs` so the helper carries
  `com.apple.security.inherit` before the app bundle is re-signed.
- App Store/TestFlight package checkpoints should use
  `npm run release:candidate -- --with-app-store-pkg`. The wrapper runs
  App Store surface smoke, builds the signed pkg through the existing
  counter-incrementing packager, writes ignored local metadata under
  `docs/internal/app-store-candidates/`, and prunes older generated pkgs
  by build number by default. Tracked docs should change only when a pkg
  is uploaded, selected for submission, or needed as release evidence.
- Sandboxed workspace restore stores an app-scoped security-scoped
  bookmark for user-selected workspace folders and resolves it on
  restart. Older path-only state can still fall back to the
  reauthorization status hint.
- TestFlight use found workspace persistence follow-ups before App
  Review. Code-level regression coverage pins repeated relaunch,
  outside-active-tab restore, and the fast clean-quit path where restored
  tabs/workspace state is already live before the restore-complete latch
  settles. Treat this as historical App Store-prep evidence unless a
  future App Store build reopens workspace-restore risk.
- Human-side App Store lane smoke on 2026-06-12 passed launch, basic
  document creation/open, preview/export, image paste/drag-drop, App
  Store surface omission, dirty-close confirmation, Move to Trash, and
  network observation. Treat Save As UX as an observation, workspace
  restore as acceptable with residual Google Drive /
  quit-before-interaction risk, and live accessibility as partial at
  that checkpoint. A `Cmd+Shift+F` global-search result activation bug
  found during smoke has a focused code-level fix.
- TestFlight use found one status-area cleanup follow-up before App
  Review. Code-level UI coverage now removes duplicate passive
  `UTF-8` / `LF` style labels in normal Safe Editor mode while
  preserving the dropdown controls and dirty/save status affordances.
- External-window routing for Markdown / Help links is implemented:
  Preview, Help documents, and Support Diagnostics intercept explicit
  `http:` / `https:` / `mailto:` / `tel:` clicks before WebView
  navigation and hand them to a bounded external-open Tauri command.
  Workspace-relative supported text links still open inside the app;
  unsafe schemes and unsupported/local-outside targets stay blocked.
- App Store-lane Move to Trash external-process review is implemented:
  `move_workspace_entry_to_trash` now calls native macOS
  `NSFileManager` Trash handling from Rust through the existing
  `objc2` / `NSURL` bridge. It no longer launches `osascript` or relies
  on AppleEvents. The signed-flow confirmation is historical App
  Store-prep evidence unless a future build reopens this behavior.
- External static review also promoted direct save fallback failure
  coverage for the truncate-and-write path used when sandboxed temp-file
  creation is denied. Pasted image decoded-size guarding is now complete:
  pasted PNG/JPEG/GIF/WebP data is rejected above the 20 MB decoded
  image boundary before allocation.
- Direct-open standalone files can save even when the parent folder
  cannot create a sibling temp file: `save_text_file` keeps the normal
  atomic path, then falls back to direct existing-file write only on
  temp-create `PermissionDenied`.
- Directly opened PNG/JPEG/GIF/WebP files can preview without an active
  workspace through `open_image_file`; workspace-tree image preview
  still uses `open_workspace_image` and its root containment check.
- App Store lane Settings exposes Hazakura Local Assist-specific preference
  rows; Agent Workbench / CLI Agent controls remain Developer /
  GitHub-only.
- Generated macOS app bundles now include repository-root `LICENSE`
  and `THIRD_PARTY_NOTICES.md` under `Contents/Resources/`.
  `scripts/probe-macos-distribution.sh` verifies those files for the
  App Store lane.
- Pre-review regression evidence is archived at
  `docs/archive/operations/v0.18-pre-review-regression-evidence-2026-06-12.md`.
  The local gates passed after one transient Rust full-test failure was
  cleared by focused and full reruns.

## Current Work Queue

Use `docs/current-work.md` for the active queue. Current priority order:

1. v0.30 e-book Mode Paged Flow: make e-book Mode a daily reading /
   revision surface for long Japanese Markdown prose while it still
   looks like a book page. Wheel / trackpad movement should reduce
   page-turn friction without becoming Preview-style continuous scroll.
2. v0.31 e-book Mode Spread View: add two-page book-like inspection with
   single-page fallback and coarse navigation, without Preview DOM
   editing.
3. v0.32 Editor / Reader Position Bridge: make read, notice, return, fix
   feel like one source-preserving revision cycle.
4. v0.33 EPUB Export v1 Polish, then v0.34 v1.0 Release Candidate.
5. v1.x deepens the single-document product before Book Scope / Book
   Workspace or stronger AI expansion.
6. Hazakura Local Assist post-release polish only for concrete safety,
   review, App Store, availability, generation failure, responsiveness,
   or transaction-boundary issues.

Recently completed: v0.20 Sakura chrome / file-state clarity kept New
File on existing non-tab-row paths, added the top chrome
workspace-sidebar toggle, central bottom full-path copy bar, Markdown
preview card styling, and Sakura-specific selected-file highlight
without adding a workspace switching dropdown or changing the
single-workspace model.

Latest completed: v0.26 initial EPUB export beta adds a File menu and
command palette action that writes the active Markdown source to a
minimal `.epub` archive through a save dialog, with generated XHTML,
heading navigation, package metadata, and a small stylesheet.

Latest completed: v0.26 EPUB beta Slice 1 content quality. The archive
builder is async, packages workspace images and allowed small `data:image`
references as manifest resources under `OEBPS/images/`, cleans
Preview-only table / task / blocked-image markup before XHTML output,
strips YAML frontmatter from EPUB content, and collects navigation
headings through `splitMarkdownIntoChapters` with inline Markdown heading
text normalized against the rendered DOM. `useDocumentExport` passes the
workspace image loader into the archive builder. Local Data Disclosure now
documents EPUB beta export as an explicit Save As action with local image
packaging, no external image fetch, no upload, no page-count guarantee,
and manual outside-app EPUBCheck guidance.

Latest completed: v0.26 EPUB beta Slice 2 manual EPUBCheck milestone.
The first check caught a placeholder UUID warning in `dc:identifier`;
the export now writes a valid per-export UUID. The follow-up
`epubcheck test02.epub` result reported 0 fatal errors / 0 errors /
0 warnings / 0 info. A related image insertion fix makes dropped or
pasted workspace-root `assets/...` images insert as paths relative to
the active Markdown document, so nested documents preview and export
the imported image instead of pointing at a non-existent sibling
`assets/` folder.

Latest completed: v0.26 EPUB beta Slice 3 metadata UI. Export EPUB now
opens a small dialog-scoped Title / Author / Language draft before the
native Save As dialog. The dialog defaults Title from the first H1 or
file stem, Author blank, and Language `ja`; it does not write Markdown
frontmatter, does not persist last-used values, and does not create a
separate EPUB document model. The archive writer escapes metadata,
generates `dcterms:modified` from export time, keeps per-export UUID
identifiers, and omits `dc:creator` when Author is blank.

Latest completed: v0.26 EPUB beta Slice 4 page-break markers.
Blank-line-flanked standalone `---` / `===` lines are converted through
the shared e-book helper into `.page-break` blocks for EPUB
`content.xhtml` and e-book Mode visual cues. YAML frontmatter, fenced
code blocks, Setext / non-blank-flanked rules, normal Preview, HTML
export, and Markdown source are left unchanged. Local Data Disclosure now
notes the beta compatibility risk for documents that used those
standalone rules as ordinary horizontal rules.

Earlier completed: v0.24 e-book single-page polish keeps Markdown source
canonical and Preview / Export / L Mode untouched while adding a fixed
reader footer outside `.ebook-page-flow`, pinning the single-page frame
dimensions in CSS tests, and documenting that right-pane 2-up should
wait for a future occupied reading mode.

Earlier completed: External-window routing for Markdown / Help links
now keeps workspace-relative text links in-app while handing explicit
external URL clicks to the OS default browser/app. Help copy overlap
cleanup now keeps the in-app Privacy Policy public-copy oriented while
Local Data Disclosure owns technical implementation details such as
workspace backup paths and preview/export routing. Auto-backup filenames
now stay unique for rapid
same-second snapshots by adding millisecond precision and a bounded
collision suffix while keeping recovery listing newest-first.
Direct-open standalone file save now handles the
App Sandbox-style case where the selected file itself is writable but
creating `.hazakura-note.tmp` next to it is denied. Direct-open image
files now route to read-only image preview instead of text open failure
when no workspace is active. Workspace restore also preserves the last
good persisted state when a restore attempt produces an empty live
result, allows clean app-exit persistence once live restored state is
present, and standalone-file `saveActiveTab` is pinned for the
no-workspace case. L Mode table Backspace / Delete, table caret
movement coverage, floating-control focus visibility, encoding-only
dirty indication, WorkspaceTree rename markup, Markdown preview task
checkboxes, pasted image decoded-size guarding, normal mode sidebar
collapse / restore, App Store preview startup, and sandboxed workspace
bookmark restore are also complete for v0.18.

The old App Store submission-prep items are now historical evidence, not
the active queue. External review notes worth preserving for future
submissions: reviewer-note answers for `network.client`, inert
script-like file associations, App Store lane omissions, and Move to
Trash; do not treat low-risk icon size, known Vite chunk warnings, or
Help copy overlap as blockers unless they reproduce as concrete review
or usability failures.

Recurring automation should use `docs/current-work.md` first. The old
pre-review automation order is exhausted; each new run should pick one
open Active UX Queue slice and close it as `implemented`,
`manual-blocked`, or `verified no-op`.

## Source Docs

- Current work: `docs/current-work.md`
- Pre-release code-quality fixes:
  `docs/archive/operations/pre-release-fix-plan-2026-06-13.md`
- Current implementation state: `docs/current-status.md`
- Phase boundaries: `docs/roadmap.md`
- Product boundary: `docs/product-brief.md`
- Security boundary: `docs/security-boundary.md`
- Agent Workbench boundary: `docs/agent-workbench-boundary.md`
- Manual smoke: `docs/smoke-checklist.md`
- Release gates: `docs/source-release-checklist.md`,
  `docs/dmg-preview-checklist.md`, `docs/release-pre-check.md`
- v0.18 release evidence:
  `docs/releases/0.18.0-warning-expected-dmg-preview.release.md`

## Archive Notes

- v0.17 App Store-quality request packets and closeout evidence moved to
  `docs/archive/operations/app-store-v0.17/`.
- Completed v0.27 execution planning moved to
  `docs/archive/planning/v0.27-refinement-slice-plan.md`.
- Completed pre-release fix planning moved to
  `docs/archive/operations/pre-release-fix-plan-2026-06-13.md`.
- Older commercial-quality, authoring-readiness, and product-copy drafts
  moved to `docs/archive/planning/`.
- WorkspaceTree v0.17 accessibility decision moved to
  `docs/archive/reviews/workspace-tree-accessibility-decision-v0.17.md`.
- Historical release notes remain in `docs/releases/`.

## Boundaries To Preserve

- Safe Editor remains primary.
- Markdown/text source remains canonical.
- Do not add Git, LSP, terminal, arbitrary command execution, plugins,
  project-wide indexing, auto-apply, or auto-commit.
- Agent Workbench remains optional, allowlisted, one-session, no-restore,
  and outside the App Store lane.
- Do not move or replace published `v0.18.0` tags/assets silently.

## Verification Guidance

- Latest v0.30 code slice: e-book Mode paged flow stays page-like,
  removes the Flow/Page toggle, and maps vertical wheel / trackpad input
  to page movement while keeping `chapterIndex` / `pageIndex` as the
  reader location contract. A follow-up human built-app check accepted
  the behavior and the wheel threshold was lowered from `80` to `40`.
  Verification on 2026-06-23:
  `npm run test -- src/components/editor/preview/EBookPane.test.tsx
  src/components/app/SidePane.test.tsx src/styles/previewCss.test.ts`,
  `npm run test`, `npm run build:vite` (passed with the usual Vite
  chunk-size warning), and `git diff --check`.
- Latest docs roadmap alignment: v0.30-v1.0 Reader UX Stabilization was
  reflected in roadmap, current work, current status, docs index,
  development automation guidance, e-book / AI planning notes, README,
  and this handoff on 2026-06-23. Verification run: `git diff --check`.
- Latest post-v1 planning alignment: v1.x single-document deepening,
  Book Scope / Book Workspace v2.0, v2.x Book Scope practicalization, and
  v3.x local AI re-evaluation were reflected in roadmap, current work,
  current status, e-book / AI / speculative local-AI planning notes, docs
  index, and this handoff on 2026-06-23. Verification run:
  `git diff --check`.
- Latest docs-refinement pass: v0.28 documentation index / README /
  roadmap cleanup, archive moves, and generated artifact cleanup script were
  checked with `npm run clean:generated -- --target-only`,
  `node --check scripts/clean-generated-artifacts.mjs`, and
  `git diff --check` on 2026-06-21.
- Previous docs closeout: App Store approval status was reflected in
  README, current status, current work, roadmap, App Store build notes,
  release-note index, and this handoff on 2026-06-18. Verification run:
  `git diff --check`.
- Latest docs closeout: `0.29.1` App Store approval / release status was
  reflected in README, current status, current work, roadmap, App Store
  build notes, release-note index, development automation guidance, and
  this handoff on 2026-06-23. Verification run: `git diff --check`.
- Latest release gate: v0.20.0 Developer / GitHub warning-expected DMG
  preview local verification passed on 2026-06-18. The DMG is Developer
  ID signed, not notarized, and has SHA-256
  `eaa5f576d4ec9aeb69429102d527778264f4d2776b03ba800c34911514fd92d9`.
  `npm audit` reports one low-severity DOMPurify advisory; no high or
  critical npm advisory was reported.
- Remote verification for `v0.20.0` also passed after publication:
  downloaded DMG checksum verification, `hdiutil verify`, mounted-app
  metadata, codesign verification, and mounted-app launch smoke all
  passed.
- Latest App Store package gate: `0.28.0` build `26` local package
  generation passed on 2026-06-21. Checks run:
  `npm run smoke:app-store-surface`, `npm run build:app-store-pkg`,
  `pkgutil --check-signature`, SHA-256, signed-app distribution probe,
  entitlements inspection, helper/resource checks,
  `productbuild --synthesize`, Info.plist version/build/minimum-OS
  inspection, and `git diff --check`.
  The generated pkg is
  `src-tauri/target/universal-apple-darwin/release/bundle/pkg/HazakuraEditor-0.28.0-build26-mas.pkg`
  with SHA-256
  `32b2e0dfee55c793b4cac5a127657cc7d2fe8b32af4341102acf387ad60dcd88`.
  Upload, App Store Connect processing, TestFlight, App Review, and
  manual signed-build smoke remain outside the repository unless new
  evidence is explicitly recorded.
- Latest v0.29 Hazakura Local Assist helper rename gate: active Tauri
  configs, helper build scripts, signing/probe/smoke scripts, Rust
  bundled-helper resolver, third-party notices, and current docs now use
  `hazakura-local-assist-helper`. The active source tree keeps the old
  Apple-branded helper filename only in a regression assertion
  that prevents it from returning to shipping scripts. Verified with
  `npm run test -- src/buildScripts.test.ts`,
  `npm run build:apple-assist-helper:fixture`,
  `cargo test --manifest-path src-tauri/Cargo.toml resolver_bundled_helper_filename_uses_sidecar_convention -- --nocapture`,
  `HAZAKURA_APPLE_ASSIST_HELPER_FIXTURE="$PWD/binaries/hazakura-local-assist-helper-aarch64-apple-darwin" cargo test --manifest-path src-tauri/Cargo.toml apple_assist_supervisor -- --nocapture --test-threads=1`,
  `npm run test`, `npm run build:vite`, and `git diff --check`.
- Latest v0.29.1 App Store package gate: build `33` was generated with
  `npm run release:candidate -- --with-app-store-pkg --no-prune-pkgs`
  using the Apple Distribution and 3rd Party Mac Developer Installer
  identities. The package is
  `src-tauri/target/universal-apple-darwin/release/bundle/pkg/HazakuraEditor-0.29.1-build33-mas.pkg`
  with SHA-256
  `f2ae163a61ab7b8ea0084c043c030f629b5bc39eba23b4d7d64e0b8769cd2ec4`.
  Verified: App Store surface smoke, live helper build smoke, signed app
  distribution probe with App Store entitlement enforcement,
  `pkgutil --check-signature`, helper `app-sandbox` + `inherit`
  entitlements, `allowed-os-versions min="26.0"`,
  `SKIP_BUILD=1 npm run smoke:macos-sandbox-preview`, and
  `git diff --check`. `spctl` remained local trust-policy noise for this
  lane. The user reported `0.29.1` App Review approval and public release
  on 2026-06-23.
- Previous v0.29 Hazakura Local Assist App Store-lane gate: source tests and
  local build evidence now cover the prompt/preset boundary: UI labels
  are display-only, preset clicks insert visible editable request text,
  the live helper prompt separates base instruction / action / visible
  request text / target text / context, and all presets use the same
  unsaved AI edit transaction / Diff review flow. Verified with `npm run typecheck`,
  `npm run test -- src/lib/appleAssist/instruction.test.ts src/components/appleAssist/AppleAssistWindowApp.test.ts src/components/appleAssist/AppleAssistWindowApp.test.tsx src/hooks/editor/useAppleAssistApplyHandler.test.ts`,
  `cargo test --manifest-path src-tauri/Cargo.toml apple_assist -- --nocapture`,
  and `npm run build:apple-assist-helper:live`.
- Previous v0.29 Hazakura Local Assist App Store-lane gate: source tests and
  local build evidence cover the v0.29 version bump, `Preview` /
  `プレビュー` Local Assist copy, light-user availability wording for
  macOS 26+ / M1+ / Apple Intelligence / supported language-region, a
  compact 480 x 560 default companion window, and a short scrollable
  in-session progress log. A later UI polish pass fixed the progress
  log height across request states, added a local-flow explanation in
  the log header, separated multiple requests with dividers, and
  shortened footer status copy so long request text does not resize the
  window. Commands run: `npm run test`,
  `npm run typecheck`, `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`,
  `cargo test --manifest-path src-tauri/Cargo.toml -- --test-threads=1`,
  `npm run smoke:app-store-surface`, `npm run build:vite`,
  `npm run build`, and Info.plist version inspection for the local
  preview app. User-side light built-app smoke evidence is also recorded:
  dedicated Local Assist UI, no helper in Activity Monitor before opening
  the window, and simple request generation/apply with diff/update
  confirmation. This is useful pre-submission confidence, but it is not a
  substitute for formal signed submit-lane packaging / TestFlight /
  App Review proof.
- Previous v0.29 Hazakura Local Assist App Store-lane gate: source tests and
  P0 probe/error hygiene fixes landed after the entrypoint fix:
  React marks a hanging availability probe unavailable after a short UI
  timeout, Rust supervisor uses a shorter probe timeout than generation,
  and the Swift helper strips Foundation Models `debugDescription` from
  user-facing error envelopes. Verified with `npm run test`,
  `npm run typecheck`, `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`,
  `cargo test --manifest-path src-tauri/Cargo.toml -- --test-threads=1`,
  and `npm run build:apple-assist-helper:live`.
- Previous v0.29 Hazakura Local Assist App Store-lane gate: source tests and
  source-level entrypoint / naming / preference-gate fixes landed on
  2026-06-21 with `npm run test`, `npm run typecheck`,
  `cargo check --manifest-path src-tauri/Cargo.toml`, and
  `VITE_HAZAKURA_DISTRIBUTION_LANE=app-store HAZAKURA_DISTRIBUTION_LANE=app-store npm run build:vite`
  confirming `dist/apple-assist.html` is emitted. Signed built-app smoke
  remains unproven for the corrected `apple-assist` window and helper
  process absence before explicit Local Assist use.
- Previous v0.29 Hazakura Local Assist App Store-lane gate: source tests and
  local build checks passed on 2026-06-21 with
  `npm run smoke:app-store-surface`, `npm run test`,
  `cargo test --manifest-path src-tauri/Cargo.toml -- --test-threads=1`,
  `npm run build:apple-assist-helper:live`, `npm run build:vite`,
  `npm run build:app-store-preview`, `npm run probe:macos-distribution`,
  `SKIP_BUILD=1 npm run smoke:macos-sandbox-preview`,
  `npm run build:app-store-submit`, and
  `REQUIRE_APP_STORE_ENTITLEMENTS=1 bash scripts/probe-macos-distribution.sh <universal app>`.
  The submit build was locally ad-hoc signed because no App Store
  Distribution identity was supplied in this run; package upload /
  TestFlight / App Review remain unproven.
- Latest e-book Mode code gate: v0.23 pseudo-pagination passed on
  2026-06-19 with
  `npm run test -- src/components/editor/preview/EBookPane.test.tsx src/styles/previewCss.test.ts`,
  `npm run build:vite`, `npm run test`, and `git diff --check`.
- Latest EPUB beta code gate: v0.26 Slice 1 content quality passed on
  2026-06-20 with `npm run test`, `npm run build:vite`, and
  `git diff --check`.
- For docs-only work, run `git diff --check`.
- For code changes, follow `docs/development-automation.md`.
- Latest workspace persistence focused checks:
  `npm run test -- src/hooks/workspace/useWorkspaceStatePersistence.test.ts src/hooks/workspace/useWorkspaceRestore.test.ts src/lib/storage.test.ts src/hooks/app/useAppExitConfirmation.test.tsx`
  and `npm run build:vite`.
- For UI behavior changes, update or exercise `docs/smoke-checklist.md`.
- Do not claim manual smoke passed unless it was actually exercised.
- Current known local worktree caveat: App Store build-number changes
  belong only to the explicit App Store lane; do not fold them into
  unrelated quality slices.
