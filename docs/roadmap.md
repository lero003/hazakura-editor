# Roadmap

Status: Operational
Scope: Active release lane and future planning boundaries
Authority: Medium
Last reviewed: 2026-09-19

## Current Position

Hazakura EditorはMarkdown-first Safe Editor。「Markdownで書き、本として読み、ローカルAIで整える。」を
v3ではUI/UX・日常導線の完成度・Local Assistの内部構造を通じて深める。
v3.1は、検証済みCore AIモデルをLocal Assistから実際に利用できるようにすることと、
英語を入口に海外のApp Storeで見つけ、購入し、使い続けられる状態を同じ版で整える。

| 対象 | 状態 |
|---|---|
| 公開版 | v3.0（2026-09-14オーナー報告。ストアページで3.0.0を確認） |
| ソース版 | 3.0.3（編集面のスクロールバー不具合修正）。作業ブランチ`codex/v3`でUI-G1〜G4（状態表示・Help、設定レール/現在地、紙面/ナビ面トークン、開始画面2ペイン）と段階2（モック配色・chrome面トークン）・第二調整（罫線の階層とfocus/native契約の検査）・設定外枠・狭幅23、続いてモック起点の再点検（江戸彼岸の明色化・スライスC/D/E・07本文面化・11形式ナビ）とレビュー修正（R1〜R5・P1/P2）を実装し、v3.0.0として公開。3.0.1・3.0.2・3.0.3は`main`上で不具合修正として積み、旧`codex/v3`ブランチは削除した。 |
| 配布証跡 | 公開build/source対応と個別実機試験は独立未確認。過去候補と区別 |
| 現行キュー | v3.0.0は公開済み。残りは公開後のフィードバックと判断待ち（05/12/13/18・03の全テーマ方針） — `docs/current-work.md` |
| 全体計画 | `docs/v3-product-completion-plan.md` |
| Assist技術計画 | `docs/v2.9-v3-local-assist-plan.md` |

候補ごとのbuild情報は `docs/internal/app-store-candidates/latest.json` を参照する。
公開版との同一性は候補記録だけから推定しない。

## Phase Decision — 2026-09-09

| 版 | 主題 | 完了の目安 |
|---|---|---|
| v2.9 | 公開済みの日常品質とSystem-only改善 | 保存・復旧等の修正履歴を維持。公開報告から未記録の個別試験を合格にしない |
| **v3.0** | **UI/UX刷新・アプリの完成度・Local Assist architecture整理** | 編集→読書→提案確認→出力と失敗/復旧の一貫性、全テーマ/狭幅/実機、System共通契約とAFM評価 |
| **v3.1** | **Core AIの実利用・海外App Store展開** | allowlistモデルを明示入手・検証・選択・生成・削除できるC-1/C-2と、英語を入口にした製品/ストア情報・対象地域・価格・サポート導線の受け入れ |
| v3.2以降 | 文章品質の追加機能、明示章参照、読む・届ける追加機能 | 需要で選ぶ候補。v3.0の既存画面整理と区別 |

添付24画面は[v3製品計画](v3-product-completion-plan.md)で採否を整理する。
モデル管理はv3.1に維持し、v3.0ではSystem経路で共通基盤を検証する。
海外展開はモデル配布とは別レーンで先行できるが、v3.1の公開判定では同じ提出候補へ合流する。
PCC、クラウド推論、ツール実行、workspace indexingは採用しない。
AFM/SDK評価とUI刷新は分け、各スライスで既存の安全契約を確認する。

## Established Foundation

### Shipped (v2.4 Book depth)

1. OKF v0.2 consumer/scaffold pin; inert optional provenance families
2. Compact Book toolbar
3. B-1 chapter-level Diff (buffer vs disk, no second editor buffer)
4. Book-like starter shape and related quality carry-in

### Shipped (v2.3 quality pack + portability)

