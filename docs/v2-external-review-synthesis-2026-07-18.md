# v2 External Review Synthesis (2026-07-18)

Status: Advisory planning input  
Scope: Consolidated useful items from four independent agent reviews of tree `2.0.0`  
Authority: Medium (does **not** override `current-work.md` queue or hard rails)  
Last reviewed: 2026-07-18

## Purpose

Four separate agents reviewed Hazakura Editor around 2026-07-18 (source tree
`2.0.0`, published App Store `1.13.0`, `1.14.0` in review per repo records).
This document **extracts and deduplicates useful guidance** so roadmap and
future slices can reference one place instead of the original four notes.

- **Does:** pool verified themes, priorities, and avoid-list consensus.
- **Does not:** change the active packaging gate, claim tests were re-run here,
  or expand product boundaries.
- **Queue of record remains:** `docs/current-work.md`.
- **Phase order remains:** `docs/roadmap.md`.

Original private notes (local Drive; not in repo):

| Label | File (local) | Emphasis |
|-------|--------------|----------|
| Grok product | `2.0レビューgrok.md` | Product / UX / release narrative |
| Improvement proposal | `review-improvement-proposal-2026-07-18.md` | Code quality, claims, Book Scope maintainability |
| Architecture / CI | `2.0Review.md` | CI, deps, large-file structure, release lanes |
| Full synthesis | `hazakura-editor-review2.0.md` | UX journeys, AppShell, portability, a11y, threat model |

When two or more reviews agree, the item is marked **Consensus**. Unique but
useful items keep a source tag.

---

## 1. Consensus strengths (keep)

Do not erode these while polishing:

| Theme | Why it matters |
|-------|----------------|
| Safe Editor rails as brand | No Git / LSP / general terminal / plugins / arbitrary exec / auto-apply |
| Source-canonical Markdown | No silent rewrite; Diff for candidates; one primary edit buffer |
| Book Scope Alpha shape | Explicit chapter pick, app-private order, unavailable retention, no background index |
| OKF ≠ Book semantics | Compatibility review stays advisory; Book is Hazakura order + read/export |
| App Store vs Developer lanes | Agent Workbench stays out of App Store |
| Honest evidence language | Implemented ≠ published ≠ proven on every device |
| 1 run = 1 verifiable slice | Avoid bulk backlog digestion |
| Human gate for tag / pkg / upload | No auto-release pipeline |

---

## 2. Consensus avoid list (boundary alarms)

Convenient-looking work that **should not** enter the main lane without an
explicit product redefinition:

- Workspace-wide background indexing / always-on project analysis
- Git client, LSP, general terminal, plugin marketplace
- OKF or Book **auto-repair** or silent multi-file rewrite
- Second permanent editable buffer as default
- Cloud AI network fallback; provider-add UI; tool calling expansion
- Auto-save / auto-apply of Assist or import candidates
- Hidden database as truth for chapter order
- Mass Redux / full AppShell rewrite in one run
- Vertical writing (縦書き) before horizontal Book stability
- 100-item backlog “catch-up” pressure

---

## 3. Extracted recommendations by roadmap phase

Priorities below map onto existing phases. They are **candidates**, not an
ordered execution queue. Promote into `current-work.md` only when chosen as
the next slice or packaging gate item.

### 3.1 Now — packaging / human gate (v2.0 cut)

Aligns with roadmap **Now: human packaging gate** and current-work immediate next.

| ID | Item | Sources | Notes |
|----|------|---------|-------|
| N-1 | **Manual smoke pass/fail card** for Book + Help + heavy manuscript PDF/EPUB | Consensus | Selection → reorder → restart restore → unavailable retained → whole-book read; export preflight blocks unavailable; Help reachable |
| N-2 | **Signed TestFlight visual check** of heavy JP manuscript (fonts, images, chapter breaks, EPUB TOC/spine) | Consensus | Bundled Poppler JP font mapping already observed as risk; do not claim bulk export quality until seen |
| N-3 | **Outward can / cannot copy** for 2.0 (store + Help same words) | Grok, Full | Order is app-private; no startup scan; reader is read-only; vertical writing not yet; no auto-repair |
| N-4 | **Disclose Book order storage** (this Mac / app storage, not folder order) | Full | UI empty state and/or Help; reduces migration / backup confusion |
| N-5 | **First-run path compression**: open folder → Book chapters → read/export | Grok, Full | Assist / OKF / Reference as second tier |
| N-6 | **Hotfix discipline**: only reproduced published / in-review bugs; do not mix tree 2.0 polish into 1.14 | Grok, Architecture | Already operational rule — keep |
| N-7 | **Doc drift fix** (product-brief multi-file wording; old `hazakura-note` names; version surfaces clarity) | Full, Improvement | Small, high trust |
| N-8 | **App Store bundle assertion**: no Agent entry / agent surface in App Store lane | Full, Architecture | Automate in release gate if not already complete |
| N-9 | **Book-critical VoiceOver minimal smoke** (Files/Book, chapter list, Save/Cancel focus return, preflight errors) | Full, Grok | Full matrix can stay parked; Book path should not ship blind |
| N-10 | **Release-state one table** (App Store / DMG / source tag: published / submitted / tree / next human gate) | Architecture, Full | Optional `current-status` header or short `release-state` note |

