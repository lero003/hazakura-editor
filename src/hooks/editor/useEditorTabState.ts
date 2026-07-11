import { useMemo } from "react";
import {
  draftMatchesTab,
  isPathlessDraft,
} from "../../features/document/pathlessDraftRecovery";
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
  const activeDraft = useMemo(() => {
    if (!activeTab) {
      return null;
    }
    return (
      pendingDrafts.find((draft) => draftMatchesTab(draft, activeTab)) ?? null
    );
  }, [activeTab, pendingDrafts]);
  /** Pathless recovery candidates with no matching open tab (startup). */
  const orphanPathlessDrafts = useMemo(
    () =>
      pendingDrafts.filter(
        (draft) =>
          isPathlessDraft(draft) &&
          !tabs.some((tab) => draftMatchesTab(draft, tab)),
      ),
    [pendingDrafts, tabs],
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
    orphanPathlessDrafts,
    pendingCloseTab,
  };
}
