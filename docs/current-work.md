# Current Work

Status: Operational
Scope: Active v0.18 UX polish and submission-prep routing
Authority: High
Last reviewed: 2026-06-11

## Purpose

Start here when choosing the next small `hazakura editor` slice.
This file is the current work queue.  Older v0.17 App Store-quality
request packets and closeout evidence now live under
`docs/archive/operations/app-store-v0.17/`.

Keep every slice small, verifiable, and inside the Markdown-first Safe
Editor boundary.

## Product Boundary

- Safe Editor remains primary.
- Markdown/text source remains canonical.
- Do not add Git, LSP, terminal, arbitrary command execution, plugins,
  project-wide indexing, auto-apply, or auto-commit.
- Workspace file operations stay bounded to the selected workspace.
- Agent Workbench remains a separate, explicit Developer / GitHub lane
  trust boundary and is not part of the App Store lane.

## Active UX Queue

Pick one item at a time.

| Priority | Slice | Acceptance |
|---|---|---|
| P1 | Manual accessibility smoke | Code-level observation recorded in `docs/smoke-checklist.md` and `docs/archive/operations/v0.18-manual-accessibility-smoke-observation.md` (Help readability, full keyboard-only traversal, VoiceOver tab-bar announcement, Increase Contrast). Live VoiceOver and Increase Contrast observation items still pending on the user's Mac. Baseline dialogs partially observed; `MoveToTrashConfirmDialog` focus management now wired (see Completed v0.18 Slices). |
| P2 | Help copy overlap cleanup | Separate Privacy Policy, Local Data Disclosure, Support Diagnostics, About, and Open Source Acknowledgements so each page has one job. |
| P2 | `data:image` size wording | Align implementation and docs: either call the check a data-URI length cap or measure decoded image bytes. |

## External-Agent Friendly Queue

Use this when handing work to an external implementation agent. Prefer
debugging, small implementation fixes, and evidence-backed refactors
over copy-heavy or product-voice-sensitive work.

| Fit | Candidate | Scope |
|---|---|---|
| Good | L Mode quality investigation | Pick one reproduced L Mode issue or one measurable quality gap only: caret, IME, Backspace/Delete, hidden markers, lists, dividers, links, tables, images, visual overlap, source preservation, or performance baseline. Do not add a new editing model or contenteditable surface. |
| Good | Theme quality investigation | Pick one concrete theme issue only: contrast, focus visibility, status/error readability, dialog readability, or Increase Contrast behavior. Do not redesign palettes or add theme customization. |
| Good | Focused refactor for a verified bug | Refactor only when it directly fixes or tests one observed user-facing problem. Keep ownership boundaries and public behavior stable. |
| Caution | `data:image` size wording | First inspect whether the implementation is a data-URI length cap or decoded-byte check. Prefer wording/docs alignment unless a small implementation correction is clearly safer. |
| Poor fit | Help copy overlap cleanup | This is product voice and submission copy work. Keep it for human/Codex review unless explicitly assigned with tight wording constraints. |
| Poor fit | Live VoiceOver / Increase Contrast observation | Requires the user's Mac accessibility settings and real interaction. Do not outsource unless that environment is explicitly available. |

## Completed v0.18 Slices

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
- 2026-06-11: App Store preview builds no longer open to a blank WebKit
  surface. The helper-free App Store configs keep `frontendDist:
  "../dist"`, the sandbox entitlement includes `network.client` for the
  Tauri/WebKit runtime, and a local packaged-app smoke rendered the
  start screen.
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

## Submission-Prep Queue

These are not ordinary UX polish and may require human account,
certificate, or App Store Connect access.

| Priority | Slice | Acceptance |
|---|---|---|
| P0 | App Store entitlement / signing lane | Define the official helper-free App Store build/signing path. Do not claim App Store-ready, notarized, submitted, or approved status until verified. |
| P0 | Distribution probe helper entitlement wording | `scripts/probe-macos-distribution.sh` should check the helper for `com.apple.security.inherit`, while the app bundle check remains `com.apple.security.app-sandbox`. |
| P1 | App Review Notes final copy | Keep private draft notes under ignored `docs/internal/`; public docs should only carry generic review boundaries and say CLI Agent / Agent Workbench execution surfaces are omitted from the App Store lane. |
| P1 | Public Privacy Policy URL / metadata | Finalize public Privacy Policy URL, support URL, category, keywords, screenshots, age rating, and App Store metadata. |
| P1 | Third-party license packet | Generate or review the complete lockfile-derived license packet before public submission. Help acknowledgements alone are not the final legal packet. |
| P2 | Bundle-size follow-up | Measure first. Split Help / Diagnostics / Assist chunks only if it reduces real startup or review risk. |

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
