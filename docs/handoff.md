# Handoff

Status: Operational
Scope: Post-v2.3.0 ship; v2.4 plan ready
Authority: Medium
Last reviewed: 2026-07-24 (MAS 2.3.0 published; v2.4 plan drafted)

## Current State

- Package/app version in tree: **`2.3.0`** (matches published store line).
- GitHub source / local-app tag: **`v2.3.0`** (no binary assets). Prior
  checkpoint `v2.0.0` remains immutable.
- Published Mac App Store (last confirmed in docs): **`2.3.0`**
  (user-reported 2026-07-24).
- **Active phase: post-v2.3.0 ship.** Hotfix only for reproduced blockers on
  published `2.3.0`. Optional next work is one honesty / friction / evidence /
  v2.x practicalization slice — not bulk review-pool digestion. 縦書き stays
  deferred.
- **First Alpha spine is in source:** existing sidebar Files / Book switch,
  explicit Markdown selection, app-private ordered document/group tree,
  same-parent reordering, unavailable-entry retention/recheck, chapter switching
  through the existing single editor, and Rust path/symlink/100-chapter
  validation. Version-1 flat settings migrate as root chapters without
  reinterpreting the workspace; re-Suggest + Save explicitly adopts hierarchy.
- **Explicit chapter suggestions are in source:** Book view can run the existing
  bounded/cancellable OKF snapshot on demand, adapt index section headings plus
  safe relative / bundle-root links into a document/group tree, expand
  root-linked nested indexes in their local chapter order, append remaining
  readable `.md` paths, and open the result as an unsaved checkbox draft. The
  saved tree has no OKF version/type field. It adds no startup/background scan
  or persistent scan cache.
- **Heavy manuscript candidate adjustment is built-app verified:** a real five-work
  e-book split into 44 Markdown files now produces 43 editable candidates with
  the default-on index-page option: root index first, then each linked nested
  index before its chapters, followed by root supplementary notes. Turning the
  option off preserves the previous 37-item body draft; `log.md` stays excluded.
  Signed TestFlight PDF/EPUB appearance is held.
- **Whole-book reader is in source:** explicit Book action, saved scope order,
  live dirty buffers before disk, chapter-relative image/link bases, 32 MiB
  total budget, visible unavailable/skipped notices, and edit return through
  the existing tab path. It is read-only and does not create a second buffer.
- **v2.1 whole-book search is in source:** the Reader searches only its already
  loaded chapter names and visible Markdown under the existing 100-chapter /
  32 MiB budget, including unsaved live buffers. Results show chapter and
  occurrence counts and jump through the existing contents list. Escape clears
  input before closing. `Command+F` is routed to the Reader search instead of
  the hidden editor find bar; Enter / Shift+Enter advances through matching
  chapters with wraparound. No persistent/background index, workspace scan,
  source edit, or auto-save was added; narrow windows keep search/results
  reachable.
- **Preview image loading is bounded in source:** interactive Preview and each
  whole-book Reader chapter keep permitted image references inert until near
  the viewport, reserve placeholder height, and run at most two reads per pane.
  A delayed fallback now routes still-unreported placeholders through the same
  bounded queue when nested WKWebView Preview reports only an initial false
  intersection and then goes quiet. A non-intersecting record no longer
  disables the fallback. A loaded data URL is committed into Preview state and
  the transparent placeholder's lazy flag is removed, so later React paints do
  not restore the blank placeholder. e-book/PDF/EPUB retain eager settle
  behavior. Source and media consent policy are unchanged.
- **In-file search now follows into e-book Mode:** the active `Command+F`
  result is mapped from its source offset to a Markdown line, then to the
  e-book chapter and estimated rendered page in both the right pane and
  Reading Focus. A spread target is aligned to the containing spread's left
  page; Markdown source and search indexing are unchanged.
- **Book frontmatter presentation is aligned:** closed leading YAML is stripped
  for whole-book Reader and PDF, matching EPUB, without changing source. Custom
  metadata is not mapped into cover/part/chapter semantics.
- **Book Scope export is in source:** PDF and EPUB dialogs explicitly choose
  Current file or whole book. Book output uses scope order, live dirty buffers,
  and each chapter's own document path. Preflight checks unavailable chapters,
  up to 100 workspace images, missing headings, and EPUB metadata; unavailable
  chapters block Book export before a destination is chosen.
- **EPUB navigation/link repair is in source:** the saved Book document/group
  tree is the EPUB TOC source, chapter headings retain their local hierarchy,
  and relative / bundle-root links between included Markdown chapters are
  rewritten to packaged XHTML/heading targets. Scope order remains the
  fallback. Book storage is versioned v2; Markdown source and OKF metadata are
  unchanged. Heavy-manuscript Apple Books interaction remains the manual proof
  boundary.
