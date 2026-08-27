# Current Work

Status: Operational
Scope: v2.6.2 App Store published — U-1 writing-companion
Authority: High
Last reviewed: 2026-08-28 (2.6.2 Mac App Store published, staged rollout; next is U-1 conversational proofread on Apple Intelligence)

## Purpose

Start here when choosing the next small `Hazakura Editor` slice.

## Active Phase

**v2.6 A-1–A-4 source implementation is merged on `main`.** The conversation pins the
target, keeps generation and proposal state separate from the editor buffer, and
allows only explicit Diff apply through stale revalidation and one reviewed
buffer write; the same proposal is not surfaced in a second Review Bar. The A-4 finishing slice keeps
the conversation and Diff regions distinct at narrow widths without changing
that mutation boundary.

- Package/app version in tree: **`2.6.2`**. User-confirmed **Mac App Store
  publication** on 2026-08-28; rollout to all users is staged over time.
  This is not a GitHub source tag or a claim that every install already has
  `2.6.2`. Local pkg provenance is in ignored
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
- Published Mac App Store (user-confirmed 2026-08-28): **`2.6.2`** closed
  line; hotfix only for reproduced blockers. Prior store baseline `2.4.0`
  remains historical.
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
| **v2.6** | **Mac App Store published** | Conversation + explicit Diff apply; `2.6.2` published 2026-08-28; staged rollout; GitHub source tag pending |
| **Core AI models** | Later in v2.x / v3 | Allowlisted writing `.aimodel` DL / manage / use |
| **縦書き** | Parked | After AI milestone progress; not v2.6 |
| **anydoc** | Evaluate only | Office→MD import; no product adoption in v2.6 |

## Active Queue — v2.6

### Immediate next

Owner direction 2026-08-28: **ヘルパーで会話し、対象とローカルモデルを指定し、
確認してから反映する。** Apple Intelligence でその体験を先に厚くする。
`.aimodel` DL はその後。ツールコールとクラウドモデル店はしない。
いまはローカルのみ。Web 検索は将来の任意。Apply 境界は凍結。

1. **U-1 — composer-first の校正会話。** 分離窓を「対象チップ（選択 /
   ファイル / 見出し）+ 作成中の案 + 短い追加指示」にする。プリセット
   集合は変えない。Core AI を待たない。
2. **U-3 — メイン Diff を読みの確認面に**（U-1 と並列可）。変更の一文は
   当面行カウント。G-1 後に補助の `changeSummary` へ。
3. **U-4 — モデル正体チップ。** いまは Apple Intelligence 表示。DL と
   利用選択の正本はのちの管理ページ（C-1 / C-2）。ヘルパーからの切替は
   C-2 の利便ショートカット。
4. **H-1 — System helper 土台。** `SystemLanguageModel` のまま model 再利用。
   Core AI import なし。ユーザー向け DL ではない。
5. **G-1 — 構造化校正出力**（Depends: H-1）。本文 + 変更の一文。Diff が正本。
6. **U-5「整える」チップは後回し**（U-1 に混ぜない）。
7. **C-1 HOLD** until a production `.aimodel` identity plus D25/D19.
   管理ページで DL / 容量 / 削除。**C-2 HOLD** until D24/D20。そこで
   利用選択（`selectedId`）とヘルパーからの利便切替を載せる。

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
- v2.6 source tag / GitHub Release until an explicit publication approval
- Claiming every Mac App Store user already has `2.6.2` while rollout is staged
- anydoc dependency or Import Assist expansion
- 縦書き
- B-2 display TOC as a parallel main queue (residual only if daily friction)
- A second package rebuild, upload, or publication without a new human gate

### Closed v2.5 line

- v2.5 is released and closed. Do not rebuild, upload, or reopen it as part of
  v2.6 work; only a separately reproduced blocker can justify a hotfix lane.

### Hotfix only (published `2.6.2`)

- Reproduced blocker from App Review, TestFlight, or daily use.
- Do not reopen `2.6.2` for drive-by polish.

## Parked Queues (do not drive the main lane)

- Unselected adjacent review-pool items remain advisory; do not bulk-promote.
- 縦書き (after Local Assist depth + horizontal foundation stay stable).
- anydoc / broad Office import (investigation memo only until demand).
- Editable display TOC (X-5); first-run coach (Q-2); tab overflow; full a11y matrix.
- Compare Center; static lint; mode-pill rainbow.
- Optional web search from Local Assist (future; local-only remains current).
- Reference の行番号は本文より小さいガター扱い（`--cm-gutter-*`）にした。
  残る観察があれば将来の Reference 表示ポリッシュで再評価する。

## Next Human Gates

1. Pick the first Core AI production model identity before starting C-1.
   Until then, U-\* / H-1 / G-1 may proceed on `SystemLanguageModel`.
2. Source tag / GitHub Release only with an explicit publication approval.
   Do not treat staged Mac App Store rollout as a 100% install-base claim.
3. Keep v2.5 closed; published `2.6.2` remains hotfix-only.
