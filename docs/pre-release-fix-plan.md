# Pre-Release Fix Plan

Status: Completed
Scope: App Store submission candidate code-quality fixes
Authority: Medium
Last reviewed: 2026-06-13 (implemented and locally verified)

## Purpose

This document turns the 2026-06-13 code-quality reviews into a small,
repair-focused release plan.

Keep this plan inside the Markdown-first Safe Editor boundary. Do not
use it to add new assist behavior, Agent Workbench behavior, external
CLI integration, Git features, LSP, terminal surfaces, plugins, or broad
refactors.

Manual smoke, TestFlight checks, App Store Connect upload work, metadata
submission, and reviewer-note preparation are intentionally out of scope
for this document. Track those in `app-store-build.md`,
`smoke-checklist.md`, or local/internal App Store notes.

Completion evidence is archived in
`docs/archive/operations/v0.19-pre-release-fix-plan-evidence-2026-06-13.md`.

## Review Baseline

Observed during the initial release-readiness review:

- `npm run typecheck`: passed.
- `cargo test --manifest-path src-tauri/Cargo.toml`: passed, 280 tests.
- `npm run build:vite`: passed, with the existing large-chunk warning.
- `npm run test`: failed under Vitest's default 5 second timeout.
- `npm run test -- --testTimeout 20000`: passed, 792 tests.

The follow-up external review was triaged against the current codebase:

- Some concerns matched existing release risks and are folded into the
  fix queue below.
- Some findings were already covered by current code or tests and are
  recorded under deferred / not adopted notes.
- No manual smoke or App Store Connect action is pulled into this plan.

Interpretation:

- No confirmed immediate data-destroying bug was found.
- The default frontend test command is not reliable enough as a release
  gate.
- The highest-value fixes are around save safety, close/quit state
  consistency, security-scoped bookmark lifetime, recovery quality, and
  editor remount cleanup.

## Out Of Scope

- Manual smoke execution.
- TestFlight / App Store Connect operation.
- Broad UX redesign or new product surfaces.
- Dependency upgrades unless a separate dependency review opens them.
- Cross-platform file-manager redesign.
- Agent Workbench or helper-process changes for the App Store lane.

## Fix Queue

### P0. Make The Frontend Test Gate Reliable

- Problem:
  - `package.json` runs `vitest run` directly, and the default 5 second
    timeout caused 11 tests to fail during the review.
  - The same suite passed with `--testTimeout 20000`, so this is a gate
    reliability problem rather than a confirmed product regression.
- Target:
  - `package.json`
  - `vitest.config.ts`, if centralizing the timeout there is cleaner.
- Recommended fix:
  - Set the release/default Vitest timeout explicitly so `npm run test`
    passes without requiring a remembered CLI flag.
  - Prefer a config-level timeout if it keeps package scripts simple.
- Acceptance:
  - `npm run test` passes without extra arguments.
  - No product behavior changes.
  - No broad test rewrites just to hide slow tests.
- Verification:
  - `npm run test`
  - `npm run typecheck`
- Size:
  - small
- Risk:
  - low

### P1. Make Atomic-Save Temp Files Crash-Recoverable

- Problem:
  - The Rust atomic-save path uses a fixed sibling temp name like
    `.<file_name>.hazakura-note.tmp`.
  - `create_new` correctly avoids clobbering an existing temp file, but a
    stale temp left by a crash can block future saves until manually
    removed.
- Target:
  - `src-tauri/src/util.rs`
  - `src-tauri/src/tests/files.rs`
- Recommended fix:
  - Keep the current "do not clobber an existing temp" safety property.
  - Add a stale-aware path, such as safe quarantine/cleanup for old
    Hazakura-owned temp files, or switch to unique temp names while
    preserving atomic rename semantics.
  - Do not overwrite or silently delete a fresh temp file that may belong
    to an active save.
- Acceptance:
  - Existing-file protection remains covered.
  - A stale Hazakura temp file no longer permanently blocks saving.
  - Failed saves leave the original file intact and the editor dirty.
- Verification:
  - Focused Rust tests for existing temp, stale temp, and write failure.
  - `cargo test --manifest-path src-tauri/Cargo.toml`
- Size:
  - medium
- Risk:
  - medium

### P1. Clarify Security-Scoped Bookmark Access Lifetime

- Problem:
  - The macOS bookmark restore path calls
    `startAccessingSecurityScopedResource()`.
  - The current boundary does not make the matching stop/lifetime
    behavior explicit, which is fragile under sandboxed App Store
    execution.
  - The external review independently flagged this as a sandbox
    lifecycle risk.
- Target:
  - `src-tauri/src/commands/security_bookmarks.rs`
  - Bookmark restore tests or a narrow Rust-side lifecycle test, where
    practical.
- Recommended fix:
  - Make the security-scoped resource lifetime explicit.
  - Prefer keeping bookmark resolution and immediate file access in a
    Rust command where start/stop can be paired clearly, or document and
    enforce the intended long-lived access model if pairing is not
    possible.
  - Avoid a broad workspace-restore rewrite in the same slice.
