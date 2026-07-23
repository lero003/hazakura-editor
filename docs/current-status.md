# Current Status

Status: Operational
Scope: Current implementation state and next safe actions
Authority: High
Last reviewed: 2026-07-23 (v2.3.0 local candidate; v2.0.0 published)

## Current State

- `Hazakura Editor` is a Tauri desktop app for Markdown-first safe text editing.
- Current package/app version: **`2.3.0`** across npm, Tauri, Cargo, and
  lockfile metadata. It is a local candidate, not uploaded, tagged, or
  published. Notes: `docs/releases/2.3.0-app-store-release-notes.md`.
  v2.1 search/image hardening is included in this package.
  GitHub source / local-app tag remains immutable **`v2.0.0`** (no binary
  assets).
- **Published Mac App Store version: `2.0.0`.** App Review passed and the
  release was published (user-reported 2026-07-21): Book Scope Alpha,
  whole-book read/export, UX quieting, and Help for books/OKF. Release notes:
  `docs/releases/2.0.0-app-store-release-notes.md`. Do not reopen without a
  reproduced hotfix. Local package provenance lives in ignored
  `docs/internal/app-store-candidates/latest.json`.
- **Prior lines:** `1.13.0` remains a historical published store baseline.
  `1.14.0` is an intermediate source tag / submission line superseded on the
  live listing by `2.0.0`. Do not rewrite those tags.
- **Active product phase: v2.3.0 local candidate (pre-submission quality pack).**
  Includes v2.1 Reader search + Preview image hardening plus Reader chapter nav,
  export Finder reveal, Book empty-state honesty, Assist availability honesty,
  and preflight fix hints. 縦書き stays deferred. Queue: `docs/current-work.md`.
  Phase: `docs/roadmap.md`.
- **v2 Book Scope Alpha spine is implemented in source.** The existing left
  sidebar now switches between Files and Book. Users explicitly select up to
  100 Markdown chapters, keep an app-private per-workspace ordered tree, reopen
  that scope after relaunch, and switch chapters through the existing single
  active editor buffer. Rust validates relative paths, workspace containment,
  Markdown/text eligibility, and symlink/file identity. Missing or externally
  moved chapters remain visible as unavailable until rechecked or explicitly
  removed. Quiet group labels and indentation show saved hierarchy; arrow moves
  stay inside the current parent group. Reader, PDF, and Rust validation consume
  the same tree in preorder. Existing flat v1 settings migrate without changing
  order as root-level chapters; hierarchy is adopted only after an explicit new
  suggestion is saved. No workspace manifest, source rewrite, background
  indexing, or OKF semantic expansion was added. Whole-book reading/export are
  separate, explicit layers described below.
- **Book Scope can now create an explicit chapter suggestion draft.** The user
  starts one bounded, cancellable OKF disk snapshot from the Book view. Root
  and nested `index.md` inline links lead the proposed tree, while ATX section
  headings become display groups. The current adapter resolves safe relative
  links and OKF's bundle-root `/...` form without storing an OKF version or type
  in the Book tree. A default-on, explicit option includes the root index first
  and each linked nested index immediately before its local chapters as
  cover/contents candidates. The option can be disabled, and every index can
  still be unchecked individually in the draft.
  Remaining readable `.md` files follow in stable path order; `log.md` and
  unreadable files stay out. The result remains an editable checkbox draft until Save;
  startup/background scanning, scan caches, source changes, and automatic
  scope persistence were not added.
- **A real five-work e-book manuscript passes the suggestion boundary.** Its 44
  Markdown files (33 chapters, 4 supplementary notes, 6 indexes, 1 log;
  390,618 bytes total) now produce 43 editable candidates with the default
  index-page option, or the previous 37 body/supplementary candidates with it
  off. The sample's five local PNG files are individually below the existing
  20 MiB image limit. Source tests and a fresh local App Store preview pin the
  43/37 results; the draft was cancelled without persistence. Semantic use of
  custom `Chapter` / `Note` frontmatter remains held for v2.x; full signed TestFlight PDF/EPUB
  visual proof for this manuscript is not yet claimed.
- **Book Scope now has a whole-book reader in source.** It opens only from an
  explicit Book-view action, renders chapters in saved order through the
  existing sanitized Preview/image boundary, and keeps each chapter's source
  path for relative images and links. Live open-tab buffers win over disk, so
  unsaved edits are visible without being saved or overwritten. Total disk/live
  content is capped at 32 MiB; missing, unreadable, and budget-skipped chapters
  remain visible as notices. Editing a chapter returns through the existing
  workspace tab path rather than creating a second editable buffer.
- **The v2.1 candidate adds bounded search inside the whole-book Reader.** It
  searches only chapter names and visible Markdown already loaded by the
  explicit Reader action, including unsaved live buffers, under the existing
  100-chapter / 32 MiB load boundary. Unicode-normalized, case-insensitive
  results show matching chapters and occurrence counts and jump through the
  existing contents navigation. Hidden leading YAML frontmatter is excluded
  because Reader does not render it. Escape clears a non-empty search before
  closing the Reader. The feature creates no persistent index, background
  scan, source edit, auto-save, or new file access path.
- **Interactive Preview image loading is bounded near the viewport.** Workspace,
  explicitly approved outside-local, and enabled remote images stay as inert,
  height-reserved placeholders until they approach the visible area, with at
  most two reads in flight per Preview pane. If nested WKWebView Preview only
  delivers an initial non-intersecting record and no usable intersection, a
  short fallback feeds the remaining placeholders into that same bounded queue
  instead of leaving valid document-relative images permanently blank. A false
  record no longer cancels that fallback. Resolved data URLs are committed back
  to Preview state and no longer retain the transparent placeholder's native
  lazy flag, preventing a later parent render from restoring the blank image.
  Whole-book Reader inherits the same behavior. e-book
  pagination and PDF/EPUB export deliberately keep their existing all-image
  settle path. This changes neither Markdown source nor the local/remote consent
  boundary.
