# Current Work

Status: Operational
Scope: v1.12 local TestFlight candidate; v1.11 held inside it
Authority: High
Last reviewed: 2026-07-15 (v1.12 local signed candidate ready)

## Purpose

Start here when choosing the next small `Hazakura Editor` slice.

## Lane Timeline (read first)

| Lane | Status | Notes |
|------|--------|--------|
| **v1.5** | **Closed / released as `1.5.0`** | Stabilization + reading polish. **Released before 江戸彼岸 (edohigan) was merged.** Do not reopen unless hotfix. |
| **Post-v1.5 main (not v1.5)** | Merged after v1.5 release | 江戸彼岸 theme; CodeMirror `@codemirror/view` **6.43.2** pin + editor display quality (syntax-tree recompute, resize remeasure, fold gutter removed). |
| **v1.6** | **Closed / published as `1.6.0`** | Import Assist Phase 1 + edohigan + quality packs. **App Review passed without issues (2026-07-10).** Boundary: `docs/archive/reviews/import-assist-boundary-review-v1.6.md`. Release notes: `docs/releases/1.6.0-app-store-release-notes.md`. Do not reopen unless hotfix. |
| **v1.7** | **Closed / published as `1.7.0`** | Reference Compare plus trust / daily-use hardening. App Review passed and the release was published (user-reported 2026-07-12). Extended smoke continues as v1.8 follow-up; do not reopen without a reproduced hotfix. |
| **v1.8** | **Closed / published as `1.8.0`** | Daily Trust Completion. App Review passed and the release was published (user-reported 2026-07-14, build `89`). Deterministic Rust suite isolation, bounded long-reference, L Mode Reference continuity, a11y / kana UI, export preflight, theme cost, failure-state messaging. Release notes: `docs/releases/1.8.0-app-store-release-notes.md`. Extended TestFlight and spoken VoiceOver breadth remain follow-up evidence. |
| **v1.9** | **Source complete / rolled into current candidate** | W1–W4 organize Preview / Reference / e-book / Outline / Diff / L Mode around `書く・読む・確かめる`. The work is rolled into the in-tree `1.11.0` candidate rather than published alone. |
| **v1.10** | **Implementation complete / held as candidate** | Shared parsing, Outline hierarchy/page-breaks, non-blocking advice, and one Undo-able heading-level edit are landed. Representative packaged Outline/advice/edit/Undo passed. Remaining breadth moves into the v1.11 distribution-confidence matrix. |
| **v1.11** | **Local TestFlight candidate ready / held** | Explicit, bounded, read-only OKF v0.1 Draft compatibility review. Local signed candidate ready; TestFlight install remains separate. Contract: `docs/v1.11-okf-draft-preview-design.md`. |
| **v1.12** | **Local TestFlight candidate ready** | OKF starter scaffold (minimal + book-like). Source, representative four-entry smoke, and signed local package gates passed; upload/install are separate. Contract: `docs/v1.12-okf-scaffold-design.md`. |
| **v2** | Later | Full multi-file Book Scope and Hazakura-defined book semantics, then 縦書き. |

Package/app version in tree is **`1.12.0`**; the published Mac App Store
version is **`1.8.0`**. v1.12 is the current local signed TestFlight candidate;
v1.11 is held inside it. See
`current-status.md` for lane truth; treat Connect as authoritative for store
counters.

## Active Queue — v1.12 OKF Starter Scaffold

Goal: 明示操作で、OKF v0.1 Draft 互換の「よくある Markdown 群」を
workspace 内にひな形として置く。A minimal / B book-like。
Source: `docs/v1.12-okf-scaffold-design.md`.

