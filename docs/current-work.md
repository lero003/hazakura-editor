# Current Work

Status: Operational
Scope: v2.6 active planning — Local Assist conversation + Diff review
Authority: High
Last reviewed: 2026-08-16 (v2.5 candidate preserved; v2.6 design opened)

## Purpose

Start here when choosing the next small `Hazakura Editor` slice.

## Active Phase

**v2.6 planning is the active product lane.** Primary theme: separate Local
Assist's conversation area from a Diff review area where the current unapplied
proposal is inspected, discarded, or explicitly applied.

- Package/app version in tree: **`2.5.0`**. Bump to `2.6.0` with the first v2.6
  implementation slice, not as a docs-only drive-by.
- Prepared v2.5 candidate: clean source commit **`6067fbec`**; upload,
  processing, TestFlight, tag, and publication remain separate human gates.
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
| **v2.5** | **Candidate prepared** | Resizable workspace + bounded clarity polish; Apple gates remain |
| **v2.6** | **Active planning** | Local Assist conversation + separate Diff review |
| **Core AI models** | Later in v2.x / v3 | Allowlisted writing `.aimodel` DL / manage / use |
| **縦書き** | Parked | After AI milestone progress; not v2.6 |
| **anydoc** | Evaluate only | Office→MD import; no product adoption in v2.6 |

## Active Queue — v2.6

### Immediate next

1. **A-1 — Proposal generation + Diff review.** Split generation from buffer
   mutation. Stream the current unapplied proposal into a dedicated Diff review
   area; keep the editor buffer unchanged; allow discard; retain presets.
2. After A-1, promote only one of A-2 → A-4 at a time from `docs/v2.6-plan.md`.
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

- A-2–A-4 before A-1 is independently verified
- Core AI download / model catalog (needs **C-0** design spike after A-3)
- anydoc dependency or Import Assist expansion
- 縦書き
- B-2 display TOC as a parallel main queue (residual only if daily friction)
- A second package build, upload, or publication without a new human gate

### Separate v2.5 release gates

- Review the prepared v2.5 source/candidate evidence through its Draft PR.
- Upload the existing signed 2.5.0 candidate only with explicit human approval.
- Keep Apple processing and installed TestFlight smoke separate from local proof
  and from v2.6 development.

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

1. Confirm A-1 is the first implementation slice and bump package surfaces to
   `2.6.0` in that coherent code slice.
2. Upload the existing clean-source v2.5 candidate only after explicit approval;
   do not rebuild it just to include v2.6 docs or work.
3. TestFlight, tag, and publication remain explicit human gates.