- **Book presentation hides closed leading YAML frontmatter without rewriting
  source.** Whole-book Reader and PDF now use the same bounded strip behavior
  already used by EPUB. Unclosed frontmatter remains visible as source text;
  metadata fields are not interpreted into book semantics.
- **Book Scope PDF/EPUB export and bounded preflight are implemented in source.**
  Existing export dialogs now explicitly choose Current file or Whole book.
  Book output keeps saved chapter order, live dirty buffers, and chapter-local
  image bases. Preflight runs only from the export action, checks unavailable
  chapters, up to 100 workspace images, missing headings, and EPUB metadata,
  and blocks Book export when a chapter is unavailable. It adds no manifest,
  background indexing, source rewrite, or second editable buffer.
- **EPUB Book navigation now uses the saved Book tree.** `nav.xhtml` preserves
  the same document/group hierarchy shown in the Book sidebar instead of
  reparsing `index.md` into a second export-only order; remaining unclaimed
  chapters keep saved Book order as a conservative fallback. Relative and
  bundle-root links between included Markdown chapters are rewritten to their
  packaged XHTML/heading targets, so exported index pages no longer point at
  absent `.md` files.
  Same-chapter anchors also follow headings moved into later XHTML documents by
  explicit page breaks. Single-document EPUB navigation preserves Markdown
  heading levels.
  Apple Books interaction on the heavy manuscript remains a manual TestFlight
  check; source is not changed and no background scan or manifest is added.
- **EPUB export has an optional explicit cover image in v2.3 source.** The
  metadata dialog selects one local PNG/JPEG/GIF/WebP file for the current
  export only. The exporter packages a dedicated `cover-image` manifest item
  and cover XHTML before the content spine. It does not infer the first
  Markdown image, rewrite source, persist a cover choice, crop/edit the image,
  or launch an external cover tool. Apple Books appearance remains a manual
  installed/TestFlight gate.
- **v2.3 source proof is green for the Book UX, image/export, and recent-folder repairs.**
  TypeScript/Vitest (**205 files / 1,713 tests**), typecheck, Vite, App Store
  surface (**10 files / 111 tests**), and the helper-enabled App Store preview
  build pass on tree `2.3.0`; the new regression covers an initial
  non-intersecting observer record for `/workspace/book/images/cover.png`.
  Rust proof is **367 pass / 2 host-dependent ignored**. The
  prior build 107 smoke only observed the image immediately and is invalidated
  by the report that it then disappeared; that pkg is held and must not be
  uploaded. The repaired built app was checked through Computer Use with the
  real parent workspace, nested `index.md`, and 2.6 MB `images/c00.png`: Preview
  retained the image after 12 seconds and a pane reopen, and e-book page 2
  retained it after 10 seconds. Before upload, the selected pkg's `sourceCommit`
  in ignored `docs/internal/app-store-candidates/latest.json` must include the
  recent-folder bookmark repair. This is not upload or Apple processing
  evidence.
- **The v2.0 release candidate proof was green.** TypeScript/Vitest
  (**201 files / 1,678 tests**), Vite, Rust (**367 pass / 2 host-dependent
  ignored**), App Store surface (**107 tests**), and the helper-enabled App
  Store preview build all pass on tree `2.0.0`. The built bundle reports
  `2.0.0`, passes deep/strict code-sign verification, and opens an onscreen
  app window. A fresh built app proposed three chapters from the official
  OKF fixture, restored their saved order, and read all three in the whole-book
  reader. Export produced a three-page A4 PDF verified in macOS Preview with one
  chapter per page, plus a valid three-document EPUB whose metadata, spine, and
  navigation preserve Book Scope order. Preflight showed the fixture's missing
  headings and author metadata; a retained unavailable chapter blocked Book PDF
  and EPUB while leaving Current file available.
- **Release-quality export smoke passed on a disposable nested fixture (2026-07-18).**
  The helper-enabled `2.0.0` app rendered Preview with headings, local images,
  and links; saved a five-entry Book tree with `Works → One → Chapters` and
  `Notes` groups; and read all five entries in order with the local images and
  explicit page-break section intact. The exported seven-page A4 PDF was
  rendered page-by-page with no clipping or overlap. The exported EPUB passed
  `epubcheck` with 0 errors and 0 warnings, preserved the saved nested TOC,
  packaged both images, and rewrote the included Markdown links. Opening that
  EPUB in macOS Books showed the nested navigation; clicking `First` and then
  `Second` landed on the packaged `Second Section` target. This is disposable
  fixture evidence only; the heavy manuscript in signed TestFlight remains a
  separate manual proof boundary. `pdftotext` was unavailable on this host, so
  PDF evidence used `pdfinfo` plus Poppler page renders.
- **The v2.0 UX review closed three release-facing gaps.** Books and knowledge
  folders is reachable from the native Help menu as well as Command Palette;
  saving or cancelling chapter selection restores focus to its trigger; About
  and diagnostics derive the visible version from package metadata instead of
  duplicating it.
- **Dependency audits have no release-blocking finding.** `npm audit
  --audit-level=high` reports 0 vulnerabilities. `cargo audit` exits 0 with 18
  allowed warnings already represented by the existing Tauri Linux / GTK,
  transitive unmaintained-crate, and `pdf-extract` exception set; it reports no
  vulnerability or new macOS blocker.
