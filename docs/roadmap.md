# Roadmap

Status: Operational
Scope: Active release lane and future planning boundaries
Authority: Medium
Last reviewed: 2026-08-16 (v2.6 A-2 review candidate; v2.5 release closed)

## Current Position

`Hazakura Editor` is a Markdown-first safe editor. It is not an IDE,
Git client, general terminal, plugin platform, project analyzer, or
automatic agent-apply system.

| Fact | Value |
|------|--------|
| Package / app version in tree | **`2.6.0`**; A-2 review candidate |
| Published Mac App Store | **`2.4.0`** (user-reported shipped 2026-08; closed line) |
| Prior store / source lines | `2.3.0`, `2.0.0`, `1.13.0` historical; tags immutable |
| v2.5 release | **Released / closed** (user-confirmed); no active release gate |
| Active product phase | **v2.6 A-2 review** — pinned target + multi-turn Diff revision |
| Next plan | **`docs/v2.6-plan.md`** |
| Design SoT (Assist UX) | **`docs/local-assist-conversational-edit-ux.md`** |
| Parked (not the main queue) | 縦書き, anydoc adoption, residual Book depth, broad evidence matrix |

North star:

> Markdownで書き、本として読み、ローカルAIで整える。

v2 lens (Book):

> 明示的に選んだ Markdown 群を一冊として読み・整え・書き出す。
> source は個々の Markdown。indexing / auto-apply / IDE 化はしない。

v2.5 lens (Workspace):

> Workspace・Editor・Preview／Reference の幅を用途に合わせ、上限や完了を
> 分かる形にする。source と Safe Editor の境界は変えない。

v2.6 lens (Assist):

> 対象文章について会話し、現在の未反映案は別の Diff 領域で確認する。
> 本文への反映は Diff からの明示操作に限り、反映しない選択を保つ。

Queue of record: `docs/current-work.md`.
v2 Book design SoT: `docs/superpowers/specs/2026-07-02-v2-book-scope-design.md`.
Assist strategy: `docs/assist-surface-strategy.md`.
Local App Store candidate provenance: `docs/internal/app-store-candidates/latest.json`.

## Phase Decision (2026-08-16)

User direction:

1. **Mac App Store / product line `2.4.0` is shipped.** Treat as closed store
   line; hotfix only for reproduced blockers. Do not reopen for polish trains.
2. **v2.5 is released and closed.** Do not reopen its release gates from the
   v2.6 development line.
3. **v2.6 A-2 is under external review.** A-1 is merged; the current candidate
   pins the Local Assist target and revises the proposal through follow-up
   conversation while keeping conversation and Diff review distinct.
4. **縦書き is deprioritized** behind AI progress. Keep parked, not deleted.
5. **Core AI** remains a later model backend after conversational apply is stable.
6. **anydoc** stays evaluation-only until product demand is clear.
7. **R-1 and the accepted Q-3/Q-4/Q-5/Q-13 clarity set** belong to the v2.5
   workspace line. Verified existing or measured no-op outcomes are valid.

```text
[done]   v1.8 ──► v1.12 bridge  ·  v1.13–v1.14 refinement boxes
[done]   v2.0 Book Scope Alpha + UX quieting + Help
[done]   Mac App Store 2.0.0 · 2.3.0 · 2.4.0 published (tags immutable)
[done]   v2.4 OKF v0.2 · compact toolbar · B-1 chapter Diff
[done]   v2.5 R-1 text Reference follows Preview font size
[done]   v2.5 release (closed)
[done]   v2.6 A-1: proposal generation → Diff review; editor unchanged
[now]    v2.6 A-2: pinned target + multi-turn proposal revision
[next]   External review, then A-3 Diff apply
[then]   A-4 two-region layout polish (separate Draft PR #34)
[later]  Core AI allowlisted writing models (C-0 design → C-1/C-2)
[parked] 縦書き · anydoc · residual Book (B-2+) · broad evidence matrix
```

## Active Path — v2.6

Operating rule: **1 run = 1 verifiable slice.** Keep Safe Editor rails.
Published `2.4.0` remains hotfix-only. v2.5 is released and closed; v2.6 is a
separate development line.

