# Roadmap

Status: Operational
Scope: Active release lane and future planning boundaries
Authority: Medium
Last reviewed: 2026-06-21 (v0.28 planning alignment)

## Current Position

`Hazakura Editor` is a Markdown-first safe editor. It is not an IDE,
Git client, general terminal, plugin platform, project analyzer, or
automatic agent-apply system.

Current release state:

- Latest published Developer / local-app release: `v0.20.0`.
- Mac App Store listing:
  `https://apps.apple.com/jp/app/hazakura-editor/id6778637880?mt=12`.
- Latest published downloadable preview: `v0.20.0` warning-expected DMG preview.
- Current package/app version: `0.27.0`.
- Mac App Store published version: `0.26.0`, reported released on
  2026-06-20 after App Review completion.
- Active lane: v0.28 Safety, Quality, and AI Review Foundation after
  the v0.27 refinement source / local-app tag.
- Current work queue: `docs/current-work.md`.

North star for the next product arc:

> AIが書いたMarkdownを、本として読み、差分で直す。

Post-v0.25 refinement lens:

> 編集空間はひとつ。Markdown source を、読む・書く・比べる・変換する
> レイヤーとして扱う。

This does not mean automatic agent application. It means Hazakura should
make Markdown drafts easier to read as a book, easier to structure as
chapters, and easier to accept or reject through explicit Diff / Review
flows.

Near-term phase order:

1. v0.28 tightens quality and trust consistency, especially around image
   loading, Japanese text search parity, OS handoff explanation, and the
   first reusable AI proposal review primitives.
2. v0.29+ deepens writing / review flow only after those foundations are
   solid: L Mode / e-book transitions, proposal import, Diff / Review, and
   release-quality smoke.
3. v1.0 should be a polished single-document Markdown book-writing
   surface with explicit export and review, not a full multi-file book
   workspace.
4. v2.0 is the first appropriate target for Book Workspace Alpha:
   treating user-selected, structurally related Markdown files as one
   book.

Historical phase details now live in release notes and archive files:

- `docs/releases/`
- `docs/archive/roadmaps/`
- `docs/archive/operations/app-store-v0.17/`

## Product Boundary

These boundaries stay active across roadmap changes:

- Safe Editor remains the primary product surface.
- Markdown/text source remains canonical.
- Default Safe Editor Mode has no general terminal, arbitrary command
  execution, Git client, LSP, plugin system, project-wide indexing,
  auto-apply, or auto-commit behavior.
- Agent Workbench is a separate Developer / GitHub lane trust boundary:
  explicit, consent-gated, allowlisted providers only, selected
  workspace root only, one active session, no restore, no auto-apply.
- Manual Review Desk entry points are hidden for the current App
  Store-oriented surface. Diff, recovery review, and Apple Local Assist
  edit review remain explicit, unsaved, and inspectable.
- Workspace file operations stay bounded to the selected workspace and
  must not become a full file manager.

## v0.18 UX Polish

Goal: make the current Safe Editor experience easier to use before
submission work hardens around it.

Use `docs/current-work.md` as the queue. The near-term UX priority is a
Core Safe Editor quality probe, with lightweight accessibility sanity
kept adjacent to the selected surface.

Recently completed:

- Help copy overlap cleanup: the in-app Privacy Policy now stays
  public-copy oriented, while Local Data Disclosure retains technical
  details such as workspace backup paths, preview/export routing, App
  Store lane omissions, and process/network boundaries.
- Auto-backup filename uniqueness: rapid snapshots for the same
  workspace file no longer overwrite each other within the same second;
  backup filenames now include milliseconds and a bounded collision
  suffix while recovery listing remains newest-first.
- Status bar encoding / line-ending de-duplication: normal Safe Editor
  mode removes duplicate passive `UTF-8` / `LF`-style detail values when
  the trailing encoding and line-ending dropdowns already expose those
  active values; L Mode keeps the passive detail because those controls
  are hidden.
- Direct save fallback failure safety: the sandbox-oriented direct write
  fallback now attempts to restore original bytes if a direct write or
  sync fails after partially changing the selected file, while keeping
  the normal atomic save path unchanged.
- App Store lane Move to Trash external-process review: the App Store
  lane now uses the native macOS Trash API instead of `osascript` /
  AppleEvents, with signed TestFlight smoke still tracked separately.