| Priority | Slice | Acceptance |
|---|---|---|
| **Done / source** | **T0 — Contract + templates** | 設計、2テンプレ、作成日のローカル暦日展開、spec pin `ee67a5c`、上書き禁止。 |
| **Done / hardened** | **T1 — Bounded multi-file create** | `create_okf_scaffold`、strict relative path / NUL / size bounds、create_new、nested directoryの一段作成、自分が作った内容だけの非再帰cleanup、Rust テスト。 |
| **Done / hardened** | **T2 — Safe Editor wiring** | 全4入口。`index.md` open / tree refreshの部分失敗をstatusへ残す。サイドバー新規menuは展開状態と矢印/Home/End/Escape操作を持つ。 |
| **Done / docs** | **Pin evolution contract** | `docs/okf-spec-pin.md` — pin 更新時に review / fixtures / scaffold assets をセット更新する前提。 |
| **Done / representative smoke** | **T3 — Entry-point breadth / release polish** | 全4入口、両template、`-2`衝突名、実日付、`index.md` open、required-clean点検、Escape復帰を確認。部分失敗表示は自動testで固定。release notes草案は公開判断時。 |
| **Done / local candidate** | **Signed App Store package** | source commitからuniversal app/pkgを作成し、app/helper entitlement、notice、installer署名、metadata、checksumを確認。詳細はignored `docs/internal/app-store-candidates/latest.json`。 |
| **Next / user proof** | **TestFlight install / manual smoke** | upload後、実機で起動、4入口のひな形作成→点検、既存daily-trust breadthを確認する。uploadはこの作業では行わない。 |

### Closed / Held — v1.11 OKF Draft Compatibility Preview

Goal: ユーザーが明示的に選んだ workspace / subfolder を、OKF v0.1 Draft
との互換性として一度だけ安全に確認し、既存 Markdown tab へ移動できる
読み取り中心の preview を作る。Source:
`docs/v1.11-okf-draft-preview-design.md`.

| Priority | Slice | Acceptance |
|---|---|---|
| **Done / source** | **S0 — Contract + fixtures** | Commit `ee67a5c`、matrix、link/budgets、日本語multi-fileを `src/features/okf/fixtures.ts` と `npm run smoke:fixtures:v1.11-okf` に固定。 |
| **Done / source** | **S1 — Pure OKF model** | TypeScript pure model + 直接依存 `yaml@^2.9.0`（lockfile で解決）。nested/cycle-safe 変換、不正quoteは failure。reserved shape / inline links（0–3 space fence・fragment-only）/ thin result。FS/UI未接続。 |
| **Done / source** | **S2 — Explicit bounded discovery** | Async `scan_okf_bundle` が **arm後**に `spawn_blocking`、`File::take(limit+1)` の bounded read、同時scan拒否、timeout付きhandshakeによる mid-run cancel、実読込 total 加算、symlink root/open時identity拒否、5 budgets境界テスト。TS bridge: `src/lib/tauri/okf.ts` + `fromDiscovery.ts`。 |
| **Done / source hardened** | **S3 — OKF review surface** | Command Palette / フォルダコンテキスト `知識フォルダ（OKF）を点検`。読み取り専用 panel は通常原稿の OKF 前提不足を「OKF として整える準備」へ分け、実対応 / 改善案 / 参考情報を混同しない。`開いて修正` は既存 tab を開いて modal を退避し、`変更後に再点検` で明示的に disk snapshot を更新する。ファイル/参考情報と spec/counts は disclosure、scroll は dialog 一つに集約。findings は解析・表示上限、三言語copy、path別accessible nameを持ち、workspace切替時は保持結果を破棄してscanをcancelする。Markdown HTML/image 非描画。**open 時の自動フル解析はしない**（UX progressive disclosure: design doc）。packaged smoke は S4 と併せて。 |
| **Next polish (optional before/with S4)** | **OKF UX Step 2–3** | パネル内ガイド/最小見本、File メニュー、root `index.md` 存在時の非侵襲チップ（クリックまで scan しない）。 |
| **Done / local candidate** | **S4 — Distribution confidence / candidate ready** | ローカルOKF packaged smoke、source/Rust/App Store surface、sandbox/helper/signature、metadata/checksumを確認し、`1.11.0` pkg を生成した。TestFlight install 後のIME、Save As、recovery、e-book/EPUB、a11y、long/failure breadthは実機証拠として分けて記録する。 |

### Closed Implementation Queue — v1.10 Single-document Structure Foundation

