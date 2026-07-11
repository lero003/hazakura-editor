import { useEffect, type Dispatch, type SetStateAction } from "react";
import {
  listWorkspaceTree,
  openTextFile,
  resolveSecurityScopedBookmark,
  type TextFileDocument,
  type WorkspaceTreeEntry,
} from "../../lib/tauri";
import { createEditorTab } from "../../features/editor/editorTabs";
import {
  readPersistedWorkspaceState,
  readStoredDrafts,
  writePersistedFileBookmark,
} from "../../lib/storage";
import {
  MAX_RESTORED_TABS,
  type DraftRecord,
  type EditorTab,
} from "../../types";

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

      if (!cancelled) {
        setWorkspaceTree(tree);
        setWorkspaceRootPath(resolvedPath);
      }

      return true;
    }

    async function restoreWorkspaceState() {
      const persistedState = readPersistedWorkspaceState();

      if (!persistedState) {
        // Still surface pathless recovery when no workspace session exists.
        const pathlessOnly = readStoredDrafts().filter(
          (candidate) =>
            candidate.path.length === 0 &&
            typeof candidate.recoveryId === "string" &&
            candidate.recoveryId.length > 0 &&
            candidate.contents.length > 0,
        );
        if (pathlessOnly.length > 0) {
          setPendingDrafts(pathlessOnly);
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
        const storedDrafts = readStoredDrafts();
        const pathRecoverableDrafts = restoredTabs.flatMap((tab) => {
          const draft = storedDrafts.find(
            (candidate) =>
              candidate.path.length > 0 &&
              candidate.path === tab.path &&
              candidate.savedFingerprint === tab.fingerprint &&
              candidate.contents !== tab.contents,
          );

          return draft ? [draft] : [];
        });
        // Pathless new / Import Assist drafts: explicit startup candidates.
        // Never auto-open as tabs; user must restore or discard.
        const pathlessRecoverableDrafts = storedDrafts.filter(
          (candidate) =>
            candidate.path.length === 0 &&
            typeof candidate.recoveryId === "string" &&
            candidate.recoveryId.length > 0 &&
            candidate.contents.length > 0,
        );
        const recoverableDrafts = [
          ...pathRecoverableDrafts,
          ...pathlessRecoverableDrafts,
        ];

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
