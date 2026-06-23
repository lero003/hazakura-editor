# Roadmap

Status: Operational
Scope: Active release lane and future planning boundaries
Authority: Medium
Last reviewed: 2026-06-23 (v0.32 candidate package)

## Current Position

`Hazakura Editor` is a Markdown-first safe editor. It is not an IDE,
Git client, general terminal, plugin platform, project analyzer, or
automatic agent-apply system.

Current release state:

- Latest published Developer / local-app release: `v0.20.0`.
- Mac App Store listing:
  `https://apps.apple.com/jp/app/hazakura-editor/id6778637880?mt=12`.
- Latest published downloadable preview: `v0.20.0` warning-expected DMG preview.
- Current package/app version: `0.32.0`.
- Latest source / local-app tag: `v0.29.1`, prepared on 2026-06-22.
- Mac App Store published version: `0.29.1`, reported approved and
  released on 2026-06-23 with Hazakura Local Assist available as a
  preview on-device writing companion.
- Latest local App Store / TestFlight package candidate: `0.32.0` build
  `36`, generated on 2026-06-23 for v0.32 Editor / Reader Position
  Bridge built-app testing.
- Active lane: `v0.30-v1.0 Reader UX Stabilization`, making the shipped
  Safe Editor, L Mode, e-book Mode, EPUB export beta, Diff / Recovery,
  and Hazakura Local Assist review surfaces feel like one coherent
  single-document book-writing product.
- Current work queue: `docs/current-work.md`.

North star for the next product arc:

> Markdownを、本として読みながら直す。AIの提案も、差分で受け取る。

Post-v0.25 refinement lens:

> 編集空間はひとつ。Markdown source を、読む・書く・比べる・変換する
> レイヤーとして扱う。

This does not mean automatic agent application. It means Hazakura should
make Markdown drafts easier to read as a book, easier to structure as
chapters, and easier to accept or reject through explicit Diff / Review
flows.

Near-term phase order:

1. v0.30 makes e-book Mode a daily paged-flow surface for reading and
   revising long Markdown prose while keeping the view book-like.
2. v0.31 adds Spread View for book-like two-page inspection, with
   single-page fallback and coarse navigation.
3. v0.32 connects editor and reader positions so the user can read,
   notice a problem, and return to the corresponding Markdown location.
4. v0.33 polishes EPUB export as an explicit initial-v1 workflow for a
   single Markdown document.
5. v0.34 freezes features as the v1.0 Release Candidate and verifies the
   product explanation, App Store lane boundary, and golden path.
6. v1.x deepens the single-document product before any rush to v2:
   EPUB, Diff / Review, movement between writing / reading layers,
   distribution polish when needed, and observation-driven Local Assist
   refinement.
7. v2.0 remains the first appropriate target for Book Scope / Book
   Workspace Alpha: treating a user-selected, explicit set of
   structurally related Markdown files as one book.

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
- The standalone Review Desk screen is retired from the current product
  surface. Hazakura Local Assist and other AI-assist paths must remain
  explicit, inspectable through Diff / change history or an equivalent
  review surface, and never auto-save or auto-apply without user action.
- Workspace file operations stay bounded to the selected workspace and
  must not become a full file manager.

## Shipped Phase Summary

Older phase-level details live in `docs/releases/`, `docs/current-work.md`,
and `docs/archive/`. Keep this roadmap focused on current and future
decisions.

- **v0.18-v0.20**: Safe Editor polish, App Store lane separation, Sakura
  workspace ergonomics, bounded image handling, save/recovery hardening,
  and helper-free App Store surface checks.
- **v0.21-v0.24**: e-book Mode progressed from display-only PoC to
  heading-based single-document reading, CSS-column pseudo-pagination, and
  single-page reading-surface polish while keeping Markdown source
  canonical.
- **v0.25**: native-feeling Safe Editor chrome polish landed as a
  source/CSS-level pass; native vibrancy and macOS floor changes remain a
  separate distribution-lane decision.
- **v0.26**: no-workspace authoring, e-book empty-state polish, and initial
  EPUB export beta shipped before heavier AI review or book-workspace work.
- **v0.27-v0.29.1**: source-preserving refinement, AI review foundation,
  Hazakura Local Assist transaction review, detached companion polish,
  Local Assist responsiveness hardening, and preview flicker reduction
  shipped through the `0.29.1` App Store update.

