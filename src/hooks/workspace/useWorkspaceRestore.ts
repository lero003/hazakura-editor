import { useEffect, type Dispatch, type SetStateAction } from "react";
import {
  listWorkspaceTree,
  openTextFile,
  resolveSecurityScopedBookmark,
  type TextFileDocument,
  type WorkspaceTreeEntry,
} from "../../lib/tauri";
import { createEditorTab, createPathlessRecoveryId } from "../../features/editor/editorTabs";
import {
  readPersistedWorkspaceState,
  readStoredDrafts,
  writePersistedFileBookmark,
  writeStoredDrafts,
} from "../../lib/storage";
import {
  MAX_RESTORED_TABS,
  type DraftRecord,
  type EditorTab,
} from "../../types";
import { migrateBookScopeWorkspaceRoot } from "../../features/bookScope";

type UseWorkspaceRestoreOptions = {
  onError: (message: string) => void;
  onStatus: (message: string) => void;
  setActiveTabId: Dispatch<SetStateAction<string | null>>;
  setPendingDrafts: Dispatch<SetStateAction<DraftRecord[]>>;
  setRestoreComplete: Dispatch<SetStateAction<boolean>>;
  setTabs: Dispatch<SetStateAction<EditorTab[]>>;
  setWorkspaceRootPath: Dispatch<SetStateAction<string | null>>;
  setWorkspaceTree: Dispatch<SetStateAction<WorkspaceTreeEntry | null>>;
};