Portable Book recipe, Reader resume, bounded search, Preview image hardening,
explicit EPUB cover, recent-folder sandbox restore, Assist honesty, etc.
Closed on store + source as the `2.3.0` / `2.4.0` lineage history.

### Shipped (v2.0 Book Scope Alpha)

Explicit multi-file Book Scope, suggestions, whole-book Reader/export, Help.

### Gated / parked (resume only at the named milestone or trigger)

| Bucket | Examples | When to touch |
|--------|----------|----------------|
| 縦書き | Vertical reading / export | After Assist depth and horizontal Book stay stable |
| anydoc | Office → Markdown import library | After written evaluation + real import demand |
| Residual Book depth | B-2 display TOC, B-3 suggestion reasons | Daily friction or dedicated Book line |
| Residual polish | Reference の行番号表示サイズ、Tab overflow, status TTL, dep cadence | Reproduced friction or cheap adjacent change |
| Distribution evidence | Full TestFlight / VoiceOver matrix | Release gate or regression |
| Core AI models | Allowlisted `.aimodel` catalog | v3.1のC-1/C-2。identityと既存ゲート確定後 |
| 海外App Store展開 | 英語ローカライズ、製品ページ、対象地域、価格、サポート/Privacy導線 | v3.1。I-0の棚卸しと対象市場決定後 |
| MLX Advanced Backend | M-0a は System 境界のみ完了。M-0b は macOS 27+ / Apple Silicon の上級者向け custom local models | M-0a は H-1 隣接で検証済み。M-0b runtime は C-2 後、v3.x / v4 目安 |
| Published v2.9 hotfix | App Review / daily-use blocker | Only when reproduced |

### Hard rails（v3以降も維持）

- Safe Editor primary; Markdown/text source canonical per file.
- No Git / LSP / general terminal / plugins / arbitrary command execution.
- No project-wide background indexing or hidden chapter inference.
- No auto-apply / auto-save / auto multi-file rewrite.
- No second simultaneous editable buffer as the default model.
- App Store lane still excludes Agent Workbench / external CLI agents.
- Local Assist: no network inference fallback, no tool calling side effects,
  no general chat DB, no workspace-wide agent editing.
- Core AI (when added): **allowlist only** — no arbitrary model URL, no cloud
  inference fallback disguised as “local.”
- Published tags and assets stay immutable.

## Product Boundary

These boundaries stay active across roadmap changes:

- Safe Editor remains the primary product surface.
- Markdown/text source remains canonical.
- Default Safe Editor Mode has no general terminal, arbitrary command
  execution, Git client, LSP, plugin system, project-wide indexing,
  auto-apply, or auto-commit behavior.
- Agent Workbench is a separate Developer / GitHub lane trust boundary:
  explicit, consent-gated, allowlisted providers only, selected
  workspace root only, one active session, no restore, no auto-apply.
- The standalone Review Desk screen is retired. Local Assist and other
  AI-assist paths stay explicit, Diff-reviewable, and never auto-save or
  auto-apply without user action. **v2.6 separates conversation from Diff
  review and moves apply to the Diff decision surface**, not away from explicit
  consent.
- Workspace file operations stay bounded to the selected workspace and
  must not become a full file manager.

## Closed Phase Snapshot