- **Structured Markdown / OKF readiness (claim boundary for v2 Alpha):** With
  single-document structure (v1.10), OKF review (v1.11), starter scaffold
  (v1.12), and Book Scope select/order/suggest/read/export + quieted presentation,
  the product can support OKF-style structured Markdown as an **explicit,
  local, non-auto-repair** workflow. In-app Help **Books and knowledge folders**
  documents the loop; store copy is drafted for `2.0.0`. Indexing and auto
  structure detection remain out of scope.
- **Book Scope Alpha built-app interaction smoke passed on 2026-07-18.** A
  throwaway nested workspace covered explicit selection, order changes, dirty
  chapter switching and return, scope-external file opening, relaunch restore,
  external deletion with unavailable retention, in-app rename path tracking,
  and confirmed Trash removal. The follow-up polish localizes lazy-folder
  status and unavailable reasons without changing the scope contract.
- **v1.14 review-candidate Keep themes:** Continuity (same-name tabs, Reference
  retained toggle, recent workspaces, shared right-pane header), Trust (export
  destination/warnings, Assist lock & not-saved, Import draft status), Writing
  Loop (Preview vs e-book, e-book edit-here, Outline hints + heading Undo
  status), Structure/OKF (scaffold pre-create copy, first-fix open guidance).
  That submitted candidate predates Book Scope and contains no indexing,
  auto-repair, or second editable buffer.
- **The v1.14 returning Start Panel is compact in source.** It keeps one short
  write/read/verify pitch, shows the resume target by folder name, moves the
  three basic actions before recents, and lays recent folders out in two short
  columns. Full action wording remains available to assistive technology; the
  panel itself scrolls rather than clipping when recovery items add height.
- **The reproduced v1.14 PDF Reference 150% scroll friction is fixed in
  source.** The PDF stage is the only overflow container. A standard mouse
  wheel pans vertically while room remains, then uses the remaining motion for
  horizontal panning at the edge; Shift+wheel pans horizontally. Trackpad
  two-axis input remains native. Real-mouse packaged interaction is still a
  hands-on smoke item.
- **Theme G media (shipped in `1.13.0`, evidence ongoing):** M0–M4 remain Keep
  in source. Signed TestFlight export recheck and pin-to-assets Undo breadth
  remain device evidence, not a reason to reopen `1.13.0`. Manual smoke:
  `docs/smoke-checklist.md` § Theme G.
- **Book Scope UX quieting is in source.** After scope is saved, the Book view
  leads with whole-book read + edit. Workspace suggestion stays a setup action
  (empty state and chapter edit). Recheck is shown only when entries are
  unavailable. Chapter rows hide root-level path noise. Export dialogs say
  “本全体 / Whole book” instead of internal Book Scope jargon; OKF review opens
  with one short purpose line and shows the disk-snapshot note only after a
  scan.
- **v2 Help expansion is in source.** The native Help menu and Command Palette
  open **Books and knowledge folders…** (English Help body). Local Data
  Disclosure mentions whole-book export and app-private book order. About /
  diagnostics derive the current `2.3.0` candidate version from package metadata.
- **Open main queue:** run the `2.3.0` Book UX (recipe + resume) signed pkg through
  installed/TestFlight interaction checks.
  Published `2.0.0` remains
  hotfix-only; other advisory items stay parked.
- **Parked / on-demand:** residual polish; broad TestFlight / VoiceOver /
  evidence matrix; bulk external-review backlog digestion.
- **`1.8.0` build `89` remains a closed historical Mac App Store baseline**
  (published 2026-07-14) superseded by `1.12.0`. Extended TestFlight interaction
  breadth and spoken VoiceOver remain ongoing quality evidence rather than
  reasons to reopen published tags.
- **The v1.8 PDF-reference zoom adjustment is included in published
  build `89`.** The duplicate-looking fit-page control was removed;
  PDF reference display now offers fit width plus a raster-independent 150%
  view. The zoomed page is a native two-axis scroll region and supports Arrow
  key / Page Up / Page Down panning without changing pages. Package/app
  signatures and publication provenance passed; hands-on panning with a real
  PDF is user-side follow-up evidence.
- **The v1.8 structured-Markdown preparation is included in published
  build `89`.** Outline, e-book chapter splitting, and EPUB export now share one
  leading YAML frontmatter boundary. Heading-like metadata is no longer shown
  as an Outline heading; CRLF and unclosed-frontmatter behavior is pinned by
  tests. This is interpretation-only hardening: it adds no hidden document
  model, structure UI, or source rewrite.
- **v1.9 Writing Loop Clarity W1–W4 are source complete and reviewed.** The
  review fixed stale Command Palette labels when locale changes while the
  palette is open, aligned the returning Start Panel kana CTA, and repaired
  release/lane document checks. v1.9 stayed source-complete without its own
  public release and is present inside the `1.11.0` candidate.
- **v1.10 Single-document Structure Foundation S1–S4 is source complete and
  has representative packaged interaction proof.** `parseMarkdownStructure` provides
  one source-offset interpretation of closed leading frontmatter, ATX headings,
  standalone page-breaks, and EPUB navigation candidates. Existing Outline
  now shows heading hierarchy and page-breaks, exposes non-blocking structure
  suggestions, and allows only an explicit one-level ATX heading change through
  one Undo-able CodeMirror transaction. No manifest, second buffer, background
  scan, automatic correction, section move, or Book Scope was added. Generate
  deterministic smoke documents with `npm run smoke:fixtures:v1.10-structure`.
  On 2026-07-14, a fresh local bundle opened the temporary fixture workspace
  and exposed the expected hierarchy/page-break rows, three overview advice
  kinds, and the 803-line section advice. A one-level H3→H2 edit set dirty and
  one `Cmd+Z` restored the original source and clean state. Source-jump breadth,
  IME, Save As, recovery, e-book/EPUB, and signed TestFlight remain manual proof
  and move into the v1.11 distribution-confidence matrix rather than reopening
  v1.10.
