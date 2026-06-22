# Current Work

Status: Operational
Scope: v0.30-v1.0 Reader UX Stabilization queue and post-v0.29.1 evidence
Authority: High
Last reviewed: 2026-06-23 (v0.30 paged flow first slice)

## Purpose

Start here when choosing the next small `Hazakura Editor` slice.
This file is the current work queue. After the `0.29.1` App Store update
was reported approved and released on 2026-06-23, the active product lane
is `v0.30-v1.0 Reader UX Stabilization`: make the shipped Safe Editor,
L Mode, e-book Mode, EPUB export beta, Diff / Recovery, and Hazakura
Local Assist review surfaces feel like one coherent single-document
book-writing product.
Keep completed submission-prep and v0.29 Local Assist material as
evidence, not as the active queue.
Older v0.17 App Store-quality request packets and closeout evidence live
under `docs/archive/operations/app-store-v0.17/`, and the completed
v0.18 pre-review automation slices remain below as historical evidence.

Keep every slice small, verifiable, and inside the Markdown-first Safe
Editor boundary.
The v0.27 refinement phases are complete for source-tag purposes. Keep
`docs/archive/planning/v0.27-refinement-slice-plan.md` as the execution
memo / historical phase boundary and
`docs/post-v0.25-product-refinement-plan.md` as the
broader lens. The completed v0.29 lane established Hazakura Local Assist
transaction / Diff review as the visible AI assistance path. From here,
Hazakura Local Assist work should be observation-driven polish unless a
safety, review, App Store, availability, generation failure, or
transaction-boundary issue appears.

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

Pick one item at a time. The immediate next product slice is v0.30 paged
flow operation unless a concrete post-release Local Assist safety or App
Store lane issue appears.

| Priority | Slice | Acceptance |
|---|---|---|
| P0 | v0.30 e-book Mode Paged Flow | e-book Mode can be used as a daily reading / revision surface for long Japanese Markdown prose while still looking like a book page. The slice should reduce page-turn friction with wheel / trackpad / keyboard movement, preserve chapter/page location for the later editor bridge, and verify large-document behavior. |
| P1 | v0.31 e-book Mode Spread View | Two-page book-like inspection exists when window width allows, falls back to one page when narrow, has keyboard / button navigation plus coarse movement, and remains a display layer over Markdown source rather than Preview DOM editing. |
| P2 | v0.32 Editor / Reader Position Bridge | Opening e-book Mode near the current editor cursor or visible heading and returning from reader position to Markdown editing feels reliable for normal, unsaved, and recovered documents. |
| P3 | v0.33 EPUB Export v1 Polish | EPUB export remains an explicit user action and is polished enough for initial v1 use with Japanese text, headings, local images, links, code blocks, and clear failure messages. Advanced metadata, cover, navigation editing, and validation workflows stay deferred to v1.x. |
| RC | v0.34 v1.0 Release Candidate | Feature work freezes and the golden path covers New File, Open, Save / Save As, L Mode, Preview, e-book paged flow, Spread View, EPUB export, Local Assist, Diff / Discard, Recovery, relaunch, large documents, and App Store lane boundary checks. |
| Observation only | Hazakura Local Assist post-release polish | Pick this before v0.30 only for a concrete safety, review, App Store, availability, generation failure, responsiveness, or transaction-boundary issue. Keep App Store AI assistance local, user-initiated, unsaved until accepted, and Diff / Discard reviewable. |
| Fallback | Core Safe Editor quality probe | Use only when no concrete Reader UX slice is open or the run is a recurring quality pass. Inspect one high-risk basic surface with a named risk hypothesis, then either fix the smallest reproduced issue or close as `verified no-op`. |

v0.30 paged flow first slice is implemented at code-regression level as
of 2026-06-23: e-book Mode stays on the simulated book page surface, has
no Preview-like Flow/Page toggle, and turns vertical wheel / trackpad
gestures into page movement while preserving chapter/page location for
right-pane remounts and the future editor/reader bridge. Interpret
`Flow` in this lane as lower-friction movement through book pages, not
as one continuous scrolling Preview document. Human-side built-app
observation accepted the general behavior and requested faster wheel
response; the threshold was halved so a shorter vertical wheel /
trackpad gesture advances the page. Remaining v0.30 proof should focus
on real long Japanese Markdown reading feel, large-document behavior,
and the v0.32 editor cursor / reader location bridge. Verification for
this code slice passed with focused e-book / side-pane / CSS tests, full
`npm run test`, `npm run build:vite` (with the usual Vite chunk-size
warning), and `git diff --check`.

Post-v1 guardrail: after v1.0, do not rush straight into v2.0. Use v1.x
to deepen the single-document product first: EPUB export, Diff / Review
ergonomics, provenance, movement between writing / reading layers,
distribution polish when needed, and observation-driven Local Assist
polish. Book Scope / Book Workspace belongs after that footing is proven.

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

## Historical v0.29 AI Assist Review API

Implemented locally as of 2026-06-21:

- The standalone Review Desk screen, normal chrome entry point, manual
  candidate editor, and Markdown / text candidate file-import UI are
  retired from the current product surface.
- The internal candidate comparison primitive remains available for AI
  assist plumbing: `useReviewDeskState.runCandidateCompare` can still
  build a source-labelled `candidate` CompareCase and diff view without
  auto-save or auto-apply.
- `smoke:app-store-surface` now covers the retired surface expectation:
  top chrome / document meta / command palette do not expose manual Review
  Desk entry points, while the internal candidate comparison primitive
  remains tested.
- `smoke:macos-window` now gives a repeatable local packaged-app
  launch/window proof for `Hazakura Editor Dev.app` via
  `CoreGraphics` / `CGWindowListCopyWindowInfo`.
- `Cmd+Shift+R` stays reserved only to avoid WebView reload; it no longer
  opens a hidden Review Desk surface.

Historical v0.29 slices, if needed:

The 2026-06-21 Hazakura Local Assist review note
(`/Users/keisetsu/Downloads/apple-assist-review-fix-list-2.md`) is
accepted as a real pre-submission triage input, with the source caveat
that it was a static review and did not run the macOS app, live
Foundation Models, signing, sandbox smoke, Transporter, or App Store
Connect validation.

Additional human-side built-app observation on 2026-06-21:

- Opening the `apple-assist` window showed the Safe Editor start panel
  instead of the Local Assist companion UI, and clicking a Safe Editor
  action produced `Command is not allowed from window 'apple-assist'.`
- Treat the server-side command denial as correct defense-in-depth, but
  the user-visible state is a P0 bug: the `apple-assist` webview must
  not render main-window Safe Editor UI or expose File / Folder / New
  File actions.
- One likely source-level risk is the App Store Vite build shape:
  `vite.config.ts` currently omits the `apple-assist.html` Rollup input
  when `VITE_HAZAKURA_DISTRIBUTION_LANE=app-store`, which conflicts
  with the current helper-enabled App Store lane.

Historical v0.29 lane decision:

- Keep the App Store lane helper-enabled for now. Do not revert to the
  older helper-free App Store plan unless a signed TestFlight or App
  Review blocker proves the helper-enabled lane is not viable.
- Treat startup helper spawn / availability probe, implicit `apple-local`
  defaults, `apple-assist` window entrypoint drift, raw helper error
  exposure, preference/menu gating, and stale helper-free smoke
  expectations as real pre-submission risks.
- Keep broader file/paste/multi-file proposal ingest deferred until a
  fresh product boundary review reopens it.

Historical v0.29 slice order:

| Priority | Slice | Acceptance |
|---|---|---|
| P0 done / light smoke confirmed | Hazakura Local Assist window entrypoint / capability isolation | Source-level fix is in place: App Store Vite builds include `apple-assist.html`, the helper window title / HTML title use `Hazakura Local Assist`, and tests pin the entrypoint outside the App Store-only `agent.html` exclusion. 2026-06-21 user-side light built-app smoke confirmed the `apple-assist` window renders the dedicated Local Assist UI rather than the Safe Editor shell/start panel. Formal signed submit-lane smoke remains separate. |
| P0 done / light smoke confirmed | No startup helper spawn | Source-level fix is in place: the main shell does not run `useAppleAssistAvailability` on launch or command-palette open; availability probing is deferred until the Assist settings pane is open while `apple-local` is active, and the detached companion still owns its own probe. 2026-06-21 user-side light smoke confirmed `hazakura-local-assist-helper` was not present in Activity Monitor memory before opening the Local Assist window. |
| P0 done | Safe default / preference gate | New installs default the shared assist surface to `none`; command palette and app menu Local Assist entries respect the active user setting, not only distribution allow. App Store lane still permits Local Assist, but permission to ship is separate from user activation. |
| P0 done | Probe timeout and error hygiene | Availability probe now uses a short UI timeout and the Rust helper supervisor has a shorter probe timeout distinct from the longer generation timeout. Swift helper Foundation Models errors no longer include `debugDescription` in user-facing error envelopes; failures stay bounded to structured copy/kinds. |
| P1 done / released | App Store lane docs / smoke alignment | `docs/app-store-build.md` and `docs/smoke-checklist.md` consistently describe the current helper-enabled lane: helper bundled and signed, no startup helper spawn, Local Assist explicit/opened only, no auto-save/auto-apply, no external AI/API or network fallback. 2026-06-21 user-side light smoke also confirmed a simple request could be generated/applied and reviewed through the diff/update flow. 2026-06-22 Transporter rejected `0.29.0` build `28` because the helper lacked `com.apple.security.app-sandbox`; build `29` signed the helper with both `com.apple.security.app-sandbox` and `com.apple.security.inherit`, and the user reported successful Transporter delivery. Build `30` superseded it after the helper executable rename to `hazakura-local-assist-helper`; build `31` superseded build `30` for the first `0.29.1` Local Assist responsiveness package candidate; build `33` superseded build `31` after the Markdown preview flicker fix. The user reported `0.29.1` App Review approval and public release on 2026-06-23. Raw App Store Connect / App Review logs remain outside this repository unless separately recorded. |
| P1 done | Network and naming wording | User/reviewer-facing labels now use `Hazakura Local Assist` while preserving internal `apple-local` / `apple-assist` compatibility identifiers. Visible "no network call" Local Assist wording was replaced with "no third-party AI service" / "no external AI/API provider" / "no network fallback" wording. |
| P1 done | Preview copy and companion UI polish | User-facing Local Assist copy uses `Preview` / `プレビュー` instead of `Alpha`, `Experimental`, or `実験的`; availability copy now gives light-user guidance for macOS 26+, M1+ Mac, Apple Intelligence enablement, supported language / region, and no external AI service. The detached companion now opens as a compact tool window, keeps the request form vertically tight, keeps the progress area fixed-height across request states, and separates request groups inside a short scrollable in-session progress log. |
| P1 done | Local Assist preset / prompt boundary | UI labels are separated from internal `actionId`s, and pressing a preset inserts its concrete request sentence into the editable request field. The live helper prompt separates base instruction, action, visible request text, target text, and surrounding context. All presets now use the same unsaved AI edit transaction / Diff review flow so `要約`, `続きの案`, and `章レビュー` no longer behave like a separate result-only mode. |
| P2 | Target sync and maintenance polish | Send document target snapshots to Rust only while Local Assist is active; update stale helper comments, helper platform metadata, diagnostics version handling, and any remaining internal naming over time. |

## Shipped v0.29.1 / v0.29.01 Local Assist Responsiveness

This focused Local Assist engineering lane is implemented and shipped in
the `0.29.1` App Store update. It remains separate from broader AI
ingest, Book Workspace, Agent Workbench, or App Store metadata work.

Implementation state as of 2026-06-22:

- The source implementation is in place for request-scoped Local Assist
  streaming responsiveness: Assist Window requests carry `requestId`,
  stale status / partial events are ignored, `started` is emitted before
  helper generation, and long-running copy no longer clears the busy state.
- The active target document is locked read-only during generation while
  the app shell and Assist Window stay usable. Partial output is shown only
  in the Assist Window generation preview; the editor buffer still changes
  only when the final candidate enters the existing unsaved AI edit
  transaction / Diff review path.
- The Swift helper now supports `generate_candidate_streaming` with
  `candidate_partial` envelopes and final `candidate` envelopes; the Rust
  supervisor / Tauri command forwards partials to the Assist Window and
  keeps the legacy final-only command for compatibility.
- Verified locally with focused frontend tests, Rust `apple_assist` tests,
  fixture helper streaming smoke, live helper compile/probe smoke,
  `npm run build:vite`, `cargo fmt --check`, App Store submit-lane package
  generation, signed bundle probe, package signature check, package SHA,
  `productbuild --synthesize`, sandbox preview smoke, and `git diff --check`.
  Built-app long-generation smoke on macOS 26 + Apple Intelligence remains
  manual.

Observed product problem:

- Local Foundation Models generation can make the app feel like it stopped
  accepting input after a request.
- A loading label that appears only after generation finishes is not useful
  and can look broken in App Review or light user smoke.
- Locking the target editor while AI generation is in flight is acceptable,
  but the app shell, Assist Window, progress text, and generated preview
  must remain responsive.

Target behavior:

- When the user sends a Hazakura Local Assist request, the Assist Window
  shows a visible `started` state before the heavy generation path begins.
- The active target document enters a bounded read-only / generation lock
  so human edits, save/apply actions, and duplicate Local Assist requests
  do not race the AI edit transaction.
- Scrolling, window controls, the Assist Window, and progress display remain
  interactive while generation is running.
- Streaming partial output, when available, is shown inside the Assist
  Window as a generation preview. It is not written into the editor buffer
  token-by-token.
- Only the final completed result creates an unsaved AI edit transaction,
  records before/after text, and exposes Diff / Discard before save.

Implementation order:

| Priority | Slice | Acceptance |
|---|---|---|
| P0 done | Separate generation wait from UI responsiveness | `started` progress is emitted before helper generation waits; the handler yields before the streaming command; 2s long-running copy keeps `busy` true and duplicate requests disabled. |
| P0 done | Target document generation lock | The active target editor is read-only while its Local Assist request is running, with clear inline copy. Save and editor-change paths are guarded for that target; unrelated app chrome remains usable. |
| P1 done | Streaming helper protocol | The helper / supervisor boundary supports `candidate_partial` streaming envelopes and final `candidate` envelopes. Rust forwards partials as request-scoped Tauri status events and keeps the legacy final-only command. |
| P1 done | Streaming preview UI | Partial generated text appears in the Assist Window preview only. The editor source changes only on final completion through the existing AI edit transaction and Diff review path. |
| P2 | Cancel / stale request handling | Add request IDs and cancellation only when the helper process can actually stop or ignore the request safely. Do not show `Escでキャンセル` / `Esc to cancel` before that behavior is real. |

Non-goals for `v0.29.01`:

- No editor-buffer token streaming.
- No auto-save, auto-apply, hidden file rewrite, or background document
  rewrite.
- No generic chat, tool calling, network model fallback, local HTTP provider,
  provider plugins, broad workspace indexing, or Agent Workbench changes.
- No additional App Store Connect upload / package rebuild unless the user
  explicitly opens the next distribution lane.

Useful proof path:

- Source regression for slow Local Assist lifecycle / duplicate-request guard.
- Hook or component test for target lock and visible progress copy.
- Swift helper / Rust supervisor test for streaming envelope parsing once
  the protocol changes.
- Built-app smoke on a real macOS 26 + Apple Intelligence environment for
  first-run model warm-up, long prompt, partial preview, final Diff, discard,
  and save-after-review behavior.

## v0.20 Sakura Workspace Ergonomics

This is the next named UX improvement lane. Keep it inside the normal
Safe Editor surface and do not introduce a broader file-manager or IDE
model.

| Priority | Slice | Acceptance |
|---|---|---|
| P0 | Sakura chrome / file-state clarity | Expose sidebar collapse / restore from the main chrome or make the existing control clearly discoverable; show the active file name with path context above the editor; strengthen Markdown preview hierarchy with card-like contrast; highlight the selected workspace file with Sakura accenting; keep the status bar concise without duplicating encoding / line-ending values; keep New File on the existing menu, shortcut, command-palette, and workspace-file paths rather than a tab-row `+` affordance. |
| Deferred | Workspace switching dropdown | Keep the simple single-workspace model for now. Do not add a workspace switcher, multi-workspace session model, background indexing, Git status, LSP, terminal, plugin, or arbitrary command behavior in this lane. |

P0 is implemented locally as of 2026-06-13. Verification:
`npm run test -- src/components/app/AppTopChrome.test.tsx
src/components/app/AppWorkspace.test.tsx
src/components/editor/EditorMainPane.test.tsx
src/styles/editorCss.test.ts src/styles/workspaceCss.test.ts
src/styles/statusCss.test.ts`, `npm run build:vite`, and `npm run test`.

## Completed v0.20 Slices

- 2026-06-18: Developer / GitHub v0.20 release prep moved the source
  and Developer-lane version to `0.20.0`, kept the published App Store
  version documented as `0.19.0`, and prepared the warning-expected DMG
  preview release note for `v0.20.0`.
- 2026-06-13: Sakura chrome / file-state clarity is implemented. Normal
  Safe Editor chrome can collapse / restore the workspace sidebar
  through the same sidebar model, and L Mode keeps its separate
  workspace drawer. The central editor pane shows the active file name
  plus workspace-relative path context, clipped for long paths. Markdown
  preview now renders as a card-like reading surface with stronger
  heading, quote, and code contrast, and Sakura theme gives the selected
  workspace file a clearer pink-accent highlight. The initial tab-row
  new-file `+` affordance was removed after visual review; New File
  remains on the existing menu, shortcut, command-palette, and
  workspace-file paths. Workspace switching remains intentionally
  deferred.

