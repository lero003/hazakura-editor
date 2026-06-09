import { useMemo } from "react";
import { isDirty, isSaveFailureError } from "../../features/editor/editorTabs";
import { localizeStatusMessage } from "../../lib/statusMessages";
import type { DraftRecord, EditorTab } from "../../types";
import type { MenuLanguage } from "../../types";

type UseEditorTabStateOptions = {
  activeTabId: string | null;
  globalError: string | null;
  pendingCloseTabId: string | null;
  pendingDrafts: DraftRecord[];
  menuLanguage: MenuLanguage;
  tabs: EditorTab[];
};

export function useEditorTabState({
  activeTabId,
  globalError,
  pendingCloseTabId,
  pendingDrafts,
  menuLanguage,
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
  const activeError = useMemo(() => {
    const error = activeTab?.error ?? globalError;
    return error ? localizeStatusMessage(error, menuLanguage) : null;
  }, [activeTab?.error, globalError, menuLanguage]);
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
