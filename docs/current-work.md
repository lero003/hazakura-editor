# Current Work

Status: Operational
Scope: v2.3.0 Book portability + Reader resume local candidate
Authority: High
Last reviewed: 2026-07-23 (v2.3.0 local candidate; v2.0.0 published)

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
| **v2.3** | **Local candidate** | Portable recipe + Reader resume + image/export repair |
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
4. **Preview image fallback:** permitted document-relative images still load
   through the bounded two-read queue when nested WKWebView Preview reports
   only an initial non-intersecting record and no usable intersection. A false
   record no longer disables the fallback. Once loaded, the data URL is
   committed back to Preview state and the transparent placeholder's native
   lazy flag is removed, so a later React paint cannot make the image flash and
   disappear. Workspace containment and source stay unchanged.
5. **Explicit EPUB cover:** the export dialog can optionally select one local
   PNG/JPEG/GIF/WebP image for that export only. The archive marks it as the
   EPUB cover image and emits a cover page; it is never inferred from the first
   Markdown image and is not saved into source or Book settings.
6. **Recent folder sandbox restore:** each newly opened recent workspace keeps
   its own security-scoped bookmark. Reopen tries the stored path first, then
   that folder's bookmark. Legacy or stale entries fall back once to the normal
   folder picker instead of leaving a raw `Operation not permitted` error.
7. **Reader search shortcut/navigation:** while the whole-book Reader is open,
   `Command+F` targets its bounded search instead of the hidden editor search.
   Enter / Shift+Enter advances through matching chapters with wraparound.
8. **e-book find-result sync:** the existing in-file `Command+F` result now
   moves both the right-pane e-book reader and Reading Focus to the containing
   chapter/page. Spread mode aligns the result to its containing two-page view.

### Current stop

1. Local source gates and built-app smoke are green after the nested-Preview
   and recent-folder repairs. Before upload, confirm the selected pkg's ignored
   candidate metadata points to a commit containing both fixes.
2. A parent workspace with a nested Markdown file and 2.6 MB document-relative
   PNG stayed visible in Preview after 12 seconds and after Preview reopen; its
   e-book image page also stayed visible after 10 seconds. Replace the pkg
   candidate before upload. Installed/TestFlight and the selected EPUB cover in
   Apple Books remain human-only gates.
3. Do not add cover cropping/editing, 縦書き, Compare Center, static lint, or
   auto-load recipes.
4. Recent-folder bookmark logic is source/build verified. Final App Sandbox
   interaction remains an installed/TestFlight gate because locally generated
   App Store distribution bundles cannot be launched without a Store receipt.

### Parked

- Chapter-level Diff (X-4); editable display TOC (X-5); first-run coach (Q-2).
- Tab overflow; full a11y matrix; 縦書き.
