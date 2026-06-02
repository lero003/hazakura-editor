import { useEffect } from "react";
import { writePersistedWorkspaceState } from "../../storage";
import type { EditorTab } from "../../types";

type UseWorkspaceStatePersistenceOptions = {
  activeTab: EditorTab | null;
  restoreComplete: boolean;
  tabs: EditorTab[];
  workspaceRootPath: string | null;
};

export function useWorkspaceStatePersistence({
  activeTab,
  restoreComplete,
  tabs,
  workspaceRootPath,
}: UseWorkspaceStatePersistenceOptions) {
  useEffect(() => {
    if (!restoreComplete) {
      return;
    }

    writePersistedWorkspaceState({
      workspaceRootPath,
      tabPaths: tabs.map((tab) => tab.path),
      activeTabPath: activeTab?.path ?? null,
    });
  }, [activeTab, restoreComplete, tabs, workspaceRootPath]);
}