S1–S4 sourceと代表的 packaged Outline/advice/edit/Undo smokeは完了した。
`docs/v1.10-single-document-structure-design.md` は完了済みの実装契約として残す。
source jump全種、IME、Save As、recovery、e-book/EPUB、signed TestFlightの
横断確認は、v1.10を再オープンせずv1.11 S4へ引き継ぐ。

### Closed Source Queue — v1.9 Writing Loop Clarity

W1 Returning Start Panel、W2 pane state copy、W3 `sessionId` view continuity、
W4 Command Palette ja/kana discoverability は source 実装と再レビューを完了した。
v1.9は独立リリースせず、最終的に `1.11.0` TestFlight candidate へ同梱する。

## Product Boundary

- Safe Editor remains primary.
- Markdown/text source remains canonical.
- Do not add Git, LSP, terminal, arbitrary command execution, plugins,
  project-wide indexing, auto-apply, or auto-commit.
- Workspace file operations stay bounded to the selected workspace.
- OKF review is explicit, bounded, derived in memory, and read-only. It must
  not become startup analysis, a persistent index, or automatic repair.
- OKF scaffolds write only on explicit user action; template bodies and the
  integrity model share one pin (`docs/okf-spec-pin.md`) and must co-update when
  upstream OKF changes.
- Agent Workbench remains a separate, explicit Developer / GitHub lane.
- Import Assist must stay on-device, edit-before-save, no auto-save
  (see boundary review).
- v1.7 Reference Compare may show one read-only reference beside the active
  editor, but must not become a generic two-editor split or second saved model.

## Closed Lane Summary — v1.6 Import Assist

v1.6 shipped as `1.6.0` and **passed App Review without issues** (2026-07-10).
Do not reopen unless a hotfix is required. Historical queue detail remains in
git history and `docs/archive/operations/quality-inventory-v1.6.md`.

| Status | Slice |
|---|---|
| Done / published | Boundary review, Import Assist MVP, helper packaging, nested helper re-sign |
| Done / published | Quality packs A/B (structure, import honesty, sandbox staging, theme cost, export timeout) |
| Done / published | `pdf-extract` 0.12.0 / `lopdf` 0.42.0 security update |
| Done / published | Q-IMG-1 A+D parent-workspace image policy (source-covered; optional packaged re-smoke) |
| Absorbed by v1.7 | Post-import review UI, PDF/source side-by-side, low-confidence navigation |
| Deferred v2 | Book Project split (`chapters/` + `hazakura.import.json`) |

## Closed UX Lane — v1.7 Reference Compare

v1.7 deepens Import Assist into a general reference workflow. Product story:

> 参照資料を横に開き、Markdownを見比べながら直せる。

| Priority | Slice | Acceptance |
|---|---|---|
| **Done / source** | **R0 — PDF reference spike** | Helper `pdf_info` / `render_pdf_page`; Rust opaque handle (`open_pdf_reference` / `render_pdf_reference_page` / `close_pdf_reference`); main-window gate; path/page/pixel bounds; fixture+live helper smoke. No complete UI. |
| **Done / source** | **R1 — Paired shell + text reference** | Reference state + **editor center-left / reference right (preview-like)** shell; Markdown/text open as read-only right reference; workspace/tab context menu + File menu + palette entry; same-file → buffer-vs-disk; narrow-window 編集/参照 switch. Not Diff. |
| **Done / source** | **R2 — Image + PDF reference readers** | PDF page UI via R0 handle; CSP-compatible bounded `data:image/png` page display; image reference via existing safe loaders; context/palette accept PDF+image; close releases PDF handle. Packaged sandbox matrix remains optional smoke. |
| **Done / source** | **R3 — Import Assist automatic pair + page follow** | Import success opens linked PDF/image reference; follow keyed by `sessionId`; cursor → page; manual page pauses; resume control; missing markers → follow off. |
| **Done / source** | **R4 — Confidence navigation + reliability** | Page-level OCR confidence markers (advisory only, not char ranges); 要確認 prev/next; empty pages flagged; adjacent-page cache (no full preload); PDF handle cleanup on shell unmount. |

Full interaction, security boundary, and non-goals:
`docs/archive/planning/v1.7-reference-compare-design.md`.

