# Current Work

Status: Operational
Scope: v2.6 A-2 implementation review — Local Assist pinned multi-turn revision
Authority: High
Last reviewed: 2026-08-16 (v2.6 A-2 review candidate; v2.5 release closed)

## Purpose

Start here when choosing the next small `Hazakura Editor` slice.

## Active Phase

**v2.6 A-2 implementation is the active product lane.** A-1 is merged. The current
slice pins the first target (tab/session/range/original), keeps follow-up requests
on that target, and revises the current unapplied proposal in the same Diff review.

- Package/app version in tree: **`2.6.0`**. A-2 is a review candidate; it is not
  a release or App Store claim.
- v2.5 is **released and closed** (user-confirmed). Do not reopen its release
  gates from this development lane.
- Published Mac App Store (user direction 2026-08-07): **`2.4.0`** closed line;
  hotfix only for reproduced blockers.
- Plan SoT: `docs/v2.6-plan.md`
- Conversational Assist design: `docs/local-assist-conversational-edit-ux.md`
- Assist / Core AI strategy: `docs/assist-surface-strategy.md`

## Lane Timeline

| Lane | Status | Notes |
|------|--------|--------|
| **v2.0–v2.3** | **Shipped** | Book Scope → quality pack → recipe / resume |
| **v2.4** | **Shipped** | OKF v0.2 + chapter Diff + Book depth baseline |
| **v2.5** | **Released / closed** | Resizable workspace + bounded clarity polish; no active release gate |
| **v2.6** | **A-2 review candidate** | Pinned target + multi-turn proposal revision; external review pending |
| **Core AI models** | Later in v2.x / v3 | Allowlisted writing `.aimodel` DL / manage / use |
| **縦書き** | Parked | After AI milestone progress; not v2.6 |
| **anydoc** | Evaluate only | Office→MD import; no product adoption in v2.6 |

## Active Queue — v2.6

### Immediate next

1. **A-2 external review.** The implementation pins tab/session/range/original on
   the first request, sends follow-up instructions against the current proposal,
   bounds recent request history, and keeps the editor buffer and transaction
   store unchanged.
2. After review, promote A-3 (explicit Diff apply) as the next implementation
   slice. A-4 remains a separate narrow-layout Draft PR (#34).
3. Keep Core AI as a later backend lane after A-3; do not combine model catalog
   work with the conversation/Diff migration.

### Completed in v2.5 development

- **R-1 — text reference uses `previewFontSize`**: text Reference now follows
  the existing Preview font-size setting through `--preview-font-size`. No new
  preference control; PDF/image Reference is unchanged.
- **W-1 — persistent three-pane workspace**: left Workspace width is newly
  adjustable; normal right pane and Reference widths now persist separately.
- **Q-4 — exact tree cap notice**: backend reports the number hidden by each
  per-folder cap; the UI says “他 N 件”.
- **Q-3 / Q-5 — verified existing**: export progress/Finder reveal and the
  app-private-vs-OKF Book empty-state explanation already meet the accepted scope.
- **Q-13 — measured no-op**: Preview/e-book are already lazy chunks; no split
  is added without a measured launch bottleneck.

### Do not start yet

- A-3 explicit apply before A-2 external review is complete
- Core AI download / model catalog (needs **C-0** design spike after A-3)
- A-4 layout polish in the A-2 branch (the separate Draft PR remains isolated)
- anydoc dependency or Import Assist expansion
- 縦書き
- B-2 display TOC as a parallel main queue (residual only if daily friction)
- A second package build, upload, or publication without a new human gate

### Closed v2.5 line

- v2.5 is released and closed. Do not rebuild, upload, or reopen it as part of
  v2.6 work; only a separately reproduced blocker can justify a hotfix lane.

### Hotfix only (published `2.4.0`)

- Reproduced blocker from App Review, TestFlight, or daily use.
- Do not reopen `2.4.0` for drive-by polish.

## Parked Queues (do not drive the main lane)

- Unselected adjacent review-pool items remain advisory; do not bulk-promote.
- 縦書き (after Local Assist depth + horizontal foundation stay stable).
- anydoc / broad Office import (investigation memo only until demand).
- Editable display TOC (X-5); first-run coach (Q-2); tab overflow; full a11y matrix.
- Compare Center; static lint; mode-pill rainbow.
- Reference の行番号表示サイズ（本文に対して大きく見えるという観察）。v2.5
  の対象外とし、将来の Reference 表示ポリッシュで本文とのスケール関係と
  読みやすさを再評価する。

## Next Human Gates

1. Complete external review of A-2 and confirm pinned-target, multi-turn, and
   no-buffer-mutation boundaries.
2. Decide whether to start A-3 explicit apply after the A-2 review.
3. Keep v2.5 closed; any future package or publication work needs a new explicit
   release gate.