- Workspace persistence before App Review: repeated launch / relaunch
  and outside-active-tab restore are pinned by code-level regression
  tests, with signed TestFlight smoke still tracked separately.
- Encoding-only dirty indication and auto-backup coverage: `TabBar`
  and the auto-backup loop now share the same `isDirty()` contract
  used elsewhere, and `encoding` is part of the auto-backup
  signature so repeated ticks do not pile up duplicates.
- WorkspaceTree rename-state markup cleanup: the rename `<input>`
  is rendered as a non-button row instead of being nested inside
  the row `<button>`, avoiding a nested-interactive-control
  VoiceOver / focus / click / blur risk.
- Markdown preview task checkboxes: `- [ ]` and `- [x]` render as
  display-only task checkboxes in Preview without changing saved
  Markdown.
- Left workspace sidebar collapse / restore: normal mode has a
  reversible restore rail, while L Mode keeps its separate temporary
  workspace drawer.
- Pasted image decoded-size cap: `save_pasted_image` rejects decoded
  pasted image payloads above the existing 20 MB local image boundary
  before allocating the decoded buffer; status and docs distinguish this
  from the separate small `data:image` preview/export inline cap.
- About metadata finalization: the base Tauri bundle metadata now sets
  the macOS About publisher and copyright source inherited by the
  local helper-free App Store preview and other build lanes.

Out of scope for this lane:

- New product surfaces.
- Git, LSP, terminal, plugin, project-wide indexing, or arbitrary
  command behavior.
- Preview DOM editing, `contenteditable`, HTML saved model, hidden
  save-time rewriting, or broad WYSIWYG structural editing.
- Certificate, notarization, upload, or App Store account work unless
  explicitly picked from the submission-prep queue.

## App Store Approval Closeout

Goal: keep the approved App Store lane accurately documented without
mixing it with the Developer / GitHub preview lane.

Use `docs/current-work.md` and `docs/app-store-build.md`.
Keep account-specific App Store Connect notes, certificate names,
signing identities, screenshots, contact details, and private reviewer
copy under ignored `docs/internal/` files.

Completed result:

- The helper-free App Store lane for `0.19.0` passed App Review and is
  published on the Mac App Store.
- The published App Store lane omits CLI Agent / Agent Workbench
  execution surfaces, Apple Local Assist helper, external AI/API calls,
  and arbitrary command execution.
- Completed local packaging, smoke, metadata, reviewer-note, and
  submission-prep evidence remains historical release evidence rather
  than the next product queue.

For future App Store submissions, restart from `docs/app-store-build.md`
and tie each new signed, submitted, approved, TestFlight-ready,
notarized, or production-ready claim to fresh evidence for that build.

## v0.20 Sakura Workspace Ergonomics

Goal: refine the normal Safe Editor surface around the Sakura visual
language without turning the app into a file manager or IDE.

Use `docs/current-work.md` as the queue. Keep the first slice focused on
the existing Safe Editor chrome:

- Make the workspace sidebar collapse / restore control easier to find
  from the main chrome, while keeping the current file-tree model.
- Move the active file path context into a thin bottom full-path copy
  bar in the central editor pane, clipped safely for long paths.
- Strengthen Markdown preview hierarchy with card-like emphasis for
  important blocks, headings, code, and quote/readout areas.
- Use Sakura accenting to make the selected workspace file state clearer.
- Keep the bottom status bar concise: breadcrumb / position / file stats
  can be clarified, but do not reintroduce duplicate `UTF-8` / `LF`
  labels that are already exposed as controls.
- Keep New File on the existing menu, shortcut, command-palette, and
  workspace-file paths rather than a tab-row `+` affordance.

Explicitly deferred:

- Workspace switching dropdowns. The simple single-workspace model is
  still preferable until a later UX pass proves the extra state is worth
  the complexity.
- Multi-workspace sessions, background indexing, Git status, LSP,
  terminal, plugin, or arbitrary command behavior.

First slice status: implemented locally on 2026-06-13 with focused
React/CSS coverage, `npm run build:vite`, and `npm run test`; the
tab-row new-file `+` affordance was removed after visual review on
2026-06-14.

v0.21+ follow-up: the v0.20 compact status detail is a stopgap. A later
UX slice should split status metadata into priority-aware fields instead
of one long `statusDetail` string, keep line-ending / encoding controls
always reachable, and move lower-priority document details into hover,
popover, or adaptive secondary display.