### 3.2 v2.x — Book practicalization (after Alpha ships)

Extends roadmap **v2.x Book Scope Practicalization**. Prefer order: read/search
utility → portability → chapter review → vertical writing later.

| ID | Item | Sources | Roadmap link |
|----|------|---------|--------------|
| X-1 | **In-book search** — explicit, bounded, no persistent index; dirty tabs win over disk | Full, Improvement, Grok | Chapter-scoped search |
| X-2 | **Reader chapter navigation** — prev/next, chapter list, sticky chapter label, reading position (app-private) | Full, Grok | Navigation editing / reader beyond scroll |
| X-3 | **Portable Book recipe** — user-explicit export/import of relative path list (JSON/MD); never auto-load; never claim OKF standard | Full, Grok (manifest-when-needed) | Small explicit manifest |
| X-4 | **Chapter-level Diff / Review** — open chapter only; no whole-book rewrite | Roadmap + all | Chapter-level Diff |
| X-5 | **Editable / display TOC design** — app-private display order vs source headings only | Improvement, roadmap | Editable generated TOC |
| X-6 | **Export JP quality as evidence** — preflight copy that says what to fix next | Grok | Distribution evidence bucket |
| X-7 | **Book vs OKF one-liner** in empty states / result headers (not only Help) | Grok | Ship polish residual |
| X-8 | **Suggestion explainability** — why candidate included (index link / remaining .md); bulk select modes; no semantics required | Grok | Alpha UX depth |
| X-9 | **Local Assist expectation UX** — unavailable Mac copy; Diff → explicit apply → user save; no chat surface | Grok, Full | Assist strategy |
| X-10 | **Sample short book workspace** (3–5 chapters) or Help fixture path | Grok | Discovery without new features |
| X-11 | **User-facing terminology table** (Book / 知識フォルダ / 資料を横に置く …) | Full | Help + UI quieting |

### 3.3 Engineering hygiene (any time as small slices)

Does not change product surface; pick when friction is real. Respect 1-slice rule.

| ID | Item | Sources |
|----|------|---------|
| E-1 | **Minimal GitHub Actions** — typecheck / vitest / cargo fmt+test on PR; **no** auto-tag / auto-publish | Architecture (notes source-release-checklist P1) |
| E-2 | **Window-label gate mechanical check** — every `#[tauri::command]` must call `ensure_label_*` (static test or build script) | Architecture |
| E-3 | **Image path extraction single source** — align JS preflight parse with Rust export collection | Improvement |
| E-4 | **Book `visitIndex` / order pure-function split** under existing tests | Improvement |
| E-5 | **Claim vs evidence separation** in long status docs (`Claimed` / `Evidence pending` or evidence matrix) | Improvement, Full |
| E-6 | **`current-status.md` slim** — move historical baselines to `archive/operations/` | Improvement, Full |
| E-7 | **Smoke procedures vs dated run evidence** split | Full |
| E-8 | **Journey integration tests** (single doc / Book / Assist apply / external conflict) over raw coverage % | Full, Architecture (E2E P2) |
| E-9 | **AppShell staged split** — start with `BookModel` props cluster only; no big-bang Context/Redux | Full, Architecture |
| E-10 | **Surface state tagged union** — main/side surfaces instead of many independent booleans | Full |
| E-11 | **Large file modularization** — `util.rs`, `okf.rs`, `apple_assist_supervisor.rs`, giant panes/shaders as pure moves under green tests | Architecture |
| E-12 | **`pdf-extract` / cargo audit allowed set** — document review trigger; optional crate alternative study in `docs/internal/` | Architecture |
| E-13 | **`@codemirror/view` 6.43.2 pin unlock criteria** in internal note | Architecture |
| E-14 | **kana / i18n hygiene** — lint missing kana; gradual table-driven locale for new strings; drop dead locale modules | Improvement, Architecture |
| E-15 | **Privacy-safe diagnostics copy** (version, OS, lane, assist availability, tab/book counts, error codes — never body/paths/titles/keys) | Full |
| E-16 | **Performance baselines** — cold start, large MD open, 100-chapter reader, Diff, preflight, shader CPU; entry size warnings | Full, Improvement (theme budget) |
| E-17 | **Docs frontmatter lint** — Status/Scope/Authority/Last reviewed; ban stale product names; broken links | Full |
| E-18 | **Property/fuzz candidates** for path/symlink/Book resolve/export collisions | Full |
| E-19 | **Threat-model table as living checklist** (assets × defenses × tests) | Full |
| E-20 | **Parked residual list discipline** — tab overflow, nav back, status TTL, narrow matrix: touch only on friction | Consensus |

