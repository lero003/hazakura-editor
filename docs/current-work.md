# Current Work

Status: Operational
Scope: v1.2 polish and expectation setting
Authority: High
Last reviewed: 2026-06-30 (1.1.0 public release and v1.2 polish)

## Purpose

Start here when choosing the next small `Hazakura Editor` slice.
This file is the current work queue. `1.1.0` is approved and published
on the Mac App Store with the product promise
`Markdownで書き、本として読み、ローカルAIで整える。` The active lane is v1.2
polish and expectation setting: improve export expectations, command
discovery, and one observed quality issue at a time without expanding into
v2 book-workspace features.

Keep every slice small, verifiable, and inside the Markdown-first Safe
Editor boundary. The v0.27 refinement phases are complete for source-tag
purposes; keep `docs/archive/planning/v0.27-refinement-slice-plan.md` as
the execution memo and `docs/post-v0.25-product-refinement-plan.md` as
the broader lens. The completed v0.29 lane established Hazakura Local
Assist transaction / Diff review as the visible AI assistance path. From
here, Hazakura Local Assist work should be observation-driven polish
unless a safety, review, App Store, availability, generation failure, or
transaction-boundary issue appears.

Completed v0.18-v0.36 implementation logs and pre-v1.0 submission-prep
evidence have moved to `docs/archive/operations/current-work-through-v1.0.md`.
Read that archive only for historical context; do not select its items as
current work. Older v0.17 App Store-quality request packets and closeout
evidence live under `docs/archive/operations/app-store-v0.17/`.

## Product Boundary

- Safe Editor remains primary.
- Markdown/text source remains canonical.
- Do not add Git, LSP, terminal, arbitrary command execution, plugins,
  project-wide indexing, auto-apply, or auto-commit.
- Workspace file operations stay bounded to the selected workspace.
- Agent Workbench remains a separate, explicit Developer / GitHub lane
  trust boundary and is not part of the App Store lane.
- e-book Mode, L Mode, Preview, Diff, Recovery, EPUB export, and
  Hazakura Local Assist review remain source-preserving layers over one
  Markdown document.
- Do not add Book Workspace Alpha, saved multi-file book manifests,
  Preview DOM editing, external AI/API providers, generic chat, or AI
  auto-apply / auto-save behavior in the v1 lane.

## Active UX Queue

Pick one item at a time. `1.1.0` is published, and no hotfix blocker has
been reported. The position-continuity lane is closed; v1.2 follows the
observation-driven queue in `docs/v1.1-v1.2-followup.md`. Keep version bump,
candidate generation, upload, review, and publication closed until they are
explicitly requested.