- **v1.12 OKF Starter Scaffold is closed and published as `1.12.0`.** Explicit
  Command Palette / folder-context actions create a new uniquely named folder
  with fixed minimal or book-like Markdown templates (OKF v0.1 Draft pin
  `ee67a5c`), open `index.md`, and invite a separate explicit review. No Book
  Scope, auto-repair, or multi-file export. Contract:
  `docs/v1.12-okf-scaffold-design.md`. Release notes:
  `docs/releases/1.12.0-app-store-release-notes.md`. Source tag: `v1.12.0`.
  The source-hardened path materializes the actual local creation date, rejects
  unclean relative paths / NUL content, creates nested directories without
  following an existing tree, and cleans up only artifacts it created. Tree
  refresh or `index.md` open failures remain visible instead of being replaced
  by a success status. The sidebar New menu exposes expanded state and standard
  arrow/Home/End/Escape keyboard movement. Local candidate gates and App Review
  passed; publication was user-reported 2026-07-17.
- **v1.11 OKF Draft Compatibility Preview is locally candidate-ready.**
  Fixtures, a `yaml`-backed pure model, async cancellable Rust discovery, and
  the OKF review surface (Command Palette + folder context menu + read-only
  panel) are in tree. The writer-facing action loop is also in tree: command/title
  `知識フォルダ（OKF）を点検`, purpose intro, ordinary-manuscript vs
  knowledge-folder status framing, separate required / OKF preparation /
  improvement / reference groups, and disclosure for files, reference facts,
  spec, and raw counts. `開いて修正` opens the existing editor tab, best-effort
  jumps to a finding line when an offset is available, and moves the modal out
  of the editing path with a recheck status hint; `変更後に再点検` (or
  re-invoking the review) performs the next explicit disk scan. Full analysis
  still runs only on explicit invoke—not on workspace open. Discovery revalidates opened-file identity, analysis and
  rendered findings have explicit caps, findings follow the active locale, and
  a workspace change closes/cancels the owning review. On 2026-07-15, the
  packaged Command Palette and folder-context flows passed review → open/edit →
  save → recheck; the fresh scan reduced required findings after the saved
  fixture correction. Full frontend/Rust/App Store surface gates, local sandbox
  entitlements, universal submit-app signing, helper inheritance, pkg signing,
  metadata, and checksum verification also passed. This is local candidate
  evidence, not TestFlight installation or interaction proof. The contract remains
  an explicit, bounded, cancellable, read-only
  review of one user-selected workspace root or subfolder against OKF v0.1
  Draft. It does not add startup scan, persistent indexing, automatic repair,
  chapter ordering, multi-file edit, whole-book export, or Book Scope. Contract:
  `docs/v1.11-okf-draft-preview-design.md`.
- **v1.6 (`1.6.0`) is closed and published.** Mac App Store App Review passed
  without issues (user-reported 2026-07-10). Release note:
  `docs/releases/1.6.0-app-store-release-notes.md`. Product scope: Import
  Assist Phase 1 (PDF / image → unsaved Markdown draft, on-device PDFKit +
  Vision), 江戸彼岸 theme, CodeMirror `@codemirror/view` **6.43.2** pin, PDF /
  image path trust polish, and the `pdf-extract` security update. Boundary:
  `docs/archive/reviews/import-assist-boundary-review-v1.6.md`. Quality notes
  (historical for this lane): `docs/archive/operations/quality-inventory-v1.6.md`.
- **v1.7 (`1.7.0`) is closed and published.** App Review passed and the Mac
  App Store release was published (user-reported 2026-07-12). Reference Compare
  keeps one editable Markdown buffer beside one read-only reference. Release
  note: `docs/releases/1.7.0-app-store-release-notes.md`.
- **v1.8 (`1.8.0`) is closed and published.** App Review passed and the Mac
  App Store release was published (user-reported 2026-07-14) as build `89`.
  It hardens the v1.7 Reference Compare plus trust / daily-use experience:
  L Mode continuity with a hidden Reference session, bounded long-reference
  rendering, deterministic Rust suite isolation, keyboard / VoiceOver
  semantics, kana UI copy, export preflight, theme cost, and failure-state
  messaging. Release note:
  `docs/releases/1.8.0-app-store-release-notes.md`. Do not reopen without a
  reproduced hotfix.
