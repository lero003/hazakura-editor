# Current Work

Status: Operational
Scope: v2.6 source-candidate release prep — Local Assist two-region UX
Authority: High
Last reviewed: 2026-08-27 (C-0 pre-development lock; 2.6.2 local candidate; physical Assist pending)

## Purpose

Start here when choosing the next small `Hazakura Editor` slice.

## Active Phase

**v2.6 A-1–A-4 source implementation is merged on `main`.** The conversation pins the
target, keeps generation and proposal state separate from the editor buffer, and
allows only explicit Diff apply through stale revalidation and one reviewed
buffer write; the same proposal is not surfaced in a second Review Bar. The A-4 finishing slice keeps
the conversation and Diff regions distinct at narrow widths without changing
that mutation boundary. It also exposes Diff column semantics, separates
cancellation feedback from failure, and shows an honest availability-probe
state. Source review is complete; physical macOS validation is the next gate.

- Package/app version in tree: **`2.6.2`**. This is the next local candidate
  after merged `2.6.0` A-1–A-4 source work, 2.6.1 theme/Preview polish, and
  the right-pane ownership fix (参照中の「確認」で差分を出す). It is not yet
  a source tag, upload, review, or publication claim. Local source gates
  and a What's New draft are prepared with this pass; a TestFlight-shaped
  `.pkg` is a separate local candidate action. Provenance is in ignored
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
| **v2.6** | **A-1–A-4 source candidate merged** | Conversation + one explicit Diff apply + stale revalidation + no duplicate post-apply review; physical Assist gate remains |
| **Core AI models** | Later in v2.x / v3 | Allowlisted writing `.aimodel` DL / manage / use |
| **縦書き** | Parked | After AI milestone progress; not v2.6 |
| **anydoc** | Evaluate only | Office→MD import; no product adoption in v2.6 |

## Active Queue — v2.6

### Immediate next

1. **v2.6 physical Assist gate.** On the current merged build, verify narrow
   Diff, keyboard/focus order, VoiceOver (including streaming summary), locale,
   streaming/cancel, and real model availability on the detached window.
   A Local Assist prompt + visibility polish is merged (revision-packet
   de-duplication, Japanese framing, preamble stripping, and a raw growing-draft
   stream preview); rebuild the live Swift helper before the physical gate so
   the prompt change is observable. **B2 is also merged:** the unapplied-proposal
   Diff review and Apply/Discard now live in the MAIN window (a large
   editor-font `LocalAssistProposalReview` panel), while the detached window
   keeps only the conversation, growing-draft preview, and Cancel. The proposal
   is held in a new session-local store separate from `AiEditTransaction`;
   `applyReviewedLocalAssistProposal` is the single apply path.
2. Local source gates, App Store What's New draft, and a TestFlight-shaped
   `.pkg` are recorded. Decide the source tag / App Store Connect upload only
   with an explicit publication approval. Do not treat the local `.pkg` as
   uploaded.
3. Keep the three non-blocking A-3 hardening items separate: completion-time
   target text revalidation, Diff failure/no-op Apply gating, and an Apply status
   watchdog. They do not change the A-3 mutation boundary.
4. C-0 is locked. Do not start C-1 until identity + D25 manifest + D19
   delivery. Do not start C-2 until D24/D20. Do not mix either into the v2.6
   apply boundary. U-\* / H-1 / G-1 may proceed on the System path.

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
- v2.6 publication actions (source tag, App Store Connect upload, App Review,
  GitHub Release) until an explicit release decision; do not mix them into
  mutation-boundary work
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
- Reference の行番号表示サイズ（本文に対して大きく見えるという観察）。v2.5
  の対象外とし、将来の Reference 表示ポリッシュで本文とのスケール関係と
  読みやすさを再評価する。

## Next Human Gates

1. Run and record the v2.6 detached-window physical gate. The live helper on
   this host already answered available; that is not the UI gate.
2. Decide on source tagging and App Store Connect upload only with an explicit
   publication approval. Use `docs/releases/2.6.2-app-store-release-notes.md`
   as the What's New draft.
3. Keep v2.5 closed; any second package rebuild or publication needs a new
   explicit release gate.