| Priority | Slice | Acceptance |
|---|---|---|
| Implemented / source verified | v1.2 Export UX and Command Discovery | The EPUB dialog explains the single-Markdown / reading-preview boundary. The command palette derives Markdown command behavior from the right-click slash-command registry, including date/time insertion, while palette-specific labels remain English. Built-app interaction smoke remains required before an RC claim. |
| Done / built-app verified | v1.1 Reader / Editor / Preview Position Continuity | `AppWorkspace` owns one per-document view-state registry for Editor, e-book Mode, and Preview. A -> B -> A restores each editor selection/scroll and reader location. Preview restores only after replacement HTML has rendered, avoiding the real-layout top reset. A safe local Markdown-link transition and Preview -> e-book -> Preview were verified in the built app without source/save-state changes. See `docs/v1.1-v1.2-followup.md`. |
| Observation / Google Drive manual-blocked | v1.2 Recovery Reliability | Local-folder forced termination passed: with Auto Backup explicitly enabled, a timed `.bak` preserved the unsaved marker, the saved source stayed unchanged, relaunch restored the workspace and exposed the draft, and explicit Restore returned it as a dirty buffer. Auto Backup was returned to its prior off state. Google Drive remains `manual-blocked` because no dedicated test fixture existed; do not create or scan user cloud content implicitly. |
| Observation | v1.2 Image / Review Edge Cases | Take one case at a time: consecutive e-book images, L Mode first-line/nested-path images, PDF page breaks through a large image, explicit Diff `採用` / `破棄`, context-menu viewport containment, or unexpected `.bak` files in Trash. Do not bundle these into a polish slice. |
| Done / published | v1.1 App Store release | `1.1.0` shipped the Reader / Editor / Preview position-continuity slice and was approved and released on the Mac App Store. Raw App Store Connect, TestFlight, App Review, and public build-number logs remain outside the repository. |
| Done / published | v1.0 App Store release | `1.0.0` was approved and released on the Mac App Store. The public listing confirms the version; raw App Store Connect, TestFlight, App Review, and build-number logs remain outside the repository. |
| Done | v1.0 product communication | README, Product Brief, App Store listing copy, release notes, screenshot captions, and current-state docs present one truthful `書く・読む・AI・書き出す` story. Local Assist availability and review boundaries remain adjacent to the AI claim. |
| Done / local evidence | v1.0 signed App Store candidate | Version surfaces agree on `1.0.0`; source, build, audit, signature, entitlement, checksum, distribution-probe, and sandbox-preview gates passed; and the signed pkg is recorded in ignored candidate metadata. Public release state is tracked separately from this local artifact evidence. |
| Done | v0.30 e-book Mode Paged Flow | e-book Mode can be used as a daily reading / revision surface for long Japanese Markdown prose while still looking like a book page. The slice should reduce page-turn friction with wheel / trackpad / keyboard movement, preserve chapter/page location for the later editor bridge, and verify large-document behavior. |
| Done | v0.31 e-book Mode Reading Focus / Spread View | `集中して読む` opens an occupied same-window reading surface, two-page book-like inspection exists when width allows, it falls back to one page when narrow, has keyboard / button navigation plus coarse movement, and remains a display layer over Markdown source rather than Preview DOM editing. |
| Done / follow-up recorded | v0.32 Editor / Reader Position Bridge | Built-app use confirmed return-to-editor, heading jumps, unsaved documents, and recovered documents. Stored e-book position versus current editor entry and Preview top-reset behavior move to the v1.1 continuity queue. |
| Done / Apple Books proof | v0.33 EPUB Export v1 Polish | EPUB export succeeded with Japanese text, structure, local images, links, code, and page-break behavior confirmed in Apple Books. Advanced production features and Kindle Previewer remain deferred or optional. |
| Done | v1 Workspace open / dirty markers | The workspace tree distinguishes active files, inactive open files, and open unsaved files without implying Git status or background indexing. Experimental drag/drop Move remains de-emphasized. |
| Done / follow-up recorded | v1 Selection tag insertion | The existing allowlisted Markdown insertion menu works without adding a formatting toolbar or arbitrary commands. Viewport clipping and command-palette parity move to the v1.1-v1.2 queue. |
| Done / published | v0.35 PDF Export Recovery | The broken TestFlight print UI path is replaced with direct PDF export: Save dialog chooses a `.pdf`, Rust validates main-window / non-empty HTML / `.pdf` destination, WebKit creates PDF data in-app, and no browser, shell, external opener, or macOS print dialog is used. Legacy `print_html` is removed from the callable surface. The direct PDF path is included in the published `0.36.0` App Store build. |
| Done / edge cases deferred | v0.36 e-book page-turn stabilization | User-side smoke accepted long-form reading, H1/H2 grouping, keyboard repeat, page counts, and spread behavior. 100k-character comfort and consecutive-image layouts remain bounded v1.1 observations rather than v1 blockers. |
| Done | v0.36 exported EPUB page-break proof | Blank-line-flanked page-break markers were confirmed in Apple Books. Kindle Previewer is optional compatibility proof, not a v1 gate. |
| Done / Go | v1.0 Release Candidate / Golden Manuscript Smoke | The user-side checklist accepted the core write -> read -> notice -> return -> revise -> review -> export flow and reported no No-Go condition. Remaining commented observations are recorded in `docs/v1.1-v1.2-followup.md`. |
| Done | Slice A Reader Stability | `EBookPane` render debounce (200ms shared with PreviewPane), rAF-coalesced pagination measurement, the scrollbar `contentDOM.blur()` refocus-on-mouseup fix, the `renderMarkdown` parse reduction (one DOM mutation pass + one sanitize), the rAF-throttled + self-extending preview->editor scroll-sync guard (fixes trackpad inertial-scroll stutter), and the per-image re-measurement collapse are implemented and pinned by focused tests. |
| Done | Slice C Robustness | `goToLine` double-rAF, `readOnly` in the `useImperativeHandle` deps (insertText / applyMarkdownFormat / insertTable gated), and the validated `tabId` Apple Assist apply path are done. Only Save-As rekey remount (needs editor session id separate from `documentKey`) stays deferred to v1.1. |
| Done | Slice B bare-`ease` sweep | Remaining transition-level bare `ease` keywords in the named style files and the matching inline icon transition are routed through `var(--ease-standard)`. `ease-out` / `ease-in-out` animations stay untouched. |
| Backlog | v1.x Safe file intake polish | Consider one bounded slice only when a concrete user case shows a gap for larger readable local images or additional text-open file extensions. Keep binary detection, file-size warnings, workspace boundary, no external image loading, and no project-indexing behavior intact. |
| Observation only | Hazakura Local Assist post-release polish | Pick this before the active Reader UX slice only for a concrete safety, review, App Store, availability, generation failure, responsiveness, or transaction-boundary issue. Keep App Store AI assistance local, user-initiated, unsaved until accepted, and Diff / Discard reviewable. |
| Fallback | Core Safe Editor quality probe | Use only when no concrete Reader UX slice is open or the run is a recurring quality pass. Inspect one high-risk basic surface with a named risk hypothesis, then either fix the smallest reproduced issue or close as `verified no-op`. |

