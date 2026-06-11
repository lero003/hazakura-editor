import { useEffect } from "react";
import {
  readPersistedWorkspaceState,
  writePersistedWorkspaceState,
} from "../../lib/storage";
import type { EditorTab } from "../../types";

type UseWorkspaceStatePersistenceOptions = {
  activeTab: EditorTab | null;
  restoreComplete: boolean;
  tabs: EditorTab[];
  workspaceRootPath: string | null;
};

export type WorkspaceStateSnapshot = Omit<
  UseWorkspaceStatePersistenceOptions,
  "restoreComplete"
>;

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

    // The restore latches the "current restore attempt is
    // finished" signal even when the attempt itself produced
    // nothing: a sandbox grant can be lost on relaunch, the
    // user can have moved the folder, or the persisted file
    // paths can all be gone. In that failure case the live
    // editor state is `tabs = []` and `workspaceRootPath =
    // null`, but the user's last *good* persisted state —
    // including the security-scoped bookmark — is still
    // sitting in localStorage and is the only thing that
    // lets the next launch re-attempt the restore or lets
    // the start panel re-authorize the same folder.
    //
    // `writePersistedWorkspaceState` already nulls the
    // bookmark whenever the new and existing
    // `workspaceRootPath` differ, so an unconditional write
    // on the empty-restore path would also wipe the
    // bookmark. Skipping the write entirely preserves both
    // the bookmark and the previous tab list, so the user
    // gets a real "Workspace restore skipped" affordance
    // and the next launch can keep trying.
    persistWorkspaceStateSnapshot({
      activeTab,
      tabs,
      workspaceRootPath,
    });
  }, [activeTab, restoreComplete, tabs, workspaceRootPath]);
}

export function persistWorkspaceStateSnapshot({
  activeTab,
  tabs,
  workspaceRootPath,
}: WorkspaceStateSnapshot) {
  if (tabs.length === 0 && workspaceRootPath === null) {
    const existing = readPersistedWorkspaceState();
    if (
      existing &&
      (existing.tabPaths.length > 0 || existing.workspaceRootPath !== null)
    ) {
      return;
    }
  }

  writePersistedWorkspaceState({
    workspaceRootPath,
    tabPaths: tabs.map((tab) => tab.path),
    activeTabPath: activeTab?.path ?? null,
  });
}