- **Explicit EPUB cover is in v2.3 source:** the EPUB dialog optionally selects
  one local PNG/JPEG/GIF/WebP file for that export. The archive emits a marked
  cover image and cover XHTML before content. No first-image inference, source
  rewrite, persistent cover setting, cropping, or cover editor was added.
- **Book Scope UX quieting is in source:** settled list keeps read/edit primary;
  suggest only in empty/edit setup; recheck progressive when unavailable;
  quieter path/label density; shorter OKF review intro. Further compact
  toolbar / More-menu density polish is optional post-ship residual, not a
  published `2.3.0` claim.
- **Help expansion is in source:** native Help menu / Command Palette → Books
  and knowledge folders…; About/diagnostics derive package version from package
  metadata. Saving or cancelling Book chapter selection restores trigger focus.
  Help documents default-on index cover/contents option and recent-workspace
  book-order retention. User-facing status/dialogs avoid “Book Scope” jargon;
  live book buffers also match open tabs by relative path / NFC.
- Design SoT:
  `docs/superpowers/specs/2026-07-02-v2-book-scope-design.md`.
- Queue: `docs/current-work.md`. Roadmap: `docs/roadmap.md`.
- Advisory review pools (not the active queue):
  `docs/v2-external-review-synthesis-2026-07-18.md` (four-agent),
  `docs/v2-qwen-ux-proposal-synthesis-2026-07-21.md` (Qwen UX triage; L Mode
  corrections; mode pills / static lint / Compare Center held or rejected as designed).

### v1.14 Keep summary (shipped in review candidate)

- Continuity: same-name tabs; Reference retained toggle; recent workspaces;
  shared sticky right-pane header; PDF 150% scroll fix.
- Trust: export path/warnings; Assist lock & not-saved; Import draft status.
- Writing Loop: Preview vs e-book; e-book edit-here; Outline hints + heading Undo.
- OKF: scaffold pre-create list; first-fix open guidance.

### Parked (not main queue)

- Tab overflow; nav history “back”; status TTL; dep cadence.
- Full TestFlight / VoiceOver / narrow / long-doc evidence matrix.
- Theme G signed export recheck breadth.

## Publication (2026-07-24)

- Mac App Store **`2.3.0`** App Review passed and the release was published
  (user-reported). Store notes:
  `docs/releases/2.3.0-app-store-release-notes.md`.
- GitHub source / local-app tag **`v2.3.0`** (source archive only; no binary
  assets). Notes: `docs/releases/2.3.0-source-tag.release.md`. Prior tag
  `v2.0.0` remains immutable (do not move).
- Hotfix discipline: only reproduced daily-use / review blockers on the
  published line. Do not reopen the store lane for polish.

## Verification (2026-07-23, v2.3.0 Book UX + image/export repair)

- Focused image/EPUB slices: 6 files / 122 tests pass, including missed
  intersection fallback, Preview/Reader regression, explicit cover dialog,
  archive contract, and selected-cover file loading.
- Follow-up nested-Preview regressions: focused red tests confirmed both that a
  non-intersecting observer record cancelled the delayed fallback and that a
  same-props React rerender restored the transparent placeholder after a data
  URL had appeared.
- Recent-folder App Sandbox regression: folder history now stores a separate
  security-scoped bookmark per workspace; focused tests cover direct-path
  denial, bookmark resolution, legacy-entry picker reauthorization, and fresh
  bookmark persistence. Local App Store distribution builds signed correctly
  but macOS rejected launching them without a Store receipt, so the final
  interaction remains an installed/TestFlight check.
- `npm run typecheck` — pass.
- `npm test` — 205 files / 1,721 tests pass on tree `2.3.0`.
- `npm run build:vite` — pass (existing large-chunk warning only).
- `npm run smoke:app-store-surface` — 10 files / 111 tests pass.
- `npm run build` — helper-enabled App Store preview `.app` built successfully;
  ad-hoc signed, not notarized and not a submission pkg.
- `npm run build:developer-preview` — pass after the Reader and e-book search
  routing fixes.
  Computer Use confirmed `Command+F` focused **本の中を検索** and Enter moved
  a 43-chapter real manuscript from chapter 1 to chapter 2, including visible
  active-label and manuscript scroll movement. A separate real-document smoke
  confirmed the in-file search moved the e-book right pane to chapter 3 / page
  4, then Reading Focus to the containing spread at page 3 / 5 with both pages
  visible; the Developer preview app was quit after verification.
- Generated covered EPUB — external `epubcheck` 3.3: 0 fatal errors / 0 errors /
  0 warnings.