export function useWorkspaceRestore({
  onError,
  onStatus,
  setActiveTabId,
  setPendingDrafts,
  setRestoreComplete,
  setTabs,
  setWorkspaceRootPath,
  setWorkspaceTree,
}: UseWorkspaceRestoreOptions) {
  useEffect(() => {
    let cancelled = false;

    async function restoreWorkspaceRoot(
      path: string,
      bookmark: number[] | null | undefined,
    ): Promise<boolean> {
      try {
        const tree = await listWorkspaceTree(path);

        if (!cancelled) {
          setWorkspaceTree(tree);
          setWorkspaceRootPath(path);
        }

        return true;
      } catch {
        if (!bookmark || bookmark.length === 0) {
          return false;
        }
      }

      const resolvedPath = await resolveSecurityScopedBookmark(bookmark);
      const tree = await listWorkspaceTree(resolvedPath);

      if (resolvedPath !== path) {
        migrateBookScopeWorkspaceRoot(path, resolvedPath);
      }

      if (!cancelled) {
        setWorkspaceTree(tree);
        setWorkspaceRootPath(resolvedPath);
      }

      return true;
    }

    async function restoreWorkspaceState() {
      const persistedState = readPersistedWorkspaceState();

      // Startup snapshots never share a storage key with new edits to a path.
      const storedDrafts = readStoredDrafts().map(draft => draft.path.length > 0
        ? { ...draft, detached: true, recoveryId: draft.recoveryId ?? createPathlessRecoveryId(), name: draft.name ?? draft.path.split(/[\\/]/).pop() }
        : draft);

      if (storedDrafts.some(draft => draft.detached)) {
        const stored = writeStoredDrafts(storedDrafts);
        if (!stored.ok) onError("復旧用の下書きを保護できませんでした。下書きを復元し、別名で保存してください。");
      }

      if (!persistedState) {
        if (storedDrafts.length > 0) {
          setPendingDrafts(storedDrafts);
          onStatus("Unsaved draft recovery available");
        }
        setRestoreComplete(true);
        return;
      }

      onStatus("Restoring workspace...");

      try {
        let skippedWorkspaceRootRestore = false;

        if (persistedState.workspaceRootPath) {
          try {
            const restoredWorkspaceRoot = await restoreWorkspaceRoot(
              persistedState.workspaceRootPath,
              persistedState.workspaceRootBookmark,
            );
            skippedWorkspaceRootRestore = !restoredWorkspaceRoot;
          } catch {
            skippedWorkspaceRootRestore = true;
          }
        }

        const uniqueTabPaths = Array.from(new Set(persistedState.tabPaths)).slice(
          0,
          MAX_RESTORED_TABS,
        );
        async function openPersistedTextFile(path: string): Promise<{
          document: TextFileDocument;
          persistedPath: string;
        }> {
          try {
            return {
              document: await openTextFile(path),
              persistedPath: path,
            };
          } catch (err) {
            const bookmark = persistedState?.tabFileBookmarks?.[path];
            if (!bookmark || bookmark.length === 0) {
              throw err;
            }

            const resolvedPath = await resolveSecurityScopedBookmark(bookmark);
            const document = await openTextFile(resolvedPath);
            if (document.path !== path) {
              writePersistedFileBookmark(document.path, bookmark);
            }
            return { document, persistedPath: path };
          }
        }
        // `Promise.allSettled` lets us drop a single failed
        // reopen without aborting the whole restore, which is
        // the right shape for App Sandbox assumptions: a stored
        // path string is not the same as a fresh user-selected
        // authorization grant, so a path that the OS can no
        // longer reach (file moved, file deleted, sandbox
        // container reauthorized the parent folder only, etc.)
        // must fall out of the restored tab list cleanly.
        // Counting the rejected results lets the status text
        // surface the gap instead of pretending the restore
        // succeeded for every stored path.
        const openResults = await Promise.allSettled(
          uniqueTabPaths.map((path) => openPersistedTextFile(path)),
        );
        const restoredTabs = openResults
          .filter(
            (
              result,
            ): result is PromiseFulfilledResult<{
              document: TextFileDocument;
              persistedPath: string;
            }> =>
              result.status === "fulfilled",
          )
          .map((result) => createEditorTab(result.value.document));
        const restoredActiveTab = openResults
          .filter(
            (
              result,
            ): result is PromiseFulfilledResult<{
              document: TextFileDocument;
              persistedPath: string;
            }> =>
              result.status === "fulfilled",
          )
          .find(
            (result) =>
              result.value.persistedPath === persistedState.activeTabPath ||
              result.value.document.path === persistedState.activeTabPath,
          );
        const skippedRestoreCount =
          openResults.length -
          restoredTabs.length +
          (skippedWorkspaceRootRestore ? 1 : 0);
        const recoverableDrafts = storedDrafts.filter(draft => {
          const tab = restoredTabs.find(tab => tab.path === draft.path);
          return !tab || tab.contents !== draft.contents || tab.line_ending !== draft.line_ending;
        });

        if (!cancelled) {
          setTabs(restoredTabs);
          setPendingDrafts(recoverableDrafts);
          setActiveTabId(
            restoredActiveTab?.value.document.path ?? restoredTabs[0]?.id ?? null,
          );
          onStatus(
            skippedRestoreCount > 0
              ? `Workspace restored: ${restoredTabs.length} tab${
                  restoredTabs.length === 1 ? "" : "s"
                } reopened, ${skippedRestoreCount} path${
                  skippedRestoreCount === 1 ? "" : "s"
                } skipped (use Open or Open Folder to reauthorize)`
              : recoverableDrafts.length > 0
                ? "Workspace restored with drafts"
                : restoredTabs.length > 0
                  ? "Workspace restored"
                  : "Ready",
          );
        }
      } catch (err) {
        if (!cancelled) {
          setPendingDrafts(storedDrafts);
          onError(String(err));
          onStatus("Workspace restore skipped");
        }
      } finally {
        if (!cancelled) {
          setRestoreComplete(true);
        }
      }
    }

    void restoreWorkspaceState();

    return () => {
      cancelled = true;
    };
  }, [
    onError,
    onStatus,
    setActiveTabId,
    setPendingDrafts,
    setRestoreComplete,
    setTabs,
    setWorkspaceRootPath,
    setWorkspaceTree,
  ]);
}
