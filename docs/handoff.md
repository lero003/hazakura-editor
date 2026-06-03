# Handoff

## Current State

- Roadmap docs now frame the remaining v0.9 writing-experience work as **えるモード**. The planning source is `docs/l-mode-plan.md`; it is an experimental one-pane reading-writing mode, not implemented behavior.
- v0.9 workspace file ops lane is **complete and unpushed** (7 commits on `main`, 1 Rust + 6 TS slices, `de7c07d..765d5e1`).
- Three new Tauri commands: `create_text_folder` (file-shim style), `rename_workspace_entry`, `move_workspace_entry`. All gated to `main` and use the new `ensure_path_inside_workspace_root` + `rename_workspace_entry_util` helpers in `src-tauri/src/util.rs` for workspace-root containment, overwrite rejection, case-only rename, and symlink-escape rejection.
- Frontend surface: sidebar `+` button (root) and folder right-click (parent = anchor) → New File / New Folder; right-click file/folder → inline Rename (Enter commits, Esc / empty cancels) with a `RenameWarnDialog` for dirty or external-change tabs (external wins when both apply); drag-to-move with `application/x-hazakura-workspace-move` disambiguated from the existing `application/x-hazakura-workspace-path` export-to-Finder drag. Folder self/descendant drop is rejected with a friendly pre-flight error.
- Tab path fan-out is centralized in `src/hooks/editor/useEditorTabsPathRekey.ts` — `tabs`, `activeTabId`, `pendingDrafts`, `recentFiles`, and `compareAnchor` / `compareTarget` / `compareView` are all rewritten in one place; both rename and move reuse the helper. Descendant rekey (renaming a folder while descendants are open) is documented as a deferred follow-up.
- Tree expansion state is preserved across all three ops via a new `reloadWorkspaceParent(directoryPath)` helper in `src/hooks/workspace/useWorkspaceTreeLoader.ts` (splice via `replaceWorkspaceTreeEntry`, not a full `refreshWorkspaceTree`).
- `docs/current-status.md` got a new bullet between the Agent Workbench micro-improvements bullet and the current-automation-emphasis bullet, and the automation-emphasis bullet now lists the deferred workspace-hygiene follow-ups (delete, `create_text_file` / `save_text_file_as` containment retrofit, auto-backup path rekey on rename, expanded-folders persistence) under v0.9 candidate work.

## Recent Changes

- `src-tauri/src/util.rs` — `ensure_path_inside_workspace_root(path, root)` + `rename_workspace_entry_util(src, dst, root)` helpers; canonicalize + `starts_with` containment, overwrite rejection, case-only rename via temp intermediate on Unix, symlink-escape rejection.
- `src-tauri/src/commands/files.rs` — `create_text_folder` + `create_text_folder_with_label` (shim).
- `src-tauri/src/commands/workspace.rs` — `rename_workspace_entry` / `move_workspace_entry` + `_with_label` shims.
- `src-tauri/src/lib.rs` — registered the 3 new commands in `generate_handler!`.
- `src-tauri/src/tests/files.rs`, `src-tauri/src/tests/workspace.rs`, `src-tauri/src/tests/security.rs` — +21 tests total (happy + label-gate + exists + outside-root + cross-dir + case-only + overwrite + symlink + cross-dir-with-existing + 3 label-gate).
- `src/lib/tauri/workspace.ts` — `createTextFolder`, `renameWorkspaceEntry`, `moveWorkspaceEntry` invoke wrappers.
- `src/lib/locale/workspaceFileOps.ts` (new) — `WorkspaceFileOpsCopy` with the 3-way kana split (`isKanaStyle` / `isJapaneseMenuLanguage`); `sidebarNewButton`, `newFileHere` / `newFolderHere`, `newFile` / `newFolder`, `rename`, `renameDialogTitle`, `renameDirtyWarning`, `renameExternalChangeWarning`, `moveOverwriteError`.
- `src/hooks/workspace/useWorkspaceFileOps.ts` (new) — the action surface (`createFile` / `createFolder` / `moveWorkspacePath` / `renameWorkspacePath` / `confirmPendingRename` / `cancelPendingRename` / `pendingRename` / `renamingPath`); `nextAvailableName` finds a unique `untitled.md` / `untitled-2.md` / … slot; `detectRenameWarning` returns `"external"` over `"dirty"` when both apply.
- `src/hooks/workspace/useWorkspaceTreeLoader.ts` — `reloadWorkspaceParent(directoryPath)` (splice, preserves expansion state).
- `src/hooks/editor/useEditorTabsPathRekey.ts` (new) — `rekeyPath(oldPath, newPath)` fans the new path through `tabs`, `activeTabId`, `pendingDrafts`, `recentFiles`, `compareAnchor` / `compareTarget` / `compareView`.
- `src/hooks/workspace/useWorkspaceContextMenu.ts` — `WorkspaceContextMenuState` gained `kind: "file" | "directory" | "root"`.
- `src/hooks/workspace/useRecentEntries.ts` — exposed `setRecentFiles` / `setRecentFolders` setters so the rekey can rewrite the recent-files list.
- `src/hooks/workspace/useWorkspaceFileOpening.ts` — includes `useWorkspaceFileOps` in the action surface spread.
- `src/hooks/app/useLocalizedAppCopy.ts` — `getWorkspaceFileOpsCopy` + `fileOpsCopy` field.
- `src/hooks/app/useAppShellController.ts` — `createWorkspaceFile` / `createWorkspaceFolder` / `renameWorkspacePath` / `moveWorkspacePath` / `onMoveEntry` / `onSubmitRename` / `confirmPendingRename` / `cancelPendingRename` wired into the return shape.
- `src/components/workspace/WorkspaceSidebar.tsx` — `+` button + popover, workspace root right-click → `kind: "root"` context menu, workspace header is a drop target (move back to root).
- `src/components/workspace/WorkspaceTree.tsx` — directory button right-click → `kind: "directory"`, inline `<input>` rename, directory button is a drop target; `startWorkspacePathDrag` now sets 3 MIME keys (text/plain + x-hazakura-workspace-path + x-hazakura-workspace-move) and `effectAllowed = "copyMove"`.
- `src/components/workspace/WorkspaceContextMenu.tsx` — `onCreateFileHere` / `onCreateFolderHere` props; "New File Here" / "New Folder Here" prepended when `canCreateHere`; "Rename" appended for file/folder.
- `src/components/app/RenameWarnDialog.tsx` (new) — two-variant warn dialog (dirty / external), `close-dialog` CSS shape, 3-way kana split; exports `RenameWarningKind` type.
- `src/components/app/AppWorkspace.tsx` — forwards `fileOpsCopy` / `onCreateFile` / `onCreateFolder` / `onMoveEntry` through to the sidebar.
- `src/components/app/AppOverlays.tsx` — `RenameWarnDialog` render; `onRename` → `requestRename(path)`.
- `src/styles/workspace.css` — `.workspace-header-actions`, `.workspace-new-menu`, `.workspace-new-menu-popover`, `.workspace-new-button`, `.workspace-header.drag-over`, `.tree-directory-button.drag-over`, `.tree-file.drag-over` (the file row only because the drag start is on the row).
- `src/hooks/workspace/useWorkspaceFileOps.test.ts` (new) — 3 shape tests.
- `src/components/app/RenameWarnDialog.test.tsx` (new) — 4 tests with `fireEvent.click` + `getByRole`; `afterEach(cleanup)`.
- `src/hooks/editor/useEditorTabsPathRekey.test.ts` (new) — 5 tests (tab remap, activeTabId rewrite, drafts/recents rekey, compare anchor/target rewrite, compareView clearing).

