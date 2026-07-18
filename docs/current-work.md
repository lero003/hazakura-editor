# Current Work

Status: Operational
Scope: v2.0.0 source tree; Help + version ship polish in progress
Authority: High
Last reviewed: 2026-07-18 (Help expansion + version 2.0.0)

## Purpose

Start here when choosing the next small `Hazakura Editor` slice.

## Active Phase

**v2.0 source tree is versioned `2.0.0`.** Book Scope Alpha + UX quieting +
in-app Help for books/OKF are in source. Residual polish and broad evidence
remain parked unless a release gate needs them.

- Package/app version in tree: **`2.0.0`**.
- Published Mac App Store (last confirmed): **`1.13.0`**.
- v1.14 (`1.14.0`) may still be in App Store review; this tree version does
  **not** claim tag, upload, or publication for `2.0.0`.
- Plan of record: `docs/roadmap.md`.
- Design SoT: `docs/superpowers/specs/2026-07-02-v2-book-scope-design.md`.
- Store draft: `docs/releases/2.0.0-app-store-release-notes.md`.

## Lane Timeline

| Lane | Status | Notes |
|------|--------|--------|
| **v1.12** | Closed / published `1.12.0` | OKF starter scaffold |
| **v1.13** | Closed / published `1.13.0` | Theme A + Theme G |
| **v1.14** | Submitted (user-reported) | Separate from tree `2.0.0` |
| **v2.0** | **Active source** | Book Scope + Help; version metadata `2.0.0` |
| **縦書き** | After v2 ship foundation | Render / export layer only |

## Active Queue — v2

**Operating rule:** 1 run = 1 verifiable slice. Keep Safe Editor rails.

### Done in source (Alpha + ship polish)

1. Files / Book sidebar, explicit scope, order, unavailable retention.
2. Chapter suggestion draft; whole-book reader; PDF/EPUB + preflight.
   Linked nested indexes now preserve a real five-work manuscript's chapter
   order. An explicit, default-on draft option includes root/nested indexes as
   cover/contents pages; semantic metadata-to-cover/part mapping remains held.
3. UX quieting (read/edit primary; suggest/recheck progressive).
4. **Help:** native Help menu / Command Palette → **Books and knowledge
   folders…** (English Help body; JP/EN/kana labels). About / diagnostics derive
   `2.0.0` from package metadata.
5. **Version surfaces:** npm, Tauri, Cargo, lockfile package version → `2.0.0`.

### Immediate next

1. The local `2.0.0` bundle builds, launches, and passes code-sign verification.
   Run signed App Store / TestFlight Book + Help smoke, including the heavy
   five-work manuscript's PDF/EPUB appearance, if preparing an upload.
2. Human gate: tag `v2.0.0`, build App Store pkg, submit — only with approval.
3. Hotfix only for reproduced review blockers on published/in-review builds.

### Hotfix only (published / in-review)

- Reproduced blocker from App Review, TestFlight, or daily use.
- Do not reopen v1.13/v1.14 for drive-by polish.

## Parked Queues (do not drive the main lane)

- Tab overflow; nav history “back”; status TTL; dep cadence.
- Full TestFlight / VoiceOver / narrow / long-doc evidence matrix.
- Theme G signed export recheck breadth.

## Next Human Gates

1. Apple processing for any in-flight `1.14.0` review — respond only if needed.
2. Decide when to cut `v2.0.0` tag / App Store package (tree is ready for that
   decision; not auto-tagged).
3. Report publication when it happens.
