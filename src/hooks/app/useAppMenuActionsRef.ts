import { useMemo } from "react";
import type { AppMenuActionHandlers } from "./useAppMenuActionListener";
import { useLatestValueRef } from "./useLatestValueRef";

export function useAppMenuActionsRef({
  createNewFile,
  exportHtml,
  exportPdf,
  openAgentWindow,
  openAppleAssistWindow,
  openFile,
  openWorkspace,
  openWorkspacePath,
  requestAppQuit,
  requestWindowClose,
  saveActiveTab,
  saveActiveTabAs,
}: AppMenuActionHandlers) {
  const appMenuActions = useMemo<AppMenuActionHandlers>(
    () => ({
      createNewFile,
      exportHtml,
      exportPdf,
      openAgentWindow,
      openAppleAssistWindow,
      openFile,
      openWorkspace,
      openWorkspacePath,
      requestAppQuit,
      requestWindowClose,
      saveActiveTab,
      saveActiveTabAs,
    }),
    [
      createNewFile,
      exportHtml,
      exportPdf,
      openAgentWindow,
      openAppleAssistWindow,
      openFile,
      openWorkspace,
      openWorkspacePath,
      requestAppQuit,
      requestWindowClose,
      saveActiveTab,
      saveActiveTabAs,
    ],
  );

  return useLatestValueRef(appMenuActions);
}
