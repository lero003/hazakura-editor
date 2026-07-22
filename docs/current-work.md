# Current Work

Status: Operational
Scope: v2.2.0 quality pack local candidate (pre-submission)
Authority: High
Last reviewed: 2026-07-22 (v2.2.0 local candidate; v2.0.0 published)

## Purpose

Start here when choosing the next small `Hazakura Editor` slice.

## Active Phase

**v2.0.0 is shipped and immutable. v2.2.0 is the active local candidate.**
v2.1 Reader search + Preview image hardening is folded into this package as
baseline. The v2.2 pack is quality improvements excluding 縦書き, aimed at the
App Store submission approach.

- Package/app version in tree: **`2.2.0`**.
- Published Mac App Store (last confirmed): **`2.0.0`** (user-reported
  2026-07-21).
- GitHub source / local-app tag: **`v2.0.0`** (no binary assets).
- Plan of record: `docs/roadmap.md`.
- Design SoT: `docs/superpowers/specs/2026-07-02-v2-book-scope-design.md`.
- External review pools (advisory; not this queue):
  `docs/v2-external-review-synthesis-2026-07-18.md` (four-agent),
  `docs/v2-qwen-ux-proposal-synthesis-2026-07-21.md` (Qwen UX triage).
- Candidate notes: `docs/releases/2.2.0-app-store-release-notes.md`.
- Prior candidate notes: `docs/releases/2.1.0-app-store-release-notes.md`.
- Published store notes: `docs/releases/2.0.0-app-store-release-notes.md`.

## Lane Timeline

| Lane | Status | Notes |
|------|--------|--------|
| **v1.12** | Closed / published `1.12.0` | OKF starter scaffold |
| **v1.13** | Closed / published `1.13.0` | Theme A + Theme G |
| **v1.14** | Source tag `v1.14.0`; store superseded by `2.0.0` | Intermediate Keep box |
| **v2.0** | **Shipped** MAS + source tag `2.0.0` | Book Scope + Help |
| **v2.1** | Folded into `2.2.0` candidate | Reader search + Preview image-load hardening |
| **v2.2** | **Local candidate / pre-submission** | Quality pack (no 縦書き) |
| **v2.x** | Later slices | Further practicalization as needed |
| **縦書き** | After v2.x foundation | Render / export layer only |

## Active Queue — v2.2 quality pack

**Operating rule:** 1 run = 1 verifiable slice. Keep Safe Editor rails.

### Done in source (this candidate)

1. **v2.1 baseline:** bounded whole-book Reader search; Preview near-viewport
   image loading with two concurrent reads per pane.
2. **Reader chapter navigation (X-2 / Q-9):** sticky current-chapter label,
   previous/next chapter controls, active contents highlight.
3. **Book empty-state honesty (N-4 / X-7 / Q-5):** app-private chapter-order
   storage disclosure (not folder order, not OKF book order).
4. **Export completion UX (Q-3):** reveal finished PDF / EPUB / HTML in Finder;
   clearer whole-book export progress status strings.
5. **Export preflight fix hints (X-6 / Q-7):** issue lines include a short next
   action without page-count theater.
6. **Local Assist honesty (X-9 / Q-1):** unavailable reasons on the chrome
   button title and Preferences status (no static lint).
7. **Help:** Books and knowledge folders documents Reader nav/search and export
   Finder reveal.
8. **Version surfaces:** npm, Tauri, Cargo, lockfiles → `2.2.0`.

### Current stop — v2.2 manual / packaging gate

1. Run full TypeScript + Rust gates and App Store surface smoke on tree
   `2.2.0`.
2. Build a fresh signed universal App Store pkg when ready; record provenance
   in ignored `docs/internal/app-store-candidates/`.
3. **Human installed / TestFlight gate** (Japanese input, Reader nav/search,
   export reveal, Assist unavailable honesty, image-heavy Preview).
4. Upload, tag, App Review, and publication require a **separate explicit
   handoff**. Do not claim them from local proof alone.
5. Do **not** add 縦書き, mode pills, static lint, Compare Center, persistent
   indexing, or source rewrite into this candidate.

### Hotfix only (published `2.0.0`)

- Reproduced blocker from App Review, TestFlight, or daily use.
- Do not reopen intermediate tags for drive-by polish.

## Parked Queues (do not drive the main lane)

- Tab overflow; nav history “back”; status TTL; dep cadence.
- Full TestFlight / VoiceOver / narrow / long-doc evidence matrix.
- Theme G signed export recheck breadth.
- Portable Book recipe export/import (X-3); chapter-level Diff (X-4).
- Reading-position persistence across relaunch (optional later).
- Setext heading / reference-style link / future OKF manifest adaptation, only
  when a pinned spec or real fixture demonstrates the need.
- 縦書き (after horizontal Book stability).

## Next Human Gates

1. Published `2.0.0` is closed unless a hotfix is needed.
2. Complete local gates + signed pkg for `2.2.0`.
3. Run the installed/TestFlight manual gate in the release notes.
4. Only then: upload / TestFlight / App Review / tag (explicit handoff).