## v0.21 e-book Mode PoC

v0.21 had a display-only e-book Mode PoC for a single Markdown
document. It used the existing `renderMarkdown` / Preview HTML pipeline
rather than CodeMirror decorations, split ATX headings into
chapter-like page sheets, kept Markdown source unchanged, and added a
thin in-pane chapter navigation bar plus lightweight deferred rendering
for the e-book surface.

This is historical MVP-prep evidence. v0.22 replaces the continuous
scroll / all-chapter display with an active chapter reader while keeping
the same Path Y safety boundary.

Keep the completed v0.21 PoC out of:

- EPUB archive generation.
- Vertical writing.
- Multiple Markdown files as one book.
- L Mode integration beyond a light source-read of reusable boundaries.
- Status bar structure cleanup, now tracked as v0.27 Phase 4.

## v0.22 e-book Mode Chapter Reader MVP

v0.22 turns e-book Mode into a chapter reader MVP. It keeps Markdown
source canonical and continues to use `splitMarkdownIntoChapters`,
`renderMarkdown`, `inlineWorkspaceAssetImages`, sanitize, workspace
image boundary, and Preview link routing.

Implemented locally as of 2026-06-19:

- `EBookPane` renders only the active `.ebook-chapter` into the DOM.
- `前の章` / `次の章` controls, chapter title, and `n / total` progress
  provide a simple reader chrome.
- `documentPath` changes reset to the first chapter, and source edits
  that reduce chapter count clamp the active index.
- `ArrowLeft` / `ArrowRight` chapter changes are scoped to the focused
  reader root only; no global key listener is used.
- `useDeferredValue(source)` is removed. The reader renders the visible
  chapter only, so source/chapter state consistency is prioritized over
  deferred display.
- e-book CSS removes the old multiple page sheet / chapter ornament /
  horizontal chapter nav model and scopes new reader chrome under
  `.ebook-pane`.

Manual smoke still useful: e-book toggle, one-chapter display,
previous/next controls, reader-root keyboard focus, workspace images,
blocked image appearance, light/dark appearance, and one very long
chapter's responsiveness.

Do not include in v0.22: CSS columns pseudo-pagination, true pagination,
spread view, vertical writing, EPUB export, multi-file book structure,
or L Mode integration.

## v0.23 e-book Mode Pseudo Pagination Spike

Implemented locally as of 2026-06-19:

- The v0.22 active chapter reader now pages the visible chapter body
  with CSS Columns inside `.ebook-page-flow`; `.ebook-pane` and
  `.ebook-reader-chrome` do not receive column layout.
- `.ebook-page-viewport` provides the fixed 文庫相当 simulation frame
  and clipping boundary, while `.ebook-page-flow` uses
  `column-fill: auto` plus horizontal `translateX(...)` page movement.
- Reader controls now move by page first, then connect to the next /
  previous chapter at chapter boundaries. A one-page chapter still
  advances to the next chapter through the page action.
- Page count is measured from the rendered chapter body and remeasured
  after active HTML changes, async workspace-image inlining,
  viewport resize, and root `style` / `data-theme` changes. Counts
  remain an app simulation result, not an EPUB-reader guarantee.
- Follow-up review tightened the Spike before manual smoke: page offset
  is now stored after layout measurement instead of reading
  `flowRef.current` during render, and long fenced code blocks are capped
  inside the simulated page with their own scroll.

Verification: `npm run test -- src/components/editor/preview/EBookPane.test.tsx
src/styles/previewCss.test.ts`, `npm run build:vite`, and `npm run test`.

Manual smoke still useful: e-book toggle, page movement, chapter
boundary movement, long chapters, image-heavy chapters, long code
blocks with inner scroll, tables, light/dark themes, Tab focus, and
whether the page reading surface feels different enough from Preview.

Follow-up decision after review: do not build a right-pane 2-up toggle.
The current right-pane grid cannot reliably provide the roughly 900px
needed for a two-page spread without making the editor column nearly
unusable. Treat 2-up as a future e-book occupied reading mode, not a
right-pane sub-feature.

## v0.24 e-book Mode Single-page Reading Surface Polish

Implemented locally as of 2026-06-19:

- The v0.23 single-page reader now has a page-sheet wrapper that keeps
  the paginated `.ebook-page-flow` separate from reader chrome.
- A fixed reader footer sits outside the CSS Columns flow and shows the
  chapter label plus chapter-local page progress. It does not attempt a
  whole-book page number.
- The single-page simulation frame was tightened to keep the page feel
  steadier in the right pane: page width, height, gap, padding, and
  footer height are pinned in `previewCss.test.ts`.
- Right-pane 2-up, spread view, horizontal scroll, `RightPaneMode`
  changes, full-screen takeover, EPUB pagination, and WYSIWYG editing
  remain out of this slice.

Manual smoke still useful: single-page reading feel, reader footer,
chapter boundary movement, long chapters, image-heavy chapters, long
code blocks with inner scroll, tables, light/dark themes, font-size
changes, and Tab focus.

## v0.25 Native-feeling Safe Editor Chrome Polish

This is the completed named product slice after v0.24 e-book Mode
polish. The v0.26 lane now focuses on authoring polish and initial EPUB
export before heavier review/import workflows.

Goal: reduce the sense of a web app inside a macOS window while keeping
the Markdown-first Safe Editor boundary intact.

Phase 1 (chrome alignment) is implemented and verified at code/CSS level.
Use `docs/native-macos-appearance-plan.md` as the planning memo.

Phase 1 implementation as of 2026-06-19:

- Top chrome has a traffic-light-safe drag region, with tabs, buttons,
  menus, and the L Mode floating chrome explicitly kept no-drag.
- Normal CodeMirror focus has a subtle visible signal while L Mode keeps
  the paper surface flat.
- L Mode active state, e-book accent fallback colors, right-pane mode
  segmented-control styling, and Diff row background tokens are aligned.
- Verification so far is code/CSS level: focused component/CSS tests,
  `npm run build:vite`, and `git diff --check`.

Phase 1 remaining proof: manual app smoke for titlebar dragging,
traffic-light overlap, dense tabs, light/dark themes, L Mode floating
chrome, segmented mode controls, e-book / Preview / Diff, Review menu
clickability, and keyboard focus.

Scrap-and-build decision as of 2026-06-19: the CSS-only glass polish
that was considered as a Phase 1 follow-up is **dropped**. A
`backdrop-filter` approximation does not change the feel enough to
justify the work, and it would be thrown away once real native vibrancy
lands.

Phase 2 (native vibrancy, brought forward) is now the active work:

- Add `window-vibrancy` and call `apply_vibrancy` on the main window
  with an `NSVisualEffectMaterial` matching the sidebar / titlebar band.
- Make the window transparent and replace the CSS
  `backdrop-filter: blur(16px)` approximation with transparent surfaces
  that let the native material render.
- Keep the five themes legible over the native material, and keep dense
  Markdown text on a readable non-vibrant background.
- Raise the macOS deployment target to **macOS 26** as part of this
  slice.

Do not add:

- A full SwiftUI / AppKit rewrite of any surface.
- True Liquid Glass fidelity (refraction, dynamic material).
- Vibrancy behind dense Markdown prose.
- A full top-bar rewrite, separate toolbar architecture, or new
  `RightPaneMode`.
- Outline / Diff information-architecture changes beyond visual polish.
- Theme redesign, Git / LSP / terminal / plugin behavior, or arbitrary
  command surfaces.

Suggested slice order for Phase 2:

1. Bump `minimumSystemVersion` to macOS 26 and update lane docs as a
   release-planning step, separate from the visual change.
2. Add `window-vibrancy`, call `apply_vibrancy` on the main window, and
   prove the native material renders in one theme.
3. Make the sidebar / top-chrome surfaces transparent so the material
   shows through, and tune the five themes over it.
4. Verify App Store lane compatibility and built `.app` smoke on macOS 26.

Verification: focused component / CSS tests for changed controls,
`npm run build:vite`, `git diff --check`, and built `.app` smoke on
macOS 26 for native material rendering, window transparency, and the
existing editor / preview / diff / status bar surfaces. Browser-only
smoke is not enough for native window / material claims.

Treat the macOS 26 floor change as release-planning work: a new App
Store build declaring macOS 26 is a lane decision with TestFlight / App
Review evidence, not a silent metadata bump.

## v0.26 Polish And EPUB Export

v0.26 is released on the Mac App Store as of 2026-06-20. The completed
work raised product quality with focused polish slices and an initial
EPUB export path while staying inside the Markdown-first Safe Editor
boundary.