- Build 107 bundle smoke is invalidated and that pkg remains held. Computer Use
  reproduced its flash-then-blank behavior with the real parent workspace,
  nested `index.md`, and 2.6 MB `images/c00.png`. In the repaired build, Preview
  retained the image after 12 seconds and after close/reopen; e-book page 2
  retained the same image after 10 seconds. Before upload, confirm ignored
  candidate metadata points to a commit containing the later recent-folder
  bookmark repair as well.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` — pass.
- `cargo test --manifest-path src-tauri/Cargo.toml` — 367 pass / 2
  host-dependent ignored.
- `npm audit` / `cargo audit` — not completed in this pass. External advisory
  access was unavailable under the current execution boundary; do not treat
  dependency audit as freshly passed.
- Version surfaces (npm / Tauri / Cargo / lockfiles / living docs alignment
  tests) report `2.3.0`.
- Fresh signed universal App Store pkg candidate for `2.3.0` was recorded in
  `docs/internal/app-store-candidates/latest.json`; signature, entitlements,
  bundled helpers/notices, installer signature, and SHA-256 checks passed.
- Publication of Mac App Store `2.3.0` was later user-reported (2026-07-24).
  This verification section remains pre-publication local evidence.

## Verification (2026-07-22, v2.1.0 candidate base)

- Focused Reader search: 2 files / 10 tests pass; frontmatter exclusion,
  Unicode/case normalization, result filtering/jump, and Escape clear are pinned.
- Focused Preview image hardening: 3 files / 33 tests pass; near-viewport
  deferral, two-read concurrency, consent-specific loaders, failure notes, and
  reserved placeholder height are pinned.
- Previous helper-enabled App Store preview build and fresh signed universal
  pkg for the image-hardened `2.1.0` tree passed deep signature and provenance
  checks on that tree.

## Verification (2026-07-18)

### Book Scope ordered tree + flexible OKF link adapter

- `npm run typecheck` — pass.
- Focused Vitest (Book model/storage/suggestion/panel/controller + EPUB export)
  — 9 files / 88 tests pass.
- `npm test` — 201 files / 1,678 tests pass.
- `npm run build:vite` — pass (existing large-chunk warning only).
- `npm run smoke:app-store-surface` — 10 files / 107 tests pass.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` — pass.
- `cargo test --manifest-path src-tauri/Cargo.toml` — 367 pass / 2
  host-dependent ignored.
- `npm run build` — helper probes and helper-enabled App Store preview build
  pass; bundle reports `2.0.0`.
- `codesign --verify --deep --strict --verbose=2` — pass for the rebuilt app.
- `npm run smoke:fixtures:v1.11-okf` — pinned `ee67a5c` fixture bundles
  generated successfully.
- `SKIP_BUILD=1 npm run smoke:macos-window -- '<built app>'` — pass; the
  rebuilt `2.0.0` app launched, exposed a `1280x820` window, and quit cleanly.
- Automated coverage pins v1 flat-scope migration, bounded tree sanitization,
  same-parent movement, nested index-heading groups, relative/bundle-root link
  adaptation, saved-tree EPUB navigation, included `.md` link rewrites,
  same-chapter cross-page-break anchors, external-link preservation, and
  conservative unknown-fragment fallback.
- Not run: heavy-manuscript export opened/clicked in Apple Books or signed
  TestFlight; keep that as the next proof boundary and do not infer it from the
  disposable fixture below.

### Release-quality disposable export smoke

- A throwaway nested workspace under `/private/tmp` covered Preview headings,
  two local images, root/nested index links, Book Scope save, whole-book Reader,
  and an explicit page-break section without clipping or source mutation.
- The saved five-entry tree showed `Works → One → Chapters` and `Notes`; Reader
  rendered all five entries in order. PDF export produced seven A4 pages; all
  pages were rendered with Poppler for visual review and showed no clipping or
  overlap.
- EPUB export passed `epubcheck` with 0 errors and 0 warnings. Archive inspection
  confirmed two packaged images, saved-tree navigation, spine order, metadata,
  and rewritten relative/bundle-root links. macOS Books displayed the nested
  TOC; `First` → `Second` reached the `Second Section` target in the packaged
  chapter. `pdftotext` was unavailable, so PDF evidence used `pdfinfo` and
  rendered PNG pages.

### Heavy nested-index manuscript adjustment