The scope-based brief for a separate v1.7 implementation request is
**`docs/archive/planning/v1.7-scope-brief.md`**. It defines the whole v1.7 product boundary and
completion criteria without making individual slices the user-facing scope.
The review-derived **`docs/archive/operations/v1.7-trust-scale-plan.md`** remains the historical
breakdown for execution; it keeps Book Scope Alpha in v2 and does not widen
Safe Editor into an IDE, terminal, Git client, or generic AI surface.

Key product rules for this lane:

- open PDF, image, Markdown, or text as **one** read-only right-hand reference
  preview (workspace opens are preview/reference treatment, not edit tabs);
- keep one ordinary editable Markdown Editor Tab in the **center/primary**
  column;
- automatically pair an Import Assist source (right) with its unsaved Markdown
  draft (center);
- use source-visible page markers for explicit PDF-page follow;
- allow manual Markdown-to-Markdown **visual reference** while editing;
  existing Diff stays a separate explicit text comparison action (`差分を見る`);
- never two editable panes, never auto-apply, never revive Review Desk, never
  treat Reference Compare as Diff layout.

## Closed Trust / Daily-use Queue — v1.8

The v1.7 feature arc is published. v1.8 carried the following extended trust
and distribution proof without reopening the released lane, and shipped as
`1.8.0`. Priority is ordered; each slice remained independently verifiable.

