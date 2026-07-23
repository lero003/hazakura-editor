# Current Work

Status: Operational
Scope: Post-v2.3.0 ship; v2.4 plan ready (not yet active queue)
Authority: High
Last reviewed: 2026-07-24 (MAS 2.3.0 published; v2.4 plan drafted)

## Purpose

Start here when choosing the next small `Hazakura Editor` slice.

## Active Phase

**v2.3.0 is shipped** on the Mac App Store (user-reported 2026-07-24) and as
GitHub source tag **`v2.3.0`** (no binary assets). It folds v2.1–v2.2 quality
into the store line and adds portable Book recipe + whole-book Reader resume
(excluding 縦書き). Residual polish and broad evidence stay parked unless
friction or a release gate needs them.

- Package/app version in tree: **`2.3.0`** (matches published store line).
- Published Mac App Store (last confirmed): **`2.3.0`** (user-reported
  2026-07-24).
- GitHub source / local-app tag: **`v2.3.0`** (no binary assets). Prior
  checkpoint `v2.0.0` remains immutable.
- Store notes: `docs/releases/2.3.0-app-store-release-notes.md`.
- Source tag notes: `docs/releases/2.3.0-source-tag.release.md`.
- Queue design pools (advisory): `docs/v2-external-review-synthesis-2026-07-18.md`,
  `docs/v2-qwen-ux-proposal-synthesis-2026-07-21.md`.

## Lane Timeline

| Lane | Status | Notes |
|------|--------|--------|
| **v2.0** | **Shipped** | Book Scope Alpha; source tag `v2.0.0` |
| **v2.1–v2.2** | Folded into published `2.3.0` | Search, image load, quality pack |
| **v2.3** | **Shipped** MAS + source tag `2.3.0` | Portable recipe + Reader resume + image/export repair |
| **v2.4** | **Plan ready** | Book depth (chapter Diff / TOC / explainability); see `docs/v2.4-plan.md` |
| **縦書き** | Later | After horizontal foundation |

## Active Queue — post-v2.3

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

1. **Hotfix only** for reproduced blockers on published `2.3.0` (App Review,
   TestFlight, or daily use). Do not reopen closed store lanes for polish.
2. **v2.4 plan is drafted** at `docs/v2.4-plan.md` (planning only). Do not
   bump to `2.4.0` or promote B-slices until the human opens the lane.
3. On `main` after tag: compact Book toolbar (C-0) is already landed; fold it
   into the v2.4 store line when that line opens (do not move `v2.3.0`).
4. Optional pre-lane: packaging residual evidence or one honesty friction item
   only if daily use reproduces a gap — not bulk review-pool digestion.
5. Do not add cover cropping/editing, 縦書き, Compare Center, static lint, or
   auto-load recipes.
6. Do not move published tags (`v2.0.0`, `v2.3.0`, …) or attach binary assets
   without a separate explicit handoff.

### Hotfix only (published `2.3.0`)

- Reproduced blocker from App Review, TestFlight, or daily use.
- Do not reopen `2.0.0` / intermediate lines for drive-by polish.

## Parked Queues (do not drive the main lane)

- Chapter-level Diff (X-4); editable display TOC (X-5); first-run coach (Q-2).
- Tab overflow; full a11y matrix; bulk external-review backlog digestion.
- 縦書き (after horizontal foundation stays stable).

## Next Human Gates

1. Published store + source tag `2.3.0` are closed unless a hotfix is needed.
2. Optional: deepen distribution evidence without reopening the shipped feature set.
3. When ready to open **v2.4**: confirm first slice in `docs/v2.4-plan.md`
   (recommended **B-1** chapter Diff), bump package surfaces to `2.4.0`, and
   promote only that one slice into this Active Queue.