### 3.4 Later — after v2.x foundation

| ID | Item | Sources |
|----|------|---------|
| L-1 | **縦書き** — render/export only; source stays horizontal Markdown | Roadmap + all |
| L-2 | **v3.x local AI re-evaluation** only after structure / review / export mature | Roadmap |
| L-3 | **DMG public lane policy** — resume Developer DMG or formally App Store–only | Architecture |
| L-4 | **Google Drive restore** — dedicated fixture or explicit out-of-scope | Architecture |
| L-5 | **Broad VoiceOver / a11y distribution matrix** beyond Book-critical path | Parked + reviews |

---

## 4. Cross-walk to existing roadmap wording

| Roadmap already says | Review reinforcement |
|----------------------|----------------------|
| Human packaging gate for 2.0.0 | N-1, N-2, N-6, N-10 |
| Help + store draft as ship polish | N-3, N-4, N-5, X-7, X-11 |
| Residual polish parked | E-20 |
| Distribution evidence parked until gate | N-2, N-9, X-6, L-5 |
| v2.x: navigation, TOC, chapter Diff/search, optional manifest | X-1–X-5 |
| 縦書き after Book foundation | L-1 |
| Hard rails / non-goals | §2 Avoid list |

Nothing in §3 **requires** expanding non-goals. Portable recipe (X-3) stays
**user-explicit** and must not become hidden auto-loaded truth.

---

## 5. Personas (useful for copy / Help, not separate features)

| Persona | Satisfied today (roughly) | Still weak | Prefer IDs |
|---------|---------------------------|------------|------------|
| Solo book author | Single MD → e-book → PDF/EPUB; v2 whole-book read | Page-turn feel, 縦書き, export JP proof | N-2, X-2, L-1 |
| OKF knowledge-folder user | Advisory review, explicit scaffold | Book vs OKF confusion; suggestion reasons | X-7, X-8 |
| Safety-first folder user | No exec / no silent send | First 10 minutes story | N-5, N-3 |
| Local Assist experimenter | Diff, no auto-save | Device availability copy | X-9 |

---

## 6. Suggested issue-sized titles (optional)

For humans cutting tickets later (not an auto-backlog):

**Pre-ship**

1. v2.0: heavy manuscript signed TestFlight PDF/EPUB visual gate  
2. Book order storage disclosure (UI + Help)  
3. Book-critical VoiceOver smoke checklist  
4. App Store bundle Agent-entry release assertion  
5. Doc drift: product-brief / security-boundary names / release-state table  

**v2.x**

6. Explicit in-book search (no index)  
7. Reader chapter navigation + private reading position  
8. Portable Book recipe export/import design  
9. BookModel props extraction from AppShell  
10. Journey integration tests (Book + conflict + Assist apply)  

**Hygiene**

11. Minimal PR CI (typecheck / test / cargo) without release automation  
12. `ensure_label_*` coverage test for all commands  
13. Privacy-safe diagnostics copy  

---

## 7. How agents should use this file

1. Read `current-work.md` first for the **active** next slice.  
2. Use this synthesis only to **pick candidates** that fit the current phase.  
3. Prefer Consensus + packaging-gate items before engineering deep refactors.  
4. If an item would touch path / exec / AI / multi-file rewrite, re-check
   `security-boundary.md` and product hard rails.  
5. After adopting an item into the queue, implement in one verifiable slice;
   update `current-work.md` / status — do not grow this file into a second
   roadmap.

---

## 8. Out of scope for this synthesis

- Re-running the full test suites or claiming new pass counts  
- Choosing tag/pkg/submit (human only)  
- Implementing any P0/P1 code change  
- Archiving or deleting the private Drive originals  

When the packaging gate closes or v2.x starts in earnest, refresh
`Last reviewed` and move completed rows to a short “Adopted / done” note or
leave them struck through in a future edit.