## v0.21 PoC And Preparation

Goal: prove the e-book Mode direction without committing to a broad new
document model.

Use `docs/ebook-mode-epub-export-plan.md` and `docs/l-mode-plan.md`.
Keep the first slice display-only and source-preserving:

- Build or prototype an e-book Mode display-only PoC for horizontal
  Japanese / English Markdown prose.
- Split a single long Markdown document into chapter-like pages from ATX
  headings.
- Audit whether `src/features/editor/lMode/` CodeMirror decorations,
  widgets, parser helpers, or CSS rules can be reused.
- Explore the UI basis for seeing multiple Markdown files in one
  selected workspace as a book-like chapter structure.
- Document the decision criteria for whether L Mode and e-book Mode
  should be integrated, coexist as separate modes, or evolve into one
  future writing surface.

Out of scope:

- EPUB archive generation.
- Vertical writing.
- Multiple-workspace or file-manager behavior.
- Background indexing, project analysis, Git state, or automatic AI
  application.

## v0.22 e-book Mode MVP

Goal: make Markdown readable as an EPUB-like book surface while keeping
Markdown source canonical.

Expected MVP shape:

- Horizontal EPUB-like display mode.
- Heading-based chapter page splitting for a single long document.
- Readable rendering for prose, headings, images, blockquotes, lists,
  tables, and code using existing preview / workspace safety boundaries
  where practical.
- Mode switching that does not mutate source, saved text, Diff, Preview,
  or Export HTML behavior.

Defer:

- Vertical writing.
- Advanced pagination fidelity.
- Cover / metadata editing.
- EPUB archive export.

## v0.23 CSS Columns Pseudo Pagination Spike

Goal: test whether the v0.22 chapter reader can become a page-like
reading surface without introducing a custom pagination engine or a new
document model.

Expected direction:

- Keep Markdown source canonical and keep the existing Preview safety
  pipeline.
- Keep the active chapter reader, then paginate only the rendered active
  chapter body with CSS columns.
- Define one fixed reference reader device for verification. Treat
  page counts as an app simulation result, not as a guarantee of Kindle,
  Apple Books, Kobo, or EPUB-reader pagination.
- Use horizontal page movement before considering true page calculation,
  vertical writing, spread view, or EPUB export page fidelity.
- If manual smoke shows the reading feel is clearly stronger than
  Preview, deepen the single-page right-pane reading surface first.
  Treat right-pane 2-up as a poor fit because it needs too much width;
  revisit it only as a later occupied reading mode.

Do not add:

- Character-count based source splitting.
- True pagination / line-layout calculation.
- Multiple device presets or device-selection UI in the first spike.
- Vertical writing, spread view, or EPUB page-count guarantees.
- Full file-management workflows or workspace-wide semantic indexing.
- Git, LSP, terminal, plugin, or arbitrary command behavior.

Book Structure Overview moves later: several Markdown files as one book
should wait until the single-document reading surface proves useful.

WYSIWYG-like editing remains an L Mode / Live Source concern. Do not
turn e-book Mode into Preview DOM editing or a second saved document
model.

## v0.24 e-book Mode Single-page Reading Surface Polish

Goal: deepen the v0.23 page-like reading feel inside the current right
pane without adding a spread view or a new document model.

Expected direction:

- Keep the active chapter reader and CSS Columns pseudo-pagination.
- Add a fixed reader footer outside `.ebook-page-flow` so chapter title
  and chapter-local page progress feel anchored to the page sheet.
- Tune the single-page simulation frame only where it improves reading
  feel in the existing right-pane layout.
- Record the decision that right-pane 2-up is not a good fit: it needs
  roughly 900px and would make the editor column nearly unusable.

Do not add:

- Right-pane 2-up toggle, spread view, horizontal scroll, or automatic
  width-based spread behavior.
- Whole-book page numbering that requires pre-measuring every chapter.
- `RightPaneMode` changes, full-screen takeover, EPUB export, vertical
  writing, or WYSIWYG editing.

Treat 2-up as a later e-book occupied reading mode candidate, not a
right-pane sub-feature.

## v0.25 Native-feeling Safe Editor Chrome Polish

Goal: make the existing Markdown-first Safe Editor shell feel more like a
macOS app before adding a new AI proposal ingest workflow.

