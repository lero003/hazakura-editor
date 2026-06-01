import { useMemo } from "react";
import { isDirty, isSaveFailureError } from "../editorTabs";
import type { DraftRecord, EditorTab } from "../types";

type UseEditorTabStateOptions = {
  activeTabId: string | null;
  globalError: string | null;
  pendingCloseTabId: string | null;
  pendingDrafts: DraftRecord[];
  tabs: EditorTab[];
};

export function useEditorTabState({
  activeTabId,
  globalError,
  pendingCloseTabId,
  pendingDrafts,
  tabs,
}: UseEditorTabStateOptions) {
  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? null,
    [activeTabId, tabs],
  );
  const pendingCloseTab = useMemo(
    () => tabs.find((tab) => tab.id === pendingCloseTabId) ?? null,
    [pendingCloseTabId, tabs],
  );
  const dirtyTabs = useMemo(() => tabs.filter(isDirty), [tabs]);
  const activeDraft = useMemo(
    () =>
      activeTab
        ? pendingDrafts.find((draft) => draft.path === activeTab.path) ?? null
        : null,
    [activeTab, pendingDrafts],
  );
  const activeContents = activeTab?.contents ?? "";
  const activeDirty = activeTab ? isDirty(activeTab) : false;
  const activeError = activeTab?.error ?? globalError;
  const activeConflict = activeTab?.saveStatus === "conflict";
  const activeSaveError = isSaveFailureError(activeTab);

  return {
    activeConflict,
    activeContents,
    activeDirty,
    activeDraft,
    activeError,
    activeSaveError,
    activeTab,
    dirtyTabCount: dirtyTabs.length,
    dirtyTabs,
    pendingCloseTab,
  };
}