- **v1.8 implementation evidence (shipped in `1.8.0`).**
  Editable Markdown stays center/primary; one read-only PDF / image / Markdown /
  text reference opens on the **right as a preview-like pane** (not Diff, not a
  second edit tab), including automatic source pairing after Import Assist.
  Design: `docs/archive/planning/v1.7-reference-compare-design.md`. Scope brief:
  `docs/archive/planning/v1.7-scope-brief.md`. **R0–R4** are in source. **T-1 / T-2 / S-2 root
  recovery / S-3 wrap-safe long-reference rendering+rename a11y / S-4 Start Panel** source landed
  2026-07-11. Recovery cleanup failures are now surfaced across Save / Save As /
  restore / discard / close, and text references have a separate 1.5M-character /
  50,000-line DOM budget. T-1 now also keeps a loaded Reference session while
  hiding its pane in L Mode, then restores the pane on return. A separate-ID
  Developer bundle passed Reference hide/restore and post-remount Undo on
  2026-07-12. S-3 now has a deterministic fixture generator; a separate-ID
  Developer bundle passed 5,000-line Japanese wrap/scroll/selection and both
  1.5M-character / 50,000-line rejection paths while preserving the editor and
  existing reference. Long-reference copy was verified by copying the full
  reference and pasting it into a disposable editor buffer, then confirming the
  `END-MARKER-5000` tail; clipboard contents were not read directly. Signed
  TestFlight interaction and full a11y smoke remain v1.8 follow-up evidence
  rather than v1.7 publication blockers.
  T-2's pathless `Discard All` cleanup-failure path is now pinned by a focused
  regression: the user-visible warning is emitted and the close still
  continues. Signed TestFlight coverage and stale-candidate cleanup remain
  manual follow-up evidence.
  S-2 was rechecked on current HEAD with three serial full Rust-suite runs;
  each passed 338 tests with the two explicit host-integration cases ignored.
  Quick Open, Command Palette, and Global Search now expose dialog,
  combobox/listbox, active-option, and search-status semantics for keyboard and
  VoiceOver navigation. Global Search also localizes missing-workspace and
  runtime failure status while preserving the underlying diagnostic, without
  showing the zero-match state for a failed search. Command Palette and Global
  Search dialog/combobox names, placeholders, and empty states now follow
  English / Japanese / kana; the latest Developer bundle exposed the expected
  Japanese and kana names in the macOS accessibility tree. Inline file/folder
  rename inputs use the active English / Japanese / kana label rather than an
  English-only accessible name; packaged VoiceOver smoke remains required. The
  Reference Compare empty-editor hint now carries an explicit polite live-region
  contract, with a focused AppWorkspace regression. Its narrow-pane Draft /
  Reference toggle buttons now expose `aria-pressed` and a localized toolbar
  name, with a focused regression that pins the selected target for assistive
  technology; locale coverage pins the same toolbar key set and the English /
  Japanese / kana labels. The contextual Slash command listbox now also exposes
  a localized accessible name, with copy-key parity coverage. Tab row and tab
  list containers also use localized names for the active menu language.
  The primary Editor pane label now follows the same locale contract, with
  focused EditorMainPane and Safe Editor copy coverage.
  Workspace file rows now localize the open / unsaved state announced to
  assistive technology, with WorkspaceTree and file-ops locale coverage.
  WorkspaceTree loading and per-folder truncation notices now use the same
  localized file-operations copy. Text and image tab close controls now also
  use active English / Japanese / kana copy, with AppTopChrome and Safe Editor
  locale regressions. Dirty tab descriptions now use the same localized
  unsaved-state copy instead of an English-only hidden label.
  The Local Assist generation-lock status now follows the active English /
  Japanese / kana copy as well, while retaining its polite live-region and
  read-only editing boundary.
  The Editor full-path copy button now also uses a kana accessible name
  instead of falling back to the English label.
  Reference PDF loading now exposes a localized status message instead of an
  ellipsis-only live status.
  Reference Text/Image panes now keep a kana read-only role label instead of
  falling back to English.
  PDF stale-handle errors now keep kana copy as well, while unknown diagnostic
  details remain unchanged.
  The PDF 150% zoom control also keeps a kana accessible name instead of
  falling back to Japanese kanji.
  Editor内検索のkana「前へ」操作も誤記を修正し、検索バーの表示名と
  VoiceOver名を`まえへ`に揃えた。
  L Modeのkana Typewriter説明に残っていた文字化けも修正し、カーソル行を
  縦方向中央付近へ保つ説明を自然なかな表記へ揃えた。
  Side PaneのPreview無効理由もkanaで表示し、漢字の`無効`へ戻らないようにした。
  Preferencesのkanaテーマ説明に残っていた`じょうけ ん て ま す`の分割崩れも
  修正し、テーマの説明文を自然なかな表記へ揃えた。
  Auto-backupのkana説明に残っていた`未保存`もかな化した。
  The App Store surface smoke also passed on 2026-07-13 (**10 files / 99
  tests**), covering pane controls, Command Palette, settings, review-state,
  and distribution-lane contracts.
  The installed public `1.7.0` build `85` also passed `⌘⇧P` Command Palette,
  `⌘⇧F` Global Search, and native 表示-menu traversal on 2026-07-13; this is
  keyboard/menu evidence, not spoken VoiceOver or signed TestFlight evidence.
  The latest local App Store preview bundle also passed `smoke:macos-window`
  with a 1282x822 onscreen window, and its macOS accessibility tree exposed
  the Japanese tab row/list, tab close names, pane controls, workspace tree,
  and Editor region. This is packaged AX-tree evidence only, not spoken
  VoiceOver or signed TestFlight evidence.
  A local Poppler render review of the existing nine-page PDF inspected pages
  1–3 with no clipping and white edge samples on all four corners. Poppler
  reported a local `Adobe-Japan1` language-pack limitation, so the disposable
  Japanese fixture was exported separately and opened in macOS Preview on
  2026-07-13: Japanese glyphs were visible within the A4 margins and Preview's
  accessibility tree exposed the same Japanese text. This closes the local
  Developer visual check; signed TestFlight export breadth remains open.
  The latest source-built App Store sandbox preview passed deep-signature,
  app-sandbox, user-selected read/write, app-scoped bookmark, and inherited
  helper entitlement checks on 2026-07-12. That App Store preview pass did not
  claim picker interaction; separate-ID Developer picker evidence is recorded
  in `docs/smoke-checklist.md`.
  No per-character confidence claims.
  A current-HEAD recheck of `SKIP_BUILD=1 npm run smoke:macos-sandbox-preview`
  passed on 2026-07-13 with valid app/helper signatures, app sandbox,
  user-selected read/write, app-scoped bookmark, and sandbox + inherit
  entitlements on both helpers.
  The top chrome now separates L Mode from right-pane selection and exposes an
  explicit `参照` item beside Preview / e-book / Outline / Diff. Switching pane
  content retains the loaded reference; the in-pane close action remains the
  explicit end of the reference session.
  A rebuilt separate-ID Developer bundle opened the disposable
  `/private/tmp/hazakura-valid-text.pdf` as a read-only right-side page image and
  workspace `reference-image.png` as a read-only image on 2026-07-13 while the
  center `EDITOR-BUFFER-MARKER` remained unchanged. This extends local PDF /
  image Reference evidence; additional matrix cases and signed TestFlight
  interaction remain open. A second Developer pass closed and reopened the
  image, replaced it with a nine-page PDF, moved to page 2, and exercised
  fit-page plus 150% controls. The Reference column was also narrowed to 25%
  and kept the image contained while the center marker stayed intact.
  `ReferenceTextPane` also now directly asserts the
  image alt name, data URL, read-only copy, and absence of an editable text
  surface. `ReferencePdfPane` now also asserts a file-and-page accessible name
  for rendered PDF rasters, alongside the image-reference alt/read-only test.
  Its focused suite also pins that a stale raster cannot replace the current
  page after the Reference ID changes.
  `AppWorkspace` also pins that closing or replacing the visible reference
  leaves the center editor buffer and its change callback untouched.
  A separate-ID Developer pass temporarily moved the referenced image out of
  the fixture, surfaced `The reference file has changed on disk.` with an
  explicit Reload action, and restored the image after the fixture path was
  returned.
