import { useMemo } from "react";
import type { AppMenuActionHandlers } from "./useAppMenuActionListener";
import { useLatestValueRef } from "./useLatestValueRef";

export function useAppMenuActionsRef({
  createNewFile,
  createOkfScaffold,
  exportEpubBeta,
  exportHtml,
  exportPdf,
  importSourceAsMarkdownDraft,
  openAgentWindow,
  openAppleAssistWindow,
  openFile,
  openReferenceFile,
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
      createOkfScaffold,
      exportEpubBeta,
      exportHtml,
      exportPdf,
      importSourceAsMarkdownDraft,
      openAgentWindow,
      openAppleAssistWindow,
      openFile,
      openReferenceFile,
      openWorkspace,
      openWorkspacePath,
      requestAppQuit,
      requestWindowClose,
      saveActiveTab,
      saveActiveTabAs,
    }),
    [
      createNewFile,
      createOkfScaffold,
      exportEpubBeta,
      exportHtml,
      exportPdf,
      importSourceAsMarkdownDraft,
      openAgentWindow,
      openAppleAssistWindow,
      openFile,
      openReferenceFile,
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
