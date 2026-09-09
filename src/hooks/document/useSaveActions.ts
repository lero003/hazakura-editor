import { flushSync } from "react-dom";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useRef,
} from "react";
import {
  createSecurityScopedBookmark,
  pickSaveAsTextFilePath,
  saveTextFile,
  saveTextFileAs,
  type SavedFileState,
} from "../../lib/tauri";
import { createEditorTab, isDirty } from "../../features/editor/editorTabs";
import { removeStoredDraft, writePersistedFileBookmark } from "../../lib/storage";
import { suggestedSaveAsPath } from "../../lib/utils";
import type { EditorTab } from "../../types";

type RefValue<T> = {
  current: T;
};

type UseSaveActionsOptions = {
  activeTab: EditorTab | null;
  activeTabId: string | null;
  refreshWorkspaceTree: () => Promise<void>;
  rememberRecentFile: (path: string) => void;
  setActiveTabId: Dispatch<SetStateAction<string | null>>;
  setGlobalError: Dispatch<SetStateAction<string | null>>;
  setStatus: Dispatch<SetStateAction<string>>;
  setTabs: Dispatch<SetStateAction<EditorTab[]>>;
  tabs: EditorTab[];
  tabsRef: RefValue<EditorTab[]>;
  workspaceRootPath: string | null;
};