Goal: make the app harder to get stuck in, make the e-book surface feel
consistently available, and add an explicit first EPUB export action
without introducing a second document model.

Completed order:

1. **No-workspace new document / Save As**: New File should work when no
   workspace is selected by creating an untitled standalone Markdown tab.
   Save for a pathless tab should route to Save As / file picker before
   writing, then become an ordinary standalone file tab. Do not create a
   hidden workspace, background autosave location, or app-managed project
   folder in this slice.
2. **e-book affordance empty-state polish**: the e-book / book button
   should not disappear just because no file is open. Keep the control
   visible in the mode cluster, but show a disabled or empty state until
   a Markdown/text document is active. It must not show stale content
   from a previous file.
3. **Initial EPUB export**: export the active Markdown source through an
   explicit user action and save dialog. Start with a minimal `.epub`
   archive for the current document / current chapter structure, using
   Markdown source and the existing preview safety assumptions. Do not
   add external command execution, Calibre / EPUBCheck launch, background
   upload, vertical writing, advanced metadata editing, or a hidden EPUB
   document model.

AI Markdown ingest remains useful, but it should not crowd out these
basic authoring and export improvements in v0.26 unless a separate
focused slice is explicitly selected.

P0 is implemented locally as of 2026-06-20. With no workspace selected,
New File now creates an untitled standalone Markdown tab without writing
to disk. Save on that pathless tab routes through Save As, then rekeys
the tab to the selected standalone file. Pathless untitled tabs are not
persisted as restorable file paths and do not expose an empty full-path
copy bar.

Verification: `npm run test -- src/hooks/document/useFileOpening.test.tsx
src/hooks/document/useSaveActions.test.tsx
src/hooks/workspace/useWorkspaceStatePersistence.test.ts
src/components/editor/EditorMainPane.test.tsx
src/hooks/document/useActiveDocumentIdentity.test.ts`, `npm run test`,
`npm run build:vite`, and `git diff --check`.

P1 is implemented locally as of 2026-06-20. The e-book toggle remains
visible in the right-pane mode cluster even when no active document is
available, but it is disabled and reports inactive state so it cannot
surface stale prior-document content. Active editor documents keep the
e-book toggle enabled unless an image preview is the foreground surface.
L Mode continues to hide the normal meta bar controls as before.

Verification: `npm run test --
src/components/app/RightPaneToggleControls.test.tsx
src/components/app/DocumentMetaBar.test.tsx
src/components/app/AppTopChrome.test.tsx src/components/app/SidePane.test.tsx`,
`npm run test`, `npm run build:vite`, and `git diff --check`.

P2 is implemented locally as of 2026-06-20 as an EPUB export beta. The
File menu and command palette expose `Export EPUB (Beta)...`, which
exports the active Markdown source to a minimal `.epub` through a save
dialog. The archive contains a package file, navigation document,
single XHTML content document, packaged workspace / allowed `data:image`
resources, dialog-scoped Title / Author / Language metadata, explicit
page-break hints from blank-line-flanked standalone `---` / `===` lines,
and a small stylesheet generated from the current Markdown headings.
Markdown source remains canonical. This beta does not launch external
validators, add a cover editor, support vertical writing, manage
multi-file book order, or claim reader-perfect pagination. The beta writes
the archive through a base64 IPC payload; if future work adds larger EPUB
packages or heavier resource bundles, prefer a plugin-fs or temp-file
handoff instead of growing this IPC path.

Verification: `npm run test --
src/features/document/epubExport.test.ts
src/hooks/document/useDocumentExport.test.tsx
src/hooks/app/useAppMenuActionListener.test.tsx
src/hooks/commandPalette/useCommandPaletteController.test.ts
src/hooks/app/useAppShellSideEffectsController.test.ts
src/lib/diagnostics.test.ts`, `cargo test --manifest-path
src-tauri/Cargo.toml epub_beta -- --nocapture`, and focused
`save_binary_file_as` Rust tests.

Follow-up planning note as of 2026-06-20: EPUB input UI now uses a
dedicated `EpubExportSettings` dialog draft state for Title / Author /
Language plus generated identifier / modified metadata. Headings should
keep driving navigation / table of contents; explicit page breaks should
be introduced separately as standalone `---` / `===` markers, without
silently rewriting Markdown source.

The EPUB beta follow-up is now decomposed into four slices in
`docs/ebook-mode-epub-export-plan.md` ("v0.26 Follow-up Slice 構成"). The
decomposition comes from five concrete gaps between the beta
implementation and the first-slice scope, recorded in the same plan under
"Beta 実装の未達スコープと乖離":

1. **Image packaging is missing**: `buildEpubBetaArchive` calls
   `renderMarkdown()` but not `inlineWorkspaceAssetImages()`, so workspace
   images reach the XHTML as transparent GIFs with a
   `data-hazakura-image-path` attribute and render broken in EPUB readers.
2. **Preview-only markup leaks into XHTML**: `.markdown-table-frame`,
   `.markdown-task-checkbox` glyphs, and `.blocked-image` spans are emitted
   into the content document without matching `epubCss()` styles.
3. **Frontmatter / `---` collision**: the page-break candidate and YAML
   frontmatter fences are not distinguished; neither
   `splitMarkdownIntoChapters` nor `collectMarkdownHeadings` recognizes
   frontmatter.
4. **Duplicated parser helpers**: chapter splitting and heading collection
   are separate implementations with already-divergent fenced-code and
   Setext handling, so the "same helper" verification item is not met.
5. **No EPUBCheck milestone**: the beta output originally had no manual
   EPUBCheck verification checkpoint. Slice 2 now records the first
   warning (`dc:identifier` placeholder UUID), the fix, and a follow-up
   `test02.epub` pass with no errors or warnings.

Slice 1 is implemented locally as of 2026-06-20: EPUB export now packages
workspace images and allowed small `data:image` references into
`OEBPS/images/`, strips Preview-only markup before writing XHTML, reuses
`splitMarkdownIntoChapters` for export navigation, supports inline
Markdown in headings without dropping later nav entries, and recognizes
YAML frontmatter so frontmatter `#` / `---` do not become book headings.
The Local Data Disclosure Help document now describes the EPUB beta image
and validation boundary. Slice 2 found one EPUBCheck warning for the
placeholder `dc:identifier`, replaced it with a per-export valid UUID,
and the user-checked `test02.epub` passed EPUBCheck 3.3 with 0 fatal
errors / 0 errors / 0 warnings / 0 info. Slice 3 adds a dialog-scoped
Title / Author / Language draft before Save As, generates `dcterms:modified`
from export time, keeps per-export UUID identifiers, and omits
`dc:creator` when Author is blank. Slice 4 adds blank-line-flanked
standalone `---` / `===` page-break markers via a shared e-book helper:
EPUB `content.xhtml` receives `.page-break` blocks and e-book Mode shows
the same markers as page cues, while YAML frontmatter, fenced code, and
non-blank-flanked rules stay unchanged. Markdown source remains
canonical, and normal Preview / HTML export are unchanged.

Post-release pre-v0.27 quality follow-up as of 2026-06-20:

- Right-bottom error/recovery banners now expose a dismiss action for
  generic errors that previously had no recovery buttons. Save failures
  and external-change conflicts keep their existing explicit recovery
  actions.
- e-book Mode page-break markers no longer draw a horizontal rule in
  the right pane, so blank-line-flanked standalone `---` / `===`
  markers read as page cues rather than both a rule and a page break.
- Human-side built-app smoke for both behaviours passed on 2026-06-20,
  per user report. Code-level verification is recorded in the commit
  that introduced the fix.

## v0.27 Refinement

Use `docs/archive/planning/v0.27-refinement-slice-plan.md` as the
historical execution memo.

Phase 1 is implemented locally as of 2026-06-20 at code-regression
level and accepted as the v0.27 Phase 1 result after human-side
large-document built-app smoke confirmed the central editor text renders
normally. Investigation found that `PreviewPane` rendered Markdown
synchronously during React render, so a large document with Preview
already visible could compete with the editor's first commit. The
Preview surface now clears stale content before paint, shows a
theme-bound loading surface, schedules Markdown rendering for the next
animation frame, then performs the existing workspace-image inlining
path. A follow-up startup check found that restored tabs are only
installed after the persisted files finish opening, so the editor pane
now shows a theme-bound restore loading surface instead of briefly
falling back to the start panel while `restoreComplete` is still false.
This keeps Markdown source, Preview sanitization, local-link routing,
and export behavior unchanged.

Known deferred request: showing the app theme before React starts remains
desirable for perceived startup quality, but the attempted boot-theme
approach made CodeMirror / Tauri first-paint layout failures hard to
isolate in the real app. Keep the improvement request, but do not reopen
it inside v0.27 Phase 1. Revisit only as a separate debug slice with
real-app DevTools evidence and one boot-path change at a time.

