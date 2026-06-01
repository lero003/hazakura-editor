import { useMemo } from "react";
import type { AppMenuActionHandlers } from "./useAppMenuActionListener";
import { useLatestValueRef } from "./useLatestValueRef";

export function useAppMenuActionsRef({
  createNewFile,
  exportHtml,
  exportPdf,
  openFile,
  openWorkspace,
  openWorkspacePath,
  requestWindowClose,
  saveActiveTab,
  saveActiveTabAs,
}: AppMenuActionHandlers) {
  const appMenuActions = useMemo<AppMenuActionHandlers>(
    () => ({
      createNewFile,
      exportHtml,
      exportPdf,
      openFile,
      openWorkspace,
      openWorkspacePath,
      requestWindowClose,
      saveActiveTab,
      saveActiveTabAs,
    }),
    [
      createNewFile,
      exportHtml,
      exportPdf,
      openFile,
      openWorkspace,
      openWorkspacePath,
      requestWindowClose,
      saveActiveTab,
      saveActiveTabAs,
    ],
  );

  return useLatestValueRef(appMenuActions);
}
