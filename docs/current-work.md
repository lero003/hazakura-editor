# Current Work

Status: Operational
Scope: Post-v2.0.0 ship; next slices after published Book Scope Alpha
Authority: High
Last reviewed: 2026-07-21 (MAS 2.0.0 published; source tag v2.0.0)

## Purpose

Start here when choosing the next small `Hazakura Editor` slice.

## Active Phase

**v2.0.0 is shipped.** Book Scope Alpha + UX quieting + Help are in the
published Mac App Store line and the GitHub source tag `v2.0.0`. Residual
polish and broad evidence remain parked unless a release gate needs them.

- Package/app version in tree: **`2.0.0`**.
- Published Mac App Store (last confirmed): **`2.0.0`** (user-reported
  2026-07-21).
- GitHub source / local-app tag: **`v2.0.0`** (no binary assets).
- Plan of record: `docs/roadmap.md`.
- Design SoT: `docs/superpowers/specs/2026-07-02-v2-book-scope-design.md`.
- External review pools (advisory; not this queue):
  `docs/v2-external-review-synthesis-2026-07-18.md` (four-agent),
  `docs/v2-qwen-ux-proposal-synthesis-2026-07-21.md` (Qwen UX triage).
- Store notes: `docs/releases/2.0.0-app-store-release-notes.md`.

## Lane Timeline

| Lane | Status | Notes |
|------|--------|--------|
| **v1.12** | Closed / published `1.12.0` | OKF starter scaffold |
| **v1.13** | Closed / published `1.13.0` | Theme A + Theme G |
| **v1.14** | Source tag `v1.14.0`; store superseded by `2.0.0` | Intermediate Keep box |
| **v2.0** | **Shipped** MAS + source tag `2.0.0` | Book Scope + Help |
| **v2.x** | Next product phase | Practicalization candidates (not auto-queue) |
| **縦書き** | After v2.x foundation | Render / export layer only |

## Active Queue — v2

**Operating rule:** 1 run = 1 verifiable slice. Keep Safe Editor rails.

### Done in source (Alpha + ship polish)

1. Files / Book sidebar, explicit scope, app-private ordered tree, quiet group
   labels, same-parent reordering, legacy flat-scope migration, unavailable
   retention.
2. Chapter suggestion draft; whole-book reader; PDF/EPUB + preflight.
   Linked nested indexes now preserve a real five-work manuscript's chapter
   order. An explicit, default-on draft option includes root/nested indexes as
   cover/contents pages. The bounded OKF adapter turns index headings and safe
   relative / bundle-root links into a draft tree; saving remains explicit and
   the saved tree contains no OKF version/type. Whole-book EPUB now uses that
   saved tree for navigation and rewrites links between included Markdown
   chapters to packaged XHTML targets; semantic metadata-to-cover/part mapping
   remains held.
3. UX quieting (read/edit primary; suggest/recheck progressive).
4. **Help:** native Help menu / Command Palette → **Books and knowledge
   folders…** (English Help body; JP/EN/kana labels). About / diagnostics derive
   `2.0.0` from package metadata. Help now documents the default-on
   index-as-cover/contents option and app-private recent-workspace retention.
5. **Version surfaces:** npm, Tauri, Cargo, lockfile package version → `2.0.0`.
6. **Pre-manual-test polish:** user-facing “Book Scope” jargon quieted in
   status / Reader kicker / EPUB dialog / scaffold hints; live dirty buffers
   match tabs by relative path and Unicode NFC as well as absolute path.

### Immediate next

1. **Hotfix only** for reproduced blockers on published `2.0.0` (App Review,
   TestFlight, or daily use). Do not reopen closed store lanes for polish.
2. Pick **one** post-ship slice when ready — prefer honesty / friction over
   backlog digestion:
   - packaging residual evidence (heavy-manuscript PDF/EPUB visual, Book
     VoiceOver minimum) if a real gap appears;
   - one item from the advisory pools (`v2-external-review-synthesis` N/X/E or
     `v2-qwen-ux-proposal-synthesis` Q-1–Q-5);
   - or a parked residual only when daily friction reproduces.
3. Do **not** start a rigid v2.1 train from external proposals. Promote one
   candidate into this queue at a time.

### Hotfix only (published `2.0.0`)

- Reproduced blocker from App Review, TestFlight, or daily use.
- Do not reopen `1.13` / intermediate `1.14` for drive-by polish.

## Parked Queues (do not drive the main lane)

- Tab overflow; nav history “back”; status TTL; dep cadence.
- Full TestFlight / VoiceOver / narrow / long-doc evidence matrix.
- Theme G signed export recheck breadth.
- Setext heading / reference-style link / future OKF manifest adaptation, only
  when a pinned spec or real fixture demonstrates the need.

## Next Human Gates

1. Published `2.0.0` is closed unless a hotfix is needed.
2. Optional: deepen distribution evidence (signed heavy-manuscript appearance,
   Book-critical a11y) without reopening the shipped feature set.
3. Choose the first **v2.x** practicalization slice only when product direction
   is clear — not as auto-catch-up of review pools.
