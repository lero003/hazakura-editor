# Roadmap

Status: Operational
Scope: Active release lane and future planning boundaries
Authority: Medium
Last reviewed: 2026-07-09 (v1.5 closed/released before edohigan; v1.6 Import Assist active)

## Current Position

`Hazakura Editor` is a Markdown-first safe editor. It is not an IDE,
Git client, general terminal, plugin platform, project analyzer, or
automatic agent-apply system.

Current release state:

- Mac App Store listing:
  `https://apps.apple.com/jp/app/hazakura-editor/id6778637880?mt=12`.
- Package/app version in tree: `1.5.0`.
- **v1.5 (`1.5.0`) is closed and released** — stabilization / reading polish
  (Spellcheck settings, Reading Focus TOC density, dead-code, deps hygiene,
  etc.). **Released before 江戸彼岸 (edohigan) was merged to main.**
- **Post-v1.5 main (not v1.5):** edohigan theme; `@codemirror/view` **6.43.2**
  pin and editor display quality work. Do not describe these as v1.5 features.
- Historical MAS baseline: `1.3.0` Daily Trust (and earlier releases) remain
  part of the public product history; store Connect is authoritative for
  listing numbers.
- Latest local App Store / TestFlight package candidate metadata lives in
  `docs/internal/app-store-candidates/latest.json`.
- **Active release lane: v1.6 — Import Assist Phase 1 (Vision OCR / PDFKit).**
  On-device, edit-before-save, no-auto-save. Boundary review:
  `docs/import-assist-boundary-review.md`. Design:
  `docs/superpowers/specs/2026-07-02-import-assist-design.md`.
- **Next major structural lane: v2** — OKF Book Scope, then vertical writing
  (縦書き). Design:
  `docs/superpowers/specs/2026-07-02-v2-book-scope-design.md`.
- Current work queue: `docs/current-work.md`.

North star for the next product arc:

> Markdownで書き、本として読み、ローカルAIで整える。

Post-v0.25 refinement lens:

> 編集空間はひとつ。Markdown source を、読む・書く・比べる・変換する
> レイヤーとして扱う。

This does not mean automatic agent application. It means Hazakura should
make Markdown drafts easier to read as a book, easier to structure as
chapters, and easier to accept or reject through explicit Diff / Review
flows.

Near-term phase order:

1. v0.30 makes e-book Mode a daily paged-flow surface for reading and
   revising long Markdown prose while keeping the view book-like.
2. v0.31 adds Spread View for book-like two-page inspection, with
   single-page fallback and coarse navigation.
3. v0.32 connects editor and reader positions so the user can read,
   notice a problem, and return to the corresponding Markdown location.
   Source-level and local package evidence exist; normal / unsaved /
   recovered built-app interaction smoke remains user-side proof.
4. v0.33 polishes EPUB export as an explicit initial-v1 workflow for a
   single Markdown document. Source-level polish is implemented and an
   external fixture EPUB passed archive inspection plus external
   EPUBCheck, and signed build `41` package evidence exists. Built-app
   manual EPUB smoke remains a proof task.
5. v0.34 attempted to close the PDF print gap with an app-owned native
   print WebView, but TestFlight still rejected the print UI path after
   local manual smoke passed.
6. v0.35 replaces that path with direct PDF export and then resumes the
   v1.0 Release Candidate golden manuscript smoke. RC work should focus
   on built-app manual smoke, remaining TestFlight / release proof gaps,
   release wording, and only the smallest file-intake polish that
   directly supports reading the manuscript.
7. v0.36 stabilizes e-book reader page-turning for long illustrated
   manuscripts. Long documents with many `###` subheadings no longer
   fragment into dozens of one-screen chapters (only H1 / H2 are chapter
   boundaries), chapter crosses no longer skip pages (one action moves
   one spread and crosses at most one chapter, EPUB-like), keyboard
   auto-repeat no longer outruns the page state, and image-decode no
   longer shrinks the committed page count. EPUB export also splits the
   body into separate XHTML content documents at explicit page-break
   markers. This work is included in the published `0.36.0` App Store
   build; detailed long-manuscript and exported-EPUB page-break smoke
   remain useful focused proof.
8. v1.0 publishes the coherent single-document product and its
   `書く・読む・整える・書き出す` message. This release is complete.
9. v1.1 shipped daily-use continuity and trust: position ownership across
   editor / Preview / reader. This release is complete.
10. v1.2 is the prepared expectation-setting and lower-risk polish lane around
   Local Assist quality, export UX, safe command discovery, and empty states.
   The `1.2.0` candidate (command discovery, context-menu containment, EPUB
   scope note) is prepared locally with a signed pkg; upload and publication
   remain gated on explicit user approval.
11. v1.3 Daily Trust is approved and published on the Mac App Store as
   `1.3.0`: Save As session continuity, explicit Local Assist `採用` /
   `破棄`, richer Reading Focus TOC context, and fixed A4 PDF margin
   presets. Full gates and representative built-app interaction/rendered-PDF
   proof pass. This lane is closed; the next lane is v1.4.