export function useSaveActions({
  activeTab,
  activeTabId,
  refreshWorkspaceTree,
  rememberRecentFile,
  setActiveTabId,
  setGlobalError,
  setStatus,
  setTabs,
  tabsRef,
  workspaceRootPath,
}: UseSaveActionsOptions) {
  const savingSessions = useRef(new Set<string>());
  const saveTabAsById = useCallback(
    async (tabId: string): Promise<boolean> => {
      const tabToSave = tabsRef.current.find((tab) => tab.id === tabId) ?? null;

      if (!tabToSave) {
        setStatus("Save As stopped");
        return false;
      }

      if (savingSessions.current.has(tabToSave.sessionId)) return false;
      savingSessions.current.add(tabToSave.sessionId);
      setGlobalError(null);
      setStatus("Choosing Save As path...");

      try {
        const suggestedPath = tabToSave.path
          ? suggestedSaveAsPath(tabToSave.path)
          : tabToSave.name || "untitled.md";
        const path = await pickSaveAsTextFilePath(suggestedPath);

        if (!path) {
          setStatus("Save As cancelled");
          return false;
        }

        const latestTab =
          tabsRef.current.find((tab) => tab.id === tabToSave.id && tab.sessionId === tabToSave.sessionId) ?? null;
        if (!latestTab) {
          setStatus("Save As stopped");
          return false;
        }

        if (
          tabsRef.current.some(
            (tab) => tab.path === path && tab.id !== latestTab.id,
          )
        ) {
          setGlobalError("A tab is already open at the selected Save As path.");
          setStatus("Save As stopped");
          return false;
        }

        setStatus("Saving as...");

        const savedFile = await saveTextFileAs(
          path,
          latestTab.contents,
          latestTab.line_ending,
          latestTab.encoding,
          workspaceRootPath,
        );
        const liveTab = tabsRef.current.find(tab => tab.sessionId === latestTab.sessionId && tab.id === latestTab.id);
        if (!liveTab || tabsRef.current.some(tab => tab.path === savedFile.path && tab.sessionId !== latestTab.sessionId)) {
          setStatus("保存しました。編集タブの状態が変わったため切り替えませんでした");
          return true;
        }
        const nextTab: EditorTab = {
          ...liveTab,
          ...createEditorTab(savedFile),
          sessionId: liveTab.sessionId,
          recoveryId: undefined,
          contents: liveTab.contents,
          encoding: liveTab.encoding,
          line_ending: liveTab.line_ending,
        };
        // Commit before the caller decides whether this session can close.
        flushSync(() => {
          setTabs(currentTabs => currentTabs.map(tab =>
            tab.sessionId === liveTab.sessionId ? nextTab : tab));
          setActiveTabId(currentId => currentId === liveTab.id ? nextTab.id : currentId);
        });
        rememberRecentFile(nextTab.path);
        const recoveryCleanup = !isDirty(nextTab)
          ? latestTab.path
            ? removeStoredDraft(latestTab.path)
            : latestTab.recoveryId
              ? removeStoredDraft(`pathless:${latestTab.recoveryId}`)
              : { ok: true as const }
          : { ok: true as const };

        let bookmarkAvailable = true;
        try {
          const bookmark = await createSecurityScopedBookmark(nextTab.path);
          if (bookmark?.length) writePersistedFileBookmark(nextTab.path, bookmark);
          else bookmarkAvailable = false;
        } catch { bookmarkAvailable = false; }
        if (!bookmarkAvailable) setGlobalError("保存は完了しましたが、次回起動用のアクセス許可を記録できませんでした。次回は「開く」から選び直してください。");

        if (workspaceRootPath) {
          try {
            await refreshWorkspaceTree();
          } catch (err) {
            setGlobalError(String(err));
            setStatus("Saved as; folder refresh failed");
            return true;
          }
        }

        setStatus(
          recoveryCleanup.ok
            ? "Saved as"
            : "Saved as; draft recovery cleanup unavailable",
        );
        return true;
      } catch (err) {
        const message = String(err);

        setTabs((currentTabs) =>
          currentTabs.map((tab) =>
            tab.id === tabId && tab.sessionId === tabToSave.sessionId && tab.saveStatus !== "conflict"
              ? {
                  ...tab,
                  saveStatus: "error",
                  error: message,
                }
              : tab,
          ),
        );
        setGlobalError(message);
        setStatus("Save As failed");
        return false;
      } finally {
        savingSessions.current.delete(tabToSave.sessionId);
      }
    },
    [
      refreshWorkspaceTree,
      rememberRecentFile,
      setActiveTabId,
      setGlobalError,
      setStatus,
      setTabs,
      tabsRef,
      workspaceRootPath,
    ],
  );

  const saveTabById = useCallback(
    async (tabId: string): Promise<boolean> => {
      const tab = tabsRef.current.find((candidate) => candidate.id === tabId);

      if (!tab) {
        return true;
      }

      if (!tab.path) {
        return saveTabAsById(tabId);
      }

      if (!isDirty(tab)) {
        return true;
      }

      if (savingSessions.current.has(tab.sessionId)) return false;
      savingSessions.current.add(tab.sessionId);
      setTabs((currentTabs) =>
        currentTabs.map((candidate) =>
          candidate.id === tabId
            ? { ...candidate, saveStatus: "saving", error: null }
            : candidate,
        ),
      );
      setStatus("Saving...");

      try {
        const saved: SavedFileState = await saveTextFile(
          tab.path,
          tab.contents,
          tab.fingerprint,
          tab.line_ending,
          tab.encoding,
        );

        let savedTabIsClean = false;
        flushSync(() => setTabs((currentTabs) =>
          currentTabs.map((candidate) =>
            candidate.id === tabId && candidate.sessionId === tab.sessionId
              ? (() => {
                  const nextTab: EditorTab = {
                    ...candidate,
                    line_ending: candidate.line_ending,
                    encoding: candidate.encoding,
                    size: saved.size,
                    modified_ms: saved.modified_ms,
                    fingerprint: saved.fingerprint,
                    large_file_warning: saved.size >= 5 * 1024 * 1024,
                    lastSavedContents: tab.contents,
                    lastSavedLineEnding: saved.line_ending,
                    lastSavedEncoding: saved.encoding,
                    ignoredExternalFingerprint: null,
                    externalFingerprint: null,
                    error: null,
                    saveStatus: "idle",
                  };
                  savedTabIsClean = !isDirty(nextTab);
                  return {
                    ...nextTab,
                    saveStatus: savedTabIsClean ? "saved" : "idle",
                  };
                })()
              : candidate,
          ),
        ));
        let recoveryCleanupOk = true;
        if (savedTabIsClean) {
          recoveryCleanupOk = removeStoredDraft(tab.path).ok;
        }
        setStatus(
          recoveryCleanupOk
            ? "Saved"
            : "Saved; draft recovery cleanup unavailable",
        );
        return true;
      } catch (err) {
        const message = String(err);

        setTabs((currentTabs) =>
          currentTabs.map((candidate) =>
            candidate.id === tabId
              ? {
                  ...candidate,
                  saveStatus: message.includes("Save conflict")
                    ? "conflict"
                    : "error",
                  error: message,
                }
              : candidate,
          ),
        );
        setStatus(
          message.includes("Save conflict") ? "Save stopped" : "Save failed",
        );
        return false;
      } finally {
        savingSessions.current.delete(tab.sessionId);
      }
    },
    [saveTabAsById, setStatus, setTabs, tabsRef],
  );

  const saveActiveTab = useCallback(async () => {
    if (!activeTabId) {
      return;
    }

    await saveTabById(activeTabId);
  }, [activeTabId, saveTabById]);

  const saveActiveTabAs = useCallback(async () => {
    if (!activeTab) {
      setStatus("No active tab to save");
      return;
    }

    await saveTabAsById(activeTab.id);
  }, [activeTab, saveTabAsById, setStatus]);

  return {
    saveActiveTab,
    saveActiveTabAs,
    saveTabById,
  };
}
