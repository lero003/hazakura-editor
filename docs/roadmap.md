# Roadmap

Status: Operational
Scope: Active release lane and future planning boundaries
Authority: Medium
Last reviewed: 2026-07-18 (v2 development phase opened; v1.14 submitted)

## Current Position

`Hazakura Editor` is a Markdown-first safe editor. It is not an IDE,
Git client, general terminal, plugin platform, project analyzer, or
automatic agent-apply system.

| Fact | Value |
|------|--------|
| Package / app version in tree | **`1.14.0`** (source tag `v1.14.0`) |
| Published Mac App Store | **`1.13.0`** (user-reported 2026-07-18) |
| v1.14 | **Submitted** for App Store review (user-reported 2026-07-18). Early look OK. Publication not claimed until confirmed. |
| Active product phase | **v2 development** — Book Scope / OKF multi-file feel |
| Parked (not the main queue) | v1.14 residual polish, broad distribution evidence matrix, optional Keep boxes |

North star:

> Markdownで書き、本として読み、ローカルAIで整える。

v2 lens:

> 明示的に選んだ Markdown 群を一冊として読み・整え・（後で）書き出す。
> source は個々の Markdown。indexing / auto-apply / IDE 化はしない。

Queue of record: `docs/current-work.md`.
v2 design SoT: `docs/superpowers/specs/2026-07-02-v2-book-scope-design.md`.

## Phase Decision (2026-07-18)

User direction:

1. **v1.14 is in review.** Light check looks fine. Fix reproduced bugs while
   using; do not drive the main queue from residual polish or evidence lists.
2. **Open v2 development.** The v1.8–v1.12 bridge is enough to start Book
   Scope work. Do not wait for a pre-v2 essay on “multi-file value.”
3. **Product narrative / Help** lands when v2 is shippable and OKF multi-file
   feel is good enough — expand Help (and other feature explanations) as part
   of **v2 ship polish**, not as a pre-implementation gate.

```text
[done]   v1.8 ──► v1.12 bridge  ·  v1.13–v1.14 refinement boxes
[now]    v2.0 Book Scope development (design → slices → ship)
[parked] residual polish · broad evidence matrix · optional v1.15+ Keep boxes
[at ship] Help / feature copy expansion (when OKF multi-file feel is ready)
[later]  v2.x practicalization  →  縦書き  ·  v3.x speculative AI only
```

## Active Path — v2 Development

Operating rule: **1 run = 1 verifiable slice.** Keep Safe Editor rails.
Hotfix only for reproduced App Store / daily-use blockers on published or
in-review builds.

### Now (v2.0 Book Scope Alpha)

Order of work (detail in the design doc; refine while building):

1. **Implementation contract** — raise the v2 design from Proposal toward a
   first Review slice: UI direction (start from candidates A/B; do not block
   forever on a perfect graph design), explicit scope selection, chapter
   order, reversible interpretation.
2. **Minimal multi-file spine** — user-selected set of Markdown files as one
   book; one primary editable buffer at a time; no background indexing.
3. **OKF multi-file feel** — reuse v1.11 review + v1.12 scaffold as inputs;
   deepen only what makes “folder as knowledge / book” trustworthy day to day.
   Keep base OKF compatibility separate from Hazakura Book semantics
   (`docs/okf-spec-pin.md`).
4. **Whole-book reading (and export only when ready)** — e-book / navigation
   over the explicit scope; export breadth is not required for the first
   Alpha cut unless the slice needs it.
5. **Ship polish including Help** — when the multi-file / OKF loop feels
   shippable: Help pages, in-app feature explanation, store/release copy.
   Do **not** front-load long product essays before the feel exists.

### Parked (resume only if friction or a release needs them)

| Bucket | Examples | When to touch |
|--------|----------|----------------|
| Residual polish | Tab overflow, nav “back”, status TTL, dep cadence | Reproduced daily friction or cheap adjacent change |
| Distribution evidence | Full TestFlight / VoiceOver / narrow / long-doc matrix | Release gate, regression, or user-reported gap |
| Optional Keep boxes (`v1.15+`) | Theme pools in `docs/v1.13-plus-refinement-roadmap.md` | Enough unrelated Keeps justify a box; not a train before v2 |
| v1.14 review follow-up | Apple questions, rejection, hotfix | Only if review or usage surfaces a real issue |

### Hard rails (v2 does not lift these)

- Safe Editor primary; Markdown/text source canonical per file.
- No Git / LSP / general terminal / plugins / arbitrary command execution.
- No project-wide background indexing or hidden chapter inference.
- No auto-apply / auto-save / auto multi-file rewrite.
- No second simultaneous editable buffer as the default model.
- App Store lane still excludes Agent Workbench / external CLI agents.
- Published tags and assets stay immutable.

## v2 Entry Status

| Criterion | Status (2026-07-18) |
|-----------|---------------------|
| v1.10 single-document structure shared by Outline / e-book / export | **Met** |
| Structure edits Undo / dirty / explicit | **Met** (source) |
| v1.11 OKF preview bounded / explicit / no persistent index | **Met** |
| v1.12 starter scaffold explicit / no auto-repair | **Met** (published) |
| Broad distribution-confidence matrix complete | **Parked** — not blocking v2 start |
| Pre-v2 multi-file value essay | **Deferred to Help at ship** |
| Book Scope UI fully converged before any code | **Softened** — pick a first direction and iterate in slices |
| OKF pin vs Hazakura Book semantics kept separate | **In force** during implementation |
| Help / feature explanation expansion | **v2 ship polish**, not a start gate |