- `npm run typecheck` — pass.
- `npm test` — 201 files / 1,667 tests pass.
- `npm run build:vite` — pass (existing large-chunk warning only).
- `npm run smoke:app-store-surface` — 10 files / 107 tests pass.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` — pass.
- `cargo test --manifest-path src-tauri/Cargo.toml` — 367 pass / 2
  host-dependent ignored.
- `npm run build` — live helper probes and local ad-hoc App Store preview build
  pass; bundle `2.0.0`, deep/strict code-sign, bundled notices pass.
- Built-app smoke — real manuscript default Suggest reported 43 items (37 body,
  6 root/nested indexes); option-off Suggest returned 37; `log.md` stayed out;
  Cancel used, no scope saved. Reader displayed body without closed leading YAML.
- Whole-book PDF smoke — A4, 289 pages; extracted PDF text contained none of the
  ASCII `type: Chapter`, `description:`, or `tags:` keys. Bundled Poppler lacked
  Japanese font mapping, so signed TestFlight PDF/EPUB visual appearance remains
  unclaimed.

### Help + version 2.0.0 slice

- `npm run typecheck` — pass.
- `npm test` — 201 files / 1,664 tests pass.
- `npm run build:vite` — pass (existing large-chunk warning only).
- `npm run smoke:app-store-surface` — 10 files / 107 tests pass.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` — pass.
- `cargo test --manifest-path src-tauri/Cargo.toml` — 367 pass / 2
  host-dependent ignored.
- `npm audit --audit-level=high` — 0 vulnerabilities.
- `cargo audit --file src-tauri/Cargo.lock` — exit 0; 18 allowed known
  Tauri/Linux and unmaintained transitive warnings, no vulnerability finding.
- `npm run build` — helper live probes and helper-enabled App Store preview
  build pass. Bundle version is `2.0.0`, deep/strict code-sign verification
  passes, and packaged window launch smoke shows an onscreen app window.
- Version surfaces: package.json, package-lock root, tauri.conf.json,
  Cargo.toml, Cargo.lock package; About Help and diagnostics read package
  metadata rather than repeating a separate version literal.
- Tag / App Store pkg / upload **not** performed.

### Prior candidate proof (Book interaction breadth)

- Earlier same-day Book Scope export/reader smoke remains the last direct
  interaction evidence for the multi-file spine. All automated, Rust, audit,
  package, signing, and launch gates above were re-run after the UX review.

## Durable Pins

- Safe Editor primary; Markdown/text source canonical (per file in v2).
- No indexing, auto-apply, auto-save, second editable buffer as default.
- App Store lane: no Agent Workbench / external CLI agent.
- Import Assist: on-device, edit-before-save, no cloud OCR auto-save.
- OKF: explicit, bounded review + explicit scaffold; no auto-repair.
- v2: explicit user-selected Book Scope only; base OKF ≠ Hazakura Book order.
- PDF export path remains direct PDF export (not macOS print UI).

## Next For Agents

1. Hotfix only for reproduced blockers on published `2.3.0`.
2. **v2.4 plan:** `docs/v2.4-plan.md` (planning only until the human opens the
   lane). Recommended first feature slice: **B-1 chapter Diff**. Carry-in
   compact toolbar (C-0) is already on `main` after `v2.3.0`.
3. Do not bump to `2.4.0` or implement B-slices without explicit lane open.
4. Keep Qwen mode pills / static lint / Compare Center and persistent indexing
   out unless product explicitly accepts them.
5. Do not move published tags (`v2.0.0`, `v2.3.0`, …), upload, or attach
   release assets without a separate explicit handoff.
6. On security/path/AI/multi-file surfaces, re-read
   `docs/security-boundary.md` and the v2 design boundary section.

## Key Paths

| Need | Path |
|------|------|
| Next slice | `docs/current-work.md` |
| v2.4 plan | `docs/v2.4-plan.md` |
| Phase / path | `docs/roadmap.md` |
| v2 design | `docs/superpowers/specs/2026-07-02-v2-book-scope-design.md` |
| Status truth | `docs/current-status.md` |
| OKF pin | `docs/okf-spec-pin.md` |
| v2.3 store notes | `docs/releases/2.3.0-app-store-release-notes.md` |
| v2.3 source tag | `docs/releases/2.3.0-source-tag.release.md` |
| v2.0 store notes | `docs/releases/2.0.0-app-store-release-notes.md` |
| v2.0 source tag | `docs/releases/2.0.0-source-tag.release.md` |
| Qwen UX triage | `docs/v2-qwen-ux-proposal-synthesis-2026-07-21.md` |
| Parked refinement | `docs/v1.13-plus-refinement-roadmap.md` |
| Smoke | `docs/smoke-checklist.md` |
| App Store build | `docs/app-store-build.md` |

Local package provenance remains in
`docs/internal/app-store-candidates/latest.json`; do not copy per-build paths or
hashes into this handoff.
