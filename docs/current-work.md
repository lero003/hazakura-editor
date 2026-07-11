# Current Work

Status: Operational
Scope: v1.7 Reference Compare (package remains `1.6.0` until a v1.7 version bump)
Authority: High
Last reviewed: 2026-07-11 (Reference Compare: editor center / reference right)

## Purpose

Start here when choosing the next small `Hazakura Editor` slice.

## Lane Timeline (read first)

| Lane | Status | Notes |
|------|--------|--------|
| **v1.5** | **Closed / released as `1.5.0`** | Stabilization + reading polish. **Released before 江戸彼岸 (edohigan) was merged.** Do not reopen unless hotfix. |
| **Post-v1.5 main (not v1.5)** | Merged after v1.5 release | 江戸彼岸 theme; CodeMirror `@codemirror/view` **6.43.2** pin + editor display quality (syntax-tree recompute, resize remeasure, fold gutter removed). |
| **v1.6** | **Closed / published as `1.6.0`** | Import Assist Phase 1 + edohigan + quality packs. **App Review passed without issues (2026-07-10).** Boundary: `docs/import-assist-boundary-review.md`. Release notes: `docs/releases/1.6.0-app-store-release-notes.md`. Do not reopen unless hotfix. |
| **v1.7** | **Active (R0–R4 source landed; trust / daily-use hardening)** | Reference Compare: one read-only PDF/image/text reference beside one editable Markdown tab. Scope brief: `docs/v1.7-scope-brief.md`; feature design: `docs/v1.7-reference-compare-design.md`; hardening plan: `docs/v1.7-trust-scale-plan.md`. Next: complete the scope gate, then version-bump discussion. |
| **v2** | Later | OKF Book Scope, then 縦書き. |

Published Mac App Store version is **`1.6.0`**. See `current-status.md` for lane truth; treat Connect as authoritative for store counters.

## Product Boundary

- Safe Editor remains primary.
- Markdown/text source remains canonical.
- Do not add Git, LSP, terminal, arbitrary command execution, plugins,
  project-wide indexing, auto-apply, or auto-commit.
- Workspace file operations stay bounded to the selected workspace.
- Agent Workbench remains a separate, explicit Developer / GitHub lane.
- Import Assist must stay on-device, edit-before-save, no auto-save
  (see boundary review).
- v1.7 Reference Compare may show one read-only reference beside the active
  editor, but must not become a generic two-editor split or second saved model.

## Closed Lane Summary — v1.6 Import Assist

v1.6 shipped as `1.6.0` and **passed App Review without issues** (2026-07-10).
Do not reopen unless a hotfix is required. Historical queue detail remains in
git history and `docs/quality-inventory-v1.6.md`.

| Status | Slice |
|---|---|
| Done / published | Boundary review, Import Assist MVP, helper packaging, nested helper re-sign |
| Done / published | Quality packs A/B (structure, import honesty, sandbox staging, theme cost, export timeout) |
| Done / published | `pdf-extract` 0.12.0 / `lopdf` 0.42.0 security update |
| Done / published | Q-IMG-1 A+D parent-workspace image policy (source-covered; optional packaged re-smoke) |
| Absorbed by v1.7 | Post-import review UI, PDF/source side-by-side, low-confidence navigation |
| Deferred v2 | Book Project split (`chapters/` + `hazakura.import.json`) |

## Active UX Queue — v1.7 Reference Compare

v1.7 deepens Import Assist into a general reference workflow. Product story:

> 参照資料を横に開き、Markdownを見比べながら直せる。

| Priority | Slice | Acceptance |
|---|---|---|
| **Done / source** | **R0 — PDF reference spike** | Helper `pdf_info` / `render_pdf_page`; Rust opaque handle (`open_pdf_reference` / `render_pdf_reference_page` / `close_pdf_reference`); main-window gate; path/page/pixel bounds; fixture+live helper smoke. No complete UI. |
| **Done / source** | **R1 — Paired shell + text reference** | Reference state + **editor center-left / reference right (preview-like)** shell; Markdown/text open as read-only right reference; workspace/tab context menu + File menu + palette entry; same-file → buffer-vs-disk; narrow-window 編集/参照 switch. Not Diff. |
| **Done / source** | **R2 — Image + PDF reference readers** | PDF page UI via R0 handle; CSP-compatible bounded `data:image/png` page display; image reference via existing safe loaders; context/palette accept PDF+image; close releases PDF handle. Packaged sandbox matrix remains optional smoke. |
| **Done / source** | **R3 — Import Assist automatic pair + page follow** | Import success opens linked PDF/image reference; follow keyed by `sessionId`; cursor → page; manual page pauses; resume control; missing markers → follow off. |
| **Done / source** | **R4 — Confidence navigation + reliability** | Page-level OCR confidence markers (advisory only, not char ranges); 要確認 prev/next; empty pages flagged; adjacent-page cache (no full preload); PDF handle cleanup on shell unmount. |