- **v1.8 S-1 bounded failure UX is source + packaged smoke verified.** Global Search
  preserves diagnostic details while suppressing the false zero-match state;
  workspace search caps per-file matches, total matches, visited files, and
  line preview length with explicit truncation; Diff and PDF raster paths keep
  bounded failure messages and retry/stop behavior. Focused source checks pass;
  A fresh isolated Developer bundle with no workspace showed the Global Search
  combobox and `Open a workspace to search its files` without a false zero-match
  message. Replacing that disposable workspace path with a regular file then
  surfaced `Selected workspace path is not a folder.` without a false zero-match
  result; the original fixture was restored afterward.
- **v1.8 P2 theme budget hardening is source + Developer smoke verified.** The
  resident Edohigan WebGL overlay now uses the shared intensity-aware DPR cap
  and frame throttle already used by CRT/Shinkai, so it no longer bypasses the
  ambient render budget. Focused theme tests, full source gates, and Developer
  theme switching (CRT / Edohigan / Shinkai) kept the editor and Preview
  content intact after boot animations. Signed TestFlight visual/accessibility
  breadth and a measured device FPS baseline remain open.
- **v1.8 S-4 purpose-led discovery is source + Developer smoke verified.** The
  existing Start Panel keeps its write / read / verify pitch, and the five
  right-pane controls now explain their task in English / Japanese / kana
  tooltips instead of repeating only the feature name. Focused locale checks
  passed (**2/2**); the latest separate-ID Developer AX tree exposed those
  localized Help strings. Signed TestFlight breadth and spoken VoiceOver
  remain follow-up evidence.
- **v1.8 P2 export preflight and Developer output proof are complete locally.** EPUB
  and PDF settings now state whether current unsaved changes are included,
  explain that unavailable workspace images are reported as warnings, and say
  that the concrete `.epub` / `.pdf` destination is selected in the next Save
  dialog. PDF export no longer overwrites an image-warning success status with
  a generic success message. A separate-ID Developer bundle exported unsaved
  content to both formats without changing the source file: the EPUB archive
  retained Japanese metadata, spine order, and the unavailable-image warning;
  the PDF rendered as nine A4 pages. That inspection exposed a transparent
  trailing-page background, now fixed by an explicit white export layer and
  covered by regression assertions. Signed TestFlight breadth remains open;
  the local Developer Japanese glyph check is recorded above.
- **v1.5 (`1.5.0`) is closed and was released before 江戸彼岸 (edohigan).**
  v1.5 covered Spellcheck settings, Reading Focus TOC density, CRT/Shinkai
  lineage polish, dead-code, deps hygiene, traffic-light, L Mode remount.
- The Pure-Rust PDF text fallback uses `pdf-extract` **0.12.0** and
  `lopdf` **0.42.0**, replacing the vulnerable `lopdf` 0.34 dependency reported
  by `RUSTSEC-2026-0187`. The PDFKit-first import behavior and all Safe Editor
  boundaries are unchanged.
- PDF image paths use the same document-relative and workspace-contained
  policy in Preview, HTML export, and PDF export. Open the project parent that
  owns both manuscript and images; child-workspace `../assets` references are
  blocked with an explicit parent-workspace hint. Optional packaged App Store
  re-smoke of the parent/child/drag-drop/missing matrix remains useful
  regression breadth, not a v1.6 reopen trigger.
- Historical Mac App Store baselines (`1.3.0` Daily Trust and earlier) remain
  part of product history. Treat listing/build counters in Connect as
  authoritative for store facts; this file tracks product-lane truth for
  agents.
- v1.3 Daily Trust remains an approved historical baseline. Four bounded
  slices ship in `1.3.0`: Save As keeps the same-language open-tab /
  CodeMirror session and migrates per-document view state; Local Assist
  review uses explicit `採用` / `破棄` without auto-save; Reading Focus TOC
  shows bounded H3+ context plus current measured page progress; and direct
  PDF export offers request-scoped A4 `狭い` / `標準` / `広い` margin
  presets. Extended RC interaction breadth remains in
  `docs/archive/operations/v1.3-followup.md`.
- `1.0.0` was approved and released on the Mac App Store. It is a
  semantic and product-message re-baseline of the feature shape first
  shipped through `0.36.0`, not a new feature expansion. Its public message is:
  `Markdownで書き、本として読み、ローカルAIで整える。`
- The signed App Store / TestFlight `1.1.0` candidate containing the
  completed position-continuity slice passed source, build, audit, signature,
  entitlement, checksum,
  distribution-probe, and sandbox-preview gates. Its local provenance
  is in `docs/internal/app-store-candidates/latest.json`; the public
  listing later confirmed `1.1.0`, while raw App Store Connect,
  TestFlight, and App Review logs are not tracked in this repository.