12. v1.4 is the prepared candidate lane, prepared as `1.4.0`. It adds two
   opt-in joke themes (CRT, Shinkai) as presentation-only WebGL overlays, a
   review stale-diff warning for Local Assist proposals, and a window-close
   / assist-cancel reconciliation, alongside the Observability And
   Testability pure-logic seams with focused tests: e-book page-commit /
   navigation (`ebookPageTarget.ts`), reader-location
   (`ebookReaderLocation.ts`), PDF screen-page-layout tests, and EPUB text
   helpers (`epubTextHelpers.ts`). The joke themes add no new product
   surface beyond a visual overlay; the safe editor surfaces, Markdown
   source contract, and export paths are unchanged when they are off. No
   App Store lane boundary change. The remaining `useAppShellController`
   and Local Assist transaction seams stay trigger-driven candidates under
   the Observation-driven Maintenance Backlog.
13. v1.5 is the active lane: a stabilization and reading-polish arc built
   from the small/medium items in the Observation-driven Maintenance
   Backlog. Each is an independent slice; none adds a new product surface,
   a second document model, or any arbitrary-execution / Git / LSP /
   terminal / plugin behavior. The v1.5 slices are:
   - **Settings surface consistency.** Bring the Spellcheck toggle (today
     only in the editor Quick Settings popover,
     `src/components/app/EditorQuickSettingsMenu.tsx`) into the main
     Settings preferences pane
     (`src/components/app/SettingsPreferencesPane.tsx`), reusing the
     existing `spellcheckEnabled` setting. Small UX alignment, not a new
     feature.
   - **Dead code sweep.** Remove unused exports, stale branches,
     retired-surface leftovers (Review Desk retire remnants, old
     Apple-branded helper names), and unreachable CSS. Low-risk
     housekeeping.
   - **Dependency updates.** Keep `npm` and Cargo dependencies current on
     a cadence. Watch DOMPurify / marked / Tauri / React major bumps for
     sanitizer or build-lane regressions. Routine maintenance, not a
     feature.
   - **Reading Focus TOC density.** Show denser chapter context
     (subheadings, progress, or a denser entry) in the Reading Focus
     contents drawer instead of a bare chapter-number list.
   - **Preview / render performance** *(trigger-driven)*. A structural
     review can target redundant re-parse, unnecessary DOM passes, and
     measurement churn on long manuscripts. Pick only when a concrete
     long-document perf case gives a measurable baseline. The goal is
     smoother scroll and faster re-render without changing the
     source-preserving render pipeline or adding Preview DOM editing.
   - **Observability refactor** *(trigger-driven)*. Refactor for
     diagnosability so a reproduced issue is easier to localize:
     concentrated state in `useAppShellController`, Local Assist
     transaction state, and the render / measurement path should expose
     enough named seams for focused regression tests and error traces.
     Refactor-for-debuggability only; no public-behavior change, no
     Markdown source change, no App Store lane change.
   - **Long-document editor ↔ e-book position bridge** *(trigger-driven)*.
     Harden drift or jump between the editor cursor and the e-book
     simulated page position on very long manuscripts. Pick only when a
     concrete reproduced case appears.
   See `docs/current-work.md` (Active UX Queue) for the acceptance shape of
   each.
14. v1.6 is the Import Assist Phase 1 lane (Vision OCR). PDF / 画像 →
   Markdown via on-device Vision OCR, edit-before-save, no-cloud-OCR,
   no-auto-save. Its Book Project generation connects to v2 Book Scope.
   **v1.5 is closed/released (before edohigan); boundary review is passed**
   (`docs/import-assist-boundary-review.md`). The full design lives in
   `docs/superpowers/specs/2026-07-02-import-assist-design.md`.
15. v2.0 is the OKF-based structural foundation and vertical writing
   target. Two pillars, in order:
   - **OKF as a structural foundation for Book Scope.** Treat a
     user-selected, explicit set of structurally related Markdown files
     as one book, with OKF (Open Knowledge Format) as the structural
     foundation. The v2 Book Scope design — including the Workspace As
     Book direction, the Safe Editor boundary that carries into v2, the
     open UI questions, and UI candidates that are not yet decided —
     lives in `docs/superpowers/specs/2026-07-02-v2-book-scope-design.md`.
     Treat that spec as the single source of truth for v2 Book Scope
     design; the scattered Book / Workspace As Book / OKF notes elsewhere
     are historical context. Re-check the latest OKF shape before
     treating it as an implementation contract.
   - **Vertical writing (縦書き).** Add vertical-text reading to e-book
     Mode and export layers after the horizontal e-book surface, Spread
     View, and EPUB export are stable (the pre-existing trigger), and
     after the OKF-based structural foundation is in place. Markdown
     source stays canonical; vertical writing is a render / export layer,
     not a second saved model.

Historical phase details now live in release notes and archive files:

- `docs/releases/`
- `docs/archive/roadmaps/`
- `docs/archive/operations/app-store-v0.17/`

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
- The standalone Review Desk screen is retired from the current product
  surface. Hazakura Local Assist and other AI-assist paths must remain
  explicit, inspectable through Diff / change history or an equivalent
  review surface, and never auto-save or auto-apply without user action.
- Workspace file operations stay bounded to the selected workspace and
  must not become a full file manager.

## Shipped Phase Summary

Older phase-level details live in `docs/releases/`, `docs/current-work.md`,
and `docs/archive/`. Keep this roadmap focused on current and future
decisions.

- **v0.18-v0.20**: Safe Editor polish, App Store lane separation, Sakura
  workspace ergonomics, bounded image handling, save/recovery hardening,
  and helper-free App Store surface checks.