| Era | What it established | Status |
|-----|---------------------|--------|
| v0.18–v0.29.1 | Safe Editor, App Store lane, Local Assist foundation | Published / historical |
| v0.30–v1.0 | e-book / Spread / position bridge / EPUB / PDF → v1 message | Published |
| v1.1–v1.5 | Continuity, trust, polish | Closed / published |
| v1.6 | Import Assist Phase 1 + edohigan | Closed / published |
| v1.7 | Reference Compare | Closed / published |
| v1.8–v1.12 | Trust → clarity → structure → OKF review → scaffold | Bridge **complete** |
| v1.13–v1.14 | Refinement Keep boxes | v1.13 published; v1.14 intermediate |
| **v2.0** | Multi-file Book Scope Alpha + OKF multi-file feel | **Closed / published** |
| **v2.1–v2.2** | Bounded Reader search + quality pack | **Folded into 2.3+** |
| **v2.3** | Portable recipe + Reader resume + image/export repair | **Closed / published** |
| **v2.4** | Book depth (OKF v0.2 / chapter Diff) | **Closed / published** |
| **v2.5** | Workspace control + delivery clarity | **Released / closed** — `docs/v2.5-plan.md` |
| **v2.6** | Local Assist conversation + Diff review | **A-1–A-4 source candidate merged; physical gate pending** — `docs/v2.6-plan.md` |
| Core AI models | Allowlisted writing on-device models | **Later** (after Assist UX) |
| 縦書き | Vertical reading / export layer | **Parked** (after AI progress) |
| v2.8 | 別窓Writing Companion | 公開報告済み（2026-09-08）。詳細な配布証跡は別 |
| **v3.0** | UI/UX刷新・読書見開き・書き出し形式ナビ・Local Assist LA-1a | **公開（2026-09-14オーナー報告。ストアページで3.0.0を確認）** |

Bridge rationale: `docs/v1.8-plus-product-review-roadmap.md`.
Historical phase prose:
`docs/archive/roadmaps/roadmap-historical-phases-through-v1.x.md`.

## v2.0–v2.4 Book Scope (closed foundation)

Goal achieved in outline: user-selected Book Scope without project analyzer
behavior. Design SoT remains
`docs/superpowers/specs/2026-07-02-v2-book-scope-design.md`.

**縦書き** was listed as a later Book pillar; it is now **explicitly behind**
the Local Assist milestone （今回の版別方針でも維持）。

Residual Book practicalization (display TOC clarity, suggestion
explainability, …) may return as a dedicated line after v2.5 workspace work,
or as single residual slices if daily friction demands it. It is not part of
the active v3 product completion queue.

## v2.5 Workspace Control and Clarity (closed)

Goal: a persistent, keyboard-operable three-pane workspace plus honest bounded
tree and completion feedback. This source line is complete at `6067fbec`; v2.5 is owner-confirmed released/closed.
The source checkpoint remains historical evidence, not a new release queue.

- Plan: `docs/v2.5-plan.md`

## v2.6 Local Assist Conversation + Diff Review

Goal: keep editing conversation and change review distinct. Conversation owns
requests and short turn state; Diff review owns the current unapplied proposal,
original-versus-proposal comparison, stale state, discard, and explicit apply.
The editor buffer stays unchanged until the Diff action is accepted.

- Design: `docs/local-assist-conversational-edit-ux.md`
- Plan: `docs/v2.6-plan.md`
- Strategy: `docs/assist-surface-strategy.md`

Not: general chat, provider marketplace, auto multi-file rewrite, or
docked IDE-like agent panel (docking is a separate future UX decision).

## Core AI — v3.0 foundation / v3.1 models

Product intent (not an implementation green light):

- Fill capability gaps that Apple Foundation Models alone cannot cover for
  **writing-specialized** tasks.
- Users may **download / manage / use** only **allowlisted** on-device models
  (e.g. curated writing-oriented packages such as `.aimodel` or the
  platform’s equivalent packaging).
- Inference stays on-device. Download network is for catalog assets only —
  not a hidden cloud chat path.
- No arbitrary URL, no user-supplied unsigned blobs, no auto-apply.

Sequence: **C-0 → v3.0 System共通基盤 → C-1 fixture配管 → 本番identity pin →
リリース前bake-off → v3.1 C-1/C-2**。
本番C-1/C-2のHOLD条件は維持。fixtureベースのC-1配管はDeveloper/GitHubレーン限定で
先に進めてよい（2026-09-15オーナー決定）。基盤の前倒し範囲は
`docs/v2.9-v3-local-assist-plan.md` と `docs/core-ai-c0-design.md` に固定する。