| Priority | Slice | Why now | Acceptance anchor |
|---|---|---|---|
| **Developer packaged smoke passed** | **L Mode continuity (T-1)** | Markdown-only L Mode; `historyField` undo on same-kind remount; L Mode hides the loaded Reference pane without clearing its session and restores it on exit. The kana Typewriter preference hint now uses natural kana copy without the previous garbled Latin fragment. | Separate-ID Developer app passed Reference hide/restore + post-remount Undo on 2026-07-12. Keep signed TestFlight and non-Markdown breadth as follow-up evidence. |
| **Developer packaged smoke passed / source cleanup regression complete** | **Pathless draft recovery (T-2)** | UUID `recoveryId`; restore always opens a new pathless tab; pathless-only TTL/size; Save / Save As / restore / discard / close の storage failure status。 A disposable separate-bundle app recovered a force-terminated pathless draft and preserved its marker on 2026-07-12. | Focused source regression now covers pathless `Discard All` cleanup failure: status is shown and the close continues. Keep signed TestFlight coverage and stale-candidate cleanup behavior as follow-up evidence; cleanup failure時も編集・明示closeは止めず、再表示リスクをstatusで通知する。 |
| **Developer packaged smoke passed / source close-replace + stale-raster guard + external-change notice + image/PDF a11y contract + PDF/image proof partial** | **Reference Compare packaged proof (T-3)** | Signed build 85 metadata/signature/helpers verified; user-reported basic packaged testing found no issue; latest source-built sandbox preview passed app/helper entitlement and deep-signature checks on 2026-07-13. A separate-ID Developer bundle opened a disposable workspace and preserved a Markdown/text reference across Preview → Reference; on 2026-07-13 it also opened `hazakura-valid-text.pdf` and workspace `reference-image.png` as read-only right-side content without changing the center buffer. On 2026-07-13 it additionally closed/reopened the image, replaced it with a nine-page PDF, moved to page 2, exercised the then-current fit-page and 150% controls, narrowed the Reference column to 25%, and simulated a missing image path with an explicit Reload recovery while the center marker stayed intact. Current source simplifies zoom to fit width plus a raster-independent, two-axis-scrollable 150% view with keyboard panning; signed build 89 includes this source and passed package/app static verification. `AppWorkspace` pins that closing or replacing the visible reference does not call the editor change path; `ReferencePdfPane` also ignores an old raster that resolves after a Reference replacement, while `ReferenceTextPane` and `ReferencePdfPane` keep direct read-only/accessibility contract tests. | Run hands-on panning on build 89 before upload, then keep signed TestFlight interaction, long-reference copy/breadth, and the remaining a11y matrix as packaged/manual follow-up evidence. |
| **Source verified / packaged missing-workspace + runtime-failure smoke passed** | **Processing budgets (S-1)** | Pathless budgets + visible storage failure; Diff/export caps remain. Global Search localizes missing-workspace and runtime failure status, preserves diagnostic detail, and does not misreport either failure as zero matches. Workspace search caps per-file matches, total matches, visited files, and line preview length with explicit truncation. | Focused source checks passed on 2026-07-13 (frontend 3 files / 16 tests; Rust search 14 and PDF export 7). An isolated fresh-ID Developer bundle showed the missing-workspace hint and, after a disposable workspace-path failure injection, showed the diagnostic error without a false zero-match result. No reproduced source bug remains. |
| **Done / source** | **Deterministic Rust suite (S-2)** | Host-only bookmark / Trash checks are explicit ignored integration tests; Trash cleanup uses an injected unit fixture; process polling tolerates parallel suite load. | The current HEAD passed three serial full-suite runs on 2026-07-13 (**338 passed / 2 ignored / 0 failed** each). Keep the ignored macOS integration checks available for a suitable interactive host. |
| **Developer packaged AX smoke partial / public build keyboard smoke passed / source status announcement fixed** | **Keyboard / VoiceOver semantics** | Quick Open, Command Palette, and Global Search expose modal dialog + combobox/listbox + active-option relationships; Global Search announces status changes. Command Palette and Global Search names/placeholders/empty copy now follow English / Japanese / kana. Reference Compare's empty-editor hint is an explicit polite status, and its narrow-pane Draft / Reference toggle buttons expose the selected target through `aria-pressed` inside a localized named toolbar. The contextual Slash command listbox, open-file tab row/list, primary Editor pane, and Workspace file rows also have localized accessible names/state labels; loading and per-folder truncation notices use the same locale contract. Text and image tab close controls also use the active English / Japanese / kana locale. Dirty tab descriptions also use that localized unsaved-state copy. The Local Assist generation-lock status also follows the active English / Japanese / kana copy. The Editor full-path copy button also uses a kana accessible name. Reference PDF loading also exposes localized status copy instead of an ellipsis-only placeholder. Reference Text/Image panes now use the kana read-only role label rather than an English fallback. PDF stale-handle errors also keep kana copy while unknown diagnostic details remain intact. The PDF 150% zoom control also keeps a kana accessible name instead of Japanese kanji. Editor find previous-match also uses the corrected kana label `まえへ`. | latest-HEAD Developer AX tree passed localized search-surface names plus pane toggle/splitter labels on 2026-07-12. A fresh local App Store preview bundle passed window smoke on 2026-07-13 and its packaged AX tree exposed the Japanese tab row/list, tab close names, pane controls, workspace tree, and Editor region. Installed public `1.7.0` build `85` also passed `⌘⇧P` / `⌘⇧F` and native 表示-menu traversal on 2026-07-13. Focused AppWorkspace, EditorMainPane, TabBar, SlashMenu, WorkspaceTree, and locale coverage now pin the narrow-pane toolbar state, tab row/list name, close-control names, dirty-state description, Local Assist generation status, full-path copy name, Reference PDF loading status, Reference Text/Image role label, PDF stale-handle error copy, PDF 150% zoom label, Editor find previous-match label, Editor pane name, file state labels, loading/truncation copy, Slash command name, and three-language key parity. Keep actual VoiceOver speech and signed TestFlight breadth as follow-up. |
| **Developer packaged smoke passed / signed follow-up** | **Long reference + rename a11y (S-3)** | Body scroller + wrap-safe full rendering; text reference専用の150万文字 / 5万行 budget; deterministic `smoke:fixtures:v1.8-reference`; rename inputs use the active English / Japanese / kana label. | 5,000-line narrow-pane wrap/scroll/selection, full-reference copy via paste-back marker, and both over-budget rejection paths passed in a separate-ID Developer app on 2026-07-13. Keep signed TestFlight breadth and spoken VoiceOver follow-up. |
| **Developer packaged smoke passed / source complete** | **Purpose-led discovery (S-4)** | Start Panel write / read / verify pitch plus purpose-led first-use titles for Preview / Reference / e-book / Outline / Diff in English / Japanese / kana. Preview-disabled status also keeps kana copy when Preferences turn the pane off. | Focused locale checks passed (**2/2**); the latest separate-ID Developer AX tree exposed the task-oriented Help text for all five pane controls on 2026-07-13. Signed TestFlight breadth and spoken VoiceOver remain follow-up evidence. |
| **Developer packaged output/theme smoke passed / signed follow-up** | **Export/theme polish (P2)** | EPUB/PDF dialogs summarize unsaved-source inclusion, image-warning policy, and the next Save-dialog destination step; PDF final success preserves image-warning count. A Developer export proved EPUB structure/warnings and nine-page A4 PDF output without changing the source file; an explicit white PDF background now prevents transparent trailing-page regions. A Japanese Markdown fixture was exported to a one-page A4 PDF and displayed Japanese glyphs without clipping in macOS Preview on 2026-07-13; Preview also exposed the Japanese text in its accessibility tree. Edohigan now shares the ambient WebGL DPR/frame budget with CRT/Shinkai. Preferences kana theme hints no longer contain the split-word corruption in the joke-theme descriptions, and the auto-backup hint no longer falls back to `未保存`. Spellcheck already lives in Preferences and reduced-motion source guards are present. | Keep signed TestFlight breadth, spoken VoiceOver, and a measured device FPS baseline as follow-up. |

