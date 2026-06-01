import { useState } from "react";
import type { PreferencesDialogMode } from "../types";

export function useAppDialogState() {
  const [pendingCloseTabId, setPendingCloseTabId] = useState<string | null>(
    null,
  );
  const [pendingAppClose, setPendingAppClose] = useState(false);
  const [preferencesDialogMode, setPreferencesDialogMode] =
    useState<PreferencesDialogMode | null>(null);

  return {
    pendingAppClose,
    pendingCloseTabId,
    preferencesDialogMode,
    setPendingAppClose,
    setPendingCloseTabId,
    setPreferencesDialogMode,
  };
}
