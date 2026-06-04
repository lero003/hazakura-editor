import { useEffect } from "react";
import { pruneAutoBackups, saveAutoBackup } from "../../lib/tauri";
import type { EditorTab } from "../../types";
import { useLatestValueRef } from "../app/useLatestValueRef";
import { workspaceRelativePath } from "./workspaceRelativePath";

const AUTO_BACKUP_INTERVAL_MS = 30000;
const MAX_AUTO_BACKUPS_PER_FILE = 30;

type UseAutoBackupOptions = {
  enabled: boolean;
  tabs: EditorTab[];
  workspaceRootPath: string | null;
};

export function useAutoBackup({
  enabled,
  tabs,
  workspaceRootPath,
}: UseAutoBackupOptions) {
  const tabsRef = useLatestValueRef(tabs);
  const workspaceRootPathRef = useLatestValueRef(workspaceRootPath);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const intervalId = window.setInterval(async () => {
      const workspaceRoot = workspaceRootPathRef.current;
      if (!workspaceRoot) {
        return;
      }

      const dirtyTabsSnapshot = tabsRef.current.filter(isDirtyTab);
      if (dirtyTabsSnapshot.length === 0) {
        return;
      }

      for (const tab of dirtyTabsSnapshot) {
        try {
          const relativePath = workspaceRelativePath({
            workspaceRoot,
            filePath: tab.path,
          });
          if (!relativePath) {
            continue;
          }

          await saveAutoBackup(workspaceRoot, relativePath, tab.contents);
          void pruneAutoBackups(
            workspaceRoot,
            relativePath,
            MAX_AUTO_BACKUPS_PER_FILE,
          );
        } catch {
          // Backup failures should not interrupt editing.
        }
      }
    }, AUTO_BACKUP_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [enabled]);
}

function isDirtyTab(tab: EditorTab): boolean {
  return (
    tab.contents !== tab.lastSavedContents ||
    tab.line_ending !== tab.lastSavedLineEnding
  );
}