- **v0.21-v0.24**: e-book Mode progressed from display-only PoC to
  heading-based single-document reading, CSS-column pseudo-pagination, and
  single-page reading-surface polish while keeping Markdown source
  canonical.
- **v0.25**: native-feeling Safe Editor chrome polish landed as a
  source/CSS-level pass; native vibrancy and macOS floor changes remain a
  separate distribution-lane decision.
- **v0.26**: no-workspace authoring, e-book empty-state polish, and initial
  EPUB export beta shipped before heavier AI review or book-workspace work.
- **v0.27-v0.29.1**: source-preserving refinement, AI review foundation,
  Hazakura Local Assist transaction review, detached companion polish,
  Local Assist responsiveness hardening, and preview flicker reduction
  shipped through the `0.29.1` App Store update.

The durable exclusions from these phases still apply: no Git/LSP/terminal,
plugin system, arbitrary command execution, background workspace indexing,
Preview DOM editing, hidden save-time rewriting, or automatic AI application.

## v0.30-v1.0 Reader UX Stabilization Lane

Goal: ship `Hazakura Editor` v1 as a polished single-document Safe
Markdown Book Editor with Local Assist Review.

The v1 lane should not add broad new product surfaces. It should make the
parts already shipped by `0.29.1` feel like one coherent product: a safe
Markdown editor where the user can write Markdown, read it as a book,
inspect it in a two-page spread, export it explicitly, and review AI
proposals through Diff / Discard.

### Product Definition

v1.0 is:

- a single-document, book-oriented Markdown editor;
- a source-preserving set of reading, writing, preview, diff, recovery,
  assist-review, and export layers over one Markdown source;
- an editor where e-book Mode can be used to read prose, notice issues,
  and return to Markdown editing;
- an app where EPUB export is an explicit user action;
- an app where Hazakura Local Assist proposals remain user-initiated,
  unsaved until accepted, and reviewable through Diff / Discard.

v1.0 is not:

- Book Workspace Alpha or a multi-file book manifest;
- a full WYSIWYG editor or Preview DOM editing surface;
- an IDE, Git client, terminal, LSP host, plugin platform, or project
  analyzer;
- an external AI/API client or Agent Workbench integration in the App
  Store lane;
- an AI auto-apply, auto-save, auto-rewrite, or hidden workspace rewrite
  system.

### Product Focus

The post-`0.29.1` v1 lane shifts from Hazakura Local Assist stabilization
to e-book Mode reader UX. Hazakura Local Assist remains part of the
product, but dedicated post-`0.29.1` work should be observation-driven
polish only unless a safety, review, App Store, availability, generation
failure, or transaction-boundary issue appears.

### Required Before v1.0

- e-book Mode supports a comfortable daily reading / revision flow for
  single-document Japanese Markdown prose.
- e-book Mode is not button-only page-turning; it provides low-friction
  wheel / trackpad / keyboard movement while keeping the simulated page
  surface book-like.
- e-book Mode provides a two-page Spread View for book-like inspection
  when the window size allows it, with a single-page fallback for narrow
  windows.
- Page navigation includes keyboard shortcuts, clear progress, heading
  jump, and coarse navigation such as a slider or equivalent control.
- The user can move between editor position and e-book reading position
  without getting lost.
- One realistic Japanese long-form Markdown manuscript covers headings,
  long prose, lists, images, links, code blocks, Local Assist review,
  Diff / Discard, Recovery, relaunch, and EPUB export as the v1 proof
  fixture.
- The workspace tree makes open files legible even when they are not the
  active tab, without implying Git status or background indexing.
- The workspace tree makes open but unsaved files legible by reusing the
  existing tab dirty state; Save remains explicit.
- The editor can wrap or insert a small allowlisted set of Markdown /
  tag snippets around selected text through a simple user action. Source
  text remains visible, undoable, and saved only by explicit Save.
- L Mode, Preview, e-book Mode, Diff, Recovery, EPUB export, and AI
  review remain source-preserving layers over one Markdown document.
- EPUB export remains an explicit user action and is polished enough for
  initial v1 use.
- e-book Mode preview and final EPUB rendering are described as related
  but not identical outputs, so the app does not imply reader-perfect
  EPUB reproduction.
- Hazakura Local Assist remains user-initiated, on-device,
  availability-gated, unsaved until accepted, and reviewable through
  Diff / Discard.
- Any v1 file-intake polish stays bounded: larger local images may be
  made readable only with explicit size / memory safeguards, and extra
  text-open extensions may be added only while preserving binary
  detection, file-size warnings, workspace boundaries, and no background
  project indexing.

### Suggested Slices

#### v0.30: e-book Mode Paged Flow

Make e-book Mode usable as a daily reading and revision surface.

- Keep e-book Mode on a simulated book page rather than a Preview-like
  continuous document.
- Reduce page-turn friction for normal reading with wheel / trackpad /
  keyboard movement.
- Preserve chapter / page reading position across mode switches.
- Preserve the reader location contract for the later editor / reader
  position bridge.
- Re-tune Japanese prose layout: width, line height, margins, paragraph
  rhythm, and empty states.
- Confirm large-document behavior.

Acceptance: long Markdown prose can be read naturally in a book-like
page surface without relying only on buttons, and switching from Normal
Mode / L Mode / Preview does not leave the user badly lost.

#### v0.31: e-book Mode Spread View

Add book-like two-page inspection without making page-turning the only
way to read.

