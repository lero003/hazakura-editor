import {
  type Dispatch,
  type SetStateAction,
  useCallback,
} from "react";
import { exitApp, hideMainWindow } from "../../lib/tauri/window";
import { isDirty } from "../../features/editor/editorTabs";
import {
  draftRecordFromTab,
  readStoredDrafts,
  removeStoredDrafts,
  upsertDraftRecord,
  writeStoredDrafts,
} from "../../lib/storage";
import type { DraftRecord, EditorTab } from "../../types";

type RefValue<T> = {
  current: T;
};

type UseTabCloseFlowOptions = {
  activeTabId: string | null;
  // v0.17 app-store-quality: save-restore-regression slice 1.4
  // — the app-exit dirty guard. The shared ref is owned by
  // the app-shell controller and flipped to `true` by
  // `useAppExitConfirmation` before it surfaces the
  // existing `AppCloseDialog` on a `Cmd+Q`. The Save All
  // / Discard All handlers then dispatch through
  // `exitApp` instead of `hideMainWindow`. The cancel path
  // resets the ref so a later red-button click on the
  // window does not silently exit the app.
  appExitInProgressRef?: RefValue<boolean>;
  allowWindowCloseRef: RefValue<boolean>;
  dirtyTabs: EditorTab[];
  discardingWindowCloseRef: RefValue<boolean>;
  focusEditorSoon: () => void;
  onBeforeWindowClose?: () => void | Promise<void>;
  pendingCloseTabId: string | null;
  saveTabById: (tabId: string) => Promise<boolean>;
  setActiveTabId: Dispatch<SetStateAction<string | null>>;
  setGlobalError: Dispatch<SetStateAction<string | null>>;
  setPendingAppClose: Dispatch<SetStateAction<boolean>>;
  setPendingCloseTabId: Dispatch<SetStateAction<string | null>>;
  setPendingDrafts: Dispatch<SetStateAction<DraftRecord[]>>;
  setStatus: Dispatch<SetStateAction<string>>;
  setTabs: Dispatch<SetStateAction<EditorTab[]>>;
  tabs: EditorTab[];
  tabsRef: RefValue<EditorTab[]>;
};

function resetDiscardedTab(tab: EditorTab): EditorTab {
  return {
    ...tab,
    contents: tab.lastSavedContents,
    encoding: tab.lastSavedEncoding,
    error: null,
    ignoredExternalFingerprint: null,
    line_ending: tab.lastSavedLineEnding,
    saveStatus: "idle",
  };
}

