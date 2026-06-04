// Ephemeral state for the "Restore from auto-backup" picker.
// Visibility is flipped by the command palette; once the user
// picks a backup, the picker closes and the comparison view
// takes over. The hook is intentionally tiny — the picker
// reads the auto-backup list directly from the Tauri binding
// (see `useAutoBackupRestore` for the read effect), and the
// apply flow lives in the compare view, not here.

import { useCallback, useState } from "react";

export function useAutoBackupRestoreDialogState() {
  const [restoreBackupDialogOpen, setRestoreBackupDialogOpen] =
    useState(false);

  const openRestoreBackupDialog = useCallback(() => {
    setRestoreBackupDialogOpen(true);
  }, []);

  const closeRestoreBackupDialog = useCallback(() => {
    setRestoreBackupDialogOpen(false);
  }, []);

  return {
    closeRestoreBackupDialog,
    openRestoreBackupDialog,
    restoreBackupDialogOpen,
  };
}
