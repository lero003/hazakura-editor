# Current Work

Status: Operational
Scope: v1.7 Reference Compare (package remains `1.6.0` until a v1.7 version bump)
Authority: High
Last reviewed: 2026-07-10 (v1.6 App Review passed; active lane → v1.7)

## Purpose

Start here when choosing the next small `Hazakura Editor` slice.

## Lane Timeline (read first)

| Lane | Status | Notes |
|------|--------|--------|
| **v1.5** | **Closed / released as `1.5.0`** | Stabilization + reading polish. **Released before 江戸彼岸 (edohigan) was merged.** Do not reopen unless hotfix. |
| **Post-v1.5 main (not v1.5)** | Merged after v1.5 release | 江戸彼岸 theme; CodeMirror `@codemirror/view` **6.43.2** pin + editor display quality (syntax-tree recompute, resize remeasure, fold gutter removed). |
| **v1.6** | **Closed / published as `1.6.0`** | Import Assist Phase 1 + edohigan + quality packs. **App Review passed without issues (2026-07-10).** Boundary: `docs/import-assist-boundary-review.md`. Release notes: `docs/releases/1.6.0-app-store-release-notes.md`. Do not reopen unless hotfix. |
| **v1.7** | **Active (design accepted; implementation not started)** | Reference Compare: one read-only PDF/image/text reference beside one editable Markdown tab. Design: `docs/v1.7-reference-compare-design.md`. Start with **R0** PDFKit bounded-raster spike. |
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
| **Next** | **R1 — Paired shell + text reference** | Dedicated Reference Compare state; Markdown/text manual reference; only Editor Tab is dirty/editable. |
| Next | R2 — Image + PDF reference readers | Reuse image preview; bounded PDF page reader from R0; sandbox access matrix. |
| Next | R3 — Import Assist automatic pair + page follow | After import, source reference + unsaved draft; `sessionId` link; page markers drive follow. |
| Later | R4 — Confidence navigation + reliability | Honest `要確認` only after bounded confidence ranges exist; packaged smoke. |

Full interaction, security boundary, and non-goals:
`docs/v1.7-reference-compare-design.md`.

Key product rules for this lane:

- open PDF, image, Markdown, or text as **one** read-only Reference Tab;
- keep one ordinary editable Markdown Editor Tab visible beside it;
- automatically pair an Import Assist source with its unsaved Markdown draft;
- use source-visible page markers for explicit PDF-page follow;
- allow manual Markdown-to-Markdown **visual** comparison; existing Diff stays
  a separate explicit text comparison action (`差分を見る`);
- never two editable panes, never auto-apply, never revive Review Desk.

### Quality inventory (v1.6 historical)

Cross-cutting quality notes for the closed v1.6 line live in
**`docs/quality-inventory-v1.6.md`**. Prefer one verifiable v1.7 slice at a
time; keep normal `npm test` / `cargo test` gates.

### CodeMirror pin (durable)

- Keep `@codemirror/view` at **6.43.2** (`package.json` + overrides).
- 6.43.3+ tile-tree regressions caused vanishing lines / wrong caret.
- Do not bump view without re-verifying long Japanese Markdown + wrap + L Mode.

### 江戸彼岸 (post-v1.5)

- Theme is on main; polish force/density on device as needed.
- Not part of the v1.5 release story.

## Historical

v1.5 and earlier queue detail: keep this file short. Older slices live in git history and `docs/archive/`. v1.3 Daily Trust remains the long-published baseline story until store listing notes supersede it in `current-status.md`.