Verification: `npm run test --
src/components/editor/preview/PreviewPane.test.tsx
src/styles/previewCss.test.ts src/components/app/SidePane.test.tsx
src/components/editor/preview/EBookPane.test.tsx`, `npm run test --
src/components/editor/EditorMainPane.test.tsx
src/components/app/AppWorkspace.test.tsx src/styles/editorCss.test.ts`.

Manual large-document built-app smoke remains useful for actual
first-paint feel. Phase 1 itself is otherwise closed; if e-book Mode
still shows a first-render disturbance, inspect its active-chapter render
/ CSS Columns measurement as a separate follow-up rather than expanding
Phase 1.

Phase 2 is implemented locally as of 2026-06-20 at code-regression
level and accepted as the v0.27 Phase 2 result after human-side
right-pane built-app smoke confirmed chapter / page handoff across mode
switches. Investigation found a concrete mode-switching disconnect: when
the right pane moved from e-book Mode to Preview / another pane and back,
the e-book reader lost its active chapter / page and returned to the
document start. `SidePane` now keeps the e-book reader location keyed by
the active document and passes it back into `EBookPane` when the reader
surface remounts. This preserves the feeling that Preview and e-book are
two layers over the same Markdown source; it does not add persistence,
background indexing, or a second document model.

Verification: `npm run test --
src/components/app/SidePane.test.tsx
src/components/editor/preview/EBookPane.test.tsx`.

Human-side right-pane built-app smoke passed on 2026-06-20: opening a
multi-chapter Markdown file, moving e-book Mode to another chapter,
switching right-pane modes, then returning to e-book Mode kept the same
chapter / page context. Phase 2 is closed.

Phase 3 is implemented locally as of 2026-06-20 at focused-regression
level and accepted as the v0.27 Phase 3 result after human-side
heading-jump built-app smoke found no interaction discomfort.
Investigation found that `goToLine()`
selected and scrolled the CodeMirror target line, but the editor scroll
ratio reported to the rest of the surface still depended on the later
scroll event / measurement path. A first attempt used target line ratio,
but real-app review found that long documents can show a temporary
Preview offset because Preview consumes the ratio as a pixel scroll
ratio. `goToLine()` now waits one animation frame after the CodeMirror
jump and reports the settled editor pixel scroll ratio, so
position-aware surfaces such as scroll sync / HUD no longer depend only
on the later browser scroll event and avoid the line-ratio mismatch.
This keeps Markdown source, outline parsing, cursor selection, Preview
rendering, and mode state unchanged.

Follow-up human-side use found a separate manual-scroll issue: Outline
heading jumps were fine, but central-editor manual scrolling with a
trackpad, wheel, or scrollbar could fail after the first successful large
movement. The editor could appear to stay near the previous focus area
and behave like text was being selected instead of scrolling. A focused
follow-up confirmed the likely cause: CodeMirror retained editing focus
while the native scrollbar gutter was used. The editor now blurs the
editing DOM only when the scrollbar gutter is pressed, which human-side
built-app smoke confirmed fixes the second-large-scroll behavior without
changing normal content clicks, source, or selection semantics. This
still does not add persistence, indexing, Preview DOM editing,
source-aware mapping, or a second document model.

Verification for the accepted Phase 3 code path:
`npm run test -- src/components/editor/EditorPane.test.tsx`.

Human-side heading-jump built-app smoke passed on 2026-06-20: with a long Markdown
document, Outline heading clicks near deep document positions did not
feel uncomfortable, including the observed Preview sync behavior around
roughly 6000 lines. The central-editor manual-scroll issue is fixed by
the follow-up scrollbar-gutter blur slice. The remaining editor /
Preview visual drift is tracked as lower priority unless it makes
navigation feel broken. The broader session-local editing-position
history candidate is not implemented in this slice.

Phase 4 is implemented locally as of 2026-06-20 and has passed the full
local verification gate. The status bar no longer relies on a single compacted
`statusDetail` string for the normal Safe Editor surface: active document
metadata is split into primary detail (file type, byte size, character
count, and large-file warning when present) and secondary detail
(encoding, line ending, final-newline state, cursor / selection, and
heading context). Normal mode shows the primary detail while preserving
the secondary detail in hover/title, and keeps the LF / CRLF and encoding
selectors reachable in the trailing format group. L Mode keeps format
controls hidden and shows the combined detail, preserving the existing
quiet focused-writing behavior. A small follow-up also keeps the L Mode
top chrome free of the developer-build badge and exposes Review / Diff /
Outline as independent right-pane controls instead of collapsing them into
one menu.

Verification: `npm run test`, `npm run build:vite`, and
`git diff --check`.

v0.27 release-candidate closeout note as of 2026-06-20:

- The boot-theme-first startup improvement remains intentionally
  deferred. Reopen only as a separate real-app DevTools debug slice.
- Very long-document editor / Preview scroll sync can still drift
  because the app does not maintain a semantic source map between the
  editor and rendered Preview. Treat as a future quality slice, not a
  v0.27 blocker.
- AI Markdown ingest, Workspace As Book, Native Vibrancy Phase 2, and
  EPUB document-model work remain outside the v0.27 source tag.

## Historical v0.28 Safety, Quality, And AI Review Foundation

Use `docs/roadmap.md`, `docs/security-boundary.md`, and
`docs/ai-markdown-ingest-plan.md` as the planning boundary. v0.28 may
ship several small slices, but each slice should have a focused proof and
must not depend on Book Workspace Alpha.

Goal: align product trust claims with implementation, preserve the
Japanese long-form editing experience, and create the first reusable
AI-proposal review foundation without becoming an agent platform.

| Priority | Slice | Acceptance |
|---|---|---|
| P0 | L Mode image policy parity | L Mode follows the same external-image and `data:image` safety expectations as Preview / export. External `http:` / `https:` images are not rendered as a direct fetch path. Supported `data:image` MIME types, strict base64 validation, and the 2 MB inline cap match Preview's embedded-image policy. The 2 MB cap is only for Markdown-embedded `data:image` payloads; workspace image files and EPUB packaged images stay under the separate workspace/local image boundary and may need their own EPUB image policy later. Workspace images still resolve through the bounded workspace-image command, source text remains unchanged, and focused L Mode tests pin the behavior. |
| P1 | Workspace search encoding parity | Workspace search uses the same practical decode assumptions as safe file open where possible: UTF-8 plus Shift-JIS / EUC-JP. Do not claim broader legacy-encoding parity unless file open supports it first. Binary-looking and oversized files remain skipped, and focused Rust tests cover UTF-8 plus Shift-JIS or EUC-JP. |
| P2 | System handoff hardening | Fixed OS handoff routes such as external links, Finder reveal, and print/browser handoff are easier to audit as allowlisted OS handoff, not arbitrary command execution. Keep behavior user-initiated and bounded; prove normalization / allowlist behavior with existing or focused tests. |
| P3 | AI proposal review foundation | Add only one reusable intake / review primitive: file, paste, or existing transaction input into explicit Diff / Review. App Store lane remains Hazakura Local Assist-only for AI assistance; Developer / GitHub integrations stay behind Hazakura Local Assist / Agent Workbench boundaries. No auto-apply, auto-save, auto-commit, generic chat, provider plugin, or hidden workspace rewrite. |
| Release gate | Golden-path smoke checklist | Before tagging a v0.28 source / local-app release, run or update a focused checklist for New File, Save / Save As, L Mode, e-book Mode, EPUB export, Diff / Recovery, and AI proposal review if the review primitive is included. |

P0 is implemented locally as of 2026-06-21. L Mode no longer renders
external `http:` / `https:` image URLs as a direct fetch path; those
remain source-preserving placeholders. L Mode now shares Preview's
embedded `data:image` policy for supported MIME types, strict base64
validation, and the 2 MB Markdown-inline cap, while workspace image files
continue to resolve through the bounded workspace-image command. Focused
verification: `npm run test -- src/features/editor/lMode/imageWidget.test.ts src/features/editor/lMode/extension.test.ts src/features/editor/markdown.test.ts`;
`npm run build:vite`; `git diff --check`.

P1 is implemented locally as of 2026-06-21. Workspace search now reads
bytes and reuses the file-open text decoding helpers, so UTF-8, UTF-8
BOM, Shift-JIS, and EUC-JP files that pass the existing binary / size
guards can be searched without broadening the supported encoding set.
Files that still cannot be decoded losslessly remain skipped. Focused
verification: `cargo test --manifest-path src-tauri/Cargo.toml search_finds_ -- --nocapture`;
`cargo test --manifest-path src-tauri/Cargo.toml tests::search:: -- --nocapture`;
`cargo test --manifest-path src-tauri/Cargo.toml -- --test-threads=1`;
`cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`;
`git diff --check`.