Use `docs/native-macos-appearance-plan.md` as the planning memo.

Phase 1 (chrome alignment) is complete and verified at code/CSS level:

- Traffic-light-safe drag / no-drag rules, including L Mode floating
  chrome boundaries.
- Subtle normal-editor focus signal, truthful L Mode active state,
  token-aligned e-book chrome, segmented right-pane mode controls, and
  tokenized Diff row backgrounds.

Phase 1 remaining proof: manual app smoke for titlebar dragging, control
clickability, L Mode floating pill behavior, dense tabs, e-book / Preview /
Diff, light/dark themes, and keyboard focus.

Scrap-and-build decision as of 2026-06-19: the CSS-only glass polish that
was considered as a Phase 1 follow-up is **dropped**. A `backdrop-filter`
approximation does not change the feel enough to justify the work, and it
would be thrown away once real native vibrancy lands.

Phase 2 (native vibrancy, brought forward) is now the active work:

- Add `window-vibrancy` and call `apply_vibrancy` on the main window with
  an `NSVisualEffectMaterial` matching the sidebar / titlebar band.
- Make the window transparent and replace the CSS
  `backdrop-filter: blur(16px)` approximation with transparent surfaces
  that let the native material render.
- Keep the five themes legible over the native material, and keep dense
  Markdown text on a readable non-vibrant background.
- Raise the macOS deployment target to **macOS 26** as part of this slice.

Do not add a full SwiftUI / AppKit rewrite, true Liquid Glass fidelity,
vibrancy behind dense Markdown text, top-bar rewrites, new
`RightPaneMode` values, Outline / Diff information-architecture changes,
AI ingest, Git, LSP, terminal, plugin, or arbitrary command behavior in
this slice.

Treat the macOS 26 floor change as release-planning work: a new App Store
build declaring macOS 26 is a lane decision with TestFlight / App Review
evidence, not a silent metadata bump.

## v0.26 Polish And EPUB Export

Goal: ship a tighter authoring surface before opening heavier review or
AI workflows.

Use `docs/current-work.md`,
`docs/post-v0.25-product-refinement-plan.md`, and
`docs/ebook-mode-epub-export-plan.md`.

Shipped v0.26 shape:

- no-workspace New File creates an untitled standalone Markdown tab;
- Save on an untitled/pathless tab routes to Save As before writing;
- the e-book affordance remains visible in no-file / non-Markdown empty
  states instead of disappearing;
- initial EPUB export beta exists as an explicit action from Markdown source;
- EPUB output is an initial archive for current-document / heading-based
  content, not a reader-perfect pagination guarantee.

Do not add hidden temporary workspaces, background autosave folders,
workspace-wide indexing, Preview DOM editing, `contenteditable`, external
validator launches, plugin/provider systems, or Git/LSP/terminal
behavior.

## v0.28 Safety, Quality, And AI Review Foundation

Goal: make the current product claims and implementation line up before
building heavier book-workspace or AI workflows.

Use `docs/current-work.md`, `docs/security-boundary.md`,
`docs/ai-markdown-ingest-plan.md`, and the relevant surface plan for
each slice. v0.28 is allowed to be several small fixes, but each fix
must remain independently reviewable.

Expected slices:

- **L Mode image policy parity**: L Mode image widgets should follow the
  same external-image and `data:image` safety expectations as Preview /
  export. Treat Preview's embedded-image policy as the implementation
  reference: no direct `http:` / `https:` image fetch path, supported
  `data:image` MIME types only, strict base64 validation, and the same
  2 MB inline cap. This cap applies only to Markdown-embedded
  `data:image` payloads, not to workspace image files or EPUB packaged
  images; those remain under the workspace/local image boundary and may
  need a separate EPUB image policy later. Do not let L Mode become a
  separate external fetch path.
- **Workspace search encoding parity**: search should use the same
  Japanese text decoding assumptions as safe file open where practical:
  UTF-8 plus Shift-JIS / EUC-JP, not broader legacy encodings unless file
  open supports them first. Files the editor can open should not be
  silently invisible to search.
- **System handoff hardening**: organize fixed OS handoff paths such as
  external links, Finder reveal, and print/browser handoff so they are
  easier to explain and test as OS handoff rather than arbitrary command
  execution.
