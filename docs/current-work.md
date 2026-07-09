# Current Work

Status: Operational
Scope: v1.6 Import Assist Phase 1 (package `1.6.0` / bundleVersion 76)
Authority: High
Last reviewed: 2026-07-09

## Purpose

Start here when choosing the next small `Hazakura Editor` slice.

## Lane Timeline (read first)

| Lane | Status | Notes |
|------|--------|--------|
| **v1.5** | **Closed / released as `1.5.0`** | Stabilization + reading polish. **Released before 江戸彼岸 (edohigan) was merged.** Do not reopen unless hotfix. |
| **Post-v1.5 main (not v1.5)** | Merged after v1.5 release | 江戸彼岸 theme; CodeMirror `@codemirror/view` **6.43.2** pin + editor display quality (syntax-tree recompute, resize remeasure, fold gutter removed). |
| **v1.6** | **Active** | Import Assist Phase 1 (Vision OCR / PDFKit). Boundary review: `docs/import-assist-boundary-review.md`. Design: `docs/superpowers/specs/2026-07-02-import-assist-design.md`. |
| **v2** | Later | OKF Book Scope, then 縦書き. |

Published Mac App Store history through v1.3 remains documented in `current-status.md`; treat `1.5.0` as the closed v1.5 product line per release before edohigan.

## Product Boundary

- Safe Editor remains primary.
- Markdown/text source remains canonical.
- Do not add Git, LSP, terminal, arbitrary command execution, plugins,
  project-wide indexing, auto-apply, or auto-commit.
- Workspace file operations stay bounded to the selected workspace.
- Agent Workbench remains a separate, explicit Developer / GitHub lane.
- Import Assist must stay on-device, edit-before-save, no auto-save
  (see boundary review).

## Active UX Queue — v1.6 Import Assist

| Priority | Slice | Acceptance |
|---|---|---|
| Done / gate | Boundary review | `docs/import-assist-boundary-review.md` approved; v1.5 closed before edohigan. |
| Done / spike | PDFKit + Vision helper spike | Fixture + live Swift helper for `extract_pdf_text` / `ocr_image` / `probe`; pure Rust draft assembly tests. |
| Done / MVP slice | Unsaved Markdown draft open | File menu + command palette. PDFKit text preferred; pdf-extract fallback; scan PDF page OCR; image Vision OCR. Dirty untitled tab, no auto-save. |
| Done / TF packaging | Helper externalBin | `hazakura-import-assist-helper` in all tauri confs; `beforeBuild` builds live helper (arm64+x64+universal). |
| Done / TF packaging | Nested helper App Store re-sign | Both local-assist and import-assist helpers inherit re-sign (TF 90885). |
| In tree / verify | PDF export last-line clip | `PDF_CONTENT_BOTTOM_SAFETY_POINTS` — device re-export still useful (**Pack C**). |
| Done / quality | Q-STR-1 tab mutation helpers | `editorTabs` list helpers + Assist/editor/recovery migration. |
| Done / quality | Q-STR-2 Assist editable guard | `appleAssistEditGuard` + save/edit/encoding/backup reject while generating. |
| Done / quality | Q-STR-3 sessionId naming | `setActiveTabContents(next, sessionId)` rename. |
| Done / quality | Q-STR-4 menu/palette share | `sharedShellDocumentActions` in controller. |
| Done / quality | Q-STR-5 path containment | images / workspace list / auto_backup use shared helper. |
| Done / quality | Q-IMP-8 import helper timeout | Wall-clock watchdog kills hanging helper (`round_trip_helper_with_timeout`). |
| Done / quality | Q-IMP-2 sandbox OCR staging | Container temp copy before nested helper (images + PDF helper paths). TF re-verify open. |
| Done / quality | Q-IMP-1 import image honesty | Draft note when `![](...)` present; Preview blocked-image copy is Japanese. |
| Rec / v1.6 quality | Pack C | Q-PDF-1 device re-verify (code already has bottom safety). |
| Rec / v1.6 quality | Import reliability pack | Q-IMP-8 helper wall timeout; Q-IMP-2 sandbox OCR if TF repro; optional Q-IMP-1 messaging (**Pack B**). |
| Deferred | Other quality backlog | Theme cost, deeper STR, … — same inventory; not default next. |
| Done / UX | Import discoverability | Confirm dialog; workspace right-click “Markdown 下書きとして取り込む…”; menu/palette keywords. |
| Next / post-TF | Review UI | Source page/image vs Markdown; low-confidence marks. |
| Later | PDF text-layer prefer + OCR fill | PDFKit first; Vision only when needed. |
| Deferred v2 | Book Project split | chapters/ + hazakura.import.json. |

### Quality inventory

Cross-cutting quality notes (symptom matrix, **structural audit**, v1.6
recommended **Packs A/B/C**, durable pins) live in
**`docs/quality-inventory-v1.6.md`**. Prefer one verifiable slice at a time;
when testing, run Pack A/B/C checks together with the normal
`npm test` / `cargo test` gates.

### CodeMirror pin (durable)

- Keep `@codemirror/view` at **6.43.2** (`package.json` + overrides).
- 6.43.3+ tile-tree regressions caused vanishing lines / wrong caret.
- Do not bump view without re-verifying long Japanese Markdown + wrap + L Mode.

### 江戸彼岸 (post-v1.5)

- Theme is on main; polish force/density on device as needed.
- Not part of the v1.5 release story.

## Historical

v1.5 and earlier queue detail: keep this file short. Older slices live in git history and `docs/archive/`. v1.3 Daily Trust remains the long-published baseline story until store listing notes supersede it in `current-status.md`.