- Add a `集中して読む` Reading Focus entry for the e-book reader.
- In Reading Focus, let workspace/sidebar/editor chrome recede so the
  active Markdown document can use the main window as a book surface.
- Add a two-page spread layout when the focused reader has enough width.
- Fall back to single-page focused reading on narrow windows.
- Add previous / next page controls.
- Support keyboard navigation such as Left / Right and Space.
- Show current page / total page or equivalent progress.
- Add coarse navigation; the current v0.31 path uses a Reading
  Focus-only table-of-contents drawer for heading/chapter jumps, with
  page sliders left as a later display-option candidate.
- Keep Markdown source canonical and avoid Preview DOM editing.
- Keep a fully detached separate reader window as a later option, not
  the first v0.31 path.

Acceptance: the surface can feel book-like while paged flow remains the
daily revision path.

#### v0.32: Editor / Reader Position Bridge

Make writing and reading feel connected.

- Open e-book Mode near the current editor cursor or visible heading.
- Return from e-book Mode to the corresponding Markdown location.
- Reduce position drift across Normal Mode, L Mode, Preview, and e-book
  Mode.
- Keep mode transitions stable for unsaved documents and recovered
  buffers.

Acceptance: "read, notice, return, fix" feels like one revision cycle
rather than a separate viewer.

#### v0.33: EPUB Export v1 Polish

Align initial EPUB export with the single-document book-writing promise.

- Improve the explicit export flow.
- Check Japanese text, headings, local images, links, code blocks, and
  failure messages.
- Report non-fatal image replacement warnings after a successful export
  and keep generated XHTML language metadata aligned with the export
  settings.
- Keep advanced metadata, cover, navigation editing, and validation
  workflow deferred to v1.x.
- Document the difference between e-book Mode preview and final EPUB
  rendering where necessary.

Acceptance: v1 can truthfully say it has an initial EPUB export without
claiming to be a full EPUB production tool.

### Pre-RC Quality Slices (v1 Polish)

A 2026-06-25 read of the editor, preview, e-book reader, and stylesheet
surfaced observation-driven quality gaps in what `v0.29.1` plus the
`v0.30-v0.33` work already ship. Close three polish slices before
freezing v1.0 at `v0.34`. Each stays inside the Safe Editor boundary:
source-preserving, no new product surfaces, no arbitrary execution, no
new dependencies. The token foundation is good; these slices finish the
last coherence pass over it.

#### Slice A: Reader Stability

Performance and correctness of the daily editor + e-book reader path.

- `EBookPane` runs `marked` + `DOMPurify` synchronously on every
  keystroke with no debounce
  (`src/components/editor/preview/EBookPane.tsx:118,214-220`), unlike
  `PreviewPane` which debounces at 200ms
  (`src/components/editor/preview/PreviewPane.tsx:135`). Add the same
  debounce and stabilize the `activeRenderedChapter` memo deps so it
  does not invalidate on every keystroke.
- E-book pagination measurement forces a per-child reflow
  (`getBoundingClientRect` + a `getClientRects()` loop over every child)
  on every render, resize, and image-load
  (`EBookPane.tsx:298,346,379`; `src/components/editor/preview/ebookPagination.ts:67`).
  Coalesce into one `requestAnimationFrame`-throttled measurement guarded
  by a dirty flag, and only re-measure when column geometry actually
  changes.
- The known "scroll stays near the previous focus / reads as text
  selection" symptom traces to unconditional
  `view.contentDOM.blur()` on scrollbar `mousedown` with no refocus
  (`src/components/editor/EditorPane.tsx:581-585`). Remove the blur or
  refocus on `pointerup`.
- `renderMarkdown` does five sequential HTML parses per render
  (`src/features/editor/markdown.ts:19-27`; three `apply*Policy`
  template round-trips plus DOMPurify). Fold into one DOM mutation
  pass, then sanitize once.
- rAF-throttle the preview->editor scroll-sync direction, which today
  reads `scrollHeight` synchronously on every scroll event
  (`src/hooks/editor/usePreviewScrollSync.ts:130`), to match the
  editor->preview path that is already throttled. This is also the
  cause of the reported trackpad / Magic Trackpad inertial-scroll jank
  in Preview: `onPreviewScroll` -> `syncEditorScroll` forces the editor
  scroll position, and the editor's scroll handler writes a different
  `scrollTop` back into the preview pane every frame. Because
  `scrollSyncSourceRef` clears after a fixed 80ms timeout, the guard
  does not hold for the full duration of an inertial scroll, so the
  OS-driven inertial position and the JS-driven sync position collide
  every frame and the preview "stutters and does not move". A normal
  mouse wheel does not reproduce it because its events are coarser.
  Fix: rAF-throttle `syncEditorScroll`, and keep the sync-source guard
  alive for the full duration of an active preview scroll (clear it on
  the next editor-emitted scroll or on scroll-end, not a fixed timeout),
  so the editor->preview write-back does not fight the OS inertia.
- Per-image `load`/`error` listeners each trigger a full re-measurement
  (`EBookPane.tsx:379-391`); collapse them through the same dirty flag.

Acceptance: a long Japanese manuscript (around 30k characters) types and
scrolls without jank in Normal Mode, Preview, and e-book Mode; trackpad
inertial scrolling in Preview is smooth and does not stutter or fight
the OS-driven position; and scrollbar / wheel scrolling no longer sticks
near the last caret line.

