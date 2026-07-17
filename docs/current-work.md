# Current Work

Status: Operational
Scope: v1.14 local candidate boxed; residual refinement after Keep set
Authority: High
Last reviewed: 2026-07-18 (v1.14.0 source candidate; store still 1.13.0)

## Purpose

Start here when choosing the next small `Hazakura Editor` slice.

## Lane Timeline (read first)

| Lane | Status | Notes |
|------|--------|--------|
| **v1.12** | **Closed / published as `1.12.0`** | OKF starter scaffold + rolled v1.9–v1.11. Source tag `v1.12.0`. |
| **v1.13** | **Closed / published as `1.13.0`** | Theme A interaction clarity + Theme G media. Do not reopen without hotfix. |
| **v1.14** | **Local source candidate (`1.14.0`)** | Continuity / Trust / Writing Loop / OKF depth Keeps boxed. Draft notes: `docs/releases/1.14.0-app-store-release-notes.md`. **Not published / not tagged / not submitted.** |
| **v1.14 residual** | Open after candidate cut | Deferred polish + distribution evidence only; not a second feature train. |
| **v2** | Later | multi-file Book Scope, then 縦書き. Needs v2 entry gate. |

Earlier closed lanes (v1.5–v1.11) remain historical; see `docs/current-status.md`
and `docs/releases/`.

Package/app version in tree is **`1.14.0`**. Published Mac App Store version
is **`1.13.0`**. Connect is authoritative for store counters.

## v1.14 Candidate Box (source Keep set)

Direction: `docs/v1.13-plus-refinement-roadmap.md`.
Release-note draft: `docs/releases/1.14.0-app-store-release-notes.md`.

Treat the following as **one shipping box** for a future store/TestFlight
candidate. Do not reopen for drive-by expansion without a reproduced friction
or explicit decision.

### Continuity

- Same-name open text tabs show parent folder (presentation only).
- Reference loaded-but-hidden: retained toggle visual + a11y name.
- Start Panel: up to five recent workspaces (explicit open; no auto-scan).
- Shared right-pane header (Preview / e-book / Outline / Diff / Reference):
  short purpose, sticky chrome, Reference path hover; Diff header close clears
  compare then hides column.
- PDF Reference 150%: one scroll container; mouse wheel pans vertically first
  and continues horizontally at the vertical edge; trackpad two-axis input stays
  native.

### Trust

- PDF / HTML export success keeps destination path and image warnings (no 2s clear on PDF success).
- Local Assist lock reason + resume; review bar / applied status “not saved yet”.
- Import Assist success stresses unsaved draft / no disk write until save.

### Writing Loop

- Preview vs e-book short purpose contrast.
- E-book always-visible “この位置を編集 / Edit this place”.
- Outline structure advisories as hints; heading-level edit status with Cmd+Z.

### Structure / OKF (bounded)

- Scaffold pre-create descriptions (files written; no auto-repair).
- OKF review “まずここを直す” for first required finding (open only).

### Verification claim strength

- Slice-level focused tests + typecheck on the landing commits.
- **Not claimed:** full packaged smoke matrix, signed TestFlight, spoken
  VoiceOver, narrow-window tab truncation proof.

## Active Queue — after the v1.14 box

**Operating rule unchanged:** 1 run = 1 hypothesis. Prefer residual polish or
evidence over inventing a mandatory `v1.15` feature list.

### Residual (safe, deferred)

- Tab overflow layout
- Navigation history “back” affordance (needs small design contract)
- Global status-message lifetime unification (partially covered by export Keep)
- Dependency cadence (keep `@codemirror/view` **6.43.2** pin)

### Distribution confidence (evidence, not features)

- TestFlight / IME / VoiceOver speech / narrow window / Reduce Motion
- Theme G signed export recheck + pin-to-assets Undo breadth (carry-over)
- App Store vs Developer lane sanity before any submit

### Hard stop / design-first

- whole-workspace Quick Open, shared analysis caches, shell rewrites
- Book Scope, 縦書き, auto-repair, indexing, Git / LSP / terminal / plugins

Hard rails and v2 entry gate: `docs/v1.13-plus-refinement-roadmap.md`.

## Closed Queues (do not reopen without hotfix)

| Lane | Note |
|------|------|
| v1.13 | Published `1.13.0` — Theme A + Theme G |
| v1.12 | Published `1.12.0` — OKF scaffold |
| v1.11–v1.8 | Rolled or published history; contracts stay closed |

## Next Human Gates (v1.14 candidate)

1. Hands-on / packaged smoke of the Keep set (`docs/smoke-checklist.md`).
2. Local candidate package when ready (see `docs/app-store-build.md`).
3. Explicit approval before upload, TestFlight, App Review, or source tag.
4. After ship (or explicit drop): residual queue only, or next Keep box.