P2 is implemented locally as of 2026-06-21. External URL opening,
Finder / file-manager reveal, and print-browser handoff now route
through one fixed OS handoff helper with platform-specific static command
templates. External URL scheme validation remains bounded to
`http:` / `https:` / `mailto:` / `tel:`, and print handoff now rejects
path-like or non-HTML file names on the Rust side before creating the
temporary file. This does not add arbitrary command input, shell input,
generic opener UI, or broader file-manager behavior. Focused
verification: `cargo test --manifest-path src-tauri/Cargo.toml tests::os_handoff:: -- --nocapture`;
`cargo test --manifest-path src-tauri/Cargo.toml tests::external_links:: -- --nocapture`;
`cargo test --manifest-path src-tauri/Cargo.toml _rejects_agent_window_label -- --nocapture`;
`cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`;
`cargo test --manifest-path src-tauri/Cargo.toml -- --test-threads=1`;
`npm run build:vite`;
`git diff --check`.

P3 is accepted as an already-implemented foundation slice as of
2026-06-21. The first reusable primitive is the existing transaction /
candidate review path, not a new file-import workflow: the internal
candidate-review primitive can still build a source-preserving
`candidate` CompareCase, and the detached Hazakura Local Assist Writing
Companion records unsaved AI edit transactions with compact Diff /
Discard review before save. This closes the v0.28 foundation goal without
adding broader provider plugins, generic chat, hidden
workspace rewrites, auto-save, auto-commit, or broader Agent Workbench
integration. Explicit file/paste ingest expansion, multi-file proposal
review, richer provenance, and Agent Workbench external-edit intake remain
deferred v0.29+ work under `docs/ai-markdown-ingest-plan.md`. Focused verification:
`npm run test -- src/hooks/review/useAppleAssistCandidate.test.ts src/features/editor/aiEditTransactions.test.ts src/components/app/AppleAssistReviewBar.test.tsx src/features/editor/aiEditTarget.test.ts`;
`npm run build:vite`;
`git diff --check`.

Deferred from v0.28:

- Book Workspace Alpha, multi-file chapter ordering, saved book
  manifests, and `Workspace = Book` information architecture. Target
  v2.0 after single-document book / EPUB / review primitives are strong.
- Native Vibrancy Phase 2 and macOS 26 release-lane changes unless that
  lane is explicitly reopened.
- EPUB document-model work, cover editing, vertical writing, OKF, or
  reader-perfect pagination claims.

## Historical v0.28 Active UX Queue

Superseded by the Active UX Queue near the top of this file. Retain these
items as historical routing evidence only; do not select them as current
work unless a regression or fresh boundary decision reopens the slice.

## External-Agent Friendly Queue

Use this when handing work to an external implementation agent. Prefer
debugging, small implementation fixes, and evidence-backed refactors
over copy-heavy or product-voice-sensitive work.

| Fit | Candidate | Scope |
|---|---|---|
| Done locally | v0.28 L Mode image policy parity | Implemented on 2026-06-21. Do not re-pick unless a regression appears; continue with the release-gate smoke checklist or a narrow quality probe. |
| Done locally | v0.28 workspace search encoding parity | Implemented on 2026-06-21. Do not re-pick unless a regression appears; continue with the release-gate smoke checklist or a narrow quality probe. |
| Done locally | v0.28 system handoff hardening | Implemented on 2026-06-21. Do not re-pick unless a regression appears; continue with the release-gate smoke checklist or a narrow quality probe. |
| Done locally | v0.28 AI proposal review foundation | Accepted on 2026-06-21 as an existing transaction / candidate Diff review primitive. Do not add file/paste/multi-file ingest in v0.28; leave broader ingest expansion for v0.29+. |
| Superseded locally | v0.29 single-file proposal import | The 2026-06-21 Review Desk file-import slice was retired before release. The current v0.29 shape removes the standalone Review Desk screen and keeps only the internal candidate comparison primitive for AI assist plumbing. |
| Good | L Mode quality investigation | Pick one reproduced L Mode issue or one measurable quality gap only: caret, IME, Backspace/Delete, hidden markers, lists, dividers, links, tables, images, visual overlap, source preservation, or performance baseline. Do not add a new editing model or contenteditable surface. |
| Good | Theme quality investigation | Pick one concrete theme issue only: contrast, focus visibility, status/error readability, dialog readability, or Increase Contrast behavior. Do not redesign palettes or add theme customization. |
| Good | Core Safe Editor quality probe | Inspect one basic surface with a clear risk hypothesis, then fix only a reproduced issue or close as `verified no-op`. Prefer open/save/close, restore/recovery, preview, diff/review, workspace files, standalone files, image handling, keyboard/IME, or error recovery. |
| Good | Focused refactor for a verified bug | Refactor only when it directly fixes or tests one observed user-facing problem. Keep ownership boundaries and public behavior stable. |
| Poor fit | Help copy overlap cleanup | This is product voice and submission copy work. Keep it for human/Codex review unless explicitly assigned with tight wording constraints. |
| Poor fit | Broad accessibility audit | Keep accessibility to lightweight sanity checks adjacent to core surfaces unless a concrete failure is observed or the user's Mac is available for live VoiceOver / Increase Contrast work. |

## Completed v0.18 Slices

- 2026-06-12: Core Safe Editor preview/export CSS variable guard is
  implemented. Export HTML and Print to PDF standalone preview HTML now
  define the `--status-bg` / `--status-text` variables used by the live
  Markdown preview CSS for code blocks and blocked-image placeholders,
  so exported documents do not silently lose those preview colors. A
  focused `useDocumentExport` regression test pins the exported HTML
  variable contract without changing Markdown rendering, save behavior,
  or preview link routing.
- 2026-06-12: Core Safe Editor malformed external Markdown link
  guard is implemented. Preview / Help external-link normalization now
  rejects `http:` / `https:` links that omit the explicit `//host`
  separator before they can be handed to the OS external-open path,
  matching the existing Rust command boundary. Workspace-relative
  Markdown links, allowed external links, unsafe-scheme blocking, and
  in-app text-open routing remain unchanged.
- 2026-06-12: Tab close affordance clarity is implemented. Text-file
  tabs and image-preview tabs now expose the close control as a stable
  `x` button rather than a plain circular mark, while retaining the
  existing tab selection, dirty-dot, keyboard navigation, and
  `aria-label` behavior. Focused component coverage pins the text and
  image close controls plus dirty-tab description, and focused CSS
  coverage keeps the close affordance distinct from the dirty dot.
- 2026-06-12: External-window routing for Markdown / Help links is
  implemented. Markdown preview clicks still open supported
  workspace-relative text links inside the app, while explicit
  `http:` / `https:` / `mailto:` / `tel:` clicks from Preview, Help
  documents, and Support Diagnostics are intercepted before WebView
  navigation and routed through a bounded Tauri external-open command.
  Unsupported files, absolute paths, workspace-outside links, and unsafe
  schemes remain blocked; focused frontend tests pin Preview, Help,
  Diagnostics, local-link preservation, and unsafe-scheme behavior, and
  Rust tests pin the command allowlist.
- 2026-06-12: Core Safe Editor image-preview close regression
  coverage is implemented. A focused `useImagePreview` test now pins
  that closing a directly opened standalone image preview clears the
  image surface and returns to the previous text tab, preserving the
  read-only image-preview-as-tab contract without changing workspace
  file operations or save behavior.
- 2026-06-12: Help copy overlap cleanup is implemented as a
  narrow Privacy Policy / Local Data Disclosure role split. The in-app
  Privacy Policy now stays public-copy oriented, avoids the
  `.hazakura/backups/...` implementation path and `fetch` wording, and
  points to local preferences plus optional recovery / backup data at a
  high level. Local Data Disclosure keeps the technical storage,
  preview/export, App Store lane, and network/process detail. Focused
  Help-pane coverage pins that the Privacy Policy does not absorb the
  technical disclosure details again.
- 2026-06-12: Light accessibility sanity is implemented as a narrow
  Help-surface pass. The Privacy Policy / Local Data Disclosure / About
  / Open Source Acknowledgements Help documents and the Support
  Diagnostics pane now expose their long body scroll container as a
  named `region` with `tabIndex=0`, so keyboard-only users can focus
  the scroll area before reading or paging through long Help text.
  Focused tests pin both the read-only Help shell and diagnostics JSON
  shell. Live VoiceOver and Increase Contrast checks remain manual
  smoke items on the user's Mac rather than code-level claims.
- 2026-06-12: Auto-backup filename uniqueness is implemented.
  Focused Rust regression coverage reproduced same-second snapshot
  overwrite risk for a single workspace file. Backup filenames now
  include milliseconds and use a bounded numeric suffix only when a
  same-name file already exists, so rapid snapshots remain distinct
  while staying under `.hazakura/backups/<relative-path>/`. Recovery
  listing remains newest-first, with filename tie-breaking for
  same-timestamp files.
