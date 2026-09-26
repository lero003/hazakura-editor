// Loads the auto-backup list for the active tab on demand. The
// hook owns the load lifecycle (loading / error / entries) but
// not the dialog visibility — the command palette opens the
// dialog and the picker calls `loadBackups` when it mounts. The
// hook is intentionally a leaf (not a controller) so the dialog
// state and the load state can be tested independently.

import { useCallback, useLayoutEffect, useRef, useState } from "react";
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
  const loadSequence = useRef(0);
  useLayoutEffect(() => () => { loadSequence.current++; }, []);

  const loadBackups = useCallback(
    async (input: WorkspaceRelativePathInput) => {
      const sequence = ++loadSequence.current;
      const { workspaceRoot } = input;
      setBackups([]);
      setLoading(true);
      setError(null);
      try {
        if (!workspaceRoot) return;
        const relativePath = workspaceRelativePath(input);
        if (!relativePath) return;
        const entries = await listAutoBackups(workspaceRoot, relativePath);
        if (sequence !== loadSequence.current) return;
        setBackups(entries);
      } catch (err) {
        if (sequence !== loadSequence.current) return;
        setError(String(err));
        setBackups([]);
      } finally {
        if (sequence === loadSequence.current) setLoading(false);
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
