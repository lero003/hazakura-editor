# Quality Inventory — v1.6 / package 1.6.0

Status: Operational
Scope: Cross-cutting quality notes for the active v1.6 lane (Import Assist,
edohigan, PDF export, joke themes, durable editor pins, structural debt)
Authority: High for prioritization; does not override `security-boundary.md`
Last reviewed: 2026-07-09 (structural audit + v1.6 recommended slices)

## Purpose

実機スモークとコード調査から拾った **品質ギャップ** と、横断レビューで
見えた **構造リスク / リファクタ候補** を一枚に集約する。
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
| Structural debt (wiring / helpers) | Documented; **v1.6 recommended slices below** |
| `@codemirror/view` | **Pinned 6.43.2** — do not bump casually |

## Priority matrix

### Symptom / product gaps

| Pri | ID | Item | Severity | Status | Suggested slice |
|-----|-----|------|----------|--------|-----------------|
| P0 | Q-PDF-1 | PDF export drops last few lines of document | Correctness | **Fixed in source** (16pt bottom safety). Confirm on device. | Device re-export smoke only |
| P1 | Q-IMP-1 | PDF import leaves Markdown image paths that Preview blocks | UX / expectation | Open | Draft banner or Japanese blocked-image copy |
| P1 | Q-IMP-2 | Image file OCR may fail under App Sandbox when helper opens user path | Correctness (TF) | Open / needs repro | Parent copies to container temp, then helper OCRs |
| P1 | Q-IMP-8 | Import helper `read_line` blocks without effective wall timeout | Reliability | Open | Watchdog kill during `round_trip_helper` (align with Local Assist) |
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

### Structural / refactor (v1.6 recommended — behavior-preserving)

挙動を変えず **配線と不変条件をコードに寄せる** 項目。
全面 rewrite・グローバル store・EditorPane 全書き直しは **非目標**。

| Pri | ID | Item | Severity | Status | Suggested slice | Verify with |
|-----|-----|------|----------|--------|-----------------|-------------|
| P1 | Q-STR-1 | Tab mutation helpers unified (`id` vs `sessionId`) | Maintainability | **Done in source** | `editorTabs.ts` helpers + Assist/editor/backup/discard/recovery migration | `editorTabs.test` + full `npm test` when shipping |
| P1 | Q-STR-2 | Single Assist “editable” guard on all buffer mutators | Correctness | Open / **v1.6 rec** | `assertTabEditable(tab)` shared by save / edit / encoding / import-adjacent mutates | Assist lock + save/edit while generating |
| P2 | Q-STR-3 | Rename misleading `tabId` params that are actually `sessionId` | Maintainability | Open / **v1.6 rec** | e.g. `setActiveTabContents(next, sessionId)` rename only | typecheck + same tests as Q-STR-1 |
| P2 | Q-STR-4 | Menu actions and Command Palette actions share one map | Maintainability | Open / **v1.6 rec** | `useAppShellController`: one `shellActions` object | palette + native menu smoke for open/save/import |
| P2 | Q-STR-5 | Workspace path containment uses one Rust helper | Security consistency | Open / **v1.6 rec** | `images` / `list_workspace_directory` / `auto_backup` → `ensure_path_inside_workspace_root` | `cargo test` security + workspace + images |
| P3 | Q-STR-6 | Import / Local Assist helper path resolver shared | Maintainability | Deferred | production: exe-adjacent + bundle only | helper probe tests |
| P3 | Q-STR-7 | Apple Assist stream uses wall-clock overall timeout | Reliability | Deferred | stop full reset on every partial | assist long-stream smoke |
| Deferred | Q-STR-8 | Thin `useDocumentSession` extract (no new state) | Maintainability | Later | move I/O wiring out of mega-controller only | full `npm test` |
| Deferred | Q-STR-9 | AppShell domain prop bundles (type-first) | Maintainability | Later | document/workspace/chrome/overlays | typecheck; no UI change |
| Out | Q-STR-X | Global store / EditorPane rewrite / PDF scrollHeight restore | — | **Do not** | — | — |

---

## v1.6 recommended pack (test together)

次のまとまりを **1 回の品質パス** で扱えるようにする（実装は 1 スライスずつ可）。
自動テスト + 必要なら短い手動スモークを同じパスで回す。

### Pack A — wiring (Q-STR-1 … Q-STR-4)

