# Roadmap

Status: Operational
Scope: Active release lane and future planning boundaries
Authority: Medium
Last reviewed: 2026-07-22 (v2.3.0 local candidate; v2.0.0 published)

## Current Position

`Hazakura Editor` is a Markdown-first safe editor. It is not an IDE,
Git client, general terminal, plugin platform, project analyzer, or
automatic agent-apply system.

| Fact | Value |
|------|--------|
| Package / app version in tree | **`2.3.0`** |
| GitHub source / local-app tag | **`v2.0.0`** (no binary assets) |
| Published Mac App Store | **`2.0.0`** (user-reported 2026-07-21) |
| Prior store / source lines | `1.13.0` published historical; `1.14.0` intermediate source tag |
| Active product phase | **v2.3.0 local candidate** — portable recipe + Reader resume (no 縦書き) |
| Parked (not the main queue) | residual polish, broad distribution evidence matrix, optional Keep boxes |

North star:

> Markdownで書き、本として読み、ローカルAIで整える。

v2 lens:

> 明示的に選んだ Markdown 群を一冊として読み・整え・書き出す。
> source は個々の Markdown。indexing / auto-apply / IDE 化はしない。

Queue of record: `docs/current-work.md`.
v2 design SoT: `docs/superpowers/specs/2026-07-02-v2-book-scope-design.md`.
External review pools (advisory, not the queue):
`docs/v2-external-review-synthesis-2026-07-18.md` (four-agent),
`docs/v2-qwen-ux-proposal-synthesis-2026-07-21.md` (Qwen UX triage; L Mode corrections).
Local App Store candidate provenance: `docs/internal/app-store-candidates/latest.json`.

## Phase Decision (2026-07-22)

User direction:

1. **Mac App Store `2.0.0` is published** (user-reported 2026-07-21). Treat as
   closed store line; hotfix only for reproduced blockers.
2. **GitHub source tag `v2.0.0`** marks the Book Scope Alpha + Help checkpoint
   (no binary assets on the tag).
3. **Next work is not a bulk catch-up** of external review pools. Pick one
   verifiable slice (honesty UX, evidence, or v2.x practicalization) when
   ready. Qwen mode-pill / static-lint / Compare Center designs stay triaged
   out unless product explicitly accepts them.
4. **First v2.x slice selected:** explicit, bounded in-book search (July 18
   X-1). It searches only the whole-book Reader's already loaded documents,
   creates no persistent index, and is the complete `2.1.0` feature scope. The
   later user-selected Preview image-loading work is release hardening, not an
   additional product feature.

```text
[done]   v1.8 ──► v1.12 bridge  ·  v1.13–v1.14 refinement boxes
[done]   v2.0 Book Scope Alpha + UX quieting + Help
[done]   Mac App Store 2.0.0 published · source tag v2.0.0
[now]    v2.3.0 local candidate · quality pack · pre-submission gate
[parked] residual polish · broad evidence matrix · optional Keep boxes
[later]  v2.x practicalization  →  縦書き  ·  v3.x speculative AI only
```

## Active Path — v2.2 Candidate

Operating rule: **1 run = 1 verifiable slice.** Keep Safe Editor rails.
Published `2.0.0` remains hotfix-only. The selected `2.1.0` slice does not
reopen or rewrite that release.

### Active (v2.2 quality pack; includes v2.1)

1. **Done in source:** whole-book Reader search over the existing explicit
   100-chapter / 32 MiB loaded-document budget. Live unsaved tabs win over disk.
2. **Done in source:** per-chapter and occurrence counts, result-to-chapter
   jump, Escape-to-clear, Japanese/English labels, and bounded narrow-window
   contents/search presentation.
3. **Boundary:** no background or persistent index, workspace-wide scan,
   Markdown rewrite, auto-save, or second editor buffer.
4. **Done in source: Preview quality hardening.** Interactive Preview and the
   whole-book Reader defer permitted image reads until near the viewport and
   cap each pane at two concurrent reads. Export/e-book settle behavior and
   image consent boundaries are unchanged.