Historical gate wording remains in
`docs/v1.8-plus-product-review-roadmap.md` and
`docs/v1.13-plus-refinement-roadmap.md` for context. **Active go decision:**
v2 development is open.

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
- The standalone Review Desk screen is retired. Local Assist and other
  AI-assist paths stay explicit, Diff-reviewable, and never auto-save or
  auto-apply without user action.
- Workspace file operations stay bounded to the selected workspace and
  must not become a full file manager.

## Closed Phase Snapshot

| Era | What it established | Status |
|-----|---------------------|--------|
| v0.18–v0.29.1 | Safe Editor, App Store lane, Local Assist foundation | Published / historical |
| v0.30–v1.0 | e-book / Spread / position bridge / EPUB / PDF → v1 message | Published |
| v1.1–v1.5 | Continuity, trust, polish | Closed / published |
| v1.6 | Import Assist Phase 1 + edohigan | Closed / published |
| v1.7 | Reference Compare | Closed / published |
| v1.8–v1.12 | Trust → clarity → structure → OKF review → scaffold | Bridge **complete** |
| v1.13–v1.14 | Refinement Keep boxes | v1.13 published; v1.14 **in review** |
| **v2.0** | Multi-file Book Scope Alpha + OKF multi-file feel | **Active development** |
| v2.x | Book Scope practicalization | After Alpha |
| 縦書き | Vertical reading / export layer | After Book Scope foundation |
| v3.x | Speculative local-AI re-evaluation only | Speculative |

Bridge rationale: `docs/v1.8-plus-product-review-roadmap.md`.
Historical phase prose:
`docs/archive/roadmaps/roadmap-historical-phases-through-v1.x.md`.

## v2.0 Book Scope / Book Workspace Alpha

Goal: introduce a user-selected Book Scope — a small, explicit set of
Markdown files treated as one book — without turning Hazakura into a
project analyzer, Obsidian-like workspace, or full file manager.

Two pillars, in order:

1. **OKF compatibility + Hazakura Book semantics.** Reuse v1.11/v1.12 as
   inputs; define chapter order, scope behavior, and whole-book reading as
   **Hazakura** conventions (base OKF is not a book format).
2. **Vertical writing (縦書き).** Later, after horizontal multi-file reading
   is stable. Markdown source stays canonical.

Possible first shape:

- Explicit Book Scope choice (index, small manifest, or selected chapter list).
- Manual chapter order and visible TOC structure.
- Connect scope to e-book Mode (and export when the slice is ready).
- Saved source remains Markdown (+ small explicit structure file if needed).

Do not add: automatic project-wide indexing, hidden chapter inference,
database-like book storage, Git/LSP/terminal/plugins, background AI
restructuring, or automatic multi-file rewrite.

Design SoT: `docs/superpowers/specs/2026-07-02-v2-book-scope-design.md`.

### v2 ship polish (including Help)

When Alpha (or the first public v2 cut) is ready to explain itself:

- Expand **Help** for Book Scope / OKF multi-file use, and other features that
  still lack a clear in-app explanation.
- Prefer Help + short UI purpose copy over pre-dev product essays.
- Keep claims aligned with implemented, verified behavior.

## v2.x Book Scope Practicalization

After Alpha proves the source-preserving shape:

- Chapter reordering and title confirmation
- Book-level e-book Mode and book-level EPUB export
- TOC generation from the explicit scope
- Chapter-level Diff / Review and chapter-scoped search
- Small explicit manifest if needed (no hidden database model)

## v3.x Speculative Local AI Re-evaluation

Not “AI expansion by default.” Earliest reasonable point to re-evaluate
stronger OS-provided local models, whitelisted `.aimodel` support, or much
later local image generation — only after book structure, explicit review,
and export flows are mature. Historical context:
`docs/archive/planning/speculative-local-ai-future-plan.md`.

## Distribution Lanes

- **App Store:** Safe Editor + L Mode + Diff / explicit review + on-device
  Local Assist. No External Agent Workbench, CLI launch, arbitrary
  command execution, external AI/API, or network fallback.
- **Developer / GitHub:** same base + optional Agent Workbench for
  allowlisted local CLI providers.

Operational checklists:

- `docs/source-release-checklist.md`
- `docs/dmg-preview-checklist.md`
- `docs/release-pre-check.md`
- `docs/releases/`

## Related Docs

| Need | Path |
|------|------|
| Next slice | `docs/current-work.md` |
| Implementation truth | `docs/current-status.md` |
| v2 design | `docs/superpowers/specs/2026-07-02-v2-book-scope-design.md` |
| OKF pin | `docs/okf-spec-pin.md` |
| Closed bridge | `docs/v1.8-plus-product-review-roadmap.md` |
| Parked refinement themes | `docs/v1.13-plus-refinement-roadmap.md` |
| Product non-goals | `docs/product-brief.md` |
| Security | `docs/security-boundary.md` |
| Historical phase detail | `docs/archive/roadmaps/roadmap-historical-phases-through-v1.x.md` |

## Future Product Direction (durable)

Keep future work source-preserving and narrow:

- L Mode: `docs/l-mode-plan.md`
- e-book / EPUB: `docs/ebook-mode-epub-export-plan.md`
- Local Assist: `docs/assist-surface-strategy.md`
- Agent Workbench: `docs/agent-workbench-boundary.md` (Developer lane only)
- Book Scope: **active** v2 work under the design SoT above
- Native macOS appearance / post-v0.25 refinement memos: historical under
  `docs/archive/planning/`

Any broader WYSIWYG model, database-like workspace, collaboration feature,
plugin system, arbitrary model runtime, local image-generation platform, or
automated agent-apply flow needs a fresh product-boundary decision first.
