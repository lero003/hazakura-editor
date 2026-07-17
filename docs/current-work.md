# Current Work

Status: Operational
Scope: v1.14+ try-and-error refinement (after published v1.13)
Authority: High
Last reviewed: 2026-07-18 (v1.13 Mac App Store published; open v1.14+)

## Purpose

Start here when choosing the next small `Hazakura Editor` slice.

## Lane Timeline (read first)

| Lane | Status | Notes |
|------|--------|--------|
| **v1.5** | **Closed / released as `1.5.0`** | Stabilization + reading polish. **Released before 江戸彼岸 (edohigan) was merged.** Do not reopen unless hotfix. |
| **Post-v1.5 main (not v1.5)** | Merged after v1.5 release | 江戸彼岸 theme; CodeMirror `@codemirror/view` **6.43.2** pin + editor display quality (syntax-tree recompute, resize remeasure, fold gutter removed). |
| **v1.6** | **Closed / published as `1.6.0`** | Import Assist Phase 1 + edohigan + quality packs. **App Review passed without issues (2026-07-10).** Boundary: `docs/archive/reviews/import-assist-boundary-review-v1.6.md`. Release notes: `docs/releases/1.6.0-app-store-release-notes.md`. Do not reopen unless hotfix. |
| **v1.7** | **Closed / published as `1.7.0`** | Reference Compare plus trust / daily-use hardening. App Review passed and the release was published (user-reported 2026-07-12). Do not reopen without a reproduced hotfix. |
| **v1.8** | **Closed / published as `1.8.0`** | Daily Trust Completion. App Review passed and the release was published (user-reported 2026-07-14, build `89`). Release notes: `docs/releases/1.8.0-app-store-release-notes.md`. |
| **v1.9** | **Source complete / rolled into `1.12.0`** | W1–W4 organize Preview / Reference / e-book / Outline / Diff / L Mode around `書く・読む・確かめる`. |
| **v1.10** | **Source complete / rolled into `1.12.0`** | Shared parsing, Outline hierarchy/page-breaks, non-blocking advice, one Undo-able heading-level edit. |
| **v1.11** | **Source complete / rolled into `1.12.0`** | Explicit, bounded, read-only OKF v0.1 Draft compatibility review. Contract: `docs/v1.11-okf-draft-preview-design.md`. |
| **v1.12** | **Closed / published as `1.12.0`** | OKF starter scaffold (minimal + book-like). GitHub source tag `v1.12.0`. Mac App Store App Review passed and the release was published (user-reported 2026-07-17). Contract: `docs/v1.12-okf-scaffold-design.md`. Release notes: `docs/releases/1.12.0-app-store-release-notes.md`. Do not reopen without a reproduced hotfix. |
| **v1.13** | **Closed / published as `1.13.0`** | Theme A interaction clarity + Theme G bounded media access/export. App Review passed and the release was published (user-reported 2026-07-18). Release notes: `docs/releases/1.13.0-app-store-release-notes.md`. |
| **v1.14+** | **Active — try-and-error refinement** | One hypothesis per run, keep/drop with evidence. Next themes: Continuity, Writing Loop, Trust edges, Structure/OKF depth, and distribution confidence. Plan: `docs/v1.13-plus-refinement-roadmap.md`. |
| **v2** | Later | Full multi-file Book Scope and Hazakura-defined book semantics, then 縦書き. Not started by experiment alone. |

Package/app version in tree is **`1.14.0`** (post-v1.13 development
line). The published Mac App Store version is **`1.13.0`**. See
`current-status.md` for lane truth; treat Connect as authoritative for store
counters.

## Active Queue — v1.14+ Refinement (try-and-error)

Direction: `docs/v1.13-plus-refinement-roadmap.md`.

**Operating rule:** 1 run = 1 hypothesis. Observe → revalidate live source →
slice → try → prove → **Keep / Iterate / Revert**. Do not batch a theme into
one giant PR. Version numbers are shipping boxes for Keep results, not a fixed
feature promise. Published tags and the shipped `1.13.0` store lane are
immutable; hotfix only with a reproduced blocker and explicit decision.

### Suggested first experiments (bias only)

Theme A — Signal & Silence (`docs/v1.13-interaction-clarity-plan.md`):

1. **Command availability** and localized disabled reasons. **Keep** (model +
   palette guard + save/export/close/OKF preconditions; pathless disk review
   needs save-first reason; empty PDF export allowed when a tab is open).
2. Honest Quick Open scope/truncation copy; no background index. **Keep**
   (loaded-tree scope hint; partial tree + first-100 result cap copy; no
   whole-workspace index).
3. Search-result open status localization. **Keep** (`openedSearchMatchStatus`
   en/ja/kana with path:line intact).
4. Quick Settings popover/dialog semantics and focus return. **Keep**
   (`role="dialog"`, Escape/outside close, focus return to trigger).
5. Non-blank delayed loading feedback for Preview / e-book. **Keep**
   (`DelayedLoadingFallback` ~180ms; polite status; no flash on fast loads).
6. Progressive disclosure for OKF starters in the New surface. **Keep**
   (file/folder primary; OKF under labeled group; keyboard menuitem order
   preserved).