export function useTabCloseFlow({
  activeTabId,
  appExitInProgressRef,
  allowWindowCloseRef,
  dirtyTabs,
  discardingWindowCloseRef,
  focusEditorSoon,
  onBeforeWindowClose,
  pendingCloseTabId,
  saveTabById,
  setActiveTabId,
  setGlobalError,
  setPendingAppClose,
  setPendingCloseTabId,
  setPendingDrafts,
  setStatus,
  setTabs,
  tabs,
  tabsRef,
}: UseTabCloseFlowOptions) {
  const closeTabNow = useCallback(
    (tabId: string) => {
      const closingTab = tabsRef.current.find((tab) => tab.id === tabId) ?? null;
      const draftKey = closingTab
        ? closingTab.path.length > 0
          ? closingTab.path
          : closingTab.recoveryId
            ? `pathless:${closingTab.recoveryId}`
            : null
        : null;
      const cleanupUnavailable = draftKey
        ? !removeStoredDrafts([draftKey]).ok
        : false;

      if (closingTab) {
        setPendingDrafts((currentDrafts) =>
          currentDrafts.filter((draft) => {
            if (closingTab.path.length > 0) {
              return draft.path !== closingTab.path;
            }
            return (
              !closingTab.recoveryId ||
              draft.recoveryId !== closingTab.recoveryId
            );
          }),
        );
      }

      setTabs((currentTabs) => {
        const closingIndex = currentTabs.findIndex((tab) => tab.id === tabId);
        const nextTabs = currentTabs.filter((tab) => tab.id !== tabId);

        if (activeTabId === tabId) {
          const nextActive =
            nextTabs[Math.min(closingIndex, nextTabs.length - 1)] ?? null;
          setActiveTabId(nextActive?.id ?? null);
        }

        return nextTabs;
      });
      setPendingCloseTabId(null);
      setStatus(
        cleanupUnavailable
          ? "Tab closed; recovery cleanup unavailable"
          : "Tab closed",
      );
    },
    [
      activeTabId,
      setActiveTabId,
      setPendingCloseTabId,
      setPendingDrafts,
      setStatus,
      setTabs,
      tabsRef,
    ],
  );

  const requestCloseTab = useCallback(
    (tabId: string) => {
      const tab = tabs.find((candidate) => candidate.id === tabId);

      if (!tab) {
        return;
      }

      if (isDirty(tab)) {
        setPendingCloseTabId(tabId);
        return;
      }

      closeTabNow(tabId);
    },
    [closeTabNow, setPendingCloseTabId, tabs],
  );

  const findDirtyTargetAfterSave = useCallback(() => {
    const targetTabIds = new Set(dirtyTabs.map((tab) => tab.id));
    return (
      tabsRef.current.find(
        (tab) => targetTabIds.has(tab.id) && isDirty(tab),
      ) ?? null
    );
  }, [dirtyTabs, tabsRef]);

  const saveAndClosePendingTab = useCallback(async () => {
    if (!pendingCloseTabId) {
      return;
    }

    const saved = await saveTabById(pendingCloseTabId);

    if (saved) {
      closeTabNow(pendingCloseTabId);
      return;
    }

    setActiveTabId(pendingCloseTabId);
    setPendingCloseTabId(null);
    setStatus("Close stopped");
    focusEditorSoon();
  }, [
    closeTabNow,
    focusEditorSoon,
    pendingCloseTabId,
    saveTabById,
    setActiveTabId,
    setPendingCloseTabId,
    setStatus,
  ]);

  const saveAllAndCloseWindow = useCallback(async () => {
    if (dirtyTabs.length === 0) {
      // v0.17 slice 1.4: the close dialog may have been
      // surfaced by either the red-button close path
      // (`pendingAppClose` set via the window-close
      // hook) or the `Cmd+Q` app-exit path
      // (`appExitInProgressRef.current === true`). The
      // window-close path teardown is `hideMainWindow`;
      // the app-exit path must actually exit the process
      // via the Rust `exit_app` command.
      const exitAfter = appExitInProgressRef?.current === true;
      allowWindowCloseRef.current = true;
      setPendingAppClose(false);
      try {
        await onBeforeWindowClose?.();
        if (exitAfter) {
          await exitApp();
        } else {
          await hideMainWindow();
        }
      } finally {
        allowWindowCloseRef.current = false;
        if (appExitInProgressRef) {
          appExitInProgressRef.current = false;
        }
      }
      return;
    }

    setStatus("Saving before close...");

    for (const tab of dirtyTabs) {
      const saved = await saveTabById(tab.id);

      if (!saved) {
        setActiveTabId(tab.id);
        setPendingAppClose(false);
        setStatus("Close stopped");
        focusEditorSoon();
        return;
      }
    }

    const dirtyAfterSave = findDirtyTargetAfterSave();
    if (dirtyAfterSave) {
      setActiveTabId(dirtyAfterSave.id);
      setPendingAppClose(false);
      setStatus("Close stopped");
      focusEditorSoon();
      if (appExitInProgressRef) {
        appExitInProgressRef.current = false;
      }
      return;
    }

    const exitAfter = appExitInProgressRef?.current === true;
    allowWindowCloseRef.current = true;
    setPendingAppClose(false);
    try {
      await onBeforeWindowClose?.();
      if (exitAfter) {
        await exitApp();
      } else {
        await hideMainWindow();
      }
    } catch (err) {
      setGlobalError(`Close failed: ${String(err)}`);
      setStatus("Close failed");
    } finally {
      allowWindowCloseRef.current = false;
      if (appExitInProgressRef) {
        appExitInProgressRef.current = false;
      }
    }
  }, [
    allowWindowCloseRef,
    appExitInProgressRef,
    dirtyTabs,
    findDirtyTargetAfterSave,
    focusEditorSoon,
    onBeforeWindowClose,
    saveTabById,
    setActiveTabId,
    setGlobalError,
    setPendingAppClose,
    setStatus,
  ]);

  const discardAllAndCloseWindow = useCallback(async () => {
    const discardedDraftKeys = dirtyTabs
      .map((tab) =>
        tab.path.length > 0
          ? tab.path
          : tab.recoveryId
            ? `pathless:${tab.recoveryId}`
            : null,
      )
      .filter((key): key is string => key !== null);
    const discardedPaths = new Set(
      dirtyTabs.map((tab) => tab.path).filter((path) => path.length > 0),
    );
    const discardedRecoveryIds = new Set(
      dirtyTabs
        .filter((tab) => tab.path.length === 0 && tab.recoveryId)
        .map((tab) => tab.recoveryId as string),
    );
    const dirtyTabById = new Map(dirtyTabs.map((tab) => [tab.id, tab]));
    const discardedTabIds = new Set(dirtyTabs.map((tab) => tab.id));
    // v0.17 slice 1.4: see the matching dispatch in
    // `saveAllAndCloseWindow`. The ref is captured at the
    // start so a re-render between dialog confirm and
    // final action cannot switch the close target.
    const exitAfter = appExitInProgressRef?.current === true;

    discardingWindowCloseRef.current = true;
    const cleanup = removeStoredDrafts(discardedDraftKeys);
    if (!cleanup.ok) {
      setStatus("Closing; recovery cleanup unavailable");
    }
    setPendingDrafts((currentDrafts) =>
      currentDrafts.filter((draft) => {
        if (draft.path.length > 0) {
          return !discardedPaths.has(draft.path);
        }
        return (
          !draft.recoveryId || !discardedRecoveryIds.has(draft.recoveryId)
        );
      }),
    );
    allowWindowCloseRef.current = true;

    try {
      setPendingAppClose(false);
      setTabs((currentTabs) =>
        currentTabs.map((tab) =>
          discardedTabIds.has(tab.id) ? resetDiscardedTab(tab) : tab,
        ),
      );
      await onBeforeWindowClose?.();
      if (exitAfter) {
        await exitApp();
      } else {
        await hideMainWindow();
      }
    } catch (err) {
      allowWindowCloseRef.current = false;
      setTabs((currentTabs) =>
        currentTabs.map((tab) => dirtyTabById.get(tab.id) ?? tab),
      );
      const recoveryRestore = writeStoredDrafts(
        [
          ...readStoredDrafts(),
          ...dirtyTabs.map(draftRecordFromTab),
        ].reduce<DraftRecord[]>(
          (records, draft) => upsertDraftRecord(records, draft),
          [],
        ),
      );
      setPendingAppClose(false);
      setGlobalError(
        recoveryRestore.ok
          ? `Close failed: ${String(err)}`
          : `Close failed: ${String(err)}; recovery storage unavailable`,
      );
      setStatus(
        recoveryRestore.ok
          ? "Close failed"
          : "Close failed; recovery storage unavailable",
      );
    } finally {
      allowWindowCloseRef.current = false;
      discardingWindowCloseRef.current = false;
      if (appExitInProgressRef) {
        appExitInProgressRef.current = false;
      }
    }
  }, [
    allowWindowCloseRef,
    appExitInProgressRef,
    dirtyTabs,
    discardingWindowCloseRef,
    onBeforeWindowClose,
    setGlobalError,
    setPendingAppClose,
    setPendingDrafts,
    setStatus,
    setTabs,
  ]);

  return {
    closeTabNow,
    discardAllAndCloseWindow,
    requestCloseTab,
    saveAllAndCloseWindow,
    saveAndClosePendingTab,
  };
}