- 2026-06-12: Pre-review regression evidence is archived in
  `docs/archive/operations/v0.18-pre-review-regression-evidence-2026-06-12.md`.
  The local gate pass includes `npm ci`, `npm run build:vite`,
  `npm test`, `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`,
  `cargo test --manifest-path src-tauri/Cargo.toml`, `npm audit`,
  `cargo audit -f src-tauri/Cargo.lock`, `npm run build`, and the
  macOS distribution probe. The first Rust full-test run had one
  transient Agent Workbench PATH propagation failure; the focused rerun
  and a full rerun passed, so this remains evidence to watch rather than
  a product bug claim. Signed TestFlight smoke, App Review submission,
  and account-bound distribution proof remain separate.
- 2026-06-12: About metadata finalization is implemented. The base
  Tauri config now sets `bundle.publisher` to `Hazakura Lab` and
  `bundle.copyright` to
  `Copyright (c) 2026 Hazakura Lab. All rights reserved.`, so the
  macOS About panel built from `src-tauri/src/menu.rs` has canonical
  publisher and copyright data across inherited build lanes. The local
  helper-free App Store preview bundle's `Info.plist` now includes
  `NSHumanReadableCopyright` with the expected value.
- 2026-06-12: Third-party license packet refresh is implemented for
  the current lockfiles. `THIRD_PARTY_NOTICES.md` now records the
  2026-06-12 `package-lock.json` runtime scan result, the
  `cargo metadata --locked` refresh command, and an appendix for
  resolved Cargo graph entries that were present in the lockfile graph
  but not previously named explicitly. The packaged app-bundle notice
  surface remains `LICENSE` plus `THIRD_PARTY_NOTICES.md`; final legal
  review, full license text packet decisions, and icon source
  provenance remain distribution-review tasks rather than app behavior
  changes.
- 2026-06-12: Recent Files surface removal is implemented as the Order
  6 Core Safe Editor quality probe. The misleading file-level recent
  surface no longer appears on the start panel or native File menu, and
  legacy `hazakura-note-recent-files` localStorage entries are removed
  on read/write instead of being migrated forward. `Recent Folders`,
  explicit Open / Open Folder, workspace restore, standalone-file open,
  and normal save paths remain unchanged. README, Help privacy copy, and
  the workspace-file smoke wording now refer only to retained recent
  folder behavior where applicable.
- 2026-06-12: Status bar encoding / line-ending de-duplication is
  implemented. In normal Safe Editor mode, the passive status detail now
  removes the active tab's currently selected `UTF-8` / `LF`-style
  format values because the trailing encoding and line-ending dropdowns
  already expose and change those values. The full detail remains in the
  hover title, the dropdown controls remain visible, and L Mode keeps
  the previous passive detail because those focusable controls are hidden
  there. Focused `StatusBar` coverage pins the normal-mode de-duplication
  while keeping the dirty/save live region and L Mode control removal
  intact.
- 2026-06-12: Direct save fallback failure safety is implemented.
  The App Sandbox direct-file fallback still only runs when the normal
  atomic temp-file path cannot create the temp file with
  `PermissionDenied`, but that direct path now reads the original bytes
  before truncating. If the direct write or sync fails after a partial
  write, it attempts to restore the original bytes before returning an
  error, so the frontend keeps the tab dirty/recoverable and never sees
  a successful save response. Focused Rust failure-injection coverage
  pins both successful original-byte restoration and the honest
  restore-failed error path; the existing direct fallback success test
  remains green.
- 2026-06-12: App Store lane Move to Trash external-process review is
  implemented. `move_workspace_entry_to_trash` now calls the native
  macOS `NSFileManager` Trash API from Rust through the existing
  `objc2` / `NSURL` bridge instead of launching `osascript` or relying
  on AppleEvents. Workspace containment checks, main-window label
  gating, destructive confirmation UI, and auto-backup cleanup remain
  unchanged. Focused Rust coverage for the trash happy path, missing
  path, outside-workspace rejection, Agent Window label rejection, and
  auto-backup cleanup passes. Signed TestFlight smoke still needs to
  confirm the App Store-lane user flow before App Review.
- 2026-06-12: Workspace persistence before App Review is implemented
  at the code-regression level. Focused inspection confirmed the
  repeated launch / relaunch path is pinned by
  `useWorkspaceStatePersistence.test.ts`, while the outside-active-tab
  and partial-restore path is covered across
  `useWorkspaceStatePersistence.test.ts`, `useWorkspaceRestore.test.ts`,
  and `storage.test.ts`. A follow-up regression now covers the
  "launch, restore state arrives, immediately quit before the restore
  latch settles" path: clean app-exit persistence may flush when live
  tabs or a live workspace root are already present, but still skips the
  truly empty pre-restore state so the last good bookmark is not erased.
  The focused command
  `npm run test -- src/hooks/workspace/useWorkspaceStatePersistence.test.ts src/hooks/workspace/useWorkspaceRestore.test.ts src/lib/storage.test.ts src/hooks/app/useAppExitConfirmation.test.tsx`
  passes with 4 files / 39 tests. Signed TestFlight smoke still needs to
  repeat the user-facing workspace-retention flow before App Review.
- 2026-06-12: Pasted image decoded-size cap / `data:image` wording is
  implemented. `save_pasted_image` now computes the decoded base64 byte
  length before allocating the decoded buffer and rejects pasted images
  above the existing 20 MB image boundary with a user-visible status
  reason. Normal PNG paste and drag/drop image import still write
  supported files into `assets/` through the existing hash-based naming
  and workspace containment checks. README and Help copy now distinguish
  pasted decoded image bytes from the separate small `data:image`
  preview/export inline cap.
- 2026-06-11: Workspace restore / standalone save regression slice.
  `useWorkspaceStatePersistence` no longer overwrites the
  user's last good persisted state when the restore latch
  flips to `true` with an empty live result
  (`tabs = []`, `workspaceRootPath = null`). The
  sandbox-loss / moved-folder / missing-file path now
  preserves the persisted state, including the
  security-scoped bookmark, so the next launch can
  re-attempt the restore or the start panel can
  re-authorize the same folder. Already-empty persisted
  state remains unaffected.
  A new unit suite (`useWorkspaceStatePersistence.test.ts`)
  pins the new contract across five cases:
  pre-restore, empty-restore with non-empty storage,
  bookmark-only storage, already-empty storage, and
  post-restore mirroring. A new
  `useSaveActions` test
  (`saveActiveTab saves a dirty standalone file when
  no workspace is open`) pins the standalone-file
  save path so a future refactor cannot silently
  short-circuit `save_text_file` for tabs that were
  opened outside a workspace. The `useWorkspaceRestore`
  and `useSaveActions` test suites stay green; `npm
  test` and `npm run build:vite` pass.
- 2026-06-11: Direct-open standalone file save fallback.
  `save_text_file` now keeps the normal atomic temp-file replace path,
  but falls back to direct existing-file write when the temp file cannot
  be created with `PermissionDenied`. This preserves the App Sandbox /
  direct file-picker case where the user-selected file itself is
  writable but creating a sibling `.hazakura-note.tmp` file is not.
  Directly opened local image files now route to read-only image preview
  without requiring an active workspace, while workspace file-tree image
  previews still use the workspace-root containment check. Existing-temp-
  file clobber protection is unchanged.
- 2026-06-11: L Mode table Backspace / Delete now preserves
  normal Markdown semantics: a selection that is strictly
  inside a single cell (e.g. a double-clicked word) falls
  through to the standard CodeMirror handler, while an
  explicit whole-body-line selection still triggers the
  row delete shortcut. Tests pin both shapes; the existing
  v0.18 `MoveToTrashConfirmDialog`, encoding-only dirty,
  preview task checkboxes, left-sidebar restore rail,
  preview startup, sandboxed bookmark restore, and
  `WorkspaceTree` rename DOM slices stay green.
- 2026-06-11: `MoveToTrashConfirmDialog` now follows the same
  focus-management pattern as the v0.7 dirty-tab / app-close
  dialogs: it owns a dialog ref and a Cancel button ref, the
  central `useDialogInitialFocus` lands focus on the Cancel
  button on open, the central `useModalKeyboardGuard` traps
  Tab / Shift+Tab inside the dialog, and Escape routes to
  `cancelPendingTrash`. The dialog copy, visual styling,
  Tauri command, workspace path validation, and trash
  execution logic are unchanged. New tests cover the
  component (`MoveToTrashConfirmDialog.test.tsx`), the focus
  hook (`useDialogInitialFocus.test.tsx`), and the keyboard
  guard (`useModalKeyboardGuard.test.tsx`); the existing
  dirty-tab / app-close / preferences Esc + Tab behaviour
  stays pinned.
