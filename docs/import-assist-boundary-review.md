# Import Assist Phase 1 — Boundary Review

Status: Approved for spike / Phase 1 foundation
Scope: v1.6 Import Assist (PDF / image → Markdown draft)
Authority: High for Phase 1 intake decisions
Last reviewed: 2026-07-09

## Lane Timeline (must not confuse)

| When | What |
|------|------|
| **v1.5 released** | Stabilization / reading polish (`1.5.0`) — Spellcheck settings, Reading Focus TOC density, dead-code sweep, dependency hygiene, traffic-light polish, editor CM remount for L Mode toggle. **Closed and released before 江戸彼岸 (edohigan) landed.** |
| **Post-v1.5 on main** | 江戸彼岸 theme, CodeMirror `@codemirror/view` **6.43.2** pin + display quality (syntax-tree recompute, resize remeasure, no fold gutter). These are **not** part of the v1.5 release tag/story. |
| **Active now** | **v1.6 Import Assist Phase 1** (this review). Design: `docs/superpowers/specs/2026-07-02-import-assist-design.md`. |

Do not re-open v1.5 feature work unless a release hotfix is required.

## Decision

**Go for Phase 1 foundation** inside Safe Editor boundaries.

Phase 1 value:

> PDF や画像から「編集できる Markdown 下書き」をローカルで作る。  
> 完全自動変換・クラウド OCR・自動保存はしない。

## Invariants (must hold)

1. **On-device only** — PDFKit / Vision (and fixed bundled helpers). No cloud OCR, no external document upload.
2. **Edit-before-save** — Result opens as an **unsaved** Markdown buffer (or equivalent explicit draft). No auto-save, no auto-apply to an existing file.
3. **Markdown source remains canonical** — No alternate document model. Optional `hazakura.import.json` / page metadata is tracking only (Book Project deferred to v2).
4. **User-selected input only** — Open via explicit file dialog / drop into an allowlisted intake action. No home-directory scan.
5. **No boundary expansion** — No Git, LSP, terminal, plugins, project-wide indexing, generic shell, or arbitrary helper paths from the frontend.
6. **Rights posture** — Product copy targets the user’s own docs, licensed materials, public/research materials, scans. No DRM circumvention, no Kindle extract, no “pirate book to Markdown” framing.
7. **Accuracy posture** — Market as **OCR draft**, not “perfect conversion”. Vertical JP, tables, math, handwriting are known weak areas.

## Allowed OS / native surface

| Surface | Allowed? | Notes |
|---------|----------|--------|
| PDFKit embedded text extract | Yes | Prefer over OCR when text layer is usable |
| PDF page → image → Vision OCR | Yes | For scanned / empty text pages |
| Vision OCR on user-selected image | Yes | PNG / JPEG / TIFF / HEIC (as supported) |
| Bundled fixed helper binary (JSON stdio) | Yes | Same trust pattern as Local Assist helper: path resolved by app, not user argv |
| Cloud OCR / remote Vision API | **No** | |
| Full Book Project split in Phase 1 | **No** | Single Markdown only; chapter split is v2 Book Scope |

## Phase 1 MVP acceptance (product)

- [ ] Image → Vision OCR → unsaved Markdown tab
- [ ] PDF → PDFKit text when present; OCR only where needed → one Markdown
- [ ] Page markers / low-confidence comments are plain Markdown (reversible)
- [ ] No auto-save
- [ ] Failure paths are explicit (unsupported type, unreadable file, OCR unavailable)
- [ ] App Store / privacy copy can truthfully say on-device processing

## Spike goals (this slice)

Prove native plumbing without shipping UI:

1. **PDFKit** — Extract plain text per page from a local PDF path (live macOS).
2. **Vision** — OCR a local image to plain text (live macOS).
3. **Fixture mode** — Deterministic helper responses for CI / non-AI Macs.
4. **Pure draft assembly** — Rust (or shared pure logic) joins page texts into a Markdown draft with page comments; unit-tested without Vision.

Out of spike: review UI, menu entry, auto workspace write, Book Project, Local Assist post-process.

## Helper contract (spike)

Swift executable `hazakura-import-assist-helper` (JSON lines, like Local Assist):

```json
{"action":"extract_pdf_text","path":"/abs/file.pdf"}
{"action":"ocr_image","path":"/abs/page.png","languages":["ja-JP","en-US"]}
{"action":"probe"}
```

Responses:

```json
{"kind":"pdf_text","value":{"pages":[{"index":0,"text":"...","charCount":12}]}}
{"kind":"ocr_text","value":{"text":"...","confidence":0.0}}
{"kind":"probe","value":{"pdfKit":true,"vision":true,"fixture":false}}
{"kind":"error","value":{"error":"...","kind":"..."}}
```

Frontend must never pass arbitrary executable paths—only content paths chosen by the user dialog, validated by Rust (extension allowlist, absolute path, exists, size cap).

## Risks

| Risk | Mitigation |
|------|------------|
| Users expect perfect OCR | Draft language + review UI later |
| Large PDF hangs UI | Page limits / progress; process off main UI thread |
| Helper sprawl | One fixed binary name; same supervisor patterns as Local Assist |
| CM / editor regressions | Keep `@codemirror/view` **6.43.2** pin |
| Scope creep into Book Scope | Single Markdown only until v2 |

## Explicit non-goals (reconfirm)

- DRM / Kindle full extract
- Cloud OCR
- Auto-save of OCR output
- Chapter-splitting Book Project in Phase 1
- Claiming “high accuracy OCR” in store listing

## Next after spike

1. Wire helper resolve path + main-window-only Tauri commands.
2. Unsaved tab open with assembled draft.
3. Review UI (source image/page vs Markdown).
4. Privacy strings + App Store notes for on-device intake.

## Sign-off

- Boundary review: **approved for Phase 1 foundation + spike** (2026-07-09).
- Design source: `docs/superpowers/specs/2026-07-02-import-assist-design.md`.
- Product boundary: `docs/security-boundary.md`, `AGENTS.md`.
