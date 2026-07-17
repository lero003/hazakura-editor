# Current Work

Status: Operational
Scope: v2 development phase; v1.14 in App Store review
Authority: High
Last reviewed: 2026-07-18 (v2 active; residual/evidence parked)

## Purpose

Start here when choosing the next small `Hazakura Editor` slice.

## Active Phase

**v2 Book Scope development is open.**

- v1.8–v1.12 bridge is complete enough to start multi-file work.
- v1.14 (`1.14.0`) is **submitted** for App Store review (user-reported).
  Early look OK. Publication is not claimed here until confirmed.
- Residual polish, broad evidence matrix, and optional `v1.15+` Keep boxes
  are **parked** — touch only for reproduced bugs or explicit release needs.
- Multi-file / OKF **value copy and Help expansion** are **v2 ship polish**,
  not a pre-coding essay gate. Prefer shipping a good feel, then explain it
  in Help (and other feature docs) when v2 is ready to put in front of users.

Plan of record: `docs/roadmap.md`.
Design SoT: `docs/superpowers/specs/2026-07-02-v2-book-scope-design.md`.

## Lane Timeline

| Lane | Status | Notes |
|------|--------|--------|
| **v1.12** | Closed / published `1.12.0` | OKF starter scaffold |
| **v1.13** | Closed / published `1.13.0` | Theme A + Theme G |
| **v1.14** | **In App Store review** | Tagged `v1.14.0` / submitted (user-reported). Hotfix only if review or usage blocks. |
| **v1.14 residual / evidence** | **Parked** | Not the main queue |
| **v1.15+** | Parked optional boxes | Only if enough unrelated Keeps justify a ship label |
| **v2.0** | **Active** | Book Scope Alpha + OKF multi-file feel |
| **v2 ship polish** | Later in v2 | Help expansion + feature explanations when feel is ready |
| **縦書き** | After Book Scope foundation | Render / export layer only |

Package/app version in tree: **`1.14.0`**.
Published Mac App Store (last confirmed here): **`1.13.0`**.
Connect is authoritative for store counters.

## Active Queue — v2

**Operating rule:** 1 run = 1 verifiable slice. Keep Safe Editor rails
(`docs/security-boundary.md`, design SoT boundary section).

### First Alpha spine — source implemented

1. **Done in source:** existing-left-sidebar `ファイル / 本` direction and
   short implementation contract in the design SoT.
2. **Done in source:** explicit bounded Markdown selection, app-private
   workspace scope persistence, unavailable-entry retention, no background scan.
3. **Done in source:** manual chapter order and chapter switching through the
   existing one-primary-edit-buffer / dirty-tab / Undo path.

### Immediate next

1. **OKF multi-file daily feel** — deepen review / scaffold / navigation only
   where it makes the folder-as-book loop trustworthy. Pin:
   `docs/okf-spec-pin.md`. Keep base OKF ≠ Hazakura Book semantics.
2. **Whole-book reading** over the explicit scope (export when the slice needs
   it — not a forced Alpha checklist item).
3. Observe the first Alpha sidebar in built-app use; adjust only reproduced
   selection/order/navigation friction before widening the surface.

### At v2 ship (not now)

- Expand **Help** for Book Scope / OKF multi-file and other under-explained
  features.
- Align store / release copy with implemented behavior.
- Prefer Help + short UI purpose text over pre-dev value essays.

### Hotfix only (v1.14 / published)

- Reproduced blocker from App Review, TestFlight, or daily use.
- Do not reopen v1.13/v1.14 for drive-by polish.

## Parked Queues (do not drive the main lane)

### Residual polish

- Tab overflow layout
- Navigation history “back” affordance
- Global status-message lifetime unification
- Dependency cadence (`@codemirror/view` **6.43.2** pin)

### Distribution evidence

- Full TestFlight / IME / VoiceOver / narrow / Reduce Motion matrix
- Theme G signed export recheck + pin-to-assets Undo breadth

### Optional theme experiments

Theme pools remain in `docs/v1.13-plus-refinement-roadmap.md` for later Keep
boxes. They are **not** a pre-v2 train.

## Closed Queues (no reopen without hotfix)

| Lane | Note |
|------|------|
| v1.13 | Published `1.13.0` |
| v1.12 | Published `1.12.0` |
| v1.11–v1.8 | Contracts stay closed |

## v1.14 Keep Box (reference only)

Inventory and store copy:

- `docs/releases/1.14.0-app-store-release-notes.md`
- Continuity / Trust / Writing Loop / OKF depth Keeps (see prior notes in
  git history / release notes). Do not expand this box unless a review
  blocker forces a patch decision.

## Next Human Gates

1. Apple processing / App Review for `1.14.0` — respond only if needed.
2. Report publication when it happens (do not assume from submission).
3. Product decisions during v2: first UI direction, scope of first Alpha cut,
   when Help polish is “good enough to ship.”