Status as of v0.36.0: all six items are implemented and pinned by
focused tests. `EBookPane` debounces rendering at 200ms through the
shared `previewRenderDebounce` (same value as `PreviewPane`), with the
first render immediate and subsequent renders debounced. Page
measurement is coalesced into one `requestAnimationFrame` per frame
through a dirty-flag `scheduleRemeasure`, driven by layout effect,
`ResizeObserver`, `MutationObserver`, and per-image `load`/`error`
listeners alike. The scrollbar `contentDOM.blur()` scroll-stick bug is
fixed by restoring focus on `mouseup`. The five-HTML-parse
`renderMarkdown` pipeline is folded into one DOM mutation pass plus one
`DOMPurify.sanitize`. The preview->editor scroll-sync path is
rAF-throttled and keeps the sync-source guard alive through the whole
active preview scroll via a self-extending timer, so trackpad inertial
scrolling no longer stutters. The legacy per-image re-measurement is
collapsed through the same dirty flag.

#### Slice B: Token and Motion Coherence

The token system in `tokens.css` is sound, but execution above it leaks
undefined tokens, keyword easings, and `transition: all`. One CSS pass
to unify.

- Define missing tokens: `--info`, `--accent-hover`, `--accent-contrast`,
  `--error` (alias of `--danger`), `--bg-elev`, `--bg-elev-hover`,
  `--font-editor`, `--font-ui`, `--app-font-family`. Remove inline
  fallbacks; the Local Assist Apply button currently falls back to
  `#2f7eb8` blue (`src/styles/apple-assist-window.css`) and the
  slash-menu shortcut badge references undefined `--info`
  (`src/styles/slash-menu.css:99`).
- Add a single global `prefers-reduced-motion` reset in
  `src/styles/base.css`. Today only two of fifteen stylesheets reference
  it, so dialogs, toasts, the slash menu, and the agent pulse animate
  unconditionally.
- Add duration tokens (`--dur-1`..`--dur-4`) and a `--z-*` z-index scale;
  sweep bare `ease` keywords to `var(--ease-standard)` and replace every
  `transition: all` with an explicit property list (perf + consistency).
- Drop the global `button:hover { transform: translateY(-1px) }` lift
  (`src/styles/animations.css:104-109`). It reads as a bouncy web-app
  hover for a quiet book editor and is the reason several components
  carry `transform: none` overrides. Keep a subtle `:active` scale only.
- Tame motion toward calm: reduce the save-affirmation spring overshoot
  (`src/styles/save-affirmation.css:3-18`), and gate the perpetual agent
  pulse (`src/styles/status.css:15-27`) and ambient background drift
  (`src/styles/app-shell.css`) behind focus / reduced-motion.

Acceptance: the Local Assist window, slash menu, notifications, and
global controls render against the real token system rather than
fallback literals; motion uses one easing / duration voice; and
reduced-motion users get a calm, non-animated surface.

Status as of v0.36.0: token definitions, the global reduced-motion
reset, duration / z-index tokens, the `transition: all` sweep, the
`button:hover` lift removal, and the transition-level bare `ease` sweep
are done. `ease-out` / `ease-in-out` animations intentionally remain
where they carry specific entrance or ambient motion.

#### Slice C: Robustness

Correctness of Save-As, mode switching, and the assist-lock path.

- Save-As rekey changes `documentKey` and forces a full editor remount,
  losing scroll position and undo history
  (`src/components/editor/EditorPane.tsx:413-453`). **Deferred to v1.1:**
  a proper fix needs an editor session id separate from `documentKey`,
  which touches tab state management beyond this slice. Save-As still
  works; it just resets scroll/undo.
- `goToLine` reports scroll ratio in a single `requestAnimationFrame`
  before CodeMirror's asynchronous `scrollIntoView` has settled
  (`EditorPane.tsx:247-275`), so the preview and scroll HUD misalign for
  one beat after a heading jump. Use a double-rAF or `requestMeasure`.
- Add `readOnly` to the `EditorPane` `useImperativeHandle` dependency
  list (`EditorPane.tsx:241-374`) so an assist lock gates imperative
  `insertText` / `applyMarkdownFormat` instead of acting on a stale
  lock state.
- Pass an explicit `tabId` to `setActiveTabContents` in the Apple Assist
  apply path
  (`src/hooks/app/useAppShellController.ts:450-464`;
  `src/hooks/editor/useAppleAssistApplyHandler.ts`) rather than closing
  over `activeTab.id`, so a tab switch during generation writes to the
  validated target.

Acceptance: heading jumps do not lag the preview, and the assist-lock
and cross-tab apply paths are race-free. Save-As rekey remount
(preserving scroll + undo history) requires an editor session id
separate from `documentKey`, so it is deferred to v1.1 — Save-As still
works, it just resets scroll/undo. These slices do not change the v1
product definition; after Slice A-C, proceed to `v0.34` Golden
Manuscript smoke.

Status as of v0.36.0: `goToLine` uses a double-rAF so the scroll ratio
is reported after CodeMirror's asynchronous `scrollIntoView` settles;
`readOnly` is in the `useImperativeHandle` dependency list and the
`insertText` / `applyMarkdownFormat` / `insertTable` handlers guard on
it; and the Apple Assist apply path passes a validated `tabId` rather
than closing over `activeTab.id`. Only the Save-As rekey remount remains
deferred to v1.1.

