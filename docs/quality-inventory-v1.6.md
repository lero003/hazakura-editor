# Quality Inventory — v1.6 / package 1.6.0

Status: Operational  
Scope: Cross-cutting quality notes for the active v1.6 lane (Import Assist,
edohigan, PDF export, joke themes, durable editor pins)  
Authority: High for prioritization; does not override `security-boundary.md`  
Last reviewed: 2026-07-09

## Purpose

実機スモークとコード調査から拾った **品質ギャップ** を一枚に集約する。
次スライス選定の入力。実装契約やリリース可否の最終判定ではない。

関連:

- Active queue: `docs/current-work.md`
- Import boundary: `docs/import-assist-boundary-review.md`
- PDF history: `docs/v1.3-followup.md`
- Older user observations: `docs/v1.1-v1.2-followup.md`
- Theme notes: `docs/edohigan-theme-plan.md`

## Snapshot (2026-07-09)

| Area | State |
|------|--------|
| Package | `1.6.0` / App Store `bundleVersion` **77** (TF proven on **76**) |
| Import Assist | MVP shipped to TF; text-layer PDF usable on long JP docs |
| Nested helpers App Store sign | Fixed (local + import helpers both inherit re-sign) |
| PDF export blank trailing pages | Fixed earlier (column occupancy measure, height 842) |
| PDF export last-line clip | **Code fix in tree** (`PDF_CONTENT_BOTTOM_SAFETY_POINTS`); **device re-verify open** |
| Image-in-import UX / sandbox OCR | Open (deferred) |
| Theme GPU/CSS cost (shinkai / crt) | Open (deferred) |
| `@codemirror/view` | **Pinned 6.43.2** — do not bump casually |

## Priority matrix

| Pri | ID | Item | Severity | Status | Suggested slice |
|-----|-----|------|----------|--------|-----------------|
| P0 | Q-PDF-1 | PDF export drops last few lines of document | Correctness | **Fixed in source** (16pt bottom safety on multi-column content height). Confirm on device with the long manuscript that reproduced the clip. | Device re-export smoke only |
| P1 | Q-IMP-1 | PDF import leaves Markdown image paths that Preview blocks | UX / expectation | Open | Draft banner or Japanese blocked-image copy; optional strip/annotate `![](...)` |
| P1 | Q-IMP-2 | Image file OCR may fail under App Sandbox when helper opens user path | Correctness (TF) | Open / needs repro | Parent copies to container temp, then helper OCRs |
| P1 | Q-THM-1 | Shinkai / CRT feel heavier than edohigan for similar “showy” intent | Perf / perception | Open | DPR cap, rAF throttle, reduce CSS `filter` animations |
| P2 | Q-PDF-2 | PDF export 30s wall timeout on very long multi-page captures | Reliability | Open | Timeout scale with page count or raise modestly |
| P2 | Q-IMP-3 | Scan PDF OCR capped at 40 pages; 40 MB source cap | Limit | By design | Document in UI; raise only with progress UI |
| P2 | Q-IMP-4 | Empty OCR still opens a draft with empty-page markers | UX | Open | Fail hard or stronger empty-state message |
| P2 | Q-EXP-1 | PDF export does not embed document images reliably in all cases | Completeness | Historical RC | v1.3-followup breadth; not v1.6 blocker |
| P2 | Q-DOC-1 | Handoff / status still mention stale bundleVersion in places | Docs drift | Partial | Keep this inventory + `current-work` authoritative |
| Durable | Q-CM-1 | CodeMirror view ≥6.43.3 tile-tree line vanish / caret bugs | Correctness | Mitigated by pin | Never bump without long JP + wrap + L Mode matrix |
| Deferred | Q-IMP-5 | Extract embedded PDF images into workspace assets | Feature | Out of Phase 1 | Book / asset pipeline later |
| Deferred | Q-IMP-6 | Import review UI (source vs draft, low-confidence) | Feature | Planned post-TF | `current-work.md` |
| Done | Q-IMP-7 | Import discoverability (menu confirm + workspace right-click) | UX | Shipped in source | Confirm before OCR; context menu on PDF/image |
| Deferred | Q-THM-2 | Edohigan force/density on-device polish | Polish | Open | `edohigan-theme-plan.md` |
| Historical | Q-RC-1 | v1.3 extended RC edges (Save As cancel, PDF dialog cancel, …) | Breadth | Not blockers | `v1.3-followup.md` |
| Historical | Q-ENV-1 | Google Drive recovery fixture | Ops | manual-blocked | Do not touch user cloud |

---

## Detail — open and recent

### Q-PDF-1 — PDF export last lines clipped

**Symptom (user):** Full document mostly exports; **last few lines** missing.

**Cause (code):** Horizontal multi-column A4 capture (`height` fixed to one
page). Content box was flush with the column bottom; WebKit `createPDF`
clips the A4 rect, so final line boxes / descenders can fall outside.

**Fix (source):** `PDF_CONTENT_BOTTOM_SAFETY_POINTS = 16` reserved from
`contentHeightPoints` in `src/features/document/pdfExport.ts`. Capture size
script still uses height `842` and column occupancy (do **not** restore
document `scrollHeight` as the normal measure — reintroduces blank pages).