- Acceptance:
  - Workspace restore still works with app-scoped bookmarks.
  - Failure and stale-bookmark paths remain user-recoverable.
  - The access lifetime is obvious from code, not implied by caller
    convention.
- Verification:
  - Focused Rust test where the lifetime can be mocked or isolated.
  - `cargo test --manifest-path src-tauri/Cargo.toml`
  - Signed sandbox behavior remains a separate manual/App Store-lane
    proof, outside this document.
- Size:
  - medium
- Risk:
  - medium

### P1. Re-Check Dirty State Before Close Or Quit Completes

- Problem:
  - `useSaveActions` protects against marking a tab clean when its buffer
    changes during an async save.
  - `useTabCloseFlow` saves the originally dirty tabs during close/quit
    flow, then proceeds to close/hide/exit without a final dirty-state
    re-check against the latest tab state.
  - Existing tests already cover the main `useTabCloseFlow` and
    `useAppExitConfirmation` close/quit routes. The missing case is
    narrower: a tab becomes dirty again during the Save All loop.
- Target:
  - `src/hooks/document/useSaveActions.ts`
  - `src/hooks/editor/useTabCloseFlow.ts`
  - `src/hooks/editor/useTabCloseFlow.test.tsx`
- Recommended fix:
  - After the save loop and before closing tabs or allowing window
    close/quit, re-read the latest tabs from `tabsRef.current`.
  - If any originally targeted tab is still dirty, stop the close/quit
    path, focus or preserve the dirty tab, and surface the existing save
    failure/dirty state rather than treating the close as complete.
  - Add only the missing dirty-after-save regression; do not rewrite the
    entire close/quit state machine in this release slice.
- Acceptance:
  - Editing during save cannot be followed by an automatic close that
    discards the new unsaved edit.
  - Save failure behavior remains unchanged.
  - Existing dirty tab close, Save All, Discard All, Cancel, and Cmd+Q
    tests still pass.
- Verification:
  - Focused React test for dirty-after-save in the close/quit Save All
    path.
  - `npm run test`
- Size:
  - medium
- Risk:
  - medium

### P1. Preserve `saving` Status During Editor Changes

- Problem:
  - `handleEditorChange` currently updates the active tab with
    `saveStatus: "idle"`.
  - If the user edits while an async save is in progress, the UI can
    leave the `saving` state early. This is not confirmed as data loss,
    but it weakens save-state truthfulness during the highest-risk
    close/quit paths.
- Target:
  - `src/hooks/editor/useEditorCommands.ts`
  - Existing editor-command tests, or a focused hook test if coverage is
    not already in place.
- Recommended fix:
  - Preserve `saveStatus: "saving"` when applying an editor change to a
    tab that is already saving.
  - Keep clearing prior non-saving error states on normal edits.
- Acceptance:
  - Editing while a save is in progress keeps the tab in `saving` until
    the save result resolves.
  - Editing after an error still clears the error and returns to the
    normal dirty/idle flow.
- Verification:
  - Focused frontend test for editor change during save.
  - `npm run test`
- Size:
  - small
- Risk:
  - low

### P2. Persist Or Derive Auto-Backup Dedup Across Relaunch

- Problem:
  - `useAutoBackup` keeps its last-backup signature in memory.
  - After relaunch, the first auto-backup tick can duplicate the same
    dirty buffer snapshot already written in the previous process.
  - This is a recovery-quality issue, not a confirmed data-destruction
    blocker.
- Target:
  - `src/hooks/workspace/useAutoBackup.ts`
  - `src-tauri/src/auto_backup.rs`, only if the better fix belongs in
    Rust.
  - Existing auto-backup tests.
- Recommended fix:
  - Prefer deriving the latest known signature from existing backup
    metadata/content if that keeps the storage model simple.
  - If a persisted signature file is introduced, keep it under the
    existing `.hazakura` workspace state/backups area and make failure
    non-fatal to editing.
  - Do not add broad backup schema migration in the same slice.
- Acceptance:
  - Relaunching with the same dirty buffer does not immediately create a
    duplicate recovery snapshot for unchanged content.
  - Changed dirty content still creates a new recovery snapshot.
  - Backup failure remains non-blocking for editing.
- Verification:
  - Focused auto-backup dedup tests.
  - Rust tests if Rust backup metadata changes.
- Size:
  - medium
- Risk:
  - medium

### P2. Clean Up Editor Remount Listener Lifetime

- Problem:
  - `EditorPane` destroys the old `EditorView` during remount, but the
    scroll listener added to the editor DOM is not clearly removed by an
    effect cleanup return.
  - This is unlikely to be the most dangerous bug, but listener lifetime
    around editor remounts is easy to regress later.
- Target:
  - `src/components/editor/EditorPane.tsx`
  - `src/components/editor/EditorPane.test.tsx`
- Recommended fix:
  - Add explicit cleanup for listeners registered during editor mount.
  - Keep the existing editor destroy behavior and cursor/scroll
    preservation behavior intact.