Post-v1 guardrail: after v1.0, do not rush straight into v2.0. Use v1.x
to deepen the single-document product first: EPUB export, Diff / Review
ergonomics, provenance, movement between writing / reading layers,
distribution polish when needed, observation-driven Local Assist polish,
and opt-in document expression such as a Hazakura-owned font for
Preview / e-book / export layers. Any hard-to-read or cipher-like font
must remain a visual expression mode, not a privacy or encryption claim.
Book Scope / Book Workspace belongs after that footing is proven.

## v1 Refactor Watchlist

Do not schedule broad v1.x refactors just because a module is large.
Refactor only when it reduces a direct release risk, fixes an observed
user-facing problem, or lets a golden-path proof cover behavior that is
otherwise too brittle to verify. Keep public behavior, Markdown source
preservation, App Store lane boundaries, and ownership boundaries stable.

| Area | v1 decision | Trigger |
|---|---|---|
| `EBookPane` reader / pagination state | Watch closely during v0.32 and v0.33. Extract measurement, navigation, or reader-location helpers only if bridge / export polish exposes drift or hard-to-test behavior. | Position bridge, Spread View, large-image pagination, or large-document smoke shows a reproducible reader problem. |
| `epubExport` assembly | Allow a narrow split only during v0.33 if it improves fixture coverage for Japanese text, headings, local images, links, code blocks, or failure messages. | EPUB export proof fails or becomes unclear because metadata/package assembly and HTML cleanup are too coupled to test. |
| `useAppShellController` orchestration | Keep intact for v1 unless one named app-shell flow breaks. Prefer focused leaf extraction or regression tests over splitting the top-level hook for size alone. | A concrete New/Open/Save/Recovery/reader-mode transition bug needs isolation. |
| Hazakura Local Assist companion | Observation only. Split request/progress/review state only if built-app smoke exposes responsiveness, availability, or transaction-boundary instability. | Local Assist availability, generation, Diff / Discard, or unsaved-transaction behavior regresses. |
| Large Rust / UI test files | Defer organization cleanup to v1.x unless it directly unblocks a failing v1 proof. | A golden-path check is failing or too slow/fragile because the test surface is hard to isolate. |

## Automation Slice Protocol

Use this section for recurring or unattended automation. For the current
v1 lane, prefer the Active UX Queue above. Use the Pre-Review Automation
Order table only when a future pre-review lane explicitly reopens it.

- Pick exactly one slice from the Active UX Queue, or from the Pre-Review
  Automation Order table only when that lane is explicitly active again.
- Prefer the first open slice whose required environment is available.
- Keep the slice inside its named files/surface; do not bundle nearby
  polish.
- Before code changes, write or identify the focused regression/smoke
  that proves the issue.
- End each run as one of:
  - `implemented`: code/docs changed and the listed checks passed.
  - `manual-blocked`: the next proof needs the user's Mac, TestFlight,
    App Store Connect, certificate, or accessibility setting.
  - `verified no-op`: inspection showed no useful small change is safe
    or necessary.
- Update this file, `docs/smoke-checklist.md`, or `docs/handoff.md`
  only when the state, evidence, or next slice actually changes.

## Pre-Review Automation Order

