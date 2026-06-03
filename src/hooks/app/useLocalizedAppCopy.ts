import { useMemo } from "react";
import {
  getAgentWorkbenchCopy,
  getEditorChromeCopy,
  getPreferencesCopy,
  getRecoveryCopy,
  getReviewDeskCopy,
  getSafeEditorCopy,
  getSidePaneCopy,
  getSlashMenuCopy,
  getWorkspaceFileOpsCopy,
} from "../../lib/locale";
import type { MenuLanguage } from "../../types";

type UseLocalizedAppCopyOptions = {
  agentWorkbenchActive: boolean;
  agentWorkbenchPreference: boolean;
  menuLanguage: MenuLanguage;
};

export function useLocalizedAppCopy({
  agentWorkbenchActive,
  agentWorkbenchPreference,
  menuLanguage,
}: UseLocalizedAppCopyOptions) {
  return useMemo(() => {
    const agentWorkbenchRestartRequired =
      agentWorkbenchPreference !== agentWorkbenchActive;
    const agentWorkbenchCopy = getAgentWorkbenchCopy(menuLanguage);
    const agentWorkbenchModeBadge = agentWorkbenchRestartRequired
      ? agentWorkbenchCopy.modeBadgePending
      : agentWorkbenchActive
        ? agentWorkbenchCopy.modeBadgeActive
        : null;

    return {
      agentWorkbenchCopy,
      agentWorkbenchModeBadge,
      agentWorkbenchRestartRequired,
      editorChromeCopy: getEditorChromeCopy(menuLanguage),
      preferencesCopy: getPreferencesCopy(menuLanguage),
      recoveryCopy: getRecoveryCopy(menuLanguage),
      reviewDeskCopy: getReviewDeskCopy(menuLanguage),
      safeEditorCopy: getSafeEditorCopy(menuLanguage),
      sidePaneCopy: getSidePaneCopy(menuLanguage),
      slashMenuCopy: getSlashMenuCopy(menuLanguage),
      fileOpsCopy: getWorkspaceFileOpsCopy(menuLanguage),
    };
  }, [agentWorkbenchActive, agentWorkbenchPreference, menuLanguage]);
}