### Active spine

1. **A-1** Proposal generation appears in a separate Diff review; no buffer apply
2. **A-2** Pinned target + multi-turn updates the current Diff
3. **A-3** Explicit apply only from Diff review + existing Review Bar
4. **A-4** Two-region layout / i18n / keyboard / accessibility polish

Plan detail: `docs/v2.6-plan.md`.

### Shipped (v2.4 Book depth)

1. OKF v0.2 consumer/scaffold pin; inert optional provenance families
2. Compact Book toolbar
3. B-1 chapter-level Diff (buffer vs disk, no second editor buffer)
4. Book-like starter shape and related quality carry-in

### Shipped (v2.3 quality pack + portability)

Portable Book recipe, Reader resume, bounded search, Preview image hardening,
explicit EPUB cover, recent-folder sandbox restore, Assist honesty, etc.
Closed on store + source as the `2.3.0` / `2.4.0` lineage history.

### Shipped (v2.0 Book Scope Alpha)

Explicit multi-file Book Scope, suggestions, whole-book Reader/export, Help.

### Parked (resume only if friction or a later milestone)

| Bucket | Examples | When to touch |
|--------|----------|----------------|
| 縦書き | Vertical reading / export | After Assist depth and horizontal Book stay stable |
| anydoc | Office → Markdown import library | After written evaluation + real import demand |
| Residual Book depth | B-2 display TOC, B-3 suggestion reasons | Daily friction or dedicated Book line |
| Residual polish | Reference の行番号表示サイズ、Tab overflow, status TTL, dep cadence | Reproduced friction or cheap adjacent change |
| Distribution evidence | Full TestFlight / VoiceOver matrix | Release gate or regression |
| Core AI models | Allowlisted `.aimodel` catalog | After A-3; start with C-0 design only |
| Published 2.4.0 hotfix | App Review / daily-use blocker | Only when reproduced |

### Hard rails (v2.x does not lift these)

- Safe Editor primary; Markdown/text source canonical per file.
- No Git / LSP / general terminal / plugins / arbitrary command execution.
- No project-wide background indexing or hidden chapter inference.
- No auto-apply / auto-save / auto multi-file rewrite.
- No second simultaneous editable buffer as the default model.
- App Store lane still excludes Agent Workbench / external CLI agents.
- Local Assist: no network inference fallback, no tool calling side effects,
  no general chat DB, no workspace-wide agent editing.
- Core AI (when added): **allowlist only** — no arbitrary model URL, no cloud
  inference fallback disguised as “local.”
- Published tags and assets stay immutable.

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
  auto-apply without user action. **v2.6 separates conversation from Diff
  review and moves apply to the Diff decision surface**, not away from explicit
  consent.
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
| v1.13–v1.14 | Refinement Keep boxes | v1.13 published; v1.14 intermediate |
| **v2.0** | Multi-file Book Scope Alpha + OKF multi-file feel | **Closed / published** |
| **v2.1–v2.2** | Bounded Reader search + quality pack | **Folded into 2.3+** |
| **v2.3** | Portable recipe + Reader resume + image/export repair | **Closed / published** |
| **v2.4** | Book depth (OKF v0.2 / chapter Diff) | **Closed / published** |
| **v2.5** | Workspace control + delivery clarity | **Released / closed** — `docs/v2.5-plan.md` |
| **v2.6** | Local Assist conversation + Diff review | **A-2 review candidate** — `docs/v2.6-plan.md` |
| Core AI models | Allowlisted writing on-device models | **Later** (after Assist UX) |
| 縦書き | Vertical reading / export layer | **Parked** (after AI progress) |
| v3.x | Broader local-AI re-evaluation if still needed | Speculative |

Bridge rationale: `docs/v1.8-plus-product-review-roadmap.md`.
Historical phase prose:
`docs/archive/roadmaps/roadmap-historical-phases-through-v1.x.md`.

## v2.0–v2.4 Book Scope (closed foundation)

Goal achieved in outline: user-selected Book Scope without project analyzer
behavior. Design SoT remains
`docs/superpowers/specs/2026-07-02-v2-book-scope-design.md`.