- A 2026-06-28 user-side pre-v1 pass accepted the Golden Manuscript flow,
  long-form e-book page-turning, EPUB page breaks in Apple Books, Local
  Assist success / failure / apply / discard, and the App Store safety
  boundary. No v1 No-Go condition was reported. Unchecked boxes are not
  treated as automatic blockers; commented observations are classified
  in `docs/archive/operations/v1.1-v1.2-followup.md`.
- No remaining source-level release blocker is known for the closed v1.6,
  v1.7, or v1.8 lines. Do not reopen them without a reproduced gap. The
  v1.9 Writing Loop Clarity and v1.10 Single-document Structure Foundation are
  implementation complete. **v1.12 OKF Starter Scaffold** is locally
  candidate-ready; v1.11 OKF Draft Compatibility Preview is held inside that
  candidate. Shared OKF pin: `docs/okf-spec-pin.md`.
  `AppWorkspace` owns a shared
  per-document view-state registry: reader, Editor cursor/scroll, Preview
  reopen, tab transitions, and safe local Markdown-link transitions now
  preserve the relevant document position. Earlier path-backed workspace
  Recovery forced-termination smoke passed. On 2026-07-12, a disposable
  separate-bundle Developer app also restored a force-terminated pathless T-2
  draft into a new unsaved tab with its marker intact. This is local packaged
  interaction evidence, not signed TestFlight proof. Google Drive remains
  `manual-blocked` because no dedicated fixture existed and user cloud content
  was not touched.
- Mac App Store listing: `Hazakura Editor`
  (`https://apps.apple.com/jp/app/hazakura-editor/id6778637880?mt=12`).
- Current development-tree candidate: **`2.3.0`**. Scope includes bounded
  whole-book Reader search; local source/package evidence is recorded here and
  in `docs/internal/app-store-candidates/latest.json`. No upload, TestFlight
  install, source tag, App Review, or publication is claimed.
- Published Mac App Store version: **`2.0.0`** (App Review passed and release
  published, user-reported 2026-07-21). Ships Book Scope Alpha, whole-book
  read/export, UX quieting, and Help on the Safe Editor baseline. Prior store
  baselines (`1.13.0`, …) remain historical.
- Latest GitHub source / local-app tag: `v2.0.0` (source archive only; see
  `docs/releases/2.0.0-source-tag.release.md`).
- Latest local App Store / TestFlight package candidate metadata
  (version, build counter, pkg path, SHA-256, generated time, source
  commit, smoke status) lives in
  `docs/internal/app-store-candidates/latest.json`, regenerated by
  `npm run release:candidate -- --with-app-store-pkg`. Tracked docs no
  longer carry per-build SHA / pkg path values; consult `latest.json`
  for the active artifact. Raw App Store Connect, TestFlight, and App
  Review logs are not tracked in this repository unless separately
  recorded. The public listing state is recorded separately from local
  package evidence.
- Source-level `v0.36` e-book page-turn stabilization is implemented
  locally. The reader now treats only H1 / H2 headings as chapter
  boundaries, keeps H3+ headings inside the current chapter, prevents
  keyboard auto-repeat from outrunning page state, guards pending
  chapter-cross turns while the next chapter renders, and prevents
  same-chapter image remeasurement from shrinking the committed page
  count. EPUB export now splits explicit page-break markers into
  separate XHTML content documents and keeps OPF spine / navigation
  links aligned with those split documents. Source proof exists through
  focused reader / chapter / EPUB tests and release preparation.
  `0.36.0` is now publicly available on the Mac App Store; detailed
  Golden Manuscript smoke, long illustrated manuscript page-turn proof,
  and actual EPUB-reader page-break confirmation remain useful product
  evidence rather than prerequisites for describing the release as
  published.
- Source-level `v0.35` PDF export recovery is implemented locally. The v0.34
  native print path is superseded because TestFlight still showed
  macOS' "This application does not support printing" alert after a
  local manual print smoke had passed. v0.35 moves the user-facing action
  to direct PDF export: the user chooses a `.pdf` destination, Rust keeps
  the main-window / non-empty HTML / `.pdf` destination guards, an
  app-owned WebView renders the HTML, WebKit creates PDF data, and Rust
  writes that data to the selected file. The user-facing path no longer
  depends on a browser, shell, external opener, or macOS print dialog.
  The legacy `print_html` command registration and frontend wrapper are
  removed, and `export_pdf` waits off the command event path so WebView
  load / PDF callbacks can complete.
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
  sandbox preview smoke, and `git diff --check`. At that checkpoint,
  built-app manual EPUB smoke was blocked because LaunchServices failed
  with `kLSNoExecutableErr` even though bundle inspection passed. A later
  2026-06-30 v1.2 `smoke:macos-window` run successfully launched an
  onscreen Developer bundle window; manual EPUB interaction smoke has not
  been rerun.
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
  released on 2026-06-20. Local package evidence for historical builds
  (0.25.0 build `18`, 0.26.0 build `21`, 0.27.0 build `22`, 0.28.0
  build `26`) is archived in `docs/app-store-build.md` and
  `docs/releases/`; per-build pkg path / SHA-256 values are no longer
  carried here. Raw App Store Connect, TestFlight, and App Review logs
  are not tracked in this repository.
- The helper-free App Store update for `0.26.0` has been reported as
  released on 2026-06-20 after App Review completion, following the
  Japanese `電子書籍` label correction. See `docs/app-store-build.md`
  and `docs/releases/` for historical package evidence. Raw App Store
  Connect, TestFlight, and App Review logs are not tracked in this
  repository.