The durable exclusions from these phases still apply: no Git/LSP/terminal,
plugin system, arbitrary command execution, background workspace indexing,
Preview DOM editing, hidden save-time rewriting, or automatic AI application.

## v0.30-v1.0 Reader UX Stabilization Lane

Goal: ship `Hazakura Editor` v1 as a polished single-document Safe
Markdown Book Editor with Local Assist Review.

The v1 lane should not add broad new product surfaces. It should make the
parts already shipped by `0.29.1` feel like one coherent product: a safe
Markdown editor where the user can write Markdown, read it as a book,
inspect it in a two-page spread, export it explicitly, and review AI
proposals through Diff / Discard.

### Product Definition

v1.0 is:

- a single-document, book-oriented Markdown editor;
- a source-preserving set of reading, writing, preview, diff, recovery,
  assist-review, and export layers over one Markdown source;
- an editor where e-book Mode can be used to read prose, notice issues,
  and return to Markdown editing;
- an app where EPUB export is an explicit user action;
- an app where Hazakura Local Assist proposals remain user-initiated,
  unsaved until accepted, and reviewable through Diff / Discard.

v1.0 is not:

- Book Workspace Alpha or a multi-file book manifest;
- a full WYSIWYG editor or Preview DOM editing surface;
- an IDE, Git client, terminal, LSP host, plugin platform, or project
  analyzer;
- an external AI/API client or Agent Workbench integration in the App
  Store lane;
- an AI auto-apply, auto-save, auto-rewrite, or hidden workspace rewrite
  system.

### Product Focus

The post-`0.29.1` v1 lane shifts from Hazakura Local Assist stabilization
to e-book Mode reader UX. Hazakura Local Assist remains part of the
product, but dedicated post-`0.29.1` work should be observation-driven
polish only unless a safety, review, App Store, availability, generation
failure, or transaction-boundary issue appears.

### Required Before v1.0

- e-book Mode supports a comfortable daily reading / revision flow for
  single-document Japanese Markdown prose.
- e-book Mode is not button-only page-turning; it provides low-friction
  wheel / trackpad / keyboard movement while keeping the simulated page
  surface book-like.
- e-book Mode provides a two-page Spread View for book-like inspection
  when the window size allows it, with a single-page fallback for narrow
  windows.
- Page navigation includes keyboard shortcuts, clear progress, heading
  jump, and coarse navigation such as a slider or equivalent control.
- The user can move between editor position and e-book reading position
  without getting lost.
- L Mode, Preview, e-book Mode, Diff, Recovery, EPUB export, and AI
  review remain source-preserving layers over one Markdown document.
- EPUB export remains an explicit user action and is polished enough for
  initial v1 use.
- Hazakura Local Assist remains user-initiated, on-device,
  availability-gated, unsaved until accepted, and reviewable through
  Diff / Discard.

### Suggested Slices

#### v0.30: e-book Mode Paged Flow

Make e-book Mode usable as a daily reading and revision surface.

- Keep e-book Mode on a simulated book page rather than a Preview-like
  continuous document.
- Reduce page-turn friction for normal reading with wheel / trackpad /
  keyboard movement.
- Preserve chapter / page reading position across mode switches.
- Preserve the reader location contract for the later editor / reader
  position bridge.
- Re-tune Japanese prose layout: width, line height, margins, paragraph
  rhythm, and empty states.
- Confirm large-document behavior.

Acceptance: long Markdown prose can be read naturally in a book-like
page surface without relying only on buttons, and switching from Normal
Mode / L Mode / Preview does not leave the user badly lost.

#### v0.31: e-book Mode Spread View

Add book-like two-page inspection without making page-turning the only
way to read.

- Add a `集中して読む` Reading Focus entry for the e-book reader.
- In Reading Focus, let workspace/sidebar/editor chrome recede so the
  active Markdown document can use the main window as a book surface.
- Add a two-page spread layout when the focused reader has enough width.
- Fall back to single-page focused reading on narrow windows.
- Add previous / next page controls.
- Support keyboard navigation such as Left / Right and Space.
- Show current page / total page or equivalent progress.
- Add coarse navigation; the current v0.31 path uses a Reading
  Focus-only table-of-contents drawer for heading/chapter jumps, with
  page sliders left as a later display-option candidate.
- Keep Markdown source canonical and avoid Preview DOM editing.
- Keep a fully detached separate reader window as a later option, not
  the first v0.31 path.

