import {
  type Dispatch,
  type SetStateAction,
  useCallback,
} from "react";
import { closeCurrentWindow } from "../../tauri";
import { isDirty } from "../../editorTabs";
import {
  draftRecordFromTab,
  readStoredDrafts,
  removeStoredDrafts,
  upsertDraftRecord,
  writeStoredDrafts,
} from "../../storage";
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
  tabsRef,
}: UseTabCloseFlowOptions) {
  const closeTabNow = useCallback(
    (tabId: string) => {
      setTabs((currentTabs) => {
        const closingIndex = currentTabs.findIndex((tab) => tab.id === tabId);
        const nextTabs = currentTabs.filter((tab) => tab.id !== tabId);

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
    [activeTabId, setActiveTabId, setPendingCloseTabId, setStatus, setTabs],
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
      await closeCurrentWindow();
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
    await closeCurrentWindow();
  }, [
    allowWindowCloseRef,
    dirtyTabs,
    focusEditorSoon,
    saveTabById,
    setActiveTabId,
    setPendingAppClose,
    setStatus,
  ]);

  const discardAllAndCloseWindow = useCallback(async () => {
    const discardedDraftPaths = dirtyTabs.map((tab) => tab.path);

    discardingWindowCloseRef.current = true;
    removeStoredDrafts(discardedDraftPaths);
    setPendingDrafts((currentDrafts) =>
      currentDrafts.filter(
        (draft) => !discardedDraftPaths.includes(draft.path),
      ),
    );
    allowWindowCloseRef.current = true;

    try {
      await closeCurrentWindow();
    } catch (err) {
      allowWindowCloseRef.current = false;
      discardingWindowCloseRef.current = false;
      writeStoredDrafts(
        [
          ...readStoredDrafts(),
          ...tabsRef.current.filter(isDirty).map(draftRecordFromTab),
        ].reduce<DraftRecord[]>(
          (records, draft) => upsertDraftRecord(records, draft),
          [],
        ),
      );
      setPendingAppClose(false);
      setGlobalError(`Close failed: ${String(err)}`);
      setStatus("Close failed");
    }
  }, [
    allowWindowCloseRef,
    dirtyTabs,
    discardingWindowCloseRef,
    setGlobalError,
    setPendingAppClose,
    setPendingDrafts,
    setStatus,
    tabsRef,
  ]);

  return {
    closeTabNow,
    discardAllAndCloseWindow,
    requestCloseTab,
    saveAllAndCloseWindow,
    saveAndClosePendingTab,
  };
}