- Acceptance:
  - Remounting for document/language changes does not duplicate stale
    scroll listeners.
  - Existing editor tests continue to pass.
- Verification:
  - Focused `EditorPane` tests.
  - `npm run test`
- Size:
  - small
- Risk:
  - low to medium

### P3. Defer Workspace Path-Join Boundary Cleanup Unless Adjacent

- Problem:
  - Some frontend workspace operations build paths with manual `/`
    joining.
  - This is acceptable for the current macOS-first lane, but it keeps the
    file-path boundary weaker than it needs to be.
- Target:
  - `src/hooks/workspace/useWorkspaceFileOps.ts`
  - Rust file/path commands if the boundary is moved native-side.
- Recommended fix:
  - Do not open this as a release blocker by itself.
  - If a workspace file-operation bug is touched anyway, move path
    joining/normalization toward a single helper or Rust-owned command
    boundary.
- Acceptance:
  - No broad file-manager redesign before release.
  - Any future cleanup preserves workspace containment checks.
- Verification:
  - Focused workspace file-operation tests.
  - `npm run test`
- Size:
  - medium
- Risk:
  - medium

## Deferred / Not Adopted Review Notes

- `useAppShellController` reducer rewrite:
  - The external review is right that the app/window close and Cmd+Q
    state machine is hard to read.
  - Do not do the large `QuitPhase` / Rust phase rewrite before release
    unless a focused regression proves the small guards above are not
    enough. Treat the reducer split as post-release maintainability work.
- `convertActiveLineEnding` / `convertActiveEncoding` updating
  `lastSaved*`:
  - Do not adopt this as proposed. Updating `lastSaved*` at conversion
    time could hide the intentional dirty state before the user saves.
  - If this area is revisited, add tests that conversion remains dirty
    until save and that save updates the `lastSaved*` fields correctly.
- `useOpenedFilesListener` startup drain:
  - Already implemented. The hook calls `drainOpenedFiles()` on startup
    and also listens for `OPENED_FILES_EVENT`.
  - No pre-release TODO is needed unless a reproduced Finder-open race
    appears.
- External-change polling:
  - `useExternalChangeChecks` already checks the active tab on tab
    change, focus, visibility change, and while an Agent session is
    active.
  - Always-on 1 second polling is a product tradeoff because it can add
    battery and filesystem noise. Defer until a concrete external-change
    miss is reproduced.
- Recent Files persistence cleanup:
  - `readStoredRecentFiles` / `writeStoredRecentFiles` intentionally
    clear legacy file-recent storage while Recent Folders remain.
  - The code can be clarified later, but this is not a release blocker.
- Theme-to-OS-chrome explicit match:
  - Making `agent_window_os_theme` enumerate Sakura / Yakou / Shokou is
    a good low-risk cleanup for a future polish slice, not a submission
    blocker.
- Spellcheck keyboard handling:
  - The native menu has a `Cmd+Option+;` spellcheck action, and the menu
    action listener handles `toggle-spellcheck`.
  - Add a WebView-level shortcut only if manual use shows the native menu
    path is unreliable in editor focus.
- Workspace tree cap documentation:
  - The current lazy tree model and cap tests are acceptable for this
    release. Improve user-facing large-folder wording in a future docs
    polish slice if needed.
- File associations:
  - The broad source/config file associations are ranked `Alternate` and
    the app treats these files as inert text.
  - Narrowing associations may still be useful for App Review messaging,
    but it is a product/submission choice rather than a code-quality
    blocker.
- `@xterm` dependency and Agent Workbench code in App Store builds:
  - The App Store lane is gated server-side and helper-free, but Agent
    Workbench dependencies remain part of the broader codebase.
  - Treat deeper dependency splitting as post-release packaging hygiene.
- Timestamp generation / `chrono`:
  - Do not add a runtime dependency before release merely to replace
    tested timestamp formatting helpers. Keep this as a future refactor
    only if a concrete timestamp bug appears.

## Recommended Order

1. Fix the default frontend test gate.
2. Add atomic-save stale-temp regression tests and implement the narrow
   save recovery fix.
3. Clarify the security-scoped bookmark lifetime.
4. Add close/quit dirty-after-save regression coverage and implement the
   final dirty re-check.
5. Preserve `saving` status during editor changes.
6. Improve auto-backup dedup across relaunch if it stays small.
7. Clean up `EditorPane` listener lifetime.
8. Defer path-join cleanup unless another workspace file-operation
   change makes it cheap and well-contained.

## Completion Criteria

This document can be considered complete when:

- `npm run test` passes without extra timeout arguments.
- Save recovery tests cover stale temp-file behavior.
- Security-scoped bookmark access lifetime is explicit in code.
- Close/quit tests cover dirty-after-save behavior.
- Editor changes during save do not prematurely clear the `saving`
  status.
- Auto-backup dedup either handles relaunch or is explicitly accepted as
  post-release recovery polish.
- Editor remount listener cleanup is explicit.
- No new App Store lane behavior or assist/agent behavior is introduced.

Smoke remains intentionally separate from this completion definition.