| Step | What | Pass criteria |
|------|------|----------------|
| A1 | Implement or review Q-STR-1 helpers | Call sites use helpers; no dual map logic left for contents replace |
| A2 | Q-STR-2 editable guard | Generating tab: edit/save blocked; other tab editable; unlock after settle |
| A3 | Q-STR-3 rename | No behavior change; grep shows `sessionId` naming |
| A4 | Q-STR-4 dedupe | Menu and palette invoke same functions |
| A5 | Automated | `npm run typecheck` (or project equivalent), focused tab/save/assist tests, then `npm test` if time |
| A6 | Manual (optional short) | Save As → Undo keeps session; Assist 採用 leaves dirty; rename path rekeys tab |

### Pack B — import reliability (Q-IMP-2, Q-IMP-8, optional Q-IMP-1)

| Step | What | Pass criteria |
|------|------|----------------|
| B1 | Q-IMP-8 watchdog | Hung helper cannot block past budget; process killed; UI error |
| B2 | Q-IMP-2 sandbox path (if TF repro) | Image from Downloads OCRs on TF via container temp |
| B3 | Q-IMP-1 messaging (if UI slice) | User understands blocked `![](...)` is policy, not crash |
| B4 | Automated | `cargo test` import_assist (+ security if paths touched) |
| B5 | Manual / TF | Long JP PDF text-layer still opens draft; image path checked on TF |

### Pack C — already-coded verify (no feature work)

| Step | What | Pass criteria |
|------|------|----------------|
| C1 | Q-PDF-1 device re-export | Long manuscript last lines present in macOS Preview |
| C2 | CM pin still 6.43.2 | `package.json` + overrides unchanged |
| C3 | Regression smoke | L Mode toggle on long JP wrap; no line vanish |

### Commands (typical pack)

```bash
npm run typecheck
npm test
cargo test --manifest-path src-tauri/Cargo.toml
npm run build:vite
git diff --check
```

PDF device re-export and TF image import remain **outside** unit tests; record pass/fail in this file’s change log or handoff when done.

---

## Structural audit (2026-07-09)

横断レビュー要約。詳細の実装順は上表の Q-STR / Pack を優先する。

### Architecture shape

- **葉は分割済み・幹が太い:** `useAppShellController` (~1700 行) が ~40 leaf hooks を直列配線し flat props を `AppShell` へ流す。
- **SoT 意図:** `tabs: EditorTab[]`。実運用の第 2 バッファは CodeMirror `EditorView` doc。
- **明示 TODO はほぼ無し。** 負債は設計コメント・race guard・識別子二重系として埋まる。

### Bug-prone areas

| Area | Paths (approx) | Failure modes |
|------|----------------|---------------|
| Dual buffer CM ↔ React | `EditorPane.tsx`, assist apply, recovery | stale revert, caret/undo jump |
| Identity `id`/`path` vs `sessionId` | `editorTabs`, path rekey, controller | wrong-tab mutate after Save As/rename |
| Scattered open/save/close mutates | file opening, save, tab close, external change | dirty/fingerprint/lock gaps; tabs vs tabsRef confusion |
| EBook paging machine | `EBookPane.tsx` (~1500) | page shrink, chapter-cross skip |
| PDF export machine | `export.rs`, `pdfExport.ts` | last-line clip, timeout, blank pages if measure wrong |
| Import helper | `import_assist/helper.rs` | hang past timeout; TF image OCR |
| Local Assist supervisor | `apple_assist_supervisor.rs` | orphan helper; stream timeout stretch; wrong-tab apply |
| FE↔Rust contract | `src/lib/tauri/*` vs Rust types | snake/camel mix; constant drift |

### Quality tends to degrade when

- Bumping `@codemirror/view` without JP + wrap + L Mode matrix
- Adding CSS filter / unthrottled rAF on joke themes
- Changing preview CSS without export/EPUB parity
- Growing flat `AppShell` props without domain bundling
- Adding a new `setTabs` path that skips Assist lock / draft / fingerprint guards
- Leaf tests green while open→edit→Save As→Assist→close wiring untested

### Hard to adjust without small refactors

| Hotspot | Why costly | Prefer |
|---------|------------|--------|
| Mega controller + dual action maps | One feature touches order, menu, palette, modalOpen | Q-STR-1…4 first |
| PDF ObjC multi-step export | load → measure → page PDFs → merge → 30s | fix measure only; never scrollHeight |
| Import vs Local Assist helper maturity | Import one-shot weaker timeout | Q-IMP-8 before feature expansion |
| Path containment 3+ copies | New workspace op may miss helper | Q-STR-5 |

