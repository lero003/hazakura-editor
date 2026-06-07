import {
  type Dispatch,
  type SetStateAction,
  useCallback,
} from "react";
import { hideMainWindow } from "../../lib/tauri";
import { isDirty } from "../../features/editor/editorTabs";
import {
  draftRecordFromTab,
  readStoredDrafts,
  removeStoredDrafts,
  upsertDraftRecord,
  writeStoredDrafts,
} from "../../lib/storage";
import type { DraftRecord, EditorTab } from "../../types";

type RefValue<T> = {
  current: T;
};

type UseTabCloseFlowOptions = {
  activeTabId: string | null;
  allowWindowCloseRef: RefValue<boolean>;
  dirtyTabs: EditorTab[];
  discardingWindowCloseRef: RefValue<boolean>;
  focusEditorSoon: () => void;
  pendingCloseTabId: string | null;
  saveTabById: (tabId: string) => Promise<boolean>;
  setActiveTabId: Dispatch<SetStateAction<string | null>>;
  setGlobalError: Dispatch<SetStateAction<string | null>>;
  setPendingAppClose: Dispatch<SetStateAction<boolean>>;
  setPendingCloseTabId: Dispatch<SetStateAction<string | null>>;
  setPendingDrafts: Dispatch<SetStateAction<DraftRecord[]>>;
  setStatus: Dispatch<SetStateAction<string>>;
  setTabs: Dispatch<SetStateAction<EditorTab[]>>;
  tabs: EditorTab[];
  tabsRef: RefValue<EditorTab[]>;
};

function resetDiscardedTab(tab: EditorTab): EditorTab {
  return {
    ...tab,
    contents: tab.lastSavedContents,
    encoding: tab.lastSavedEncoding,
    error: null,
    ignoredExternalFingerprint: null,
    line_ending: tab.lastSavedLineEnding,
    saveStatus: "idle",
  };
}

export function useTabCloseFlow({
  activeTabId,
  allowWindowCloseRef,
  dirtyTabs,
  discardingWindowCloseRef,
  focusEditorSoon,
  pendingCloseTabId,
  saveTabById,
  setActiveTabId,
  setGlobalError,
  setPendingAppClose,
  setPendingCloseTabId,
  setPendingDrafts,
  setStatus,
  setTabs,
  tabs,
}: UseTabCloseFlowOptions) {
  const closeTabNow = useCallback(
    (tabId: string) => {
      setTabs((currentTabs) => {
        const closingIndex = currentTabs.findIndex((tab) => tab.id === tabId);
        const closingTab = currentTabs[closingIndex] ?? null;
        const nextTabs = currentTabs.filter((tab) => tab.id !== tabId);

        if (closingTab) {
          removeStoredDrafts([closingTab.path]);
          setPendingDrafts((currentDrafts) =>
            currentDrafts.filter((draft) => draft.path !== closingTab.path),
          );
        }

        if (activeTabId === tabId) {
          const nextActive =
            nextTabs[Math.min(closingIndex, nextTabs.length - 1)] ?? null;
          setActiveTabId(nextActive?.id ?? null);
        }

        return nextTabs;
      });
      setPendingCloseTabId(null);
      setStatus("Tab closed");
    },
    [
      activeTabId,
      setActiveTabId,
      setPendingCloseTabId,
      setPendingDrafts,
      setStatus,
      setTabs,
    ],
  );

  const requestCloseTab = useCallback(
    (tabId: string) => {
      const tab = tabs.find((candidate) => candidate.id === tabId);

      if (!tab) {
        return;
      }

      if (isDirty(tab)) {
        setPendingCloseTabId(tabId);
        return;
      }

      closeTabNow(tabId);
    },
    [closeTabNow, setPendingCloseTabId, tabs],
  );

  const saveAndClosePendingTab = useCallback(async () => {
    if (!pendingCloseTabId) {
      return;
    }

    const saved = await saveTabById(pendingCloseTabId);

    if (saved) {
      closeTabNow(pendingCloseTabId);
      return;
    }

    setActiveTabId(pendingCloseTabId);
    setPendingCloseTabId(null);
    setStatus("Close stopped");
    focusEditorSoon();
  }, [
    closeTabNow,
    focusEditorSoon,
    pendingCloseTabId,
    saveTabById,
    setActiveTabId,
    setPendingCloseTabId,
    setStatus,
  ]);

  const saveAllAndCloseWindow = useCallback(async () => {
    if (dirtyTabs.length === 0) {
      allowWindowCloseRef.current = true;
      setPendingAppClose(false);
      try {
        await hideMainWindow();
      } finally {
        allowWindowCloseRef.current = false;
      }
      return;
    }

    setStatus("Saving before close...");

    for (const tab of dirtyTabs) {
      const saved = await saveTabById(tab.id);

      if (!saved) {
        setActiveTabId(tab.id);
        setPendingAppClose(false);
        setStatus("Close stopped");
        focusEditorSoon();
        return;
      }
    }

    allowWindowCloseRef.current = true;
    setPendingAppClose(false);
    try {
      await hideMainWindow();
    } catch (err) {
      setGlobalError(`Close failed: ${String(err)}`);
      setStatus("Close failed");
    } finally {
      allowWindowCloseRef.current = false;
    }
  }, [
    allowWindowCloseRef,
    dirtyTabs,
    focusEditorSoon,
    saveTabById,
    setActiveTabId,
    setGlobalError,
    setPendingAppClose,
    setStatus,
  ]);

  const discardAllAndCloseWindow = useCallback(async () => {
    const discardedDraftPaths = dirtyTabs.map((tab) => tab.path);
    const dirtyTabById = new Map(dirtyTabs.map((tab) => [tab.id, tab]));
    const discardedTabIds = new Set(dirtyTabs.map((tab) => tab.id));

    discardingWindowCloseRef.current = true;
    removeStoredDrafts(discardedDraftPaths);
    setPendingDrafts((currentDrafts) =>
      currentDrafts.filter(
        (draft) => !discardedDraftPaths.includes(draft.path),
      ),
    );
    allowWindowCloseRef.current = true;

    try {
      setPendingAppClose(false);
      setTabs((currentTabs) =>
        currentTabs.map((tab) =>
          discardedTabIds.has(tab.id) ? resetDiscardedTab(tab) : tab,
        ),
      );
      await hideMainWindow();
    } catch (err) {
      allowWindowCloseRef.current = false;
      setTabs((currentTabs) =>
        currentTabs.map((tab) => dirtyTabById.get(tab.id) ?? tab),
      );
      writeStoredDrafts(
        [
          ...readStoredDrafts(),
          ...dirtyTabs.map(draftRecordFromTab),
        ].reduce<DraftRecord[]>(
          (records, draft) => upsertDraftRecord(records, draft),
          [],
        ),
      );
      setPendingAppClose(false);
      setGlobalError(`Close failed: ${String(err)}`);
      setStatus("Close failed");
    } finally {
      allowWindowCloseRef.current = false;
      discardingWindowCloseRef.current = false;
    }
  }, [
    allowWindowCloseRef,
    dirtyTabs,
    discardingWindowCloseRef,
    setGlobalError,
    setPendingAppClose,
    setPendingDrafts,
    setStatus,
    setTabs,
  ]);

  return {
    closeTabNow,
    discardAllAndCloseWindow,
    requestCloseTab,
    saveAllAndCloseWindow,
    saveAndClosePendingTab,
  };
}