- The helper-free App Store package candidate for `0.27.0` (build `22`,
  after the `v0.27.0` source / local-app tag) and for `0.28.0` (build
  `26`, after the v0.28 safety / quality / AI review foundation slice
  and top-chrome quieting pass) passed local signature, entitlement,
  helper-absence, bundled-notice, supported-OS, and package SHA checks.
  Per-build pkg path / SHA-256 values are archived in
  `docs/app-store-build.md` and `docs/releases/`. App Store Connect
  upload, processing, TestFlight, App Review, and release handling are
  not tracked in this repository unless separately recorded.
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
  passed. Per-build pkg path / SHA-256 values are archived in
  `docs/app-store-build.md` and `docs/releases/`; they are no longer
  carried here. Earlier build `29` was reported as delivered through Transporter on
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
  `docs/archive/planning/native-macos-appearance-plan.md`.

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
  Each newly opened recent folder now retains its own security-scoped bookmark:
  reopen tries the stored path and then that folder-specific grant. Legacy or
  stale entries return to the standard folder picker for one explicit
  reauthorization instead of leaving the raw sandbox `Operation not permitted`
  error visible. This remains bounded history, not startup scanning.
- The macOS About panel inherits canonical Tauri bundle metadata:
  publisher `Hazakura Lab` and
  `Copyright (c) 2026 Hazakura Lab. All rights reserved.`.
- Sanitized Markdown preview, local workspace image handling,
  standalone HTML export, and direct PDF export.
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
- Theme selection (`light`, `dark`, `sakura`, `yakou`, `shokou`, and the
  `crt` joke theme) from the native View menu and the Preferences pane.
  `sakura` / `yakou` / `shokou` are seasonal ambient themes with particle
  effects; `crt` is a deliberately hard-to-read joke theme that overlays a
  WebGL CRT shader, scanlines, chromatic-aberration text, and
  mouse-reactive glitch on top of the editor. The shader is fully
  procedural (no external texture fetch, no `blob:` URL) and stays inside
  the existing CSP. Theme choice and ambient intensity are stored in
  `localStorage` alongside other display settings.

## Release Evidence

Use release notes for detailed historical evidence:

- `docs/releases/0.36.0-app-store-release-notes.md`
- `docs/releases/0.35.0-app-store-release-notes.md`
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

- `docs/roadmap.md`: **v2 development phase** (active); residual/evidence parked.
- `docs/current-work.md`: **v2 slice queue**.
- `docs/superpowers/specs/2026-07-02-v2-book-scope-design.md`: v2 design SoT.
- `docs/releases/2.0.0-app-store-release-notes.md`: published store notes for
  `2.0.0` (user-reported 2026-07-21).
- `docs/releases/2.3.0-app-store-release-notes.md`: local Book UX (recipe + resume) candidate
  notes; manual installed/TestFlight gate pending.
- `docs/releases/2.1.0-app-store-release-notes.md`: historical notes for the
  folded whole-book search + Preview image-hardening slice.
- `docs/releases/2.0.0-source-tag.release.md`: `v2.0.0` source-tag boundary.
- `docs/releases/1.14.0-source-tag.release.md`: intermediate `v1.14.0` source tag.
- `docs/releases/1.14.0-app-store-release-notes.md`: intermediate `1.14.0` store
  copy (live listing superseded by `2.0.0`).
- `docs/product-brief.md`: durable product direction and non-goals.
- `docs/security-boundary.md`: safe editor constraints.
- `docs/agent-workbench-boundary.md`: implemented Agent Workbench trust boundary.
- `docs/l-mode-plan.md`: L Mode source-preserving writing-surface direction.
- `docs/ebook-mode-epub-export-plan.md`: e-book Mode / EPUB export
  planning and source-preserving reader/export boundaries.
- `docs/assist-surface-strategy.md`: assist-surface direction.
- `docs/v1.8-plus-product-review-roadmap.md`: completed v1.8–v1.12 bridge.
- `docs/v1.10-single-document-structure-design.md`: completed v1.10 structure contract.
- `docs/v1.11-okf-draft-preview-design.md`: completed v1.11 implementation and verification contract.
- `docs/v1.12-okf-scaffold-design.md`: closed / published v1.12 contract.
- `docs/v1.13-plus-refinement-roadmap.md`: **parked** refinement theme pools.
- `docs/v1.13-interaction-clarity-plan.md`: Theme A candidate pool (historical for main queue).
- `docs/okf-spec-pin.md`: shared OKF pin for review + scaffold + v2 inputs.
- `docs/app-store-build.md`: public-safe App Store build/signing boundary.

## Next Safe Actions

1. Use the signed universal App Store pkg candidate recorded in
   `docs/internal/app-store-candidates/latest.json` for the installed/TestFlight
   manual gate in `docs/current-work.md` and
   `docs/releases/2.3.0-app-store-release-notes.md`. Upload remains a separate
   human-approved action.
2. Treat **`2.0.0` as published/closed** (store + source tag). Hotfix only for
   reproduced review or daily-use blockers.
3. **Park** residual polish, broad evidence matrix, 縦書き, and bulk digestion
   of external review pools. Do not add another feature train to `2.3.0`
   unless a manual gate finds a blocker.
4. Keep v1.9–v1.12 product contracts and Book Scope design rails closed unless a
   regression reproduces.
5. Keep position-continuity, v1.3 Daily Trust, and v1.7 Reference Compare
   closed unless a gap reproduces.
6. Local package provenance lives in
   `docs/internal/app-store-candidates/latest.json`. App Store Connect /
   TestFlight / Review logs stay outside the repo unless public-safe evidence
   is recorded.
7. For Local Assist, keep explicit AI edit transactions
   (`docs/assist-surface-strategy.md`, `docs/app-store-build.md`).
8. Do not move published tags or upload/publish `2.3.0` without a separate
   explicit handoff. Do not reopen the `2.0.0` store lane without a reproduced
   hotfix.
