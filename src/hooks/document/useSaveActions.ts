import {
  type Dispatch,
  type SetStateAction,
  useCallback,
} from "react";
import {
  pickSaveAsTextFilePath,
  saveTextFile,
  saveTextFileAs,
  type SavedFileState,
} from "../../lib/tauri";
import { createEditorTab, isDirty } from "../../features/editor/editorTabs";
import { removeStoredDraft } from "../../lib/storage";
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
  tabs,
  tabsRef,
  workspaceRootPath,
}: UseSaveActionsOptions) {
  const saveTabById = useCallback(
    async (tabId: string): Promise<boolean> => {
      const tab = tabsRef.current.find((candidate) => candidate.id === tabId);

      if (!tab || !isDirty(tab)) {
        return true;
      }

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
        setTabs((currentTabs) =>
          currentTabs.map((candidate) =>
            candidate.id === tabId
              ? (() => {
                  const nextTab: EditorTab = {
                    ...candidate,
                    line_ending: saved.line_ending,
                    encoding: saved.encoding,
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
        );
        setStatus("Saved");
        if (savedTabIsClean) {
          removeStoredDraft(tab.path);
        }
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
      }
    },
    [setStatus, setTabs, tabsRef],
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

    setGlobalError(null);
    setStatus("Choosing Save As path...");

    try {
      const path = await pickSaveAsTextFilePath(
        suggestedSaveAsPath(activeTab.path),
      );

      if (!path) {
        setStatus("Save As cancelled");
        return;
      }

      if (tabs.some((tab) => tab.path === path && tab.id !== activeTab.id)) {
        setGlobalError("A tab is already open at the selected Save As path.");
        setStatus("Save As stopped");
        return;
      }

      setStatus("Saving as...");

      const savedFile = await saveTextFileAs(
        path,
        activeTab.contents,
        activeTab.line_ending,
        activeTab.encoding,
        workspaceRootPath,
      );
      const nextTab = createEditorTab(savedFile);

      setTabs((currentTabs) =>
        currentTabs.map((tab) => (tab.id === activeTab.id ? nextTab : tab)),
      );
      setActiveTabId(nextTab.id);
      rememberRecentFile(nextTab.path);
      removeStoredDraft(activeTab.path);

      if (workspaceRootPath) {
        try {
          await refreshWorkspaceTree();
        } catch (err) {
          setGlobalError(String(err));
          setStatus("Saved as; folder refresh failed");
          return;
        }
      }

      setStatus("Saved as");
    } catch (err) {
      const message = String(err);

      setTabs((currentTabs) =>
        currentTabs.map((tab) =>
          tab.id === activeTab.id
            ? {
                ...tab,
                saveStatus: "error",
                error: message,
              }
            : tab,
        ),
      );
      setStatus("Save As failed");
    }
  }, [
    activeTab,
    refreshWorkspaceTree,
    rememberRecentFile,
    setActiveTabId,
    setGlobalError,
    setStatus,
    setTabs,
    tabs,
    workspaceRootPath,
  ]);

  return {
    saveActiveTab,
    saveActiveTabAs,
    saveTabById,
  };
}