## Decisions

- **えるモード is presentation layer only.** Markdown source remains truth; normal mode, Preview, Diff, Review Desk, export, and copy behavior must keep round-tripping as Markdown. Do not turn it into WYSIWYG editing, Preview DOM editing, AI autocomplete, or automatic candidate application.
- **Workspace-root containment from day 1** for the 3 new commands. The existing `create_text_file` and `save_text_file_as` rely on the native dialog to constrain the path; that gap is real but not actively exploitable and is deliberately deferred to a separate security-hygiene slice (out of scope here, listed in the `next run can pick from` bullet).
- **Folder self-move rejected pre-flight** in `moveWorkspacePath` (frontend), so a friendly error surfaces before the backend round-trip. The backend would also reject (would move a directory inside itself), but the user sees the message immediately.
- **External-change warn wins over dirty warn** when both apply — the user has more to lose from an unseen external change than from a dirty buffer.
- **Internal drag disambiguated via a second MIME key** (`application/x-hazakura-workspace-move`) so the existing export-to-Finder drag (`application/x-hazakura-workspace-path`) is unchanged. `effectAllowed = "copyMove"` covers both routes; an OS-level drop still copies to Finder, a tree-internal drop moves.
- **Tree reload splices the affected parent only** (`reloadWorkspaceParent`) instead of `refreshWorkspaceTree` (which collapses everything below root). Expansion state is preserved naturally; no global expansion map needed.
- **Auto-backup path rekey is a deferred follow-up** — auto-backup keys on `workspaceRelativePath(tab.path, root)`, so a rename leaves stale entries under the old relative path. Stale entries are not user-visible and are pruned by the existing retention policy; a follow-up lane should rekey.
- **Delete is explicitly deferred** per the v0.9 direction. Move-to-trash is the likely direction for a separate destructive-file review.
- **No Co-Authored-By trailer on any commit.** Local git config is already `kei japan <33001547+lero003@users.noreply.github.com>` so primary author is already `lero003`. Memory rule saved 2026-06-03.

## Tests