- **AI proposal review foundation**: add one review primitive only: file,
  paste, or transaction intake into explicit Diff / Review. Keep it
  helper-free in the App Store lane and separate from Agent Workbench.
- **Golden-path smoke**: keep a repeatable release-quality path for New
  File, Save / Save As, L Mode, e-book Mode, EPUB export, Diff /
  Recovery, and AI proposal review once the first review primitive
  exists.

Do not include:

- Book Workspace Alpha, multi-file chapter ordering, or a saved book
  manifest.
- Background workspace indexing, project analysis, Git / LSP / terminal,
  provider plugins, generic chat, or agent orchestration.
- AI auto-apply, auto-save, auto-commit, hidden workspace rewriting, or
  Preview DOM editing.

## v0.29+ AI Proposal Ingest And Writing Flow

Goal: make AI-written Markdown easier to import, compare, and accept
explicitly.

Use `docs/ai-markdown-ingest-plan.md` as the planning memo. The durable
boundary is manual review:

- Support Diff / Review for AI or external-agent output, starting with
  the smallest reusable proposal intake path.
- Add explicit ingest for AI-proposed Markdown changes from selected
  files, pasted text, Apple Local Assist transactions, or Agent Workbench
  external edits when those lanes are active.
- Expand from the one v0.28 review primitive into broader ingest flows
  only after the first path proves source-preserving review, rejection,
  and explicit application.
- Keep App Store lane ingestion file-based and helper-free.
- Keep Developer / GitHub lane integration separate, where Apple Local
  Assist or Agent Workbench may create external or unsaved edits under
  their existing boundaries.

Do not add auto-apply, auto-save, auto-commit, hidden workspace
rewriting, or general agent orchestration.

## Post-v0.25 Product Refinement

Goal: raise the product grade by tightening the existing experience
instead of adding broad new surfaces.

Use `docs/post-v0.25-product-refinement-plan.md` as the refinement lens.
For v0.27 execution, use `docs/v0.27-refinement-slice-plan.md`; it
keeps AI ingest, Workspace As Book information-architecture changes, and
Native Vibrancy Phase 2 outside the main v0.27 scope. After v0.27, the
strongest direction is:

- treat Normal Mode, L Mode, e-book Mode, Preview, Diff, and AI review as
  source-preserving layers over one Markdown editing space;
- move the workspace / book idea forward carefully, but keep structural
  multi-file book handling out of the v0.x / v1.0 path unless explicitly
  reopened;
- make UI chrome feel layered and callable rather than card-heavy or
  dashboard-like;
- prioritize stability, large-document behavior, tab-state retention,
  preview memory behavior, and mode-switch context before broader feature
  expansion.

Do not turn this into a full WYSIWYG rewrite, plugin system, always-on
CLI / terminal surface, background project analyzer, or AI auto-apply
workflow.

## v1.0 Candidate

Goal: ship a coherent single-document book-oriented writing surface, not
every future authoring idea.

Candidate criteria:

- e-book Mode is stable enough to serve as a daily writing and reading
  surface for Markdown prose.
- Initial EPUB export exists as an explicit user action.
- L Mode integration is complete, or the product defines a clear
  long-term coexistence between L Mode and e-book Mode.
- AI proposal intake / review has a stable first path if it has entered
  the product: user-initiated import, explicit Diff / Review, no
  auto-save, and no auto-apply.
- App Store lane status is separately verified and accurately reported
  for each release; the initial `0.19.0` App Store lane is approved and
  published.

Defer beyond v1.0 unless a focused review reopens scope:

- OKF bundle support.
- Book Workspace Alpha and any saved multi-file book manifest.
- Vertical writing.
- Advanced EPUB metadata, cover, navigation, and validation workflow.
- Speculative OS-model or local-model integration.

## v1.x Writing, Review, And EPUB Expansion

Goal: deepen the single-document writing / review / export model after
the first daily-use surface is proven.

Possible directions:

- Improve AI proposal import, provenance display, and Diff / Review
  ergonomics without making Hazakura an agent platform.
- Improve EPUB export with metadata, cover selection, navigation, and
  clearer manual validation guidance.
- Add vertical writing if the horizontal e-book surface is already stable.
- Reduce UI friction around L Mode, e-book Mode, Preview, Diff, and
  Recovery as layers over the same Markdown source.

OKF remains a proposal-stage dependency. Re-check the latest OKF shape
before treating it as an implementation contract.

