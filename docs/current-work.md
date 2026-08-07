# Current Work

Status: Operational
Scope: v2.5 active planning — Local Assist conversational edit + polish
Authority: High
Last reviewed: 2026-08-07 (v2.4 closed; v2.5 lane opened in docs)

## Purpose

Start here when choosing the next small `Hazakura Editor` slice.

## Active Phase

**v2.5 is the active product lane.** Primary theme: move Hazakura Local Assist
from single-shot buffer apply to **proposal-first, multi-turn document edit
conversation**, without becoming a general chat or agent.

- Package/app version in tree: **`2.4.0`** (bump to `2.5.0` when opening the
  first implementation slice for the v2.5 store line).
- Published Mac App Store (user direction 2026-08-07): **`2.4.0`** closed line;
  hotfix only for reproduced blockers.
- Plan SoT: `docs/v2.5-plan.md`
- Conversational UX design: `docs/local-assist-conversational-edit-ux.md`
- Assist / Core AI strategy: `docs/assist-surface-strategy.md`

## Lane Timeline

| Lane | Status | Notes |
|------|--------|--------|
| **v2.0–v2.3** | **Shipped** | Book Scope → quality pack → recipe / resume |
| **v2.4** | **Shipped** | OKF v0.2 + chapter Diff + Book depth baseline |
| **v2.5** | **Active** | Local Assist conversational edit + quiet polish |
| **Core AI models** | Later in v2.x / v3 | Allowlisted writing `.aimodel` DL / manage / use |
| **縦書き** | Parked | After AI milestone progress; not v2.5 |
| **anydoc** | Evaluate only | Office→MD import; no product adoption in v2.5 |

## Active Queue — v2.5

### Immediate next (promote one at a time)

1. **A-1 — Proposal-first generation (P1)**
   Split generate from buffer apply. Stream into a Local Assist proposal card.
   Body unchanged until a later explicit apply slice. Design:
   `docs/local-assist-conversational-edit-ux.md` § Implementation Phases.
2. Optional interleave: **R-1 — text reference uses `previewFontSize`**
   CSS / settings wiring only; no new preference control.
3. Then **A-2 → A-3 → A-4** (pin + multi-turn → explicit apply → UI polish).

### Do not start yet

- Core AI download / model catalog (needs **C-0** design spike after A-1–A-3)
- anydoc dependency or Import Assist expansion
- 縦書き
- B-2 display TOC as a parallel main queue (residual only if daily friction)
- Package bump + store upload without human gate

### Hotfix only (published `2.4.0`)

- Reproduced blocker from App Review, TestFlight, or daily use.
- Do not reopen `2.4.0` for drive-by polish.

## Parked Queues (do not drive the main lane)

- 縦書き (after Local Assist depth + horizontal foundation stay stable).
- anydoc / broad Office import (investigation memo only until demand).
- Editable display TOC (X-5); first-run coach (Q-2); tab overflow; full a11y matrix.
- Compare Center; static lint; mode-pill rainbow.

## Next Human Gates

1. Confirm first implementation slice is **A-1** (or R-1 if only polish is wanted).
2. When opening implementation: bump package surfaces to `2.5.0` in the same
   coherent slice family, not as a drive-by alone.
3. Do not move published tags or attach binary assets without explicit handoff.