#### v0.34: v1.0 Release Candidate

Freeze features and verify product quality.

- Create or select one realistic Japanese long-form Markdown document as
  the v1 Golden Manuscript. It should include headings, long paragraphs,
  lists, images, links, code blocks, and text that makes Local Assist
  review useful.
- Run golden-path smoke against that manuscript for New File, Open, Save
  / Save As, L Mode, Preview, e-book Mode paged flow, Spread View,
  heading jump, editor/reader return, EPUB export, Local Assist, Diff /
  Discard, Recovery, relaunch, and large documents.
- Verify workspace-file open / dirty markers and right-click
  slash-command selection insertion as fit-and-finish items, not as a
  new workspace model or formatting system.
- If the Golden Manuscript exposes a small blocker around local images or
  plain-text file intake, allow one narrow v1 fit-and-finish slice:
  larger readable local image handling or additional text-open file
  extensions. Do not turn this into external image loading, a binary
  viewer, log viewer, project indexer, or broad file manager.
- Make the App Store and Help wording emphasize the user-facing roles:
  write, read, compare, export, and review AI proposals before explicit
  save.
- Use App Store screenshots and release copy to show the product story in
  order: write Markdown, read it like a book, inspect a spread, review an
  AI proposal through Diff, then export EPUB.
- Make first-run / empty-state / tooltip copy answer which surface is
  for writing, reading, comparing, exporting, and reviewing proposals.
- Keep Diff / Discard / Save-state copy strong enough that AI proposals,
  Recovery, and manual edits remain visibly unsaved and reversible before
  Save.
- Document the expected difference between e-book Mode preview and final
  EPUB reader output where the user could otherwise expect identical
  rendering.
- Set internal large-document expectations before RC judgment. A useful
  starting line is: 10k Japanese characters feels comfortable, 30k is
  practical, and 100k may wait but must not crash, lose source, or hide
  that work is in progress.
- Update App Store screenshots, description, and release notes.
- Verify the App Store lane excludes Agent Workbench, external AI/API
  calls, CLI launch, arbitrary command execution, network fallback,
  auto-save, and auto-apply.

Acceptance: the product can be described without qualification as:

> Safe Markdown Book Editor with Local Assist Review

Golden Manuscript acceptance: the app can complete "write -> read ->
notice -> return -> revise -> review -> export" without the user losing
document position, source ownership, or save-state confidence.

#### Pre-v1.0 Close-out Checklist

Status as of 2026-06-29: closed. v1.0 passed review and is published on
the Mac App Store. The user-side checklist confirmed the
Golden Manuscript path, practical long-form e-book page-turning, EPUB
page breaks in Apple Books, Local Assist success/failure/apply/discard,
and the App Store safety boundary. No No-Go condition was reported.

Unchecked boxes were not automatic blockers. Commented observations are
preserved in `docs/v1.1-v1.2-followup.md` and now feed the active v1.2
queue one reproducible item at a time. v1.0 release artifacts and
published tags remain immutable.

Save-As session continuity, 100k-character comfort, consecutive-image
layout, Recovery edge cases, and detailed review/export polish are
accepted post-v1 work unless they reproduce a No-Go condition.

### Deferred Beyond v1.0

- Book Workspace Alpha.
- Multiple Markdown files as chapters.
- Saved book manifests.
- Vertical writing.
- Advanced EPUB metadata, cover, navigation editing, and validation
  workflow.
- External AI/API providers, plugin systems, arbitrary local model
  runtimes, agent orchestration, or automatic AI application.

## Post-v1 Product Direction

After v1.0, Hazakura should not immediately rush into broad workspace,
agent, or AI-provider expansion. The first post-v1 goal is to prove that
the single-document book-writing surface is useful in daily writing.

The durable question for every post-v1 idea is:

> Does this make it easier to read Markdown as a book and fix it through
> explicit review?

If the answer is not clearly yes, keep the idea out of the active lane.

## v1.x Deepen The Single-document Product

Goal: deepen the single-document writing / review / export model after
the first daily-use surface is proven.

Possible directions:

- Keep the v1 Golden Manuscript as a reusable release fixture and expand
  it only when a real regression or product claim needs coverage.
- Deepen safe file intake after v1: additional text-open extensions,
  better large local-image readability, and clearer warnings for files
  that are too large or not safely editable. This must not become a
  binary viewer, log viewer, project indexer, or broad file manager.
- Improve AI proposal review, provenance display, and Diff / Review
  ergonomics without making Hazakura an agent platform: clearer changed
  areas, better large-prose diff readability, partial Accept / Reject
  where it can stay understandable, and visible distinction between AI
  proposals, manual edits, and Recovery changes.
- Improve EPUB export with metadata, cover selection, navigation, and
  clearer pre-export / manual validation guidance.
- Improve PDF export polish after v1. The v0.35 direct PDF export
  already paginates into A4-sized pages, but the page rect is currently
  margin-less at the PDF-generation layer
  (`src-tauri/src/commands/export.rs`: `PDF_A4_PAGE_WIDTH_POINTS` /
  `PDF_A4_PAGE_HEIGHT_POINTS` with `origin_x: 0.0`, content split only by
  page height). Open design questions to resolve before implementing:
  whether to expose a user-facing margin / page-size option (and how far
  to go without turning Hazakura into a print-layout tool), whether
  margins should live in the export HTML CSS or in the Rust page-rect
  calculation, and how page-break markers (`---`) should interact with
  PDF page boundaries (today only EPUB uses them). Keep this as an
  explicit user consultation item, not a silent default change.