## v2.0 Book Workspace Alpha

Goal: treat a user-selected set of structurally related Markdown files
as one book without turning Hazakura into a project analyzer or full file
manager.

This is the right place for the difficult part of `Workspace = Book`:
several Markdown files, explicit order, chapter metadata, and book-level
reading / export. It should build on the single-document e-book, EPUB,
and AI review primitives instead of arriving before them.

Possible first shape:

- Let the user explicitly choose a book scope from the selected
  workspace, such as an `index.md`, a simple manifest, or a selected
  chapter list.
- Treat chosen Markdown files as chapter candidates with manual order
  and visible table-of-contents structure.
- Connect book scope to e-book Mode, EPUB export, and AI proposal review
  only after the scope is explicit and reversible.
- Keep saved source as Markdown plus a small explicit structure file if
  needed; do not hide a database-like document model behind the app.

Do not add:

- automatic project-wide indexing or semantic analysis;
- hidden chapter inference across the whole workspace;
- Git, LSP, terminal, plugin, or arbitrary command behavior;
- background AI restructuring or automatic multi-file rewrite.

## v2.x / v3.x Speculative Local AI Decision

Goal: decide whether OS-provided local AI belongs in the product after
the book / review primitives are strong.

Use `docs/speculative-local-ai-future-plan.md`. Do not start an OS-model
integration just because the roadmap names it; require a fresh
product-boundary decision and working proof that edits remain explicit,
unsaved until accepted, and reviewable.

## Distribution Lanes

Current preview releases are warning-expected DMG previews unless the
user opens a different lane.

The intended stable distribution shape remains two public binary lanes:

- App Store build: Safe Editor + L Mode + Diff / explicit change review,
  without External Agent Workbench, CLI launch, Apple Local Assist helper,
  or external AI/API calls.
- Developer / GitHub build: the same base plus optional Apple Local
  Assist and Agent Workbench for allowlisted local CLI providers.

Use:

- Source-preview release rules: `docs/source-release-checklist.md`
- Warning-expected DMG rules: `docs/dmg-preview-checklist.md`
- Final release hygiene: `docs/release-pre-check.md`
- Release-note evidence: `docs/releases/`

Developer ID signing, notarization, updater work, installer packaging,
and stable distribution remain explicit future distribution-lane work.

## Future Product Direction

Keep future product work source-preserving and narrow:

- L Mode: treat it as the existing Live Source writing surface and a
  potential e-book Mode integration target. Use `docs/l-mode-plan.md`.
- e-book Mode / EPUB export: make it the next book-oriented authoring
  arc. Use `docs/ebook-mode-epub-export-plan.md`.
- AI proposal ingest: keep AI output explicit, file-based or
  transaction-based, and Diff / Review centered. Use
  `docs/ai-markdown-ingest-plan.md`.
- Book Workspace: target v2.0 for structured, user-selected Markdown
  files as one book. Keep the scope explicit and avoid background
  project indexing or a hidden document model.
- Apple Local Assist: keep it as an explicit, on-device, availability-
  gated writing companion with unsaved, diff-reviewable edits. Use
  `docs/assist-surface-strategy.md` and
  `docs/apple-local-assist-writing-companion-plan.md`.
- Native macOS appearance: explore a more native-feeling macOS 26+
  interface, with macOS 27 treated as a future verification target. Use
  `docs/native-macos-appearance-plan.md`.
- Post-v0.25 product refinement: keep the product feeling like one
  quiet, safe Markdown editing space while tightening book structure,
  mode transitions, chrome density, and reliability. Use
  `docs/post-v0.25-product-refinement-plan.md`.
- Speculative local AI future: preserve, but do not yet commit to,
  a changeable v1+ / v2+ / v3+ direction for AI-ready editing
  primitives, OS-provided local models, whitelisted external `.aimodel`
  support, and much later local image generation. Use
  `docs/speculative-local-ai-future-plan.md`.
- Agent Workbench: keep it optional, allowlisted, one-session, no-restore,
  and outside the App Store lane. Use `docs/agent-workbench-boundary.md`.

Any broader WYSIWYG editing model, database-like workspace layer,
collaboration feature, updater, plugin system, arbitrary model runtime,
local image-generation platform, or automated agent-apply flow needs a
fresh product-boundary decision before implementation.