**Verify:** Re-export the long manuscript that failed; check final page in
macOS Preview. If still clipped, raise safety to 20–24pt.

### Q-IMP-1 — Image paths after PDF import

**Symptom (user):** After PDF import, Markdown shows image reference paths;
Preview shows an error-like note (exact string not captured; likely
`Image blocked: …`).

**Cause (code):** Import Assist extracts **text only**. Paths such as
`![](assets/foo.png)` from the source text layer remain as Markdown.
Preview policy (`renderMarkdown` / `workspaceImagePath`) blocks
non-workspace, missing, remote, and untitled-draft-relative images by design
(Safe Editor).

**Not the same as:** Failure to OCR a standalone image file (Q-IMP-2).

**Do not fix by:** Silently fetching remote images or reading outside the
workspace.

### Q-IMP-2 — Standalone image OCR under sandbox

**Hypothesis:** Image path always goes to nested helper + Vision. Parent has
user-selected file access; helper only has sandbox **inherit**. Path
passthrough can fail on TF while **PDF text-layer** still works via
in-process / already-accessible paths.

**Repro checklist:**

1. TF build: import a small PNG/JPEG from Downloads → error text?
2. Same file on non-sandbox developer build → success?
3. Distinguish `Image blocked` in preview vs Import failed status.

**Preferred fix:** Copy user file into app container temp, OCR that path.

### Q-THM-1 — Theme cost imbalance

**Observation (user):** Edohigan feels light for a decorative theme; Shinkai /
CRT invite the expectation they could be lighter too.

**Code notes:**

| Theme | WebGL full-screen rAF | JS flow field | Continuous CSS filter / flicker |
|-------|----------------------|---------------|----------------------------------|
| edohigan | Yes | Yes (48×27) | Minimal |
| shinkai | Yes | Yes (48×27) | Yes (`shinkaiBgPulse` filter, etc.) |
| crt | Yes (simpler FS) | No | Heavier (flicker / scan / glitch + filter) |

Perception is driven as much by **CSS compositing and flicker** as by
shader math. Edohigan’s calm motion hides cost; CRT’s grain/flicker
amplifies it.

**Safe levers (when resumed):** lower DPR outside `dramatic`, throttle rAF
to ~30fps, move CRT flicker into shader and drop CSS `filter` loops, thin
shinkai particle/god-ray layers on `subtle`.

### Q-PDF-2 — Export timeout

`PDF_EXPORT_TIMEOUT_SECONDS = 30` with sequential per-page `createPDF`.
Very long manuscripts may time out rather than clip. Separate from Q-PDF-1.

### Q-CM-1 — CodeMirror pin (durable)

Keep `@codemirror/view` **6.43.2** (`package.json` + overrides). 6.43.3+
showed vanishing lines / wrong caret on long Japanese Markdown with wrap and
L Mode. Any bump needs a dedicated regression matrix.

---

## Already addressed (do not re-open casually)

| ID | Item | Notes |
|----|------|--------|
| Q-SIGN-1 | TF 90885 nested helper without profile/inherit | Both helpers re-signed in `sign-app-store-submit-app.mjs` (+ smoke/probe/lanes) |
| Q-PDF-0 | Trailing blank PDF pages | Column occupancy measure; height stays one A4 row |
| Q-IMP-0 | Japanese PDF text-layer quality | Prefer live PDFKit; pdf-extract fallback; soft-wrap join conservative |
| Q-ED-0 | L Mode partial decorations / fold blanking | treeChanged recompute; fold gutter removed; CM pin |

---

## Limits and by-design behavior (document, don’t “bugfix”)

- Import: max source **40 MB**; scan OCR **max 40 pages** (MVP safety).
- Import: draft is always dirty/unsaved; no auto-save.
- Import: no embedded PDF image extraction in Phase 1.
- Preview: no external image fetch; workspace-bounded load only.
- Local Assist: preview companion; OS/Apple Intelligence dependent; no network fallback.
- Agent Workbench: Developer/GitHub lane only; not App Store surface.
- Vite production chunk-size warning: known, warning-only.

---

## Suggested order when quality work resumes

1. **Device-verify Q-PDF-1** (already coded).  
2. **Q-IMP-2** if TF image import still errors (sandbox copy).  
3. **Q-IMP-1** UX honesty (blocked image / missing assets messaging).  
4. **Q-THM-1** only if users still report heat/fan on shinkai/crt.  
5. Leave Book Project, embedded PDF images, and review UI on the feature track
   in `current-work.md`, not this bug list.

## Explicit non-goals for this inventory

- Do not expand Safe Editor boundary for quality polish.
- Do not treat historical v1.1–v1.3 RC breadth as open implementation work
  unless a gap reproduces on current `1.6.0`.
- Do not bump CodeMirror view “for quality” without the pin matrix.
- Do not restore PDF `scrollHeight` measurement to chase completeness.

## Change log

| Date | Note |
|------|------|
| 2026-07-09 | Initial inventory from TF Import Assist smoke, PDF export clip, theme cost discussion, and code pass. |
