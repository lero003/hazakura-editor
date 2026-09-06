# Current Work

Status: Operational
Scope: v2.8.0 release candidate; v2.7 candidate preserved
Authority: High
Last reviewed: 2026-09-07 (v2.8 release preparation)

## Purpose

Start here when choosing the next small `Hazakura Editor` slice.

## PR #40 — merged Preview follow-up

`c462e846`でmainへマージ。空表示・再試行・選択終了と読むモードの配置を改善。
型検査、Vitest 1,937件、Vite build、App Store surface 111件が成功。
既存build 124には含まれない。提出文案は更新済みだが、パッケージとの一致確認、
全テーマの外観・実機操作・VoiceOverは残る。
詳細: `docs/reviews/2026-09-07-preview-reading-polish.md`。

## PR #38 — source-only U-1 update

Owner follow-up 2026-09-06: **Local Assistは別ウィンドウにし、縦長の会話欄を主役にする**。
PR #38のサイドパネル入口は撤回し、既存のネイティブ分離窓へ戻した。
対象の詳細・使い方と利用条件・定型依頼は初期状態で折りたたむ。
依頼と生成中・完成・失敗の状態を同じ会話欄に置き、入力欄は下部に固定する。
本文16px・補助表示14pxを基本とし、薄すぎる補助文字を調整した。
生成hook、proposal store、mainのDiffと明示Apply、Undoの境界は維持する。
PR #38時点のレビュー記録は履歴: `docs/reviews/2026-09-06-pr38-integration-review.md`。
実モデル・native窓の往復・IME・VoiceOverは未確認。
検証: typecheckを含むmacOS app build、Vitest 1,919件、App Store surface smoke 111件が成功。
ブラウザーでlight/darkと420×540・480×720の配置を確認。
公開版の更新ではない。

## Active Phase

**v2.6 A-1–A-4 source implementation is merged on `main`.** The conversation pins the
target, keeps generation and proposal state separate from the editor buffer, and
allows only explicit Diff apply through stale revalidation and one reviewed
buffer write; the same proposal is not surfaced in a second Review Bar. The A-4 finishing slice keeps
the conversation and Diff regions distinct at narrow widths without changing
that mutation boundary.

- Package/app version in tree: **`2.8.0`**. A signed local universal package is prepared;
  upload, approval and publication remain pending. The frozen `2.7.0` / build `123`
  candidate is owner-managed for App Review. User-confirmed **Mac App Store
  publication** of `2.6.2` on 2026-08-28 remains the published store line.
  Local pkg provenance is in ignored
  `docs/internal/app-store-candidates/latest.json`.
- Local checkpoint: A-2 is committed as `9011d3a6`, A-3 is complete through
  `c7ff442b`, and A-4 finishing is merged on `main` at `b40bd217`. The 2.6.1
  code candidate is `6ff22dad`. `2.6.2` is the pane-ownership candidate on
  this worktree. The review branch was deleted after merge.
  v2.8 plan: `docs/v2.8-plan.md`. Frozen release notes:
  `docs/releases/2.7.0-source-tag.release.md`,
  `docs/releases/2.7.0-app-store-release-notes.md`,
  `docs/releases/2.6.1-source-tag.release.md`,
  `docs/releases/2.6.0-source-tag.release.md`.
- v2.5 is **released and closed** (user-confirmed). Do not reopen its release
  gates from this development lane.
- Published Mac App Store (user-confirmed 2026-08-28): **`2.6.2`** closed
  line; hotfix only for reproduced blockers. Prior store baseline `2.4.0`
  remains historical.
- Plan SoT: `docs/v2.8-plan.md`
- Conversational Assist design: `docs/local-assist-conversational-edit-ux.md`
- Assist / Core AI strategy: `docs/assist-surface-strategy.md`
- **MLX M-0a preflight:** `docs/mlx-m0-preflight-design.md`. H-1 の System
  model 再利用と Rust-owned / fail-closed backend wire だけを前倒しする。
  MLX dependency / model load / storage / UI は M-0b まで禁止。
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
| **v2.7** | **Frozen local candidate** | M-0a maintenance; build `123`; owner-managed App Review planned, Apple-side state unconfirmed |
| **v2.8** | **Release preparation** | Detached conversation-first Apple Intelligence writing companion; existing Diff Apply boundary |
| **Core AI models** | Later in v2.x / v3 | Allowlisted writing `.aimodel` DL / manage / use |
| **MLX M-0a** | Completed preflight | System model reuse + fail-closed internal wire only; no MLX runtime |
| **MLX M-0b** | Parked after C-2 | Xcode 27 / macOS 27 Developer-build runtime evaluation |
| **縦書き** | Parked | After AI milestone progress; not v2.8 |
| **anydoc** | Evaluate only | Office→MD import; no product adoption in v2.8 |

## Active Queue — v2.8

### Immediate next

v2.8は実装追加を止め、別窓Local Assist・M-0a/H-1・PR #40のPreview改善を含む候補を検証する。
リリース記録: `docs/releases/2.8.0-source-tag.release.md`。

1. PR #40の型・テスト・Vite・App Store surfaceは成功済み。提出対象ソースを固定し、
   再生成するパッケージのhelper・Rust・macOS build・依存監査をリリース手順に従って確認。
2. 実機で別窓→依頼→追加指示→main Diff→明示反映→Undo、取消と再依頼を確認。
3. IME、VoiceOver、dirty close、保存衝突に加え、Previewの全削除→Undo、文書切替、
   ペイン外での選択終了、全テーマ・狭幅を実機確認（`docs/smoke-checklist.md`）。
4. 提出用パッケージと公開は別工程。U-3/U-4/G-1の追加実装、C-1/C-2/M-0bはこの候補に混ぜない。

### Completed in v2.5 development

- **R-1 — text reference uses `previewFontSize`**: text Reference now follows
  the existing Preview font-size setting through `--preview-font-size`.
  No new preference control; PDF/image Reference is unchanged.
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
  Not v2.8 U-1 work)
- MLX package / runtime / model import / storage / selection UI (**M-0b**;
  requires C-2 + Xcode 27 and a separate review)
- v2.8 package / source tag / GitHub Release until an explicit release decision
- Claiming every Mac App Store user already has `2.6.2` while rollout is staged
- anydoc dependency or Import Assist expansion
- 縦書き
- B-2 display TOC as a parallel main queue (residual only if daily friction)
- A second package rebuild, upload, or publication without a new human gate

### Closed v2.5 line

- v2.5 is released and closed. Do not rebuild, upload, or reopen it as part of
  v2.8 work; only a separately reproduced blocker can justify a hotfix lane.

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
- MLX M-0b runtime (after C-2 + Xcode 27; M-0a boundary preflight only is active).
- Reference の行番号は本文より小さいガター扱い（`--cm-gutter-*`）にした。
  残る観察があれば将来の Reference 表示ポリッシュで再評価する。

## Next Human Gates

1. Pick the first Core AI production model identity before starting C-1.
   Until then, U-\* / G-1 may proceed on `SystemLanguageModel`; H-1 model
   reuse is complete.
2. Do not start MLX runtime work until C-2 and an Xcode 27 build lane exist.
3. Source tag / GitHub Release only with an explicit publication approval.
   Do not treat staged Mac App Store rollout as a 100% install-base claim.
4. Keep v2.5 closed; published `2.6.2` remains hotfix-only.