MLX のユーザー向け経路は **C-0〜C-2 では Non-Goal** のままにする。
H-1 隣接の **M-0a** では、Xcode 26 で検証できる System model 再利用と
Rust-owned / fail-closed な内部 backend wire だけを先に固定してよい。
MLX package、model load、保存、選択 UI は足さない。

C-2 後の v3.x / v4 を目安に、**M-0b — MLX Advanced Backend runtime**
として再評価する。最初の検討対象は Developer / GitHub build、
macOS 27+ / Apple Silicon、上級者による明示 import。同じ Conversation / Proposal /
Diff / Apply UX を再利用し、推論は local-only、cloud fallback と remote code /
shell / Python 実行は不可とする。対応 architecture / model data、revision pin、
app-managed storage、ロード前 memory check、取得経路、App Store 可否の詳細は
M-0b の product / security / distribution review で固定する。M-0a の正本は
`docs/mlx-m0-preflight-design.md`。

## v3.1 — Core AI利用と海外App Store展開

Goal: **Core AIをダウンロードできるだけで終わらせず、既存のLocal Assistから安全に
選んで使えるようにする。同時に、海外の利用者が製品を理解し、購入し、初回利用と
サポートまで進めるApp Store経路を整える。**

両レーンは並行して進めてよい。ただし「Core AI対応」や「海外販売対応」を公開上の
完了とするのは、同じv3.1提出候補とApp Store Connect設定を通した後に限る。
v3.0.xの公開状態、タグ、既存アセットは変更しない。

| レーン | v3.1で行うこと | 完了の目安 |
|---|---|---|
| **C-1 — 資産ライフサイクル** | allowlist catalogからの明示DL、サイズ/進捗/取消、digest/signature検証、準備、復旧、削除 | 未検証資産をreadyにせず、壊れた/不足した資産から安全に復旧できる |
| **C-2 — Core AI利用** | Rust-owned `selectedId`、backend別availability、Systemとの切り替え、同じConversation / Proposal / Diff / Applyからの生成 | 選択した検証済みモデルで実際に生成でき、失敗時も本文を変えずSystemと混同しない |
| **I-0 — 海外展開の棚卸し** | 現在のUI/Help/a11y文言、App Store情報、WebのPrivacy/Support、対象地域、価格、モデルの権利/地域制限を棚卸し | 最初の対象言語・地域・価格方針と、翻訳/法務/サポートの責任範囲が明記される |
| **I-1 — 製品ローカライズ** | 英語を第一候補に、主要UI、Help、エラー、Local Assist/Core AIの状態・容量・通信説明、VoiceOver labelを整える | 英語環境で主要導線が日本語へ不意に戻らず、日本語環境とsource正本/保存挙動が同じ |
| **I-2 — App Store製品ページ** | localized name/subtitle/description/keywords/What's New、英語スクリーンショット、Privacy/Support URL、review notesを用意 | 実装・対応OS・モデルavailabilityを越える主張がなく、英語で購入前後の期待がつながる |
| **I-3 — 販売設定** | 対象storefront、base country/region、価格、Paid Apps Agreement・税務/銀行、age rating・content rights・export complianceを確認 | 選んだ地域で販売可能な状態をApp Store Connect上で確認し、アカウント固有情報はtracked docsへ残さない |
| **I-4 — 統合受け入れ** | 同一候補で日本語/英語、clean install、Local AssistのSystem/Core AI、DL取消/再開/削除、Diff/Apply/Undo、offline/未選択/非対応状態を確認 | 署名候補、TestFlight、製品ページ、価格/地域、App Reviewの証跡を分離して記録し、未確認を合格扱いしない |

### 進める順序