Structured-Markdown preparation for v1.8 is intentionally limited to one
source-preserving seam: Outline, e-book chapters, and EPUB export share the
same leading YAML frontmatter boundary. Closed, CRLF, and unclosed cases are
covered. The broader shared structure model and structure overview were then
completed in v1.10.

Book Scope Alpha is **not** part of this queue. v1.11 may review one explicitly
selected OKF root and open its Markdown concepts; v1.12 may create starter
folders only. Chapter order, whole-book reading/export, visible manifest
authoring, and multi-file edits remain v2. OKF pin bumps:
`docs/okf-spec-pin.md`.

### Active post-v1.8 direction

After v1.8, do not jump directly to v2. Two-digit minor versions such as
`v1.10`–`v1.12` are normal and accepted. v1.9–v1.11 are implemented (v1.11 held
as local candidate). The **active v1.12** lane adds explicit OKF starter
scaffolds that share the v1.11 pin; upstream OKF changes update review +
templates together (`docs/okf-spec-pin.md`).

The v1.10 structure lane stays inside one Markdown source: shared heading /
frontmatter / page-break / navigation interpretation, structure overview, and
only bounded explicit Undo-able edits in the active buffer. v1.11 may derive a
temporary read-only bundle view; v1.12 may write fixed starters. Neither adds a
Book manifest, hidden database, background workspace scan, or second editable
document model. Full rationale: `docs/v1.8-plus-product-review-roadmap.md`,
`docs/v1.11-okf-draft-preview-design.md`, `docs/v1.12-okf-scaffold-design.md`.

### Quality inventory (v1.6 historical)

Cross-cutting quality notes for the closed v1.6 line live in
**`docs/archive/operations/quality-inventory-v1.6.md`**. Prefer one verifiable
slice at a time; keep normal `npm test` / `cargo test` gates.

### CodeMirror pin (durable)

- Keep `@codemirror/view` at **6.43.2** (`package.json` + overrides).
- 6.43.3+ tile-tree regressions caused vanishing lines / wrong caret.
- Do not bump view without re-verifying long Japanese Markdown + wrap + L Mode.

### v1.7 / v1.8 publication closeout

`1.7.0` passed App Review and was published (user-reported 2026-07-12).
`1.8.0` passed App Review and was published (user-reported 2026-07-14).
Extended Reference Compare, pathless recovery, bounded large-data,
keyboard/a11y checks, signed TestFlight breadth, and spoken VoiceOver remain
follow-up quality evidence, not reasons to mutate the published tags or
reopen v1.7 / v1.8.

### 江戸彼岸 (post-v1.5)

- Theme is on main; polish force/density on device as needed.
- Not part of the v1.5 release story.

## Historical

v1.5 and earlier queue detail: keep this file short. Older slices live in git history and `docs/archive/`. v1.3 Daily Trust remains the long-published baseline story until store listing notes supersede it in `current-status.md`.