Acceptance: the surface can feel book-like while paged flow remains the
daily revision path.

#### v0.32: Editor / Reader Position Bridge

Make writing and reading feel connected.

- Open e-book Mode near the current editor cursor or visible heading.
- Return from e-book Mode to the corresponding Markdown location.
- Reduce position drift across Normal Mode, L Mode, Preview, and e-book
  Mode.
- Keep mode transitions stable for unsaved documents and recovered
  buffers.

Acceptance: "read, notice, return, fix" feels like one revision cycle
rather than a separate viewer.

#### v0.33: EPUB Export v1 Polish

Align initial EPUB export with the single-document book-writing promise.

- Improve the explicit export flow.
- Check Japanese text, headings, local images, links, code blocks, and
  failure messages.
- Keep advanced metadata, cover, navigation editing, and validation
  workflow deferred to v1.x.
- Document the difference between e-book Mode preview and final EPUB
  rendering where necessary.

Acceptance: v1 can truthfully say it has an initial EPUB export without
claiming to be a full EPUB production tool.

#### v0.34: v1.0 Release Candidate

Freeze features and verify product quality.

- Run golden-path smoke for New File, Open, Save / Save As, L Mode,
  Preview, e-book Mode paged flow, Spread View, EPUB export, Local Assist,
  Diff / Discard, Recovery, relaunch, and large documents.
- Update App Store screenshots, description, and release notes.
- Verify the App Store lane excludes Agent Workbench, external AI/API
  calls, CLI launch, arbitrary command execution, network fallback,
  auto-save, and auto-apply.

Acceptance: the product can be described without qualification as:

> Safe Markdown Book Editor with Local Assist Review

### Deferred Beyond v1.0

- Book Workspace Alpha.
- Multiple Markdown files as chapters.
- Saved book manifests.
- Vertical writing.
- Advanced EPUB metadata, cover, navigation editing, and validation
  workflow.
- External AI/API providers, plugin systems, arbitrary local model
  runtimes, agent orchestration, or automatic AI application.

## Post-v1 Product Direction

After v1.0, Hazakura should not immediately rush into broad workspace,
agent, or AI-provider expansion. The first post-v1 goal is to prove that
the single-document book-writing surface is useful in daily writing.

The durable question for every post-v1 idea is:

> Does this make it easier to read Markdown as a book and fix it through
> explicit review?

If the answer is not clearly yes, keep the idea out of the active lane.

## v1.x Deepen The Single-document Product

Goal: deepen the single-document writing / review / export model after
the first daily-use surface is proven.

Possible directions:

- Improve AI proposal review, provenance display, and Diff / Review
  ergonomics without making Hazakura an agent platform: clearer changed
  areas, better large-prose diff readability, partial Accept / Reject
  where it can stay understandable, and visible distinction between AI
  proposals, manual edits, and Recovery changes.
- Improve EPUB export with metadata, cover selection, navigation, and
  clearer pre-export / manual validation guidance.
- Improve movement between writing, reading, Preview, Recovery, and AI
  review layers without creating a second document model.
- Add vertical writing only after the horizontal e-book surface, Spread
  View, and EPUB export are already stable.
- Improve Developer / GitHub distribution only when needed: Developer ID
  signing, notarization, updater, DMG stability, and clear App Store vs
  Developer-lane feature differences. Keep Agent Workbench Developer /
  GitHub-only.
- Keep Hazakura Local Assist polish observation-driven, and avoid turning
  it into a generic AI chat, provider plugin, or agent platform.
- Reduce UI friction around L Mode, e-book Mode, Preview, Diff, and
  Recovery as layers over the same Markdown source.

OKF remains a proposal-stage dependency. Re-check the latest OKF shape
before treating it as an implementation contract.

## v2.0 Book Scope / Book Workspace Alpha

Goal: introduce a user-selected Book Scope: a small, explicit set of
Markdown files treated as one book without turning Hazakura into a
project analyzer, Obsidian-like workspace system, or full file manager.

This is the right place for the difficult part of `Workspace = Book`:
several Markdown files, explicit order, chapter metadata, and book-level
reading / export. It should build on the single-document e-book, EPUB,
and AI review primitives instead of arriving before them.

Possible first shape:

- Let the user explicitly choose a Book Scope from the selected
  workspace, such as an `index.md`, a small manifest, or a selected
  chapter list.
- Treat chosen Markdown files as chapter candidates with manual order
  and visible table-of-contents structure.