7. Exact destructive target and disabled reason for Workspace Trash. **Keep**
   (name in label/title; distinct no-active vs not-in-tree reasons).
8. Settings dialog density balance. **Keep** (four sections use a desktop 2×2
   grid and collapse to one column on narrow windows; setting semantics and
   order remain unchanged).

After the first Keep (or a hands-on friction that hurts more), you may jump to
another theme instead of finishing the list:

- **Continuity** — recents, same-name tabs, Reference retained state
- **Writing Loop** — purpose vocabulary, Preview vs e-book copy (no shell rewrite)
- **Trust edges** — export result clarity, Assist lock wording
- **Media boundaries** — Plan: `docs/v1.xx-image-media-boundary-plan.md`.
  **M0–M4 Keep** (honest blocks; outside-local ask/allow without remembered
  folders; remote Pref default
  Off https-only; export materialize default On; palette pin to assets + Undo).
  Manual smoke: `docs/smoke-checklist.md` § Theme G. Built-app ask/allow and
  remote-Off branching passed. TestFlight build 97 found PDF-first-image and
  EPUB-image packaging regressions; both are fixed in source, with fresh local
  app proof for a visible PDF cover and byte-identical packaged EPUB resource.
  Signed TestFlight export recheck and pin-to-assets Undo remain device breadth.
- **v1.13 closure** — Theme A and Theme G shipped in `1.13.0`; do not reopen
  them without a reproduced regression. Continue with one hypothesis from
  Continuity, Writing Loop, Trust edges, Structure / OKF depth, or distribution
  confidence.
- **Continuity / same-name tabs** — **Keep in source.** When two open text tabs
  share a filename, each tab and close action adds its immediate parent folder
  as a quiet disambiguator. Unique names stay unchanged; full paths remain in
  the title. Narrow-window visual truncation remains packaged/manual evidence.
- **Trust / export destination clarity** — **Keep in source.** Successful PDF
  export status includes the destination path (and image-warning count when
  needed) and no longer auto-clears after 2s. HTML export reports image
  warnings the same way EPUB already did. Localized ja copy keeps the path.
- **Trust / Assist lock wording** — **Keep in source.** Generation lock status
  uses an English key with Japanese localization; the overlay explains that
  editing resumes after generation. The Local Assist review bar shows a
  visible “not saved yet” note; applied status localization repeats it.
- **Continuity / Reference retained state** — **Keep in source.** When a
  Reference session is loaded but the column is hidden, the Reference toggle
  shows a retained visual (accent ring + dot), `data-retained`, and an
  accessible name that matches the “show again” title. Close still ends the
  session; hide via other panes still keeps it.
- **Continuity / recent workspaces** — **Keep in source.** Start Panel lists up
  to five recent workspace folders from existing localStorage recents
  (explicit open only; no auto-scan). Last-folder resume stays primary; that
  path is omitted from the list. Same-name folders disambiguate via parent.
- **Writing Loop / Preview vs e-book** — **Keep in source.** Toggle titles,
  empty states, and a short purpose note contrast continuous-scroll Preview
  with paged e-book reading. No shell rewrite.
- **Writing Loop / e-book → edit** — **Keep in source.** Always-visible
  “この位置を編集 / Edit this place” in the e-book status chrome focuses the
  editor at the current reader location (side pane and Reading Focus exit).
- **Theme A / status lifetime** — partially covered by export destination
  Keep (success no longer auto-clears). Global status TTL unification remains
  optional polish, not a separate ship box yet.
- **Structure / OKF template pre-create copy** — **Keep in source.** Palette
  descriptions and New-menu titles list which files each starter writes and
  that auto-repair is not included.
- **Structure / OKF first-fix guidance** — **Keep in source.** When required
  findings exist, the review panel shows a “まずここを直す” card for the first
  required finding with open-to-edit only (no auto-repair).
- **Outline advice / Undo** — **Keep in source.** Structure advisories read as
  hints (not errors); heading level promote/demote sets a status with Cmd+Z
  Undo guidance.
- **Import Assist draft status** — **Keep in source.** Success status stresses
  unsaved draft / edit-before-save and that nothing is written to disk yet.
- **Continuity / right-pane shared header** — **Keep in source.** Thin
  `RightPaneHeader` + pure header model. Short purpose lines, sticky/solid
  chrome, reference shows `filename · read-only` with full path on hover.
  Header close on Diff also clears the compare result. Easy to restyle or drop.
- **Structure / OKF depth** — first-run guidance, template preview (still bounded)
- **Distribution confidence** — TestFlight / VoiceOver / long-doc evidence

Hard rails and v2 entry gate: `docs/v1.13-plus-refinement-roadmap.md`.

## Closed Queue — v1.12 OKF Starter Scaffold

Goal was: 明示操作で、OKF v0.1 Draft 互換の「よくある Markdown 群」を
workspace 内にひな形として置く。A minimal / B book-like。
Shipped in published `1.12.0`. Source: `docs/v1.12-okf-scaffold-design.md`.
Do not reopen without a reproduced hotfix.
