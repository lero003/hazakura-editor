import { useEffect, type Dispatch, type SetStateAction } from "react";
import {
  listWorkspaceTree,
  openTextFile,
  type TextFileDocument,
  type WorkspaceTreeEntry,
} from "../tauri";
import { createEditorTab } from "../editorTabs";
import {
  readPersistedWorkspaceState,
  readStoredDrafts,
} from "../storage";
import {
  MAX_RESTORED_TABS,
  type DraftRecord,
  type EditorTab,
} from "../types";

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
        if (persistedState.workspaceRootPath) {
          const tree = await listWorkspaceTree(persistedState.workspaceRootPath);

          if (!cancelled) {
            setWorkspaceTree(tree);
            setWorkspaceRootPath(persistedState.workspaceRootPath);
          }
        }

        const uniqueTabPaths = Array.from(new Set(persistedState.tabPaths)).slice(
          0,
          MAX_RESTORED_TABS,
        );
        const restoredTabs = (
          await Promise.allSettled(uniqueTabPaths.map((path) => openTextFile(path)))
        )
          .filter(
            (result): result is PromiseFulfilledResult<TextFileDocument> =>
              result.status === "fulfilled",
          )
          .map((result) => createEditorTab(result.value));
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
            recoverableDrafts.length > 0
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
