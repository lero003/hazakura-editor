# Current Work

Status: Operational
Scope: v2.6 TestFlight (user-confirmed) — Core AI / writing-companion
Authority: High
Last reviewed: 2026-08-28 (2.6.2 TestFlight user-confirmed; App Review / store publication pending; C-0 lock)

## Purpose

Start here when choosing the next small `Hazakura Editor` slice.

## Active Phase

**v2.6 A-1–A-4 source implementation is merged on `main`.** The conversation pins the
target, keeps generation and proposal state separate from the editor buffer, and
allows only explicit Diff apply through stale revalidation and one reviewed
buffer write; the same proposal is not surfaced in a second Review Bar. The A-4 finishing slice keeps
the conversation and Diff regions distinct at narrow widths without changing
that mutation boundary.

- Package/app version in tree: **`2.6.2`**. User-confirmed **TestFlight
  internal distribution** on 2026-08-28. This is not an App Review result,
  Mac App Store publication, source tag, or GitHub Release. Published store
  remains **`2.4.0`**. Local pkg provenance is in ignored
  `docs/internal/app-store-candidates/latest.json`.
- Local checkpoint: A-2 is committed as `9011d3a6`, A-3 is complete through
  `c7ff442b`, and A-4 finishing is merged on `main` at `b40bd217`. The 2.6.1
  code candidate is `6ff22dad`. `2.6.2` is the pane-ownership candidate on
  this worktree. The review branch was deleted after merge.
  Release notes: `docs/releases/2.6.2-source-tag.release.md`,
  `docs/releases/2.6.2-app-store-release-notes.md`,
  `docs/releases/2.6.1-source-tag.release.md`,
  `docs/releases/2.6.0-source-tag.release.md`.
- v2.5 is **released and closed** (user-confirmed). Do not reopen its release
  gates from this development lane.
- Published Mac App Store (user direction 2026-08-07): **`2.4.0`** closed line;
  hotfix only for reproduced blockers.
- Plan SoT: `docs/v2.6-plan.md`
- Conversational Assist design: `docs/local-assist-conversational-edit-ux.md`
- Assist / Core AI strategy: `docs/assist-surface-strategy.md`
- **C-0 design spike (pre-development lock):** `docs/core-ai-c0-design.md`.
  Advisory reviews: `docs/core-ai-c0-external-review-2026-08-27.md`.
  Gate: **U-\* / H-1 / G-1 = GO.** **C-1 HOLD** until identity + expanded
  `resourceManifest` + Background Assets/AOT delivery lock. **C-2 HOLD** until
  backend-specific availability and Rust-owned `selectedId`. Do not touch Apply.
  Owner 2026-08-27: 本番モデル identity は未決。「整える」は U-5 後回し。
  App Store での allowlist オンデバイス DL は許可（開示正本を同時更新）。
  大きい級はコード予約・UI 非表示。Goal に「Notion AI 級」と書かない。

## Lane Timeline

| Lane | Status | Notes |
|------|--------|--------|
| **v2.0–v2.3** | **Shipped** | Book Scope → quality pack → recipe / resume |
| **v2.4** | **Shipped** | OKF v0.2 + chapter Diff + Book depth baseline |
| **v2.5** | **Released / closed** | Resizable workspace + bounded clarity polish; no active release gate |
| **v2.6** | **TestFlight (user-confirmed)** | Conversation + explicit Diff apply; 2.6.2 on TestFlight 2026-08-28; App Review / store publication pending |
| **Core AI models** | Later in v2.x / v3 | Allowlisted writing `.aimodel` DL / manage / use |
| **縦書き** | Parked | After AI milestone progress; not v2.6 |
| **anydoc** | Evaluate only | Office→MD import; no product adoption in v2.6 |

## Active Queue — v2.6

### Immediate next

1. **Writing-companion UI / System helper (U-\* / H-1 / G-1 = GO).** Do not
   wait for Core AI download. Keep the v2.6 apply boundary frozen.
2. **C-1 HOLD** until the owner picks a production model identity plus D25
   `resourceManifest` and D19 delivery (Background Assets / AOT). **C-2 HOLD**
   until D24/D20. Do not start either as v2.6 apply work.
3. **2.6.2 App Review / store publication** wait for Apple's result. Do not
   write “審査通過” or store publication until confirmed. Source tag and
   GitHub Release still need an explicit publication approval.
4. Keep the three non-blocking A-3 hardening items separate: completion-time
   target text revalidation, Diff failure/no-op Apply gating, and an Apply
   status watchdog. They do not change the A-3 mutation boundary.

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

- Core AI download / model catalog (**C-1**; C-0 is locked in
  `docs/core-ai-c0-design.md`. Needs a production identity plus D25/D19.
  Not v2.6 apply work)
- Claiming 2.6.2 App Review passed or Mac App Store publication until the
  user confirms the Apple result
- v2.6 source tag / GitHub Release until an explicit publication approval
- anydoc dependency or Import Assist expansion
- 縦書き
- B-2 display TOC as a parallel main queue (residual only if daily friction)
- A second package rebuild, upload, or publication without a new human gate

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
- Reference の行番号は本文より小さいガター扱い（`--cm-gutter-*`）にした。
  残る観察があれば将来の Reference 表示ポリッシュで再評価する。

## Next Human Gates

1. Record the App Review / store-publication result for `2.6.2` when Apple
   returns it. TestFlight is already user-confirmed; do not infer Review.
2. Pick the first Core AI production model identity before starting C-1.
   Until then, U-\* / H-1 / G-1 may proceed on `SystemLanguageModel`.
3. Source tag / GitHub Release only with an explicit publication approval.
4. Keep v2.5 closed; published `2.4.0` remains hotfix-only.