**縦書き** was listed as a later Book pillar; it is now **explicitly behind**
the Local Assist milestone (see Phase Decision 2026-08-16).

Residual Book practicalization (display TOC clarity, suggestion
explainability, …) may return as a dedicated line after v2.5 workspace work,
or as single residual slices if daily friction demands it. It is not part of
the active v2.6 Local Assist queue.

## v2.5 Workspace Control and Clarity (candidate prepared)

Goal: a persistent, keyboard-operable three-pane workspace plus honest bounded
tree and completion feedback. This source line is complete at `6067fbec`; Apple
upload, processing, TestFlight, tag, and publication remain separate gates.

- Plan: `docs/v2.5-plan.md`

## v2.6 Local Assist Conversation + Diff Review

Goal: keep editing conversation and change review distinct. Conversation owns
requests and short turn state; Diff review owns the current unapplied proposal,
original-versus-proposal comparison, stale state, discard, and explicit apply.
The editor buffer stays unchanged until the Diff action is accepted.

- Design: `docs/local-assist-conversational-edit-ux.md`
- Plan: `docs/v2.6-plan.md`
- Strategy: `docs/assist-surface-strategy.md`

Not: general chat, provider marketplace, auto multi-file rewrite, or
docked IDE-like agent panel (docking is a separate future UX decision).

## Core AI — Allowlisted Writing Models (later)

Product intent (not an implementation green light):

- Fill capability gaps that Apple Foundation Models alone cannot cover for
  **writing-specialized** tasks.
- Users may **download / manage / use** only **allowlisted** on-device models
  (e.g. curated writing-oriented packages such as `.aimodel` or the
  platform’s equivalent packaging).
- Inference stays on-device. Download network is for catalog assets only —
  not a hidden cloud chat path.
- No arbitrary URL, no user-supplied unsigned blobs, no auto-apply.

Sequence: **C-0 design spike → C-1 catalog lifecycle → C-2 Assist selection**,
after conversational apply (A-3) is trustworthy. See
`docs/assist-surface-strategy.md` and `docs/v2.6-plan.md`.

## anydoc (evaluation only)

[firecrawl/anydoc](https://github.com/firecrawl/anydoc) (Office/PDF → Markdown)
may later extend **Import** (draft-until-save), not Open-as-source. PDF stays
with existing Import Assist first. **No v2.6 product adoption** without a
written evaluation and scope pin (prefer docx-only spike if ever promoted).

## Distribution Lanes

- **App Store:** Safe Editor + L Mode + Diff / explicit review + on-device
  Local Assist (+ future allowlisted on-device models if accepted by review).
  No External Agent Workbench, CLI launch, arbitrary command execution,
  external AI/API inference, or network fallback for generation.
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
| v2.6 plan | `docs/v2.6-plan.md` |
| v2.5 plan | `docs/v2.5-plan.md` |
| Conversational Assist UX | `docs/local-assist-conversational-edit-ux.md` |
| Assist strategy | `docs/assist-surface-strategy.md` |
| Closed v2.4 plan | `docs/v2.4-plan.md` |
| v2 Book design | `docs/superpowers/specs/2026-07-02-v2-book-scope-design.md` |
| OKF pin | `docs/okf-spec-pin.md` |
| Product non-goals | `docs/product-brief.md` |
| Security | `docs/security-boundary.md` |

## Future Product Direction (durable)

Keep future work source-preserving and narrow:

- L Mode: `docs/l-mode-plan.md`
- e-book / EPUB: `docs/ebook-mode-epub-export-plan.md`
- Local Assist: `docs/assist-surface-strategy.md` + conversational UX SoT
- Agent Workbench: `docs/agent-workbench-boundary.md` (Developer lane only)
- Book Scope: foundation **shipped**; residual only by promotion
- Native macOS appearance / post-v0.25 refinement memos: historical under
  `docs/archive/planning/`

Any broader WYSIWYG model, database-like workspace, collaboration feature,
plugin system, **arbitrary** model runtime, local image-generation platform, or
automated agent-apply flow needs a fresh product-boundary decision first.
Allowlisted writing models under Core AI are the narrow exception path above,
not a general model marketplace.