- 2026-06-11: Encoding-only dirty indication is now consistent across
  the shared `isDirty()` contract, `TabBar`, and the auto-backup
  loop. Encoding-only changes surface the TabBar dirty dot and
  accessible "unsaved" description and are eligible for auto-backup
  with `encoding` included in the backup signature so repeated
  ticks do not pile up duplicates. The actual byte rewrite still
  happens on the next save via the encoding selector.
- 2026-06-11: Markdown preview task checkboxes now render `- [ ]` and
  `- [x]` as inert display-only checkbox glyphs in Preview. Saved
  Markdown remains unchanged; task items suppress the normal list marker
  so the checkbox glyph does not overlap. Focused preview tests and
  smoke checklist coverage were updated.
- 2026-06-11: Normal mode can collapse and restore the left workspace
  sidebar through a visible restore rail. The file-tree model is
  unchanged, and L Mode continues to own its separate temporary
  workspace drawer.
- 2026-06-11 / 2026-06-12: App Store preview builds no longer open to a
  blank WebKit surface. The helper-free App Store configs keep
  `frontendDist: "../dist"`. A later ad-hoc App Store preview carrying
  sandbox entitlements failed with `RBSRequestErrorDomain Code=5`, while
  the Developer / GitHub app and mounted DMG app launched. `npm run build`
  now produces a launchable helper-free local smoke bundle and leaves
  App Store sandbox entitlement proof to
  `npm run smoke:macos-sandbox-preview` or the signed submit / TestFlight
  lane.
- 2026-06-11: Restarting a sandboxed preview can restore a selected
  workspace through an app-scoped security-scoped bookmark. Older
  path-only state still skips stale folder paths without a global error
  and surfaces the existing reauthorization status hint.
- 2026-06-11: `WorkspaceTree` rename state is rendered as a
  non-button row instead of nesting the rename `<input>` inside
  the row `<button>`, avoiding a nested-interactive-control
  VoiceOver / focus / click / blur risk flagged in
  `docs/archive/reviews/workspace-tree-accessibility-decision-v0.17.md`.
  Normal file and directory rows still keep the button-based
  model; `Enter` / `Escape` / `blur` behavior and the
  auto-focus + select on entry are preserved. Existing v0.17
  pinned tests (aria-expanded, loading disabled state, rename
  Enter / Escape / blur, compare Escape with and without
  rename, empty-area click, file / directory context menu,
  target-directory drop) stay green, and three new tests pin
  the non-button rename DOM, the auto-focus + select on
  entry, and the directory rename row shape.

## App Store Approval Closeout

The `0.25.0` helper-free App Store update has been reported as released
on 2026-06-20. The public listing is:

```txt
https://apps.apple.com/jp/app/hazakura-editor/id6778637880?mt=12
```

The completed submission-prep notes below are retained as public-safe
evidence. Do not use them as the active queue unless preparing a new App
Store build. Future App Store work should restart from
`docs/app-store-build.md`, current version/build state, and fresh
App Store Connect evidence.

## Latest App Store Update Evidence

- 2026-06-19: Generated the local helper-free App Store submit-lane
  package for `0.25.0` build `18`:
  `src-tauri/target/universal-apple-darwin/release/bundle/pkg/HazakuraEditor-0.25.0-build18-mas.pkg`.
  SHA-256:
  `211ed7ffa935929cb4d3e31e88b6d9034c08a2335876e3f3fbf61a90e4400b61`.
  Local checks passed for App Store surface omission, Apple Distribution
  signed app bundle, 3rd Party Mac Developer Installer package
  signature, App Sandbox entitlements, helper absence, bundled notices,
  `0.25.0` / `18` metadata, and minimum macOS `26.0`.
  `spctl --assess --type install` rejected locally; keep treating that
  as non-authoritative local trust-policy evidence for this lane.
  The later App Store release is user-reported; raw App Store Connect,
  TestFlight, and App Review logs are not tracked in this repository.

## Completed Submission-Prep Slices

- 2026-06-18: `0.19.0` passed App Review and was published on the Mac
  App Store. The public listing is
  `https://apps.apple.com/jp/app/hazakura-editor/id6778637880?mt=12`.
  That published App Store build used the helper-free Safe Editor lane;
  Agent Workbench, CLI Agent launch, Hazakura Local Assist helper, external
  AI/API calls, and arbitrary command execution surfaces stayed outside
  that published build.
- 2026-06-13: The ignored internal App Review notes draft was refreshed
  during the `0.19.0` submission-candidate lane, and the tracked
  reviewer-note facts apply to build `13`. It
  carries the public-safe reviewer-note answers for sandbox
  `network.client`, inert script-like file handling, native Move to
  Trash behavior, App Store lane omission of Agent Workbench / CLI Agent
  / Hazakura Local Assist / external AI/API surfaces, and the TestFlight
  smoke points to verify. Final App Store Connect fields, screenshots,
  attachments, and account/contact-specific reviewer copy remain outside
  tracked docs.
- 2026-06-13: Public metadata local notes are prepared under ignored
  `docs/internal/` notes. Privacy and support URLs both returned HTTP
  200, and the local notes record candidate App Store Connect fields
  without account contacts, certificates, raw logs, or private screenshot
  material.
- 2026-06-13: Bundle-size follow-up is closed as `verified no-op`.
  `npm run build:vite` passes with the existing Vite large-chunk warning;
  measured output has `main-BfLm2n6P.js` at 1,080,445 bytes minified /
  336,207 bytes gzip, `agent-D2tmzj3c.js` at 353,913 bytes minified /
  89,802 bytes gzip, and `hazakura-mark-X75Ti9mc.png` at 307,180 bytes
  / 306,631 bytes gzip. There is no concrete App Review or startup
  evidence that justifies a pre-submission Help / Diagnostics / Assist
  split.
- 2026-06-12: App Store lane command-palette assist omission is
  implemented. The command palette no longer exposes `agent.*`,
  `appleAssist.*`, Hazakura Local Assist window, or `Assist Settings…`
  commands when the App Store lane disables both CLI Agent and Apple
  Local Assist surfaces. `npm run smoke:app-store-surface` now groups
  the lightweight App Store surface-omission tests for repeatable
  pre-submission automation.
- 2026-06-12: v0.18 TestFlight delivery evidence recorded. The
  signed `HazakuraEditor-0.18.0-mas.pkg` upload completed and the
  resulting `0.18.0` / build `4` TestFlight distribution showed no
  reported Apple validation warnings. Basic TestFlight launch and save
  smoke passed. Keep raw Transporter logs and account/request metadata
  out of tracked docs; record only public-safe build/result summaries.
- 2026-06-12: Tauri bundle resources now automatically include
  repository-root `LICENSE` and `THIRD_PARTY_NOTICES.md` in generated
  macOS app bundles. `scripts/probe-macos-distribution.sh` verifies
  `Contents/Resources/LICENSE` and
  `Contents/Resources/THIRD_PARTY_NOTICES.md` for App Store lane
  checks, so notice omission fails the distribution probe instead of
  remaining a manual memory item.
- 2026-06-13: v0.19 pre-release-fix and package evidence is archived in
  `docs/archive/operations/v0.19-pre-release-fix-plan-evidence-2026-06-13.md`.
  It records the earlier local code-quality gates, signed submit bundle
  probe, `HazakuraEditor-0.19.0-build11-mas.pkg` signature/payload
  checks, SHA-256, and dependency audit results. The current build `13`
  package evidence is summarized in `docs/app-store-build.md`.
  Transporter upload, App Store Connect validation, TestFlight smoke,
  metadata finalization, and App Review handling remain account-bound
  follow-up work.
- 2026-06-11: Helper-free App Store build / signing lane is defined.
  `npm run build:app-store-preview` and
  `npm run build:app-store-submit` use App Store-specific Tauri config,
  omit `bundle.externalBin`, use the minimal App Sandbox entitlement file,
  and keep Developer / GitHub lane helper behavior separate. The remaining
  App Store Connect work is upload / validation / TestFlight evidence, not
  initial lane definition.
- 2026-06-11: `scripts/probe-macos-distribution.sh` now checks the app
  bundle for `com.apple.security.app-sandbox` and the Developer / GitHub
  lane helper for `com.apple.security.inherit`, matching the inherited
  sandbox helper model instead of reporting a misleading helper sandbox miss.

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

## Do Not Use As Current

- `docs/archive/operations/app-store-v0.17/quality-agent-requests.md`
- `docs/archive/operations/app-store-v0.17/external-agent-requests.md`
- `docs/archive/operations/app-store-v0.17/current-work-closeout.md`

Those files are retained as evidence and background only.  They should
not be the starting point for new UX work.