1. C-1の本番identity gateを待つ間にI-0を閉じ、I-1の不足をテスト可能な単位へ分ける。
2. C-1/C-2は既存HOLD条件を満たしてから進める。fixture配管を本番利用やApp Store対応と呼ばない。
3. モデルidentity、容量、権利、対応OS、品質比較が固まってからI-2のCore AI文言と画像を確定する。
4. I-3はオーナーがApp Store Connectで確認する。対象地域を理由なく一括有効化せず、価格とサポート可能性を明示判断する。
5. code freeze後に同じv3.1候補でI-4を行う。修正が入った場合は候補を再作成し、古い受け入れ結果を流用しない。

### v3.1のNon-Goals

- 任意URL/import、unsigned model、一般モデルmarketplace、MLX同時導入。
- cloud inference、network fallback、tool calling、background indexing、auto-apply / auto-save。
- Agent Workbench / external CLI agentをApp Store laneへ入れること。
- 機械翻訳だけで公開文言を確定すること、または未確認の全地域販売・法令対応を主張すること。
- App Store Connectの連絡先、契約、証明書、価格メモなどのaccount固有情報をtracked docsへ書くこと。

App Store Connectの具体操作は実行時点のApple公式資料を正本として再確認する:
[metadata localization](https://developer.apple.com/help/app-store-connect/manage-app-information/localize-app-information)、
[availability](https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/manage-availability-for-your-app-on-the-app-store)、
[pricing](https://developer.apple.com/help/app-store-connect/manage-app-pricing/set-a-price)。

## anydoc (evaluation only)

[firecrawl/anydoc](https://github.com/firecrawl/anydoc) (Office/PDF → Markdown)
may later extend **Import** (draft-until-save), not Open-as-source. PDF stays
with existing Import Assist first. **No v2.6 product adoption** without a
written evaluation and scope pin (prefer docx-only spike if ever promoted).

## Distribution Lanes

- **App Store:** Safe Editor + L Mode + Diff / explicit review + on-device
  Local Assist (+ future allowlisted on-device models if accepted by review).
  No External Agent Workbench, CLI launch, arbitrary command execution,
  external AI/API inference, or network fallback for generation.
- **Developer / GitHub:** same base + optional Agent Workbench for
  allowlisted local CLI providers.

Operational checklists:

- `docs/source-release-checklist.md`
- `docs/dmg-preview-checklist.md`
- `docs/release-pre-check.md`
- `docs/releases/`

## Related Docs

| Need | Path |
|------|------|
| Next slice | `docs/current-work.md` |
| Implementation truth | `docs/current-status.md` |
| v2.9–v3.1 plan | `docs/v2.9-v3-local-assist-plan.md` |
| v2.6 plan | `docs/v2.6-plan.md` |
| v2.5 plan | `docs/v2.5-plan.md` |
| Conversational Assist UX | `docs/local-assist-conversational-edit-ux.md` |
| Assist strategy | `docs/assist-surface-strategy.md` |
| Closed v2.4 plan | `docs/v2.4-plan.md` |
| v2 Book design | `docs/superpowers/specs/2026-07-02-v2-book-scope-design.md` |
| OKF pin | `docs/okf-spec-pin.md` |
| Product non-goals | `docs/product-brief.md` |
| Security | `docs/security-boundary.md` |

## Future Product Direction (durable)

Keep future work source-preserving and narrow:

- L Mode: `docs/l-mode-plan.md`
- e-book / EPUB: `docs/ebook-mode-epub-export-plan.md`
- Local Assist: `docs/assist-surface-strategy.md` + conversational UX SoT
- Agent Workbench: `docs/agent-workbench-boundary.md` (Developer lane only)
- Book Scope: foundation **shipped**; residual only by promotion
- Native macOS appearance / post-v0.25 refinement memos: historical under
  `docs/archive/planning/`

Any broader WYSIWYG model, database-like workspace, collaboration feature,
plugin system, **arbitrary** model runtime, local image-generation platform, or
automated agent-apply flow needs a fresh product-boundary decision first.
Allowlisted writing models under Core AI are the narrow exception path above,
not a general model marketplace. M-0a does not lift this rail; MLX runtime
becomes actionable only after the separate M-0b boundary review.
