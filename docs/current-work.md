# Current Work

Status: Operational
Scope: v2.3.0 Book portability + Reader resume local candidate
Authority: High
Last reviewed: 2026-07-22 (v2.3.0 local candidate; v2.0.0 published)

## Purpose

Start here when choosing the next small `Hazakura Editor` slice.

## Active Phase

**v2.0.0 is shipped and immutable. v2.3.0 is the active local candidate.**
It folds v2.1–v2.2 quality into the tree and adds two larger Book UX slices
from the v2.x practicalization pool (excluding 縦書き).

- Package/app version in tree: **`2.3.0`**.
- Published Mac App Store (last confirmed): **`2.0.0`**.
- GitHub source / local-app tag: **`v2.0.0`** (no binary assets).
- Candidate notes: `docs/releases/2.3.0-app-store-release-notes.md`.
- Queue design pools: `docs/v2-external-review-synthesis-2026-07-18.md` (X-2/X-3).

## Lane Timeline

| Lane | Status | Notes |
|------|--------|--------|
| **v2.0** | **Shipped** | Book Scope Alpha |
| **v2.1–v2.2** | Folded into `2.3.0` | Search, image load, quality pack |
| **v2.3** | **Local candidate** | Portable Book recipe + Reader resume |
| **縦書き** | Later | After horizontal foundation |

## Active Queue — v2.3

### Done in source

1. **Portable Book recipe (X-3):** explicit export/import of relative-path JSON
   (`hazakura-book-recipe` v1). Import is always an editable draft until Save.
   Never auto-loaded; not an OKF claim.
2. **Reader reading position (X-2 rest):** app-private per-workspace chapter +
   scroll ratio resume for whole-book Reader (max 8 workspaces).
3. Prior v2.1–v2.2 quality remains in tree (search, chapter nav, export reveal,
   Assist honesty, preflight hints).

### Current stop

1. Full local gates green on tree `2.3.0`.
2. Fresh signed universal pkg + installed/TestFlight manual gate (human).
3. Do not add 縦書き, Compare Center, static lint, or auto-load recipes.

### Parked

- Chapter-level Diff (X-4); editable display TOC (X-5); first-run coach (Q-2).
- Tab overflow; full a11y matrix; 縦書き.
