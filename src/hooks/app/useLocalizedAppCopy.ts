import { useMemo } from "react";
import { getAgentWorkbenchCopy } from "../../lib/locale/agentWorkbench";
import { getAppleAssistCopy } from "../../lib/locale/appleAssist";
import { getAutoBackupRestoreCopy } from "../../lib/locale/autoBackup";
import { getEditorChromeCopy } from "../../lib/locale/editorChrome";
import { getLModeCopy } from "../../lib/locale/lMode";
import { getPreferencesCopy } from "../../lib/locale/preferences";
import { getRecoveryCopy } from "../../lib/locale/recovery";
import { getReviewDeskCopy } from "../../lib/locale/reviewDesk";
import { getSafeEditorCopy } from "../../lib/locale/safeEditor";
import { getSidePaneCopy } from "../../lib/locale/sidePane";
import { getSlashMenuCopy } from "../../lib/locale/slashMenu";
import { getWorkspaceFileOpsCopy } from "../../lib/locale/workspaceFileOps";
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
      appleAssistCopy: getAppleAssistCopy(menuLanguage),
      autoBackupRestoreCopy: getAutoBackupRestoreCopy(menuLanguage),
      editorChromeCopy: getEditorChromeCopy(menuLanguage),
      lModeCopy: getLModeCopy(menuLanguage),
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