| Order | Slice | Run Type | Automation Exit |
|---|---|---|---|
| 1 | App Store lane Move to Trash external-process review | Code / lane decision | `implemented`: App Store lane uses native Trash or cannot reach Move to Trash; focused Rust/UI tests pass; TestFlight smoke item remains if local signing is unavailable. `manual-blocked`: only signed TestFlight proof remains. |
| 2 | Workspace persistence before App Review | Code / TestFlight smoke | `implemented`: repeated launch/relaunch and outside-active-tab restore are covered by regression tests and local app evidence where possible. `manual-blocked`: signed TestFlight proof remains. |
| 3 | Pasted image decoded-size cap / `data:image` wording | Code + docs | `implemented`: oversized pasted payloads are rejected before unsafe memory growth, normal image paste still works, user-facing copy/docs match decoded-byte policy. |
| 4 | Direct save fallback failure safety | Code / test | `implemented`: failure-injection coverage proves direct fallback failures leave edits dirty/recoverable and do not report success; recovery is improved only if the test proves it is needed. |
| 5 | Status bar encoding / line-ending de-duplication | UI polish | `implemented`: duplicate passive `UTF-8` / `LF` labels are removed while dropdown controls, dirty/save state, and compact layout remain intact. |
| 6 | Core Safe Editor quality probe | Focused investigation / small fixes | `implemented`: one high-risk basic surface such as open/save/close, restore/recovery, preview, diff/review, workspace files, standalone files, image handling, keyboard/IME, or error recovery is inspected and any discovered narrow issue is fixed with focused proof. `verified no-op`: focused inspection finds no useful small fix. |
| 7 | Third-party license packet | Docs / release prep | `implemented`: notices are refreshed/reviewed against `package-lock.json` and `src-tauri/Cargo.lock`, bundled-resource probe passes, and any required upstream notices are included. |
| 8 | About metadata finalization | Config / bundle smoke | `implemented`: Tauri bundle metadata or documented canonical About surface is finalized and built-bundle About behavior is verified. |
| 9 | Pre-review regression evidence | CI or local evidence | `implemented`: either a small CI workflow exists or local release-readiness evidence is archived for the listed commands; signing/Transporter remain local account-bound. |
| 10 | Auto-backup filename uniqueness | Code / verified no-op | `implemented`: same-second backup collision is reproduced and fixed. `verified no-op`: focused inspection cannot reproduce a realistic overwrite risk. |
| 11 | Light accessibility sanity | Manual smoke / adjacent fixes | Keep as a lightweight pass only: keyboard reachability, focus escape/Tab behavior, readable labels, and obvious contrast on the selected core surface. Defer live VoiceOver / Increase Contrast depth unless the user's Mac is available or a concrete issue appears. |
| 12 | Help copy overlap cleanup | Product copy | Keep for human/Codex review unless explicitly assigned with tight wording constraints. |

Order 1 is implemented as of 2026-06-12. Order 2 is implemented at the
code-regression level as of 2026-06-12. Order 3 is implemented as of
2026-06-12. Order 4 is implemented as of 2026-06-12. Order 5 is
implemented as of 2026-06-12. Order 6 is implemented as of 2026-06-12
through the Recent Files surface-removal core probe. Order 7 is
implemented as of 2026-06-12. Order 8 is implemented as of
2026-06-12. Order 9 was first implemented as of 2026-06-12 through
archived local regression evidence, and has fresh v0.19 candidate
evidence as of 2026-06-13 through the archived pre-release-fix/package
checks. Order 10 is implemented as of 2026-06-12. Order 11 is
implemented as of 2026-06-12 through the Help-document scroll-region
keyboard reachability pass.
Order 12 is implemented as of 2026-06-12 through a focused Privacy
Policy / Local Data Disclosure role-split copy pass.
The remaining signed-TestFlight-only proof notes are superseded by the
App Store approval unless a future App Store build specifically reopens
Trash, workspace restore, accessibility, or network-observation risk.
The pre-review automation table is currently exhausted; the next
recurring quality run should use the fallback item in the Active UX Queue
only when no concrete Reader UX slice or post-release safety issue is
open.

## Historical Work Log

Detailed v0.18-v0.36 implementation logs and pre-v1.0 submission-prep
evidence moved to `docs/archive/operations/current-work-through-v1.0.md`.
That archive holds the v0.30-v0.36 reader UX slices, the Pre-RC Slice
A/B/C detail, the historical v0.28 Safety / Quality / AI Review
Foundation queue, the v0.29 AI Assist Review API and v0.29.1 Local
Assist responsiveness lanes, and the v0.20-v0.26 completed slices. Read
it only for historical context or to trace why a current boundary exists.

## Where To Look

- Current implementation truth: `docs/current-status.md`
- Phase order and boundaries: `docs/roadmap.md`
- Product and safety boundaries: `docs/product-brief.md`,
  `docs/security-boundary.md`, `docs/agent-workbench-boundary.md`
- Manual smoke: `docs/smoke-checklist.md`
- Release gates: `docs/source-release-checklist.md`,
  `docs/dmg-preview-checklist.md`, `docs/release-pre-check.md`
- Private App Review draft: ignored `docs/internal/` files only
- Historical v0.17 App Store-quality work:
  `docs/archive/operations/app-store-v0.17/`
- Historical v0.18-v0.36 implementation logs:
  `docs/archive/operations/current-work-through-v1.0.md`

## Do Not Use As Current

- `docs/archive/operations/app-store-v0.17/quality-agent-requests.md`
- `docs/archive/operations/app-store-v0.17/external-agent-requests.md`
- `docs/archive/operations/app-store-v0.17/current-work-closeout.md`
- `docs/archive/operations/current-work-through-v1.0.md`

Those files are retained as evidence and background only. They should
not be the starting point for new UX work.