5. **v2.1 local package gate completed** on the search + image-hardening tree.
6. **v2.2 quality pack in source:** Reader chapter prev/next + current label;
   Book empty-state app-private order disclosure; export Finder reveal + whole-
   book progress status; preflight fix hints; Local Assist unavailable honesty
   on chrome and Preferences. 縦書き remains deferred.
7. **Next gate:** full local gates, signed pkg, installed/TestFlight manual
   checks for `2.3.0`. Upload, tag, review, and publication are separate.

### Shipped (v2.0 Book Scope Alpha)

1. **Done: implementation contract + minimal multi-file spine.**
   Existing-left-sidebar Files / Book view, explicit bounded Markdown scope,
   app-private order, unavailable retention, one primary editable buffer, and
   no background indexing.
2. **Done: explicit chapter suggestion draft.** One user-triggered, bounded OKF
   snapshot proposes root and linked nested `index.md` local link order plus
   remaining readable `.md` files. The checkbox draft is never saved
   automatically; base OKF compatibility remains separate from Hazakura Book
   semantics.
3. **Done: Whole-book reading.** A read-only scroll reader uses scope order,
   live dirty buffers, per-chapter image bases, and visible partial-load
   notices without creating a second editable buffer.
4. **Done: Book export + preflight** — explicit Current file / Whole book for
   EPUB/PDF, ordered multi-chapter output, and bounded missing
   chapter/image/heading/metadata checks before destination selection.
5. **Done: UX quieting + Help + version `2.0.0`.** Settled Book view
   presentation, Help **Books and knowledge folders**, store notes.
6. **Done: packaging gate** — App Store publication + source tag `v2.0.0`
   (user-reported / cut 2026-07-21).

### Parked (resume only if friction or a release needs them)

| Bucket | Examples | When to touch |
|--------|----------|----------------|
| Residual polish | Tab overflow, nav “back”, status TTL, dep cadence | Reproduced daily friction or cheap adjacent change |
| Distribution evidence | Full TestFlight / VoiceOver / narrow / long-doc matrix | Release gate, regression, or user-reported gap |
| Optional Keep boxes (`v1.15+`) | Theme pools in `docs/v1.13-plus-refinement-roadmap.md` | Enough unrelated Keeps justify a box; not a train before v2 |
| Published 2.0.0 hotfix | App Review / daily-use blocker | Only when reproduced |
| External review candidates | Engineering hygiene, journeys, portable recipe, CI | Promote one slice at a time from `docs/v2-external-review-synthesis-2026-07-18.md` |
| Qwen UX candidates | Assist honesty, first-run story, export progress, tree bounds; not mode pills / static lint by default | Promote only after triage in `docs/v2-qwen-ux-proposal-synthesis-2026-07-21.md` |

Packaging-gate candidates distilled from the same reviews (smoke card, JP
export visual check, can/cannot copy, Book-order storage disclosure, Book
VoiceOver minimum) live under **§3.1** of that synthesis. They support the
human gate above; they are not a parallel implementation queue.

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
| Explicit Book Scope + order + one primary edit buffer | **Met in source** — first Alpha spine |
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
| **v2.0** | Multi-file Book Scope Alpha + OKF multi-file feel | **Closed / published** |
| **v2.1** | Bounded whole-book Reader search | **Local candidate** |
| v2.x | Further Book Scope practicalization | After v2.1 gate |
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

- Richer chapter-title / navigation editing beyond source headings
- Reader pagination or book-level e-book presentation beyond the Alpha scroll reader
- Editable generated TOC beyond the current scope-order EPUB navigation
- Chapter-level Diff / Review and chapter-scoped search
- Small explicit manifest if needed (no hidden database model)

Review-reinforced candidates for this phase (search, chapter nav + private
reading position, portable recipe export/import, Assist expectation UX, Book
vs OKF copy): `docs/v2-external-review-synthesis-2026-07-18.md` §3.2.
Still no background index, auto-repair, or second edit buffer.

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
| v2 external review pool | `docs/v2-external-review-synthesis-2026-07-18.md` |
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
