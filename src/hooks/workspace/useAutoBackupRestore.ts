// Loads the auto-backup list for the active tab on demand. The
// hook owns the load lifecycle (loading / error / entries) but
// not the dialog visibility — the command palette opens the
// dialog and the picker calls `loadBackups` when it mounts. The
// hook is intentionally a leaf (not a controller) so the dialog
// state and the load state can be tested independently.

import { useCallback, useState } from "react";
import {
  listAutoBackups,
  readAutoBackup,
  type AutoBackupEntry,
} from "../../lib/tauri/autoBackup";
import {
  workspaceRelativePath,
  type WorkspaceRelativePathInput,
} from "./workspaceRelativePath";

export type UseAutoBackupRestoreResult = {
  backups: AutoBackupEntry[];
  error: string | null;
  loading: boolean;
  loadBackups: (input: WorkspaceRelativePathInput) => Promise<void>;
  readBackup: (
    input: WorkspaceRelativePathInput,
    backupName: string,
  ) => Promise<string>;
};

export function useAutoBackupRestore(): UseAutoBackupRestoreResult {
  const [backups, setBackups] = useState<AutoBackupEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadBackups = useCallback(
    async (input: WorkspaceRelativePathInput) => {
      const { workspaceRoot } = input;
      if (!workspaceRoot) {
        setBackups([]);
        setError(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const relativePath = workspaceRelativePath(input);
        if (!relativePath) {
          setBackups([]);
          return;
        }
        const entries = await listAutoBackups(workspaceRoot, relativePath);
        setBackups(entries);
      } catch (err) {
        setError(String(err));
        setBackups([]);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const readBackup = useCallback(
    async (input: WorkspaceRelativePathInput, backupName: string) => {
      const { workspaceRoot } = input;
      if (!workspaceRoot) {
        throw new Error("Active file is not inside the open workspace.");
      }
      const relativePath = workspaceRelativePath(input);
      if (!relativePath) {
        throw new Error("Active file is not inside the open workspace.");
      }
      return readAutoBackup(workspaceRoot, relativePath, backupName);
    },
    [],
  );

  return { backups, error, loading, loadBackups, readBackup };
}
