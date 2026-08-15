# Current Work

Status: Operational
Scope: v2.6 post-A-1 narrow Diff polish — Local Assist proposal + Diff review
Authority: High
Last reviewed: 2026-08-16 (v2.6 A-1 merged; narrow Diff polish in progress)

## Purpose

Start here when choosing the next small `Hazakura Editor` slice.

## Active Phase

**v2.6 post-A-1 polish is the active product lane.** Primary theme: keep Local
Assist's conversation area separate from a Diff review area where the current
unapplied proposal is inspected, discarded, or explicitly applied later.

- Package/app version in tree: **`2.6.0`**. A-1 is merged; the current branch
  carries the next narrow Diff layout polish slice and is not a publication claim.
- Released v2.5.0: clean implementation boundary **`6067fbec`**; the v2.5
  product line is closed and must not be rebuilt for v2.6 work.
- Published Mac App Store: **`2.5.0`** (user-confirmed); hotfix only for a
  reproduced blocker.
- Plan SoT: `docs/v2.6-plan.md`
- Conversational Assist design: `docs/local-assist-conversational-edit-ux.md`
- Assist / Core AI strategy: `docs/assist-surface-strategy.md`

## Lane Timeline

| Lane | Status | Notes |
|------|--------|--------|
| **v2.0–v2.3** | **Shipped** | Book Scope → quality pack → recipe / resume |
| **v2.4** | **Shipped** | OKF v0.2 + chapter Diff + Book depth baseline |
| **v2.5** | **Shipped / closed** | Resizable workspace + bounded clarity polish |
| **v2.6** | **A-4 narrow polish** | A-1 merged; bounded Diff layout follow-up is in progress |
| **Core AI models** | Later in v2.x / v3 | Allowlisted writing `.aimodel` DL / manage / use |
| **縦書き** | Parked | After AI milestone progress; not v2.6 |
| **anydoc** | Evaluate only | Office→MD import; no product adoption in v2.6 |

## Active Queue — v2.6

### Immediate next

1. **A-4 narrow Diff polish.** Keep the two-region review usable at the compact
   detached-window width without changing conversation, target, or apply scope.
2. After this slice is reviewed, promote only one of A-2 or A-3 at a time from
   `docs/v2.6-plan.md`.
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

- A-2 pinned target / multi-turn and A-3 explicit apply before the narrow polish
  slice is independently reviewed
- Core AI download / model catalog (needs **C-0** design spike after A-3)
- anydoc dependency or Import Assist expansion
- 縦書き
- B-2 display TOC as a parallel main queue (residual only if daily friction)
- A second package build, upload, or publication without a new human gate

### Closed v2.5 line

- v2.5.0 is released and closed. Do not rebuild, upload, or reopen its release
  lane as part of v2.6 development.
- Reopen only for a reproduced release blocker with an explicit hotfix decision.

### Hotfix only (released `2.5.0`)

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

1. Complete external review of the narrow Diff polish while preserving the
   merged A-1 buffer / transaction boundary.
2. Promote A-2 target pinning or A-3 explicit apply only after a separate slice
   decision; do not combine them.
3. Keep v2.5.0 closed and separate from all v2.6 source work.
