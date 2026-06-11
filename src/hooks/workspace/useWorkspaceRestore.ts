import { useEffect, type Dispatch, type SetStateAction } from "react";
import {
  listWorkspaceTree,
  openTextFile,
  type TextFileDocument,
  type WorkspaceTreeEntry,
} from "../../lib/tauri";
import { createEditorTab } from "../../features/editor/editorTabs";
import {
  readPersistedWorkspaceState,
  readStoredDrafts,
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

    async function restoreWorkspaceState() {
      const persistedState = readPersistedWorkspaceState();

      if (!persistedState) {
        setRestoreComplete(true);
        return;
      }

      onStatus("Restoring workspace...");

      try {
        let skippedWorkspaceRootRestore = false;

        if (persistedState.workspaceRootPath) {
          try {
            const tree = await listWorkspaceTree(
              persistedState.workspaceRootPath,
            );

            if (!cancelled) {
              setWorkspaceTree(tree);
              setWorkspaceRootPath(persistedState.workspaceRootPath);
            }
          } catch {
            skippedWorkspaceRootRestore = true;
          }
        }

        const uniqueTabPaths = Array.from(new Set(persistedState.tabPaths)).slice(
          0,
          MAX_RESTORED_TABS,
        );
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
          uniqueTabPaths.map((path) => openTextFile(path)),
        );
        const restoredTabs = openResults
          .filter(
            (result): result is PromiseFulfilledResult<TextFileDocument> =>
              result.status === "fulfilled",
          )
          .map((result) => createEditorTab(result.value));
        const skippedRestoreCount =
          openResults.length -
          restoredTabs.length +
          (skippedWorkspaceRootRestore ? 1 : 0);
        const storedDrafts = readStoredDrafts();
        const recoverableDrafts = restoredTabs.flatMap((tab) => {
          const draft = storedDrafts.find(
            (candidate) =>
              candidate.path === tab.path &&
              candidate.savedFingerprint === tab.fingerprint &&
              candidate.contents !== tab.contents,
          );

          return draft ? [draft] : [];
        });

        if (!cancelled) {
          setTabs(restoredTabs);
          setPendingDrafts(recoverableDrafts);
          setActiveTabId(
            restoredTabs.some(
              (tab) => tab.path === persistedState.activeTabPath,
            )
              ? persistedState.activeTabPath
              : restoredTabs[0]?.id ?? null,
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
