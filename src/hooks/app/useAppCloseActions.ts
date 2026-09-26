import { useCallback, type RefObject } from "react";
import type { EditorTab } from "../../types";
import { exitApp } from "../../lib/tauri/window";
import { isDirty } from "../../features/editor/editorTabs";
import { useAppExitConfirmation } from "./useAppExitConfirmation";
import {
  persistWorkspaceStateSnapshot,
  shouldPersistWorkspaceSessionOnQuit,
} from "../workspace/useWorkspaceStatePersistence";

type Options = {
  activeTab: EditorTab | null;
  activeTabId: string | null;
  appExitInProgressRef: RefObject<boolean>;
  cancelPendingAppClose: () => void;
  dirtyTabCount: number;
  requestAppCloseConfirmation: () => void;
  restoreComplete: boolean;
  stopActiveAppleAssistGeneration: () => Promise<void>;
  tabsRef: RefObject<EditorTab[]>;
  workspaceRootPath: string | null;
};

export function useAppCloseActions({
  activeTab,
  activeTabId,
  appExitInProgressRef,
  cancelPendingAppClose,
  dirtyTabCount,
  requestAppCloseConfirmation,
  restoreComplete,
  stopActiveAppleAssistGeneration,
  tabsRef,
  workspaceRootPath,
}: Options) {
  // The shared close dialog uses this flag to distinguish app exit from
  // window hide. Cancel must reset it before another close request.
  const onAppExitNeedsConfirmation = useCallback(() => {
    appExitInProgressRef.current = true;
    requestAppCloseConfirmation();
  }, [appExitInProgressRef, requestAppCloseConfirmation]);
  const cancelPendingAppCloseAndExitFlag = useCallback(() => {
    appExitInProgressRef.current = false;
    cancelPendingAppClose();
  }, [appExitInProgressRef, cancelPendingAppClose]);

  const persistWorkspaceSession = useCallback(() => {
    const latestTabs = tabsRef.current;
    if (
      !shouldPersistWorkspaceSessionOnQuit({
        restoreComplete,
        tabs: latestTabs,
        workspaceRootPath,
      })
    ) {
      return;
    }

    const latestActiveTab =
      latestTabs.find((tab) => tab.id === activeTabId) ?? activeTab ?? null;

    persistWorkspaceStateSnapshot({
      activeTab: latestActiveTab,
      tabs: latestTabs,
      workspaceRootPath,
    });
  }, [activeTab, activeTabId, restoreComplete, tabsRef, workspaceRootPath]);

  // Both menu and OS exits wait for shutdown. A different document may
  // become dirty while cancellation is pending, so recheck the live tabs
  // before allowing the process to exit.
  const onBeforeExitWithAssistShutdown = useCallback(async () => {
    await stopActiveAppleAssistGeneration();
    if (tabsRef.current.some(isDirty)) {
      onAppExitNeedsConfirmation();
      return false;
    }
    persistWorkspaceSession();
    return true;
  }, [
    onAppExitNeedsConfirmation,
    persistWorkspaceSession,
    stopActiveAppleAssistGeneration,
    tabsRef,
  ]);

  const requestAppQuit = useCallback(async () => {
    if (dirtyTabCount > 0 || tabsRef.current.some(isDirty)) {
      onAppExitNeedsConfirmation();
      return;
    }
    if (await onBeforeExitWithAssistShutdown()) {
      await exitApp();
    }
  }, [
    dirtyTabCount,
    onAppExitNeedsConfirmation,
    onBeforeExitWithAssistShutdown,
    tabsRef,
  ]);

  useAppExitConfirmation({
    appExitInProgressRef,
    dirtyTabCount,
    onBeforeExit: onBeforeExitWithAssistShutdown,
    onNeedsConfirmation: onAppExitNeedsConfirmation,
  });

  // Same shutdown-before-persist hook for the save/discard → close
  // dialog flow (window hide, not app exit). Distinct from the exit
  // path so the two close destinations stay explicit.
  const onBeforeWindowCloseWithAssistShutdown = useCallback(async () => {
    await stopActiveAppleAssistGeneration();
    persistWorkspaceSession();
  }, [persistWorkspaceSession, stopActiveAppleAssistGeneration]);

  return {
    cancelPendingAppCloseAndExitFlag,
    requestAppQuit,
    onBeforeWindowCloseWithAssistShutdown,
  };
}
