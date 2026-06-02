import { useMemo } from "react";
import type { AppMenuActionHandlers } from "./useAppMenuActionListener";
import { useLatestValueRef } from "./useLatestValueRef";

export function useAppMenuActionsRef({
  createNewFile,
  exportHtml,
  exportPdf,
  openAgentWindow,
  openFile,
  openWorkspace,
  openWorkspacePath,
  requestWindowClose,
  saveActiveTab,
  saveActiveTabAs,
  toggleReviewDesk,
}: AppMenuActionHandlers) {
  const appMenuActions = useMemo<AppMenuActionHandlers>(
    () => ({
      createNewFile,
      exportHtml,
      exportPdf,
      openAgentWindow,
      openFile,
      openWorkspace,
      openWorkspacePath,
      requestWindowClose,
      saveActiveTab,
      saveActiveTabAs,
      toggleReviewDesk,
    }),
    [
      createNewFile,
      exportHtml,
      exportPdf,
      openAgentWindow,
      openFile,
      openWorkspace,
      openWorkspacePath,
      requestWindowClose,
      saveActiveTab,
      saveActiveTabAs,
      toggleReviewDesk,
    ],
  );

  return useLatestValueRef(appMenuActions);
}
