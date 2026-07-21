# Current Work

Status: Operational
Scope: v2.1.0 whole-book search candidate after published v2.0.0
Authority: High
Last reviewed: 2026-07-22 (v2.1.0 local candidate; manual gate pending)

## Purpose

Start here when choosing the next small `Hazakura Editor` slice.

## Active Phase

**v2.0.0 is shipped and immutable. v2.1.0 is the active local candidate.**
The first post-ship practicalization slice is bounded whole-book Reader search;
other advisory items remain parked.

- Package/app version in tree: **`2.1.0`**.
- Published Mac App Store (last confirmed): **`2.0.0`** (user-reported
  2026-07-21).
- GitHub source / local-app tag: **`v2.0.0`** (no binary assets).
- Plan of record: `docs/roadmap.md`.
- Design SoT: `docs/superpowers/specs/2026-07-02-v2-book-scope-design.md`.
- External review pools (advisory; not this queue):
  `docs/v2-external-review-synthesis-2026-07-18.md` (four-agent),
  `docs/v2-qwen-ux-proposal-synthesis-2026-07-21.md` (Qwen UX triage).
- Candidate notes: `docs/releases/2.1.0-app-store-release-notes.md`.
- Published store notes: `docs/releases/2.0.0-app-store-release-notes.md`.

## Lane Timeline

| Lane | Status | Notes |
|------|--------|--------|
| **v1.12** | Closed / published `1.12.0` | OKF starter scaffold |
| **v1.13** | Closed / published `1.13.0` | Theme A + Theme G |
| **v1.14** | Source tag `v1.14.0`; store superseded by `2.0.0` | Intermediate Keep box |
| **v2.0** | **Shipped** MAS + source tag `2.0.0` | Book Scope + Help |
| **v2.1** | **Local candidate** | Bounded in-book Reader search |
| **v2.x** | Later slices | Practicalization candidates (not auto-queue) |
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
7. **v2.1 bounded Reader search:** the explicit whole-book Reader searches only
   its already loaded chapter names and visible Markdown (100 chapters / 32 MiB
   existing load budget), including unsaved live buffers. Results show chapter
   and occurrence counts and jump through the existing contents navigation.
   Search creates no persistent index, background scan, or source change.
8. **Version surfaces:** npm, Tauri, Cargo, and lockfile package version are
   `2.1.0`; published store and latest source tag remain `2.0.0` / `v2.0.0`.

### Current stop — v2.1 manual installed gate

1. **Local gates complete:** source tests, App Store surface, signed universal
   bundle/pkg, payload metadata/entitlements, checksum, and ignored provenance
   all pass for the `2.1.0` candidate sourced from the pushed commit.
2. **Stop before upload/publication.** Human gate: install the signed candidate and
   check Japanese input, result counts, chapter jump, Escape, narrow layout,
   VoiceOver labels, ordinary Reader scroll/edit return, and local images.
3. Fix only blockers found by those gates. Do not add another advisory feature
   to `2.1.0`; mode pills, static lint, Compare Center, persistent indexing,
   and source rewrite remain out.

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
2. Run the `2.1.0` installed/TestFlight manual gate described above.
3. Upload, TestFlight distribution, tag, App Review, and publication require a
   separate explicit handoff; none is implied by local package proof.