### Do not (structure)

- Redux/Zustand 全面導入、App.tsx 巻き戻し、EditorPane 全面書き直し
- フック群を無理に Context 分割（controller コメントが既に警告）
- PDF の `scrollHeight` 通常計測復活
- Safe Editor 境界拡大を「品質改善」と呼ぶこと

### Hotspot map (size order of magnitude)

| Surface | File | Risk |
|---------|------|------|
| Wiring trunk | `src/hooks/app/useAppShellController.ts` | coupling |
| Editor | `src/components/editor/EditorPane.tsx` | dual buffer |
| E-book | `src/components/editor/preview/EBookPane.tsx` | paging SM |
| Local Assist UI | `src/components/appleAssist/AppleAssistWindowApp.tsx` | cross-window |
| PDF BE | `src-tauri/src/commands/export.rs` | capture SM |
| Assist BE | `src-tauri/src/commands/apple_assist_supervisor.rs` | process life |
| Import BE | `src-tauri/src/import_assist/helper.rs` | timeout/sandbox |
| util | `src-tauri/src/util.rs` | path/encoding bulk |

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

### Q-IMP-8 — Import helper effective timeout

**Code:** `HELPER_TIMEOUT` in `import_assist/helper.rs` is checked between
loop iterations, but **`read_line` can block** without advancing that check.
Local Assist supervisor has a stronger kill/watchdog path.

**Preferred fix:** Wall-clock watchdog that kills the child if the overall
round-trip exceeds budget (same spirit as Local Assist, one-shot lifecycle).

**Verify:** Fixture or fake helper that never writes a line; assert parent
returns error within ~timeout (+ grace), no orphan process.

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

### Q-STR-1 … Q-STR-5 — Structural (summary)

See matrix rows and **v1.6 recommended pack**. Implementation notes:

- **Q-STR-1:** Prefer pure functions in `src/features/editor/editorTabs.ts` so
  hooks only call `setTabs(helpers...)`.
- **Q-STR-2:** Generation lock already lives in `useAppShellController`;
  centralize the “may mutate this tab?” check so new mutators cannot skip it.
- **Q-STR-3:** Cosmetic rename but high misuse cost; do with Q-STR-1.
- **Q-STR-4:** Menu listener and palette currently rebuild overlapping action
  objects in the controller — share one.
- **Q-STR-5:** Do not change “user-selected absolute path” open/save policy;
  only unify **workspace-scoped** containment helpers.

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
- Open/save of user-selected paths is not always workspace-bound (by design;
  sandbox + window label + content limits). Workspace tree ops stay contained.

---

## Suggested order when quality work resumes

1. **Pack C:** Device-verify Q-PDF-1 (already coded).
2. **Pack A:** Q-STR-1 → Q-STR-2 → Q-STR-3 → Q-STR-4 (behavior-preserving wiring).
3. **Pack B:** Q-IMP-8; then Q-IMP-2 if TF image import still errors; Q-IMP-1 UX.
4. **Q-STR-5** path helper unify (good with any workspace/images touch).
5. **Q-THM-1** only if users still report heat/fan on shinkai/crt.
6. Leave Book Project, embedded PDF images, review UI, and deep PDF/EBook
   refactors on feature / deferred tracks — not this pack list.

## Explicit non-goals for this inventory

- Do not expand Safe Editor boundary for quality polish.
- Do not treat historical v1.1–v1.3 RC breadth as open implementation work
  unless a gap reproduces on current `1.6.0`.
- Do not bump CodeMirror view “for quality” without the pin matrix.
- Do not restore PDF `scrollHeight` measurement to chase completeness.
- Do not start Q-STR-8/9 or EditorPane rewrites without a reproduced wiring pain.

## Change log

| Date | Note |
|------|------|
| 2026-07-09 | Initial inventory from TF Import Assist smoke, PDF export clip, theme cost discussion, and code pass. |
| 2026-07-09 | Structural audit + Q-STR / Q-IMP-8 rows; v1.6 recommended packs A/B/C for combined testing. |
| 2026-07-09 | Q-STR-1 shipped: list helpers in `editorTabs.ts`; Assist/editor/backup/discard/recovery callers migrated. |
