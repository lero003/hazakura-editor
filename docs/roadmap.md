# Roadmap

Status: Operational
Scope: Active release lane and future planning boundaries
Authority: Medium
Last reviewed: 2026-06-21 (v0.29 Review Desk retirement alignment)

## Current Position

`Hazakura Editor` is a Markdown-first safe editor. It is not an IDE,
Git client, general terminal, plugin platform, project analyzer, or
automatic agent-apply system.

Current release state:

- Latest published Developer / local-app release: `v0.20.0`.
- Mac App Store listing:
  `https://apps.apple.com/jp/app/hazakura-editor/id6778637880?mt=12`.
- Latest published downloadable preview: `v0.20.0` warning-expected DMG preview.
- Current package/app version: `0.28.0`.
- Mac App Store published version: `0.26.0`, reported released on
  2026-06-20 after App Review completion.
- Active lane: v0.29 AI Proposal Ingest and Writing Flow on top of the
  completed v0.28 safety / AI-review foundation.
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

1. v0.28 tightened quality and trust consistency, especially around image
   loading, Japanese text search parity, OS handoff explanation, and the
   first reusable AI proposal review primitives.
2. v0.29 deepens writing / review flow from that foundation: Apple Local
   Assist transaction review, explicit Diff / Review, retired Review Desk
   exposure guards, and release-quality smoke.
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

The durable exclusions from these phases still apply: no Git/LSP/terminal,
plugin system, arbitrary command execution, background workspace indexing,
Preview DOM editing, hidden save-time rewriting, or automatic AI application.

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
- **AI proposal review foundation**: add one review primitive only:
  transaction intake into explicit Diff / Review. For v0.28 and the first
  v0.29 follow-up, the selected visible primitive is the Apple Local
  Assist transaction / compact Diff path; broader file / paste /
  multi-file ingest remains deferred work. Keep App Store AI assistance
  limited to Hazakura Local Assist and separate from Agent Workbench.
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

Goal: make AI-written Markdown easier to review and accept explicitly
without reviving the standalone Review Desk screen.

Use `docs/ai-markdown-ingest-plan.md` as the planning memo. The durable
boundary is manual review:

- The first v0.29 correction retires the standalone Review Desk screen
  and keeps only the internal candidate comparison primitive for AI assist
  plumbing.
- Support Diff / Review for AI or external-agent output, starting with
  the smallest reusable Hazakura Local Assist transaction review path.
- Add explicit ingest for AI-proposed Markdown changes from selected
  files, pasted text, Hazakura Local Assist transactions, or Agent Workbench
  external edits when those lanes are active.
- Expand from the one v0.28 review primitive into broader ingest flows
  only after the first path proves source-preserving review, rejection,
  and explicit application.
- Keep App Store lane ingestion limited to explicit Hazakura Local Assist
  transactions unless a fresh boundary review opens file/paste ingest.
- Keep Developer / GitHub lane integration separate, where Apple Local
  Assist or Agent Workbench may create external or unsaved edits under
  their existing boundaries.

Do not add auto-apply, auto-save, auto-commit, hidden workspace
rewriting, or general agent orchestration.

## Post-v0.25 Product Refinement

Goal: raise the product grade by tightening the existing experience
instead of adding broad new surfaces.

Use `docs/post-v0.25-product-refinement-plan.md` as the refinement lens.
For historical v0.27 execution detail, use
`docs/archive/planning/v0.27-refinement-slice-plan.md`. The strongest
direction after that refinement pass is:

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

- Improve AI proposal review, provenance display, and Diff / Review
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