- Improve movement between writing, reading, Preview, Recovery, and AI
  review layers without creating a second document model.
- Explore a Hazakura-owned expression font as an opt-in document display
  font, not as the default app UI font.
- Explore preview and export output using that expression font, including
  whether HTML / PDF / EPUB output can embed or hand off the font
  cleanly.
- Explore explicit source-visible tags that render only the wrapped span
  in the expression font in Preview / e-book / export layers. The tags
  must be allowlisted, reversible, and source-preserving.
- Treat any intentionally hard-to-read or cipher-like typeface as a
  visual expression mode only, not as a privacy, encryption, security, or
  access-control feature.
- Add vertical writing only after the horizontal e-book surface, Spread
  View, and EPUB export are already stable, and after the OKF-based
  structural foundation for v2 Book Scope is in place. Vertical writing is
  a v2 target, not a v1.x slice.
- Improve Developer / GitHub distribution only when needed: Developer ID
  signing, notarization, updater, DMG stability, and clear App Store vs
  Developer-lane feature differences. Keep Agent Workbench Developer /
  GitHub-only.
- Keep Hazakura Local Assist polish observation-driven, and avoid turning
  it into a generic AI chat, provider plugin, or agent platform.
- Reduce UI friction around L Mode, e-book Mode, Preview, Diff, and
  Recovery as layers over the same Markdown source.

OKF remains a proposal-stage dependency. Re-check the latest OKF shape
before treating it as an implementation contract. OKF as a structural
foundation for v2 Book Scope is assessed in
`docs/superpowers/specs/2026-07-02-v2-book-scope-design.md`.

### Observation-driven Maintenance Backlog

These are not v1.0 blockers and not scheduled releases. They are items
worth picking up whenever a quiet moment or a related change makes one
cheap to close. Each is a candidate, not a commitment. Keep them small
and inside the Safe Editor boundary.

- **Theme customization.** Today the app ships five themes
  (`light` / `dark` / `sakura` / `yakou` / `shokou`; the earlier
  "fixed light/dark + Sakura accent" note was outdated). Personal taste
  still varies, so an accent / per-surface adjustment path may be worth
  it. Open question: how far to go without turning the app into a theme
  editor. Start from observation, not from a settings panel.
- **UI review pass (post-v1).** The v0.27-v0.36 UI work settled a lot,
  but "is the current shape actually best?" deserves a periodic read.
  Revisit chrome density, L Mode / e-book / Preview layering, and
  control placement against real daily use after v1 ships.
- **e-book Mode table-of-contents drawer is too sparse.** The Reading
  Focus contents drawer omits too much. Consider showing more chapter
  context (subheadings, progress, or a denser entry) so navigation
  does not feel like a bare chapter-number list.
- **Long-document editor ↔ e-book simulation coupling feels unstable.**
  At long lengths the editor cursor and the e-book simulated page
  position can drift or jump. This overlaps the v0.32 position bridge;
  treat it as observation-driven hardening of the bridge for very long
  manuscripts rather than a new surface.
- **PDF export A4 margin / page-size adjustment.** (Carried from the
  PDF consultation item above.) Margin-less A4 page rects today; this is
  likely a swamp, so keep it as an explicit consultation, not a silent
  default change.
- **Long-document performance.** Already partially addressed by the
  Pre-RC Slice A work (debounce, rAF-coalesced measurement, single
  renderMarkdown parse), but keep watching typing / scrolling /
  page-turn latency on very long manuscripts and add narrow throttling
  where observation finds jank.
- **Code clarity / refactor for faster incident response.** When a bug
  lands (like the e-book page-skip), deep call sites slow the fix. Keep
  opportunistic readability / decoupling refactors on the backlog so the
  next incident is cheaper to trace. No big-bang rewrite.
- **Dead code sweep.** Periodically check for unused exports, stale
  branches, retired-surface leftovers (e.g. Review Desk retire remnants,
  old Apple-branded helper names), and unreachable CSS. Low-risk
  housekeeping.
- **Dependency updates.** Keep `npm` and Cargo dependencies current on a
  cadence. Watch DOMPurify / marked / Tauri / React major bumps for
  sanitizer or build-lane regressions. Treat as routine, not as a
  feature.
- **Settings surface consistency.** The Spellcheck toggle currently lives
  only in the editor Quick Settings popover
  (`src/components/app/EditorQuickSettingsMenu.tsx`) and is missing from
  the main Settings preferences pane
  (`src/components/app/SettingsPreferencesPane.tsx`). Bring the same
  toggle into Settings so display / editing preferences are in one place,
  reusing the existing `spellcheckEnabled` setting. This is a small UX
  alignment, not a new feature or a new editor behavior.

Pick one when a slice is small, verifiable, and does not reopen a
product-boundary decision. None of these add arbitrary execution,
plugins, Git/LSP/terminal, external AI/API, or a second document model.

## v2.0 Book Scope / Book Workspace Alpha

Goal: introduce a user-selected Book Scope: a small, explicit set of
Markdown files treated as one book without turning Hazakura into a
project analyzer, Obsidian-like workspace system, or full file manager.