Full interaction, security boundary, and non-goals:
`docs/v1.7-reference-compare-design.md`.

The scope-based brief for a separate v1.7 implementation request is
**`docs/v1.7-scope-brief.md`**. It defines the whole v1.7 product boundary and
completion criteria without making individual slices the user-facing scope.
The review-derived **`docs/v1.7-trust-scale-plan.md`** remains the operational
breakdown for execution; it keeps Book Scope Alpha in v2 and does not widen
Safe Editor into an IDE, terminal, Git client, or generic AI surface.

Key product rules for this lane:

- open PDF, image, Markdown, or text as **one** read-only right-hand reference
  preview (workspace opens are preview/reference treatment, not edit tabs);
- keep one ordinary editable Markdown Editor Tab in the **center/primary**
  column;
- automatically pair an Import Assist source (right) with its unsaved Markdown
  draft (center);
- use source-visible page markers for explicit PDF-page follow;
- allow manual Markdown-to-Markdown **visual reference** while editing;
  existing Diff stays a separate explicit text comparison action (`差分を見る`);
- never two editable panes, never auto-apply, never revive Review Desk, never
  treat Reference Compare as Diff layout.

## Active Trust / Daily-use Queue — v1.7

The feature arc is source-landed, but the product is not ready to widen scope
until the following user-visible guarantees are proven. Priority is ordered;
each slice should remain independently verifiable.

| Priority | Slice | Why now | Acceptance anchor |
|---|---|---|---|
| **P0** | **L Mode continuity** | A presentation toggle must not discard Undo, the prior side pane, or comparison context. | L Mode → normal restores the prior surface; edits remain undoable; cursor/IME/long-wrap state stays stable. |
| **P0** | **Pathless draft recovery** | “No auto-save” must not mean losing a new or Import Assist draft after a crash. | App-private, TTL/size-bounded recovery candidate; no source-file write or silent apply. |
| **P0** | **Reference Compare packaged proof** | R0–R4 source tests do not prove native helper, picker, sandbox, CSP, and close/replace behavior together. | PDF/image/text, Import pair/follow, 要確認, Save As, deletion, narrow/keyboard/App Store smoke matrix. |
| **P1** | **Processing budgets** | Draft persistence, Diff, search, PDF export, and reference raster need independent byte/time/DOM limits. | Bounded fallback, cancellation where applicable, and an honest truncation/error state. |
| **P1** | **Failure containment / deterministic tests** | A frontend exception should not strand the editing session; the Rust suite currently has a PATH-sensitive full-run flake. | Root recovery surface; deterministic full-suite signal; integration coverage across open → edit → Save As → Assist/Reference → close. |
| **P1** | **Long reference + accessibility** | Full-line text reference DOM and unnamed rename input weaken long-document and VoiceOver use. | Windowed reference rendering, accessible rename field, keyboard/VoiceOver/contrast/Reduce Motion smoke. |
| **P1** | **Purpose-led discovery** | Preview/L Mode/e-book/Outline/Diff/Reference are easier to understand by task than by feature name. | Small first-use Start Panel and contextual hints for write / read / verify, without adding chrome. |
| **P2** | **Export/theme polish** | Export confidence and theme cost can improve after trust gates pass. | Concise EPUB/PDF preflight, Preferences parity, measured shader/reduced-motion behavior. |

Book Scope Alpha is **not** part of this queue. It remains a v2 decision after
the single-document and Reference Compare loop is proven.

### Quality inventory (v1.6 historical)

Cross-cutting quality notes for the closed v1.6 line live in
**`docs/quality-inventory-v1.6.md`**. Prefer one verifiable v1.7 slice at a
time; keep normal `npm test` / `cargo test` gates.

### CodeMirror pin (durable)

- Keep `@codemirror/view` at **6.43.2** (`package.json` + overrides).
- 6.43.3+ tile-tree regressions caused vanishing lines / wrong caret.
- Do not bump view without re-verifying long Japanese Markdown + wrap + L Mode.

### v1.7 completion gate

Before discussing a v1.7 version bump, confirm the packaged Reference Compare
matrix, L Mode continuity, pathless draft recovery, bounded large-data failure
states, keyboard/a11y smoke, and deterministic Rust test signal. Keep the
published version at `1.6.0` until that proof exists and release approval is
explicit.

### 江戸彼岸 (post-v1.5)

- Theme is on main; polish force/density on device as needed.
- Not part of the v1.5 release story.

## Historical

v1.5 and earlier queue detail: keep this file short. Older slices live in git history and `docs/archive/`. v1.3 Daily Trust remains the long-published baseline story until store listing notes supersede it in `current-status.md`.
