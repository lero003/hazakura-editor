# Current Work

Status: Operational
Scope: v2.4 active — OKF v0.2 compatibility + chapter Diff
Authority: High
Last reviewed: 2026-07-28 (v2.4 lane opened; OKF v0.2 + B-1 implemented)

## Purpose

Start here when choosing the next small `Hazakura Editor` slice.

## Active Phase

**v2.4 is the active development lane.** Its first completed compatibility
slice pins OKF v0.2 while retaining best-effort v0.1 reads. B-1 adds explicit
per-chapter buffer-vs-disk review through the existing Diff surface. Neither
slice rewrites source, adds background indexing, or executes attestation data.

- Package/app version in tree: **`2.4.0`**.
- Published Mac App Store (last confirmed): **`2.3.0`** (user-reported
  2026-07-24).
- GitHub source / local-app tag: **`v2.3.0`** (no binary assets). Prior
  checkpoint `v2.0.0` remains immutable.
- Store notes: `docs/releases/2.3.0-app-store-release-notes.md`.
- Source tag notes: `docs/releases/2.3.0-source-tag.release.md`.
- v2.4 store-copy draft: `docs/releases/2.4.0-app-store-release-notes.md`
  (development only; not publication evidence).
- Queue design pools (advisory): `docs/v2-external-review-synthesis-2026-07-18.md`,
  `docs/v2-qwen-ux-proposal-synthesis-2026-07-21.md`.

## Lane Timeline

| Lane | Status | Notes |
|------|--------|--------|
| **v2.0** | **Shipped** | Book Scope Alpha; source tag `v2.0.0` |
| **v2.1–v2.2** | Folded into published `2.3.0` | Search, image load, quality pack |
| **v2.3** | **Shipped** MAS + source tag `2.3.0` | Portable recipe + Reader resume + image/export repair |
| **v2.4** | **Active** | OKF v0.2 compatibility + compact toolbar + B-1 chapter Diff |
| **縦書き** | Later | After horizontal foundation |

## Active Queue — v2.4

### Completed in the active tree

1. **OKF v0.2 compatibility:** pin `3fcbb9f…`; recognize v0.2 optional
   trust/lifecycle/attestation families as inert data; retain best-effort v0.1,
   legacy `timestamp`, and `# Citations`; scaffolds now emit 0.2 without
   invented provenance.
2. **C-0 compact Book toolbar:** carried into the 2.4 development line from
   post-tag `main`.
3. **B-1 chapter Diff:** available Book rows can explicitly review the live
   editor buffer against that chapter on disk. Existing dirty tabs win; unopened
   chapters use the normal tab-open path. Unavailable rows stay disabled.

### Shipped in `2.3.0` (closed)

1. **Portable Book recipe (X-3):** explicit export/import of relative-path JSON
   (`hazakura-book-recipe` v1). Import is always an editable draft until Save.
   Never auto-loaded; not an OKF claim.
2. **Reader reading position (X-2 rest):** app-private per-workspace chapter +
   scroll ratio resume for whole-book Reader (max 8 workspaces).
3. Prior v2.1–v2.2 quality (search, chapter nav, export reveal, Assist honesty,
   preflight hints).
4. **Preview image fallback** for nested WKWebView non-intersection + data-URL
   commit so images do not flash-then-blank.
5. **Explicit EPUB cover** selection per export (no first-image inference).
6. **Recent folder sandbox restore** via per-workspace security-scoped bookmark.
7. **Reader search shortcut/navigation** (`Command+F` / Enter while Reader open).
8. **e-book find-result sync** into right-pane e-book and Reading Focus.

### Immediate next

1. Complete local automated gates and the focused Book/OKF manual smoke before
   preparing any candidate.
2. After B-1 is accepted, promote at most one next v2.4 slice from
   `docs/v2.4-plan.md`; B-2 display TOC contract is the next candidate.
3. Do not add cover cropping/editing, 縦書き, Compare Center, static lint, or
   auto-load recipes.
4. Do not move published tags (`v2.0.0`, `v2.3.0`, …) or attach binary assets
   without a separate explicit handoff.

### Hotfix only (published `2.3.0`)

- Reproduced blocker from App Review, TestFlight, or daily use.
- Do not reopen `2.0.0` / intermediate lines for drive-by polish.

## Parked Queues (do not drive the main lane)

- Editable display TOC (X-5); first-run coach (Q-2).
- Tab overflow; full a11y matrix; bulk external-review backlog digestion.
- 縦書き (after horizontal foundation stays stable).

## Next Human Gates

1. Published store + source tag `2.3.0` remain closed unless a hotfix is needed.
2. Run packaged/manual Book and OKF smoke; this source work does not prove
   signing, upload, TestFlight, App Review, or publication.
3. Decide whether B-2 is promoted only after the current slice is verified.