All gates ran at the last slice and were clean:
- `npm run typecheck`
- `npm test` — 88 tests, 0 failed
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`
- `cargo test --manifest-path src-tauri/Cargo.toml` — 156 tests, 0 failed, 0 ignored
- `npm run build:vite`
- `git diff --check`

Docs-only roadmap cleanup on 2026-06-03 also ran `git diff --check` successfully.

The 3 new Rust commands have unit tests at the per-module level (`tests/files.rs`, `tests/workspace.rs`, `tests/security.rs`); the 6 TS slices have shape + render tests (`useWorkspaceFileOps`, `RenameWarnDialog`, `useEditorTabsPathRekey`, plus the existing `useWorkspaceContextMenu` shape test from slice 3). The behavior of move/rename on a real workspace tree is not tested at the hook level (would need a Tauri IPC stub and a deep tree stub); the per-command Rust tests cover the backend contract and the hook tests cover the per-store fan-out.

## Risks / Unknowns

- **Built-app smoke of the new file ops surface was not run** in this automation environment (`open -n` / in-app browser policy blockers). The user should confirm: sidebar `+` popover creates at root; folder right-click creates inside the folder; rename inline input commits on Enter, cancels on Esc / empty; dirty and external-change tabs both surface the warn dialog (external wins when both apply); drag a file from the tree onto a different folder moves it (and the open tab's path is rekeyed); drag back to the workspace root works; dropping a folder onto itself or a descendant surfaces the friendly error.
- **APFS case-insensitive quirk** is handled in Rust (`fs::canonicalize` resolves the on-disk case form when `dst.exists()` is true), but the per-platform behavior on case-only renames was not exercised by a built-app smoke in this lane — Rust unit tests pin the Unix path.
- **Descendant rekey** (renaming a folder while descendants are open in tabs) is documented as out of scope; the `useEditorTabsPathRekey` helper only rewrites the exact path match. The user can save-and-close descendants before renaming, but a follow-up should extend the rekey to `startsWith(oldPath + "/")` if user feedback calls for it.
- **Auto-backup path rekey is a known stale-entry**; not user-visible today, but a hygiene follow-up.
- **`create_text_file` / `save_text_file_as` workspace-root containment gap** is real (they currently rely on the native dialog to constrain the path) and is a deliberate follow-up.
- **No release notes / version bump / changelog** were drafted for the v0.9 file ops lane; the next agent should decide whether to call this a v0.9.0 release or fold it into a v0.9 candidate-work release alongside the micro-improvements lane.

## Next Actions

- **Built-app smoke** the new file ops surface (see Risks for the checklist) before declaring v0.9 done.
- **If implementing えるモード**, start from `docs/l-mode-plan.md` and keep the first slice to one-pane layout / CodeMirror display decoration / immediate return to normal mode.
- **Push 7 unpushed commits** (`de7c07d..765d5e1`) to `origin/main` — the durable no-push rule means the user must explicitly authorize `git push origin main`. The 4 prior commits (`de7c07d`, `c00f950`, `7f1b304`, `062a82d`) plus the 3 user-facing slices (`92d0885`, `5de9136`, `765d5e1`) are all local.
- **Decide on release labeling** — v0.9.0 refactor-only (the split lane), v0.9.1 micro-improvements-only (the Agent Workbench lane), v0.9.2 file-ops-only (this lane), or fold the three lanes into a single v0.9.0 release.
- **Plan a workspace-hygiene follow-up lane** for: delete (move-to-trash), `create_text_file` / `save_text_file_as` containment retrofit, auto-backup path rekey on rename, descendant rekey in `useEditorTabsPathRekey`, expanded-folders persistence.
- **Consider additional TS hook unit-test bring-up** — `useTabReorder` remains the next safe low-risk target (pointer-event surface needs `document.elementFromPoint` / `setPointerCapture` / `getBoundingClientRect` stubbed but the reorder callback itself is pure). The `useWorkspaceFileOps` hook is now also a candidate for a deeper test (would need a Tauri IPC stub and a deep tree stub).

## Avoid

- **Do not push without explicit user confirmation** — the durable no-push rule applies to all 7 commits.
- **Do not amend prior commits** to add a `Co-Authored-By` trailer — the no-trailer memory rule is in effect.
- **Do not add Delete / Git integration / LSP / plugins / project-wide indexing / arbitrary command execution / Agent auto-apply / signing / Foundation Models / provider-add UI** — the v0.8+ scope exclusions memory rule is in effect.
- **Do not make えるモード a full WYSIWYG, AI, or auto-formatting mode** — it should hide or reveal Markdown markers through display behavior while preserving the source text.
- **Do not retrofit `create_text_file` / `save_text_file_as` containment in this lane** — it is a deliberate follow-up; mixing it with the file ops lane would muddy the diff and the test surface.
- **Do not extend `useEditorTabsPathRekey` to `startsWith` descendant rekey without an explicit user ask** — the inline rename is expected to be invoked after the user has saved-and-closed descendants; the rare case of renaming a folder with open descendants is documented as a known gap.
- **Do not collapse the tree via `refreshWorkspaceTree`** after a file op — the splice-via-`replaceWorkspaceTreeEntry` is what preserves expansion state; collapsing would reset the user's navigation.
- **Do not introduce a new toast / status component** for the move-overwrite error — the existing `setStatus` + `setGlobalError` channel is sufficient for this slice; a proper toast is a separate lane if user feedback calls for it.