This is the right place for the difficult part of `Workspace = Book`:
several Markdown files, explicit order, chapter metadata, and book-level
reading / export. It should build on the single-document e-book, EPUB,
and AI review primitives instead of arriving before them.

Possible first shape:

- Let the user explicitly choose a Book Scope from the selected
  workspace, such as an `index.md`, a small manifest, or a selected
  chapter list.
- Treat chosen Markdown files as chapter candidates with manual order
  and visible table-of-contents structure.
- Connect book scope to e-book Mode, EPUB export, and AI proposal review
  only after the scope is explicit and reversible.
- Keep saved source as Markdown plus a small explicit structure file if
  needed; do not hide a database-like document model behind the app.
- Review AI or external edits only inside the selected Book Scope and
  only through explicit Diff / Review.

Do not add:

- automatic project-wide indexing or semantic analysis;
- hidden chapter inference across the whole workspace;
- database-like book storage hidden from the user;
- Git, LSP, terminal, plugin, or arbitrary command behavior;
- background AI restructuring or automatic multi-file rewrite.

## v2.x Book Scope Practicalization

Goal: make Book Scope useful after the alpha proves its source-preserving
shape.

Possible directions:

- Chapter reordering and chapter-title confirmation.
- Book-level e-book Mode and book-level EPUB export.
- Table-of-contents generation from the explicit scope.
- Chapter-level Diff / Review and chapter-scoped search.
- A small explicit manifest if needed, with no hidden database-like book
  model.

Do not add whole-workspace background indexing, hidden chapter inference,
automatic multi-file rewriting, or Git / LSP / terminal behavior.

## v3.x Speculative Local AI Re-evaluation

Goal: decide whether OS-provided local AI belongs in the product after
the book / review primitives are strong.

Use `docs/speculative-local-ai-future-plan.md`. v3.x is not "AI expansion
by default"; it is the earliest reasonable point to re-evaluate whether
stronger local AI, OS-provided models, whitelisted `.aimodel` support, or
much later local image generation belongs in the product after book
structure, explicit review, and export flows are mature.

Do not start this work just because model APIs exist. Require a fresh
product-boundary decision and working proof that edits remain explicit,
unsaved until accepted, and reviewable. The deciding question remains
whether the AI layer strengthens reading Markdown as a book and fixing it
through explicit review.

## Distribution Lanes

Current preview releases are warning-expected DMG previews unless the
user opens a different lane.

The intended stable distribution shape remains two public binary lanes:

- App Store build: Safe Editor + L Mode + Diff / explicit change review
  plus Hazakura Local Assist as an on-device, availability-gated writing
  companion; without External Agent Workbench, CLI launch, arbitrary
  command execution, external AI/API calls, or network fallback.
- Developer / GitHub build: the same base plus optional Agent Workbench
  for allowlisted local CLI providers.

Use:

- Source-preview release rules: `docs/source-release-checklist.md`
- Warning-expected DMG rules: `docs/dmg-preview-checklist.md`
- Final release hygiene: `docs/release-pre-check.md`
- Release-note evidence: `docs/releases/`

Developer ID signing, notarization, updater work, installer packaging,
and stable distribution remain explicit future distribution-lane work.
Treat this as v1.x-or-later work when distribution friction makes it
necessary, not as a reason to delay or bloat v1.0.

## Future Product Direction

Keep future product work source-preserving and narrow:

- L Mode: treat it as the existing Live Source writing surface and a
  potential e-book Mode integration target. Use `docs/l-mode-plan.md`.
- e-book Mode / EPUB export: make it the next book-oriented authoring
  arc. Use `docs/ebook-mode-epub-export-plan.md`.
- AI proposal ingest: keep AI output explicit, file-based or
  transaction-based, and Diff / Review centered. Use
  `docs/ai-markdown-ingest-plan.md`.
- Book Scope / Book Workspace: target v2.0 only after v1.x proves the
  single-document product. Treat a small, explicit, user-selected set of
  Markdown files as one book. Keep the scope reversible and avoid
  background project indexing, hidden chapter inference, or a hidden
  document model.
- Hazakura Local Assist: keep it as an explicit, on-device, availability-
  gated writing companion with unsaved, diff-reviewable edits. Use
  `docs/assist-surface-strategy.md` and
  `docs/apple-local-assist-writing-companion-plan.md`.
- Native macOS appearance: explore a more native-feeling macOS 26+
  interface, with macOS 27 treated as a future verification target. Use
  `docs/native-macos-appearance-plan.md`.
- Post-v0.25 product refinement: keep the product feeling like one
  quiet, safe Markdown editing space while tightening book structure,
  mode transitions, chrome density, and reliability. Use
  `docs/post-v0.25-product-refinement-plan.md`.
- Speculative local AI future: preserve, but do not yet commit to,
  v3.x-or-later re-evaluation for OS-provided local models, whitelisted
  external `.aimodel` support, and much later local image generation.
  Keep arbitrary local model runtimes out unless a fresh product and
  security boundary decision explicitly reopens that risk. Use
  `docs/speculative-local-ai-future-plan.md`.
- Agent Workbench: keep it optional, allowlisted, one-session, no-restore,
  and outside the App Store lane. Use `docs/agent-workbench-boundary.md`.

Any broader WYSIWYG editing model, database-like workspace layer,
collaboration feature, updater, plugin system, arbitrary model runtime,
local image-generation platform, or automated agent-apply flow needs a
fresh product-boundary decision before implementation.
