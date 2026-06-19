# Roadmap

Status: Operational
Scope: Active release lane and future planning boundaries
Authority: Medium
Last reviewed: 2026-06-19 (v0.25 native-feeling chrome polish planning)

## Current Position

`Hazakura Editor` is a Markdown-first safe editor. It is not an IDE,
Git client, general terminal, plugin platform, project analyzer, or
automatic agent-apply system.

Current release state:

- Latest published Developer / local-app release: `v0.20.0`.
- Mac App Store listing:
  `https://apps.apple.com/jp/app/hazakura-editor/id6778637880?mt=12`.
- Latest published downloadable preview: `v0.20.0` warning-expected DMG preview.
- Current package/app version: `0.20.0`.
- Active lane: v0.25 native-feeling Safe Editor chrome polish after the
  v0.24 e-book Mode single-page reader polish.
- Current work queue: `docs/current-work.md`.

North star for the next product arc:

> AIが書いたMarkdownを、本として読み、差分で直す。

This does not mean automatic agent application. It means Hazakura should
make Markdown drafts easier to read as a book, easier to structure as
chapters, and easier to accept or reject through explicit Diff / Review
flows.

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

Use `docs/native-macos-appearance-plan.md` as the planning memo. Keep the
first implementation slice inside current React/CSS chrome:

- Add or verify traffic-light-safe top-chrome drag regions, with buttons,
  tabs, menus, and segmented controls excluded from drag behavior.
- Restore a subtle editor focus indication and make existing mode active
  states truthful.
- Align right-pane / e-book chrome colors with existing design tokens and
  remove stale fallback literals.
- Improve right-pane mode controls toward a real segmented-control feel
  only after the P0 chrome fixes are verified.
- Tokenize narrow visual inconsistencies, such as Diff row backgrounds,
  when the current light/dark behavior can be preserved.

Initial implementation as of 2026-06-19:

- Traffic-light-safe drag / no-drag rules, including L Mode floating
  chrome boundaries.
- Subtle normal-editor focus signal, truthful L Mode active state,
  token-aligned e-book chrome, segmented right-pane mode controls, and
  tokenized Diff row backgrounds.

Next proof: manual app smoke for titlebar dragging, control clickability,
L Mode floating pill behavior, dense tabs, e-book / Preview / Diff,
light/dark themes, and keyboard focus.

Do not add true native vibrancy, AppKit / SwiftUI architecture changes,
top-bar rewrites, new `RightPaneMode` values, Outline / Diff information-
architecture changes, AI ingest, Git, LSP, terminal, plugin, or arbitrary
command behavior in this slice.

Treat OS material / Liquid Glass exploration as a later design and
architecture decision, not as incidental CSS polish.

## v0.26 AI Proposal Ingest And Review

Goal: make AI-written Markdown easier to import, compare, and accept
explicitly.

Use `docs/ai-markdown-ingest-plan.md` as the planning memo. The durable
boundary is manual review:

- Support multi-file Diff / Review for AI or external-agent output.
- Add an explicit ingest flow for AI-proposed Markdown changes.
- Keep App Store lane ingestion file-based and helper-free.
- Keep Developer / GitHub lane integration separate, where Apple Local
  Assist or Agent Workbench may create external or unsaved edits under
  their existing boundaries.

Do not add auto-apply, auto-save, auto-commit, hidden workspace
rewriting, or general agent orchestration.

## v1.0 Candidate

Goal: ship a coherent book-oriented writing surface, not every future
authoring idea.

Candidate criteria:

- e-book Mode is stable enough to serve as a daily writing and reading
  surface for Markdown prose.
- Initial EPUB export exists as an explicit user action.
- L Mode integration is complete, or the product defines a clear
  long-term coexistence between L Mode and e-book Mode.
- App Store lane status is separately verified and accurately reported
  for each release; the initial `0.19.0` App Store lane is approved and
  published.

Defer beyond v1.0 unless a focused review reopens scope:

- OKF bundle support.
- Vertical writing.
- Advanced EPUB metadata, cover, navigation, and validation workflow.
- Speculative OS-model or local-model integration.

## v1.x Book And EPUB Expansion

Goal: deepen the book model after the first daily-use surface is proven.

Possible directions:

- Read OKF-style bundles as books, including readable frontmatter,
  `index.md` / `log.md` conventions, and simple link-graph views.
- Add vertical writing if the horizontal e-book surface is already stable.
- Improve EPUB export with metadata, cover selection, navigation, and
  clearer manual validation guidance.

OKF remains a proposal-stage dependency. Re-check the latest OKF shape
before treating it as an implementation contract.

## v2.x Speculative Local AI Decision

Goal: decide whether OS-provided local AI belongs in the product after
the book / review primitives are strong.

Use `docs/speculative-local-ai-future-plan.md`. Do not start a v2.0
OS-model integration just because the roadmap names it; require a fresh
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
- Apple Local Assist: keep it as an explicit, on-device, availability-
  gated writing companion with unsaved, diff-reviewable edits. Use
  `docs/assist-surface-strategy.md` and
  `docs/apple-local-assist-writing-companion-plan.md`.
- Native macOS appearance: explore a more native-feeling macOS 26+
  interface, with macOS 27 treated as a future verification target. Use
  `docs/native-macos-appearance-plan.md`.
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