- Connect book scope to e-book Mode, EPUB export, and AI proposal review
  only after the scope is explicit and reversible.
- Keep saved source as Markdown plus a small explicit structure file if
  needed; do not hide a database-like document model behind the app.
- Review AI or external edits only inside the selected Book Scope and
  only through explicit Diff / Review.

Do not add:

- automatic project-wide indexing or semantic analysis;
- hidden chapter inference across the whole workspace;
- database-like book storage hidden from the user;
- Git, LSP, terminal, plugin, or arbitrary command behavior;
- background AI restructuring or automatic multi-file rewrite.

## v2.x Book Scope Practicalization

Goal: make Book Scope useful after the alpha proves its source-preserving
shape.

Possible directions:

- Chapter reordering and chapter-title confirmation.
- Book-level e-book Mode and book-level EPUB export.
- Table-of-contents generation from the explicit scope.
- Chapter-level Diff / Review and chapter-scoped search.
- A small explicit manifest if needed, with no hidden database-like book
  model.

Do not add whole-workspace background indexing, hidden chapter inference,
automatic multi-file rewriting, or Git / LSP / terminal behavior.

## v3.x Speculative Local AI Re-evaluation

Goal: decide whether OS-provided local AI belongs in the product after
the book / review primitives are strong.

Use `docs/speculative-local-ai-future-plan.md`. v3.x is not "AI expansion
by default"; it is the earliest reasonable point to re-evaluate whether
stronger local AI, OS-provided models, whitelisted `.aimodel` support, or
much later local image generation belongs in the product after book
structure, explicit review, and export flows are mature.

Do not start this work just because model APIs exist. Require a fresh
product-boundary decision and working proof that edits remain explicit,
unsaved until accepted, and reviewable. The deciding question remains
whether the AI layer strengthens reading Markdown as a book and fixing it
through explicit review.

## Distribution Lanes

Current preview releases are warning-expected DMG previews unless the
user opens a different lane.

The intended stable distribution shape remains two public binary lanes:

- App Store build: Safe Editor + L Mode + Diff / explicit change review
  plus Hazakura Local Assist as an on-device, availability-gated writing
  companion; without External Agent Workbench, CLI launch, arbitrary
  command execution, external AI/API calls, or network fallback.
- Developer / GitHub build: the same base plus optional Agent Workbench
  for allowlisted local CLI providers.

Use:

- Source-preview release rules: `docs/source-release-checklist.md`
- Warning-expected DMG rules: `docs/dmg-preview-checklist.md`
- Final release hygiene: `docs/release-pre-check.md`
- Release-note evidence: `docs/releases/`

Developer ID signing, notarization, updater work, installer packaging,
and stable distribution remain explicit future distribution-lane work.
Treat this as v1.x-or-later work when distribution friction makes it
necessary, not as a reason to delay or bloat v1.0.

## Future Product Direction

Keep future product work source-preserving and narrow:

- L Mode: treat it as the existing Live Source writing surface and a
  potential e-book Mode integration target. Use `docs/l-mode-plan.md`.
- e-book Mode / EPUB export: make it the next book-oriented authoring
  arc. Use `docs/ebook-mode-epub-export-plan.md`.
- AI proposal ingest: keep AI output explicit, file-based or
  transaction-based, and Diff / Review centered. Use
  `docs/ai-markdown-ingest-plan.md`.
- Book Scope / Book Workspace: target v2.0 only after v1.x proves the
  single-document product. Treat a small, explicit, user-selected set of
  Markdown files as one book. Keep the scope reversible and avoid
  background project indexing, hidden chapter inference, or a hidden
  document model.
- Hazakura Local Assist: keep it as an explicit, on-device, availability-
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
  v3.x-or-later re-evaluation for OS-provided local models, whitelisted
  external `.aimodel` support, and much later local image generation.
  Keep arbitrary local model runtimes out unless a fresh product and
  security boundary decision explicitly reopens that risk. Use
  `docs/speculative-local-ai-future-plan.md`.
- Agent Workbench: keep it optional, allowlisted, one-session, no-restore,
  and outside the App Store lane. Use `docs/agent-workbench-boundary.md`.

Any broader WYSIWYG editing model, database-like workspace layer,
collaboration feature, updater, plugin system, arbitrary model runtime,
local image-generation platform, or automated agent-apply flow needs a
fresh product-boundary decision before implementation.
