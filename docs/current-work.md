# Current Work

Status: Operational
Scope: v2.5 active implementation — resizable workspace + clarity polish
Authority: High
Last reviewed: 2026-08-09 (signed v2.5 candidate prepared; upload remains gated)

## Purpose

Start here when choosing the next small `Hazakura Editor` slice.

## Active Phase

**v2.5 is the active product lane.** Primary theme: make the three-pane Safe
Editor workspace adjustable and persistent, then close small clarity gaps around
references, bounded trees, Book setup, and export completion.

- Package/app version in tree: **`2.5.0`** development line.
- Published Mac App Store (user direction 2026-08-07): **`2.4.0`** closed line;
  hotfix only for reproduced blockers.
- Plan SoT: `docs/v2.5-plan.md`
- Conversational Assist design remains a later-line SoT:
  `docs/local-assist-conversational-edit-ux.md`
- Assist / Core AI strategy: `docs/assist-surface-strategy.md`

## Lane Timeline

| Lane | Status | Notes |
|------|--------|--------|
| **v2.0–v2.3** | **Shipped** | Book Scope → quality pack → recipe / resume |
| **v2.4** | **Shipped** | OKF v0.2 + chapter Diff + Book depth baseline |
| **v2.5** | **Active** | Resizable workspace + bounded clarity polish |
| **Core AI models** | Later in v2.x / v3 | Allowlisted writing `.aimodel` DL / manage / use |
| **縦書き** | Parked | After AI milestone progress; not v2.5 |
| **anydoc** | Evaluate only | Office→MD import; no product adoption in v2.5 |

## Active Queue — v2.5

### Immediate next

1. Review the v2.5 implementation through its Draft PR and keep CI green.
2. With explicit human approval, upload the signed 2.5.0 candidate to App Store
   Connect and wait for Apple processing.
3. Install the processed TestFlight build and run the remaining manual checks,
   including Reference font-size extremes and representative workspace layouts.

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

- A-1–A-4 conversational Local Assist; moved to a later line by user direction
- Core AI download / model catalog (needs **C-0** design spike after Assist depth)
- anydoc dependency or Import Assist expansion
- 縦書き
- B-2 display TOC as a parallel main queue (residual only if daily friction)
- A second package build, upload, or publication without a new human gate

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

1. Upload the existing clean-source signed candidate only after explicit approval;
   do not rebuild it just to change tracked wording.
2. Keep Apple processing and installed TestFlight smoke separate from local proof.
3. Tag and publication remain explicit human gates.
