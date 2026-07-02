// `useAppShellController` is the Phase 3 single orchestrator hook
// that bundles the ~40 leaf hooks App.tsx used to call individually
// into one place. It returns a flat object that satisfies
// `AppShellProps` so App.tsx can be reduced to a 2-line
// `const props = useAppShellController(); return <AppShell {...props} />;`.
//
// The controller preserves the exact leaf-hook call order and
// arguments that the pre-refactor App.tsx used (verified by
// re-running `npm run typecheck`, `npm run build:vite`, and
// `cargo test` after the move), so behavior is unchanged. Each
// section is labeled with the feature it owns and the inline
// `// section: <feature>` comment marks the boundary, but the
// controller is one function (not six) because the cross-feature
// dependency graph (doc → workspace → diff; chrome owns refs /
// dialogs / i18n; review + agent are leaves) is tangled enough that
// splitting into 6 controllers would require threading a large
// shared "context" object through every call, which would just
// relocate the surface to the controller args. Keeping it as one
// function lets the React hook order stay obvious and the
// dependency wiring stay in one place.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  openAgentWindow,
  openAppleAssistWindow,
  toggleAppleAssistWindow,
} from "../../lib/tauri";
import { isAppleLocalAssistSurfaceAllowed } from "../../lib/distributionLane";
import { useAgentWorkbenchController } from "../agent/useAgentWorkbenchController";
import { useAppExitConfirmation } from "./useAppExitConfirmation";
import { useAppleAssistAvailability } from "../agent/useAppleAssistAvailability";
import { useCommandPaletteController } from "../commandPalette/useCommandPaletteController";
import { useCompareController } from "../diff/useCompareController";
import { useDocumentSafetyActions } from "../document/useDocumentSafetyActions";
import { useDocumentIoController } from "../document/useDocumentIoController";
import { useDocumentCoreController } from "../document/useDocumentCoreController";
import { useDocumentPreviewController } from "../document/useDocumentPreviewController";
import { useEditorSurfaceController } from "../document/useEditorSurfaceController";
import { useAppleAssistTargetSync } from "../editor/useAppleAssistTargetSync";
import { useAppleAssistApplyHandler } from "../editor/useAppleAssistApplyHandler";
import { stopAppleAssistGeneration } from "../../lib/tauri";
import { aiEditTransactionStore } from "../../features/editor/aiEditTransactions";
import { useEditorCommands } from "../editor/useEditorCommands";
import { useEditorFindController } from "../editor/useEditorFindController";
import { useTabBarController } from "../editor/useTabBarController";
import { useWorkspaceFileOpening } from "../workspace/useWorkspaceFileOpening";
import { useAppShellFoundation } from "./useAppShellFoundation";
import { useAppShellRefs } from "./useAppShellRefs";
import { useWindowDialogActions } from "./useWindowDialogActions";
import { useLocalizedAppCopy } from "./useLocalizedAppCopy";
import { useAppShellSideEffectsController } from "./useAppShellSideEffectsController";
import { useAutoBackupRestore } from "../workspace/useAutoBackupRestore";
import {
  persistWorkspaceStateSnapshot,
  shouldPersistWorkspaceSessionOnQuit,
} from "../workspace/useWorkspaceStatePersistence";
import { exitApp } from "../../lib/tauri/window";
import type { AppleAssistGenerationLock } from "../../types";

export function useAppShellController() {
  const appleLocalAssistAllowed = isAppleLocalAssistSurfaceAllowed();

  // section: state pool (orchestrator extracts dep-free leaf hooks)
  const foundation = useAppShellFoundation();

  // section: agent runtime state
  const {
    activeAgentSession,
    agentLaunchGate,
    agentSession,
    agentStopPending,
    agentTerminalSize,
    appRestartPending,
    setAgentLaunchGate,
    setAgentSession,
    setAgentStopPending,
    setAgentTerminalSize,
    setAppRestartPending,
  } = foundation;

  // section: chrome dialog state
  const {
    pendingAppClose,
    pendingCloseTabId,
    preferencesDialogMode,
    setPendingAppClose,
    setPendingCloseTabId,
    setPreferencesDialogMode,
  } = foundation;

  // section: chrome view state
  const {
    rightPaneMode,
    setRightPaneMode,
    setSidePaneOpen,
    sidePaneOpen,
  } = foundation;

  // section: draft recovery
  const { pendingDrafts, setPendingDrafts } = foundation;

  // section: chrome feedback
  const { globalError, setGlobalError, setStatus, status } = foundation;

  // section: save affirmation (depends on status; foundation re-exposes
  // useSaveAffirmation's `affirmation` / `lastAffirmedAt` as the
  // orchestrator's `saveAffirmation` / `saveAffirmationKey` field names)
  const { saveAffirmation, saveAffirmationKey } = foundation;

  // section: editor tabs
  const { activeTabId, setActiveTabId, setTabs, tabs } = foundation;
  const [appleAssistGenerationLock, setAppleAssistGenerationLock] =
    useState<AppleAssistGenerationLock | null>(null);
  // Mirror the generation lock into a ref so the window/tab close
  // paths can read "is any generation in flight?" synchronously
  // without depending on the React render cycle. `appleAssistGenerationLock`
  // (the public value) is scoped to the active tab; this ref tracks
  // any in-flight generation regardless of which tab started it.
  const appleAssistGenerationActiveRef = useRef<boolean>(false);
  const setAppleAssistGenerationLockWithMirror = useCallback<Dispatch<SetStateAction<AppleAssistGenerationLock | null>>>(
    (next) => {
      setAppleAssistGenerationLock((prev) => {
        const resolved =
          typeof next === "function" ? next(prev) : next;
        appleAssistGenerationActiveRef.current = resolved !== null;
        return resolved;
      });
    },
    [],
  );
  // Stop an in-flight Hazakura Local Assist generation, if any. Used
  // by the window/tab close paths so no helper process is orphaned
  // and the in-flight Promise resolves with a cancel. Idempotent.
  const stopActiveAppleAssistGeneration = useCallback(async () => {
    if (!appleAssistGenerationActiveRef.current) {
      return;
    }
    try {
      await stopAppleAssistGeneration();
    } catch {
      // The Rust cancel path is best-effort. If it fails (helper
      // already gone, distribution lane mismatch, etc.), the lock
      // still clears via the apply handler's finally block when the
      // in-flight Promise settles.
    }
  }, []);
  const [pendingAssistDiscard, setPendingAssistDiscard] = useState<{
    sessionId: string;
    beforeBuffer: string;
  } | null>(null);
  const appleAssistLockMessage =
    "生成中のため、この文書の編集を一時停止しています";
  const isAppleAssistTabLocked = useCallback(
    (tabId: string | null | undefined, tabPath: string | null | undefined) =>
      Boolean(
        appleAssistGenerationLock &&
          (appleAssistGenerationLock.tabId === tabId ||
            appleAssistGenerationLock.tabPath === tabPath),
      ),
    [appleAssistGenerationLock],
  );
  // section: editor selection
  const { selectionInfo, setSelectionInfo } = foundation;

  // section: diff state
  const {
    compareAnchor,
    compareTarget,
    compareView,
    getCompareCaseByKey,
    setCompareAnchor,
    setCompareCaseEntry,
    setCompareTarget,
    setCompareView,
  } = foundation;

  // section: workspace shell state
  const {
    restoreComplete,
    setRestoreComplete,
    setWorkspaceRootPath,
    setWorkspaceTree,
    workspaceRootPath,
    workspaceTree,
  } = foundation;

  // section: auto-backup restore dialog state (visibility) + load hook
  const {
    closeRestoreBackupDialog,
    openRestoreBackupDialog,
    restoreBackupDialogOpen,
  } = foundation;
  const autoBackupRestore = useAutoBackupRestore();

  // section: agent workbench preferences
  const {
    agentWorkbenchActive,
    agentWorkbenchAvailable,
    agentWorkbenchConsent,
    agentWorkbenchPreference,
    agentWorkbenchProvider,
    assistSurfaceActive,
    assistSurfacePreference,
    setAgentWorkbenchConsent,
    setAgentWorkbenchPreference,
    setAgentWorkbenchProvider,
    setAssistSurfacePreference,
  } = foundation;

  // section: app preferences
  const {
    editorSettings,
    editorTheme,
    menuLanguage,
    previewVisible,
    resolvedTheme,
    setEditorSettings,
    setMenuLanguage,
    setPreviewVisible,
    setThemePreference,
    themePreference,
  } = foundation;

  // section: recent entries
  const {
    recentFiles,
    recentFilesRef,
    recentFolders,
    recentFoldersRef,
    rememberRecentFile,
    rememberRecentFolder,
    setRecentFiles,
    setRecentFolders,
  } = foundation;

  // section: agent UI refresh gate
  const {
    agentUiSuspendedRef,
    resumeAgentUiRefresh,
    suspendAgentUiRefresh,
  } = foundation;

  // section: document core (editor tab state + pasted image)
  const {
    activeConflict,
    activeContents,
    activeDirty,
    activeDraft,
    activeError,
    activeSaveError,
    activeTab,
    dirtyTabCount,
    dirtyTabs,
    handlePasteImage,
    pendingCloseTab,
  } = useDocumentCoreController({
    activeTabId,
    globalError,
    menuLanguage,
    pendingCloseTabId,
    pendingDrafts,
    setStatus,
    tabs,
    workspaceRootPath,
  });
  const activeAppleAssistGenerationLock =
    activeTab && isAppleAssistTabLocked(activeTab.id, activeTab.path)
      ? appleAssistGenerationLock
      : null;

  // section: refs (editor + dialog; depends on tabs + editor tab state)
  const {
    editorPaneRef,
    findInputRef,
    previewPaneRef,
    tabsRef,
    allowWindowCloseRef,
    appCloseCancelButtonRef,
    appCloseDialogRef,
    closeTabCancelButtonRef,
    closeTabDialogRef,
    discardingWindowCloseRef,
    epubExportCancelButtonRef,
    epubExportDialogRef,
    pdfExportCancelButtonRef,
    pdfExportDialogRef,
    modalOpen,
    moveTrashCancelButtonRef,
    moveTrashDialogRef,
    assistDiscardCancelButtonRef,
    assistDiscardDialogRef,
    pendingCloseTabOpen,
    preferencesCloseButtonRef,
    preferencesDialogRef,
    preferencesOpen,
  } = useAppShellRefs({
    pendingAppClose,
    pendingCloseTab,
    preferencesDialogMode,
    tabs,
  });

  // v0.17 app-store-quality: save-restore-regression slice 1.4
  // — `Cmd+Q` / Quit menu dirty guard. The ref is flipped
  // to `true` by `useAppExitConfirmation` when a
  // `RunEvent::ExitRequested` lands while there are
  // unsaved tabs, then read by
  // `useTabCloseFlow.saveAllAndCloseWindow` /
  // `discardAllAndCloseWindow` to dispatch through
  // `exitApp` instead of `hideMainWindow`. The cancel
  // path below resets it so a later red-button window
  // close does not silently exit the app.
  const appExitInProgressRef = useRef(false);

  // section: document preview (image preview + document identity)
  const {
    activeTabPath,
    clearImagePreview,
    closeSelectedImagePreview,
    documentKey,
    hasActiveDocument,
    imageReturnTabId,
    openImagePreview,
    selectedImage,
    selectedImageOpen,
  } = useDocumentPreviewController({
    activeTab,
    activeTabId,
    onError: setGlobalError,
    onStatus: setStatus,
    setActiveTabId,
    setCompareView,
    tabs,
    workspaceRootPath,
  });

  // section: workspace context menu
  const {
    closeTabContextMenu,
    closeWorkspaceContextMenu,
    openRootWorkspaceContextMenu,
    openTabContextMenu,
    openWorkspaceContextMenu,
    tabContextMenu,
    workspaceContextMenu,
  } = foundation;

  // section: quick open
  const { closeQuickOpen, quickOpenVisible, toggleQuickOpen } =
    foundation;

  // section: localized app copy
  const {
    agentWorkbenchCopy,
    agentWorkbenchRestartRequired,
    autoBackupRestoreCopy,
    editorChromeCopy,
    fileOpsCopy,
    lModeCopy,
    preferencesCopy,
    recoveryCopy,
    safeEditorCopy,
    sidePaneCopy,
    slashMenuCopy,
  } = useLocalizedAppCopy({
    agentWorkbenchActive,
    agentWorkbenchPreference,
    menuLanguage,
  });

  // section: editor surface (side pane + active document surface)
  const {
    activeDirtyLabel,
    activeDocumentLineCount,
    activeStatusDetail,
    activeStatusSecondaryDetail,
    currentMarkdownHeading,
    documentHeadings,
    documentOutline,
    editorPreviewGridRef,
    editorPreviewGridStyle,
    handlePreviewResizeKeyDown,
    handlePreviewResizePointerDown,
    handlePreviewResizePointerMove,
    hasWorkspaceSelection,
    previewColumnPercent,
    scrollHudContext,
    scrollHudLine,
    scrollHudVisible,
    sidePaneMode,
    sidePaneVisible,
    syncEditorScroll,
    syncPreviewScroll,
    toggleDiffPane,
    toggleEbookPane,
    toggleOutlinePane,
    togglePreviewPane,
  } = useEditorSurfaceController({
    activeContents,
    activeDirty,
    activeTab,
    compareView,
    editorPaneRef,
    getCompareCaseByKey,
    hasActiveDocument,
    menuLanguage,
    noFileOpenText: safeEditorCopy.noFileOpen,
    previewPaneRef,
    previewVisible,
    rightPaneMode,
    selectedImage,
    selectionInfo,
    setPreviewVisible,
    setRightPaneMode,
    setSidePaneOpen,
    sidePaneOpen,
  });

  // section: find / replace + go to line
  const {
    activeMatchIndex,
    closeFindAndFocusEditor,
    findMatchCount,
    findMatches,
    findQuery,
    findVisible,
    handleFindKeyDown,
    handleReplaceKeyDown,
    invalidRegex,
    replaceAll,
    replaceOne,
    replaceQuery,
    searchOptions,
    setFindQuery,
    setFindVisible,
    setReplaceQuery,
    setSearchOptions,
    showNextMatch,
    showPreviousMatch,
    goToLine,
    goToLineValue,
    handleGoToLineKeyDown,
    setGoToLineValue,
  } = useEditorFindController({
    documentKey,
    editorPaneRef,
    setStatus,
    source: activeContents,
  });

  // section: agent output buffer
  const { agentOutput, applyAgentOutput, resetAgentOutput } = foundation;

  // v0.12+ Hazakura Local Assist Writing Companion (slice 3).
  // Keep the Rust-side `MainAppleAssistTargetCache` fresh on
  // every selection / cursor change. The hook is a no-op
  // outside the Tauri runtime (it short-circuits the
  // `setMainAppleAssistTarget` invoke), so it is safe to
  // call unconditionally.
  useAppleAssistTargetSync({
    editorPaneRef,
    activeTab: activeTab
      ? {
          id: activeTab.id,
          name: activeTab.name,
          path: activeTab.path,
        }
      : null,
    selectionInfo,
  });

  // v0.12+ Hazakura Local Assist Writing Companion (slice 4).
  // Main-window listener for `APPLY_AI_EDIT_TRANSACTION_EVENT`.
  // The detached Hazakura Local Assist window fires this when the user
  // clicks Apply; the hook runs the fixture transform, mutates
  // the active tab's unsaved buffer, and records the
  // transaction in the session-local store so the slice 5
  // escape hatch can surface a "review / discard" affordance.
  //
  // The hook is purely side-effect: the only output it produces
  // is the tab mutation (via the `setActiveTabContents` callback
  // that updates the active tab's `contents` + `saveStatus` in
  // one shot) and a status message routed through `setStatus`.
  useAppleAssistApplyHandler({
    activeTab: activeTab
      ? {
          id: activeTab.id,
          sessionId: activeTab.sessionId,
          name: activeTab.name,
          path: activeTab.path,
          contents: activeTab.contents,
        }
      : null,
    setActiveTabContents: (next: string, tabId: string) => {
      // v0.34: クロージャの activeTab.sessionId ではなく、ハンドラが検証済みの
      // tabId で書き込み先を決める。生成中に別タブへ切替しても誤爆しない。
      setTabs((currentTabs) =>
        currentTabs.map((tab) =>
          tab.sessionId === tabId
            ? {
                ...tab,
                contents: next,
                saveStatus: "idle",
                error: null,
              }
            : tab,
        ),
      );
    },
    setStatus,
    setGenerationLock: setAppleAssistGenerationLockWithMirror,
  });

  // section: workspace file opening
  const {
    cancelPendingRename,
    confirmPendingRename,
    createFile,
    createFolder,
    createNewFile,
    loadWorkspaceDirectory,
    moveWorkspacePath,
    openExternalFilePaths,
    openFile,
    openFilePath,
    openWorkspace,
    openWorkspacePath,
    openPreviewMarkdownLink,
    openWorkspaceFile,
    pendingRenameWarning,
    pendingTrash,
    refreshWorkspaceTree,
    renameWorkspacePath,
    renamingPath,
    requestRename,
    requestTrashWorkspacePath,
    confirmPendingTrash,
    cancelPendingTrash,
  } = useWorkspaceFileOpening({
    activeTab,
    clearImagePreview,
    menuLanguage,
    openImagePreview,
    rememberRecentFile,
    rememberRecentFolder,
    setActiveTabId,
    setCompareAnchor,
    setCompareTarget,
    setCompareView,
    setGlobalError,
    getCompareCaseByKey,
    setPendingDrafts,
    setRecentFiles,
    setStatus,
    setTabs,
    setWorkspaceRootPath,
    setWorkspaceTree,
    tabs,
    workspaceRootPath,
  });

  // v0.18 accessibility follow-up: the move-to-trash dialog
  // is a modal-shaped surface, so the controller composes the
  // `pendingTrashOpen` boolean and the augmented `modalOpen`
  // here, after the workspace hook destructures the trash
  // state. The values are forwarded to the keyboard guard and
  // the focus hook through the `keyboardFocus` object below.
  // The ref pool above still owns the dialog ref and the
  // cancel button ref so the dialog itself stays structurally
  // aligned with the v0.7-era close / app-close dialogs.
  const pendingTrashOpen = pendingTrash !== null;
  // v1.3: the Local Assist discard confirmation is another
  // destructive confirm-style dialog, so it is composed into
  // the shared modal surface the same way `pendingTrashOpen`
  // is. This keeps global shortcuts suppressed and routes the
  // dialog through the central focus / keyboard-guard pool.
  const pendingAssistDiscardOpen = pendingAssistDiscard !== null;
  // section: window dialog actions
  const {
    cancelPendingAppClose,
    cancelPendingTabClose,
    closePreferencesFromKeyboard,
    focusEditorSoon,
    requestAppCloseConfirmation,
    requestWindowClose,
  } = useWindowDialogActions({
    editorPaneRef,
    setGlobalError,
    setPendingAppClose,
    setPendingCloseTabId,
    setPreferencesDialogMode,
    setStatus,
  });

  // v0.17 app-store-quality: save-restore-regression slice 1.4
  // — wrap the existing `requestAppCloseConfirmation` and
  // `cancelPendingAppClose` so the app-exit ref is flipped
  // and reset through the same dialog callbacks the
  // window-close path already uses. The wrapper is the only
  // place the ref is mutated outside of `useTabCloseFlow`'s
  // `finally` block.
  const onAppExitNeedsConfirmation = useCallback(() => {
    appExitInProgressRef.current = true;
    requestAppCloseConfirmation();
  }, [requestAppCloseConfirmation]);
  const cancelPendingAppCloseAndExitFlag = useCallback(() => {
    appExitInProgressRef.current = false;
    cancelPendingAppClose();
  }, [cancelPendingAppClose]);

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

  const requestAppQuit = useCallback(() => {
    if (dirtyTabCount === 0) {
      persistWorkspaceSession();
      void exitApp();
      return;
    }

    appExitInProgressRef.current = true;
    requestAppCloseConfirmation();
  }, [
    appExitInProgressRef,
    dirtyTabCount,
    persistWorkspaceSession,
    requestAppCloseConfirmation,
  ]);

  // Stop any in-flight Local Assist generation before the app exits
  // or the window closes through the save/discard dialog flow. The
  // persist step stays synchronous; the shutdown runs first.
  const onBeforeExitWithAssistShutdown = useCallback(async () => {
    await stopActiveAppleAssistGeneration();
    persistWorkspaceSession();
  }, [persistWorkspaceSession, stopActiveAppleAssistGeneration]);

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

  // section: tab bar controller
  const {
    draggingTabId,
    dragOverTabId,
    finishTabPointerDrag,
    focusAdjacentTab,
    handleTabPointerDown,
    handleTabPointerMove,
    selectTabFromBar,
    shouldSuppressTabClick,
  } = useTabBarController({
    activeTabId,
    clearImagePreview,
    focusEditorSoon,
    imageReturnTabId,
    onShowDocumentSurface: () => {},
    setActiveTabId,
    setTabs,
    setStatus,
    tabs,
  });

  // section: compare controller
  const {
    clearCompareSource,
    clearCompareTarget,
    closeCompareView,
    compareWorkspaceFiles,
    copyWorkspaceFullPath,
    prepareReviewTabAgainstDisk,
    requestReviewBackupAgainstBuffer,
    requestReviewDraftAgainstDisk,
    requestReviewTabAgainstDisk,
    revealWorkspacePath,
    runSelectedFileCompare,
    selectWorkspaceCompareFile,
    setCompareSource,
    setCompareTargetFile,
  } = useCompareController({
    activeTab,
    closeWorkspaceContextMenu,
    compareAnchor,
    compareTarget,
    getCurrentTabById: (tabId) =>
      tabsRef.current.find((tab) => tab.id === tabId) ?? null,
    menuLanguage,
    setCompareAnchor,
    setCompareCaseEntry,
    setCompareTarget,
    setCompareView,
    setGlobalError,
    setRightPaneMode,
    setSidePaneOpen,
    setStatus,
  });

  // section: auto-backup restore flow
  //
  // Open the picker dialog and load the active tab's backup
  // list in one step. The list reload is best-effort: if it
  // fails the dialog still opens (with an error message) so
  // the user can at least dismiss it. Declared after
  // `useCompareController` so `requestReviewBackupAgainstBuffer`
  // and `closeCompareView` are in scope; the command palette
  // wiring below uses this reference.
  const requestRestoreFromBackup = useCallback(() => {
    if (!activeTab || !workspaceRootPath) {
      setStatus("Open a file in a workspace to restore a backup");
      return;
    }
    openRestoreBackupDialog();
    void autoBackupRestore.loadBackups({
      workspaceRoot: workspaceRootPath,
      filePath: activeTab.path,
    });
  }, [
    activeTab,
    autoBackupRestore,
    openRestoreBackupDialog,
    setStatus,
    workspaceRootPath,
  ]);

  // User picked a backup entry. Read its content, then open
  // the right-pane comparison (`backup-vs-buffer`). The diff
  // is what shows the user exactly what would change before
  // they commit — the apply step is a second, explicit click
  // inside the compare view.
  const selectAutoBackupEntry = useCallback(
    async (entry: { name: string; path: string }) => {
      if (!activeTab || !workspaceRootPath) {
        return;
      }
      closeRestoreBackupDialog();
      try {
        const contents = await autoBackupRestore.readBackup(
          { workspaceRoot: workspaceRootPath, filePath: activeTab.path },
          entry.name,
        );
        if (editorSettings.lModeEnabled) {
          setEditorSettings((current) => ({
            ...current,
            lModeEnabled: false,
          }));
        }
        await requestReviewBackupAgainstBuffer(
          activeTab,
          entry.name,
          contents,
        );
      } catch (err) {
        setGlobalError(`Restore from backup failed: ${String(err)}`);
        setStatus("Restore from backup failed");
      }
    },
    [
      activeTab,
      autoBackupRestore,
      closeRestoreBackupDialog,
      editorSettings.lModeEnabled,
      requestReviewBackupAgainstBuffer,
      setEditorSettings,
      setGlobalError,
      setStatus,
      workspaceRootPath,
    ],
  );

  // Apply a previously-selected backup to its original target tab. The
  // `compareCase` comes from the diff view's state (the
  // `backupApplyAction` payload is set when the case is built,
  // not when the apply button is clicked), so the right-pane
  // view is the source of truth for "which backup am I
  // applying". We use the compare case's document path rather
  // than the current active tab so a tab switch between review
  // and Apply cannot write the backup into the wrong document.
  // The buffer is marked dirty so the user still has to save to
  // persist; this avoids a silent disk write when the user just
  // wanted to peek at a backup.
  const applyBackupToActiveTab = useCallback(
    (documentPath: string, backupContents: string) => {
      const targetTab = tabs.find((tab) => tab.path === documentPath);
      if (!targetTab) {
        setStatus("Backup apply failed");
        return;
      }
      setTabs((currentTabs) =>
        currentTabs.map((tab) =>
          tab.path === documentPath
            ? {
                ...tab,
                contents: backupContents,
                saveStatus: "idle",
                error: null,
              }
            : tab,
        ),
      );
      setActiveTabId(targetTab.id);
      closeCompareView();
      setStatus("Backup applied — save to keep changes");
    },
    [closeCompareView, setActiveTabId, setStatus, setTabs, tabs],
  );

  // section: document IO controller
  const {
    cancelPdfExport,
    cancelEpubBetaExport,
    confirmPdfExport,
    confirmEpubBetaExport,
    epubExportRequest,
    exportEpubBeta,
    exportHtml,
    exportPdf,
    pdfExportRequest,
    saveActiveTab: saveActiveTabUnsafe,
    saveActiveTabAs: saveActiveTabAsUnsafe,
    saveTabById: saveTabByIdUnsafe,
  } = useDocumentIoController({
    activeContents,
    activeTab,
    activeTabId,
    autoBackupEnabled: editorSettings.autoBackupEnabled,
    refreshWorkspaceTree,
    rememberRecentFile,
    setActiveTabId,
    setGlobalError,
    setStatus,
    setTabs,
    tabs,
    tabsRef,
    workspaceRootPath,
  });
  const saveActiveTab = useCallback(async () => {
    if (activeTab && isAppleAssistTabLocked(activeTab.id, activeTab.path)) {
      setStatus(appleAssistLockMessage);
      return;
    }
    await saveActiveTabUnsafe();
  }, [
    activeTab,
    appleAssistLockMessage,
    isAppleAssistTabLocked,
    saveActiveTabUnsafe,
    setStatus,
  ]);
  const saveActiveTabAs = useCallback(async () => {
    if (activeTab && isAppleAssistTabLocked(activeTab.id, activeTab.path)) {
      setStatus(appleAssistLockMessage);
      return;
    }
    await saveActiveTabAsUnsafe();
  }, [
    activeTab,
    appleAssistLockMessage,
    isAppleAssistTabLocked,
    saveActiveTabAsUnsafe,
    setStatus,
  ]);
  const saveTabById = useCallback(
    async (tabId: string): Promise<boolean> => {
      const targetTab = tabs.find((tab) => tab.id === tabId) ?? null;
      if (
        targetTab &&
        isAppleAssistTabLocked(targetTab.id, targetTab.path)
      ) {
        setStatus(appleAssistLockMessage);
        return false;
      }
      return saveTabByIdUnsafe(tabId);
    },
    [
      appleAssistLockMessage,
      isAppleAssistTabLocked,
      saveTabByIdUnsafe,
      setStatus,
      tabs,
    ],
  );
  const epubExportSettingsOpen = epubExportRequest !== null;
  const pdfExportSettingsOpen = pdfExportRequest !== null;
  const modalOpenWithBlockingDialogs =
    modalOpen ||
    pendingTrashOpen ||
    pendingAssistDiscardOpen ||
    epubExportSettingsOpen ||
    pdfExportSettingsOpen;

  // L Mode (えるモード) toggle. Wraps a simple
  // setEditorSettings flip so the command palette and the
  // Cmd+Shift+L shortcut can share one code path.
  const toggleLMode = useCallback(() => {
    setEditorSettings((current) => ({
      ...current,
      lModeEnabled: !current.lModeEnabled,
    }));
  }, [setEditorSettings]);

  const exitLMode = useCallback(() => {
    setEditorSettings((current) => ({
      ...current,
      lModeEnabled: false,
    }));
  }, [setEditorSettings]);

  // Escape hatch surfaced in the L Mode action rail. This
  // returns a local diff snapshot so L Mode can show a small
  // review window without opening the normal edit surface's
  // right pane.
  const reviewChangesFromLMode = useCallback(async () => {
    if (!activeTab) {
      return null;
    }
    return prepareReviewTabAgainstDisk(activeTab);
  }, [activeTab, prepareReviewTabAgainstDisk]);
  const exitLModeToWorkspace = useCallback(() => {
    exitLMode();
  }, [exitLMode]);

  // When L Mode turns on, force the side pane closed. The CSS hides
  // the toggles in L Mode so the user cannot re-open them from chrome
  // alone; this effect keeps the state consistent so the next time the
  // user toggles L Mode off, the workspace is in a clean state.
  useEffect(() => {
    if (!editorSettings.lModeEnabled) {
      return;
    }
    setSidePaneOpen(false);
    // Compare selection is invisible in L Mode (the workspace
    // tree and the compare panel are both hidden), but the
    // source/target anchors persist in state. If we leave them
    // set, the user re-entering normal mode finds the slots
    // pre-filled with files they no longer remember choosing.
    // Clear both slots on entry so the user starts fresh.
    if (compareAnchor !== null) {
      clearCompareSource();
    }
    if (compareTarget !== null) {
      clearCompareTarget();
    }
  }, [
    clearCompareSource,
    clearCompareTarget,
    compareAnchor,
    compareTarget,
    editorSettings.lModeEnabled,
    setSidePaneOpen,
  ]);

  // section: document safety actions
  const {
    checkTabForExternalChange,
    clearSaveError,
    closeTabNow,
    discardDraft,
    discardAllAndCloseWindow,
    keepEditingAfterConflict,
    reopenTabFromDisk,
    requestCloseTab,
    restoreDraft,
    saveAllAndCloseWindow,
    saveAndClosePendingTab,
  } = useDocumentSafetyActions({
    activeTabId,
    appExitInProgressRef,
    allowWindowCloseRef,
    dirtyTabs,
    discardingWindowCloseRef,
    focusEditorSoon,
    onBeforeWindowClose: onBeforeWindowCloseWithAssistShutdown,
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
  });

  const dismissActiveError = useCallback(() => {
    if (activeTabId !== null) {
      setTabs((currentTabs) =>
        currentTabs.map((tab) =>
          tab.id === activeTabId &&
          tab.error &&
          tab.saveStatus !== "conflict" &&
          tab.saveStatus !== "error"
            ? { ...tab, error: null }
            : tab,
        ),
      );
    }
    setGlobalError(null);
    setStatus("Error dismissed");
  }, [activeTabId, setGlobalError, setStatus, setTabs]);

  // section: agent workbench (preference + session + terminal actions)
  const {
    handlePresetPrompt,
    handleSendSelectionToAgent,
    refreshAgentSessionState,
    requestAgentLaunchGateCheck,
    requestAgentSessionStop,
    resizeAgentTerminal,
    restartAppForAgentMode,
    sendAgentTerminalData,
    sendWorkspacePathToAgent,
    updateAgentWorkbenchConsent,
    updateAgentWorkbenchPreference,
    updateAgentWorkbenchProvider,
    updateAssistSurfacePreference,
  } = useAgentWorkbenchController({
    activeAgentSession,
    agentSession,
    agentTerminalSize,
    assistSurfaceActive,
    agentWorkbenchActive,
    agentWorkbenchConsent,
    agentWorkbenchProvider,
    applyAgentOutput,
    closeWorkspaceContextMenu,
    editorPaneRef,
    menuLanguage,
    setAgentLaunchGate,
    setAgentSession,
    setAgentStopPending,
    setAgentTerminalSize,
    setAgentWorkbenchConsent,
    setAgentWorkbenchPreference,
    setAgentWorkbenchProvider,
    setAssistSurfacePreference,
    setAppRestartPending,
    setGlobalError,
    setStatus,
    workspaceRootPath,
  });

  // section: editor commands
  const {
    applyActiveMarkdownFormat,
    convertActiveEncoding,
    convertActiveLineEnding,
    handleEditorChange: handleEditorChangeUnsafe,
    insertMarkdownAtCursor,
    insertTable,
    jumpToHeading,
    slashCommands,
  } = useEditorCommands({
    activeDraft,
    activeTab,
    activeTabId,
    agentWorkbenchActive,
    editorPaneRef,
    handleSendSelectionToAgent,
    menuLanguage,
    requestReviewDraftAgainstDisk,
    requestReviewTabAgainstDisk,
    setStatus,
    setTabs,
  });
  const handleEditorChange = useCallback(
    (nextValue: string) => {
      if (activeTab && isAppleAssistTabLocked(activeTab.id, activeTab.path)) {
        setStatus(appleAssistLockMessage);
        return;
      }
      handleEditorChangeUnsafe(nextValue);
    },
    [
      activeTab,
      appleAssistLockMessage,
      handleEditorChangeUnsafe,
      isAppleAssistTabLocked,
      setStatus,
    ],
  );

  // section: command palette + global search
  const appleLocalAssistActive =
    appleLocalAssistAllowed && assistSurfaceActive === "apple-local";
  const { availability: appleAssistAvailability } = useAppleAssistAvailability(
    appleLocalAssistActive && preferencesDialogMode === "agent",
  );

  const {
    closeCommandPalette,
    closeGlobalSearch,
    commandPaletteActiveIndex,
    commandPaletteQuery,
    commandPaletteVisible,
    filteredCommands,
    globalSearchActiveIndex,
    globalSearchError,
    globalSearchQuery,
    globalSearchRows,
    globalSearchSummary,
    globalSearching,
    globalSearchVisible,
    openCommandPalette,
    openGlobalSearch,
    runCommand,
    runGlobalSearchMatch,
    setCommandPaletteActiveIndex,
    setCommandPaletteQuery,
    setGlobalSearchActiveIndex,
    setGlobalSearchQuery,
  } = useCommandPaletteController({
    actions: {
      applyActiveMarkdownFormat,
      createNewFile,
      exportEpubBeta,
      exportHtml,
      exportPdf,
      focusAdjacentTab,
      handleSendSelectionToAgent,
      insertTable,
      openAgentWindow: (theme) => {
        void openAgentWindow(theme);
      },
      openAppleAssistWindow: (theme) => {
        if (!appleLocalAssistActive) {
          return;
        }
        void openAppleAssistWindow(theme);
      },
      openFile,
      openWorkspace,
      openWorkspaceFile,
      requestCloseTab,
      requestRestoreFromBackup,
      requestReviewTabAgainstDisk,
      requestWindowClose,
      saveActiveTab,
      saveActiveTabAs,
      setEditorSettings,
      setFindVisible,
      setPreferencesDialogMode,
      setPreviewVisible,
      toggleDiffPane,
      toggleLMode,
      toggleOutlinePane,
      toggleQuickOpen,
    },
    activeTab,
    activeTabId,
    appleLocalAssistAllowed,
    assistSurfaceActive,
    editorPaneRef,
    lModeCopy,
    setStatus,
    slashCommands,
    themePreference,
    workspaceRootPath,
  });

  // v1.3 Hazakura Local Assist discard handling is defined here,
  // ahead of the `useAppShellSideEffectsController` call below, so
  // the `keyboardFocus` object can reference `cancelDiscardAppleAssistEdit`
  // for the Escape route without a use-before-declaration error.
  //
  // When the user hand-edits the buffer after an assist apply
  // (current contents differ from the transaction's
  // `afterBuffer`), a blind revert to `beforeBuffer` would
  // destroy those edits. In that case we open a confirmation
  // dialog instead of reverting immediately; only a confirmed
  // discard reverts all the way back to `beforeBuffer`.
  const confirmDiscardAppleAssistEdit = useCallback(
    (sessionId: string, beforeBuffer: string) => {
      setTabs((currentTabs) =>
        currentTabs.map((tab) =>
          tab.sessionId === sessionId
            ? {
                ...tab,
                contents: beforeBuffer,
                saveStatus: "idle",
                error: null,
              }
            : tab,
        ),
      );
      const targetTab = tabs.find((tab) => tab.sessionId === sessionId);
      if (targetTab) {
        setActiveTabId(targetTab.id);
      }
      aiEditTransactionStore.clear(sessionId);
      setStatus("Hazakura Local Assist edit discarded");
    },
    [setActiveTabId, setStatus, setTabs, tabs],
  );

  const discardAppleAssistEdit = useCallback(
    (sessionId: string, beforeBuffer: string, afterBuffer: string) => {
      const targetTab = tabs.find((tab) => tab.sessionId === sessionId);
      if (!targetTab) {
        setStatus("Hazakura Local Assist discard failed");
        return;
      }
      // No hand-edits since the assist was applied: safe to revert now.
      if (targetTab.contents === afterBuffer) {
        confirmDiscardAppleAssistEdit(sessionId, beforeBuffer);
        return;
      }
      // The buffer changed after the apply. Confirm before discarding so
      // the user does not silently lose hand-edits along with the assist.
      setPendingAssistDiscard({ sessionId, beforeBuffer });
    },
    [confirmDiscardAppleAssistEdit, setStatus, tabs],
  );

  const cancelDiscardAppleAssistEdit = useCallback(() => {
    setPendingAssistDiscard(null);
  }, []);

  const confirmPendingAssistDiscard = useCallback(() => {
    if (!pendingAssistDiscard) return;
    confirmDiscardAppleAssistEdit(
      pendingAssistDiscard.sessionId,
      pendingAssistDiscard.beforeBuffer,
    );
    setPendingAssistDiscard(null);
  }, [confirmDiscardAppleAssistEdit, pendingAssistDiscard]);

  // section: app side effects (menu integration + runtime effects)
  useAppShellSideEffectsController({
    actions: {
      createNewFile,
      exportEpubBeta,
      exportHtml,
      exportPdf,
      openAgentWindow: () => {
        void openAgentWindow(themePreference);
      },
      openAppleAssistWindow: () => {
        if (!appleLocalAssistActive) {
          return;
        }
        void openAppleAssistWindow(themePreference);
      },
      openFile,
      openWorkspace,
      openWorkspacePath,
      requestAppQuit,
      requestWindowClose,
      saveActiveTab,
      saveActiveTabAs,
    },
    listener: {
      onOpenRecentFile: openFilePath,
      recentFilesRef,
      recentFoldersRef,
      setEditorSettings,
      setPreferencesDialogMode,
      setPreviewVisible,
      setThemePreference,
    },
    activity: {
      onResumeAgentUiRefresh: resumeAgentUiRefresh,
      onSuspendAgentUiRefresh: suspendAgentUiRefresh,
      onToggleQuickOpen: toggleQuickOpen,
    },
    agentSessionSync: {
      activeAgentSession,
      agentSession,
      agentUiSuspendedRef,
      agentWorkbenchAvailable,
      onRefreshAgentSessionState: refreshAgentSessionState,
      onResetAgentOutput: resetAgentOutput,
      setAgentLaunchGate,
      setAgentSession,
      workspaceRootPath,
    },
    appShellSync: {
      activeDirty,
      activeTab,
      agentWorkbenchActive,
      agentWorkbenchConsent,
      assistSurfaceActive,
      discardingWindowCloseRef,
      editorSettings,
      menuLanguage,
      onStatus: setStatus,
      pendingDrafts,
      previewVisible,
      recentFiles,
      recentFolders,
      restoreComplete,
      selectedImage,
      tabs,
      themePreference,
      workspaceRootPath,
    },
    workspaceRuntime: {
      activeTabPath,
      closeWorkspaceContextMenu,
      insertMarkdownAtCursor,
      openExternalFilePaths,
      restoreComplete,
      setActiveTabId,
      setGlobalError,
      setPendingDrafts,
      setRestoreComplete,
      setStatus,
      setTabs,
      setWorkspaceRootPath,
      setWorkspaceTree,
      workspaceContextMenuOpen: workspaceContextMenu !== null,
      workspaceRootPath,
    },
    keyboardFocus: {
      activeAgentSession,
      activeTabId,
      agentUiSuspendedRef,
      allowWindowCloseRef,
      appCloseCancelButtonRef,
      appCloseDialogRef,
      assistDiscardDialogRef,
      closeTabCancelButtonRef,
      closeTabDialogRef,
      epubExportDialogRef,
      epubExportSettingsOpen,
      pdfExportDialogRef,
      pdfExportSettingsOpen,
      moveTrashCancelButtonRef,
      moveTrashDialogRef,
      assistDiscardCancelButtonRef,
      commandPaletteVisible,
      dirtyTabCount,
      editorPaneRef,
      findInputRef,
      findVisible,
      globalSearchVisible,
      modalOpen: modalOpenWithBlockingDialogs,
      onApplyMarkdownFormat: applyActiveMarkdownFormat,
      onCancelAppClose: cancelPendingAppClose,
      onCancelAssistDiscard: cancelDiscardAppleAssistEdit,
      onCancelPendingTrash: cancelPendingTrash,
      onCancelTabClose: cancelPendingTabClose,
      onCheckTabForExternalChange: checkTabForExternalChange,
      onCloseCommandPalette: closeCommandPalette,
      onCloseFindAndFocusEditor: closeFindAndFocusEditor,
      onCloseGlobalSearch: closeGlobalSearch,
      onClosePreferences: closePreferencesFromKeyboard,
      onCloseSelectedImagePreview: closeSelectedImagePreview,
      onCreateNewFile: createNewFile,
      onFocusAdjacentTab: focusAdjacentTab,
      onFocusEditorSoon: focusEditorSoon,
      onNeedsWindowCloseConfirmation: requestAppCloseConfirmation,
      stopActiveAppleAssistGeneration,
      onOpenCommandPalette: openCommandPalette,
      onOpenFile: openFile,
      onOpenGlobalSearch: openGlobalSearch,
      onOpenWorkspace: openWorkspace,
      onRequestCloseTab: requestCloseTab,
      onRequestWindowClose: requestWindowClose,
      onSaveActiveTab: saveActiveTab,
      onSaveActiveTabAs: saveActiveTabAs,
      onCancelEpubBetaExport: cancelEpubBetaExport,
      onCancelPdfExport: cancelPdfExport,
      pendingAppClose,
      pendingAssistDiscardOpen,
      pendingCloseTabOpen,
      pendingTrashOpen,
      preferencesCloseButtonRef,
      preferencesDialogRef,
      preferencesOpen,
      selectedImageOpen,
      setEditorSettings,
      setFindVisible,
      setPreferencesDialogMode,
      setPreviewVisible,
      setStatus,
    },
  });

  // v0.12+ Hazakura Local Assist Writing Companion (slice 5).
  // The escape hatch's Discard button reverts the affected
  // tab's contents to the transaction's full-buffer snapshot
  // and clears the transaction via the store. The tab
  // mutation goes through the same `setTabs` path the apply
  // handler uses so save status / error are
  // consistent regardless of which direction the buffer
  // was edited.

  return {
    activeAgentSession,
    activeConflict,
    activeContents,
    activeDirty,
    activeDocumentLineCount,
    activeDraft,
    activeError,
    activeMatchIndex,
    activeSaveError,
    ambientIntensity: editorSettings.ambientIntensity,
    activeTab,
    activeTabId,
    agentLaunchGate,
    agentOutput,
    agentSession,
    agentStopPending,
    agentWorkbenchActive,
    agentWorkbenchAvailable,
    agentWorkbenchConsent,
    agentWorkbenchCopy,
    agentWorkbenchPreference,
    agentWorkbenchProvider,
    agentWorkbenchRestartRequired,
    appleAssistAvailability,
    appleAssistGenerationLock: activeAppleAssistGenerationLock,
    appleLocalAssistAllowed,
    assistSurfaceActive,
    assistSurfacePreference,
    autoBackupRestoreCopy,
    autoBackupRestoreEntries: autoBackupRestore.backups,
    autoBackupRestoreError: autoBackupRestore.error,
    autoBackupRestoreLoading: autoBackupRestore.loading,
    appCloseCancelButtonRef,
    appCloseDialogRef,
    appRestartPending,
    cancelPendingAppClose: cancelPendingAppCloseAndExitFlag,
    cancelPendingRename,
    cancelPendingTabClose,
    clearCompareSource,
    clearCompareTarget,
    clearSaveError,
    closeCompareView,
    closeFindAndFocusEditor,
    closePreferencesFromKeyboard,
    closeQuickOpen,
    closeTabCancelButtonRef,
    closeTabContextMenu,
    closeTabDialogRef,
    closeTabNow,
    closeWorkspaceContextMenu,
    moveTrashCancelButtonRef,
    moveTrashDialogRef,
    assistDiscardCancelButtonRef,
    assistDiscardDialogRef,
    closeCommandPalette,
    commandPaletteActiveIndex,
    confirmPendingRename,
    commandPaletteQuery,
    commandPaletteVisible,
    compareAnchor,
    compareTarget,
    compareView,
    compareWorkspaceFiles,
    copyWorkspaceFullPath,
    createFile,
    createFolder,
    createNewFile,
    currentHeadingLine: currentMarkdownHeading?.line ?? null,
    detail: activeStatusDetail,
    secondaryDetail: activeStatusSecondaryDetail,
    dirtyLabel: activeDirtyLabel,
    dirtyTabCount,
    dismissActiveError,
    discardAllAndCloseWindow,
    discardDraft,
    pendingRenameWarning,
    renamingPath,
    requestRename,
    documentHeadings,
    documentKey,
    draggingTabId,
    dragOverTabId,
    editorChromeCopy,
    editorPaneRef,
    editorPreviewGridRef,
    editorPreviewGridStyle,
    editorSettings,
    editorTheme,
    epubExportCancelButtonRef,
    epubExportDialogRef,
    epubExportRequest,
    pdfExportCancelButtonRef,
    pdfExportDialogRef,
    pdfExportRequest,
    lModeCopy,
    lModeEnabled: editorSettings.lModeEnabled,
    emptyTabsLabel: safeEditorCopy.emptyTabs,
    fileOpsCopy,
    encodingAriaLabel: editorChromeCopy.encodings,
    encodingLabel: editorChromeCopy.encoding,
    findInputRef,
    findMatchCount,
    findMatches,
    findQuery,
    findVisible,
    filteredCommands,
    getCompareCaseByKey,
    goToLine,
    goToLineValue,
    globalSearchActiveIndex,
    globalSearchError: globalSearchError,
    globalSearchQuery,
    globalSearchRows,
    globalSearchSummary,
    globalSearching,
    globalSearchVisible,
    handleEditorChange,
    handleFindKeyDown,
    handleGoToLineKeyDown,
    handlePasteImage,
    handlePresetPrompt,
    handlePreviewResizeKeyDown,
    handlePreviewResizePointerDown,
    handlePreviewResizePointerMove,
    handleReplaceKeyDown,
    handleSendSelectionToAgent,
    hasWorkspaceSelection,
    invalidRegex,
    jumpToHeading,
    keepEditingAfterConflict,
    lineEndingAriaLabel: editorChromeCopy.lineEndings,
    lineEndingLabel: editorChromeCopy.lineEnding,
    loadWorkspaceDirectory,
    menuLanguage,
    onCheckAgentGate: requestAgentLaunchGateCheck,
    onDiscardAppleAssistEdit: discardAppleAssistEdit,
    onConfirmPendingAssistDiscard: confirmPendingAssistDiscard,
    onCancelPendingAssistDiscard: cancelDiscardAppleAssistEdit,
    pendingAssistDiscard,
    onOpenAgentWindow: () => {
      void openAgentWindow(themePreference);
    },
    onOpenAppleAssistWindow: () => {
      if (!appleLocalAssistAllowed) {
        return;
      }
      void toggleAppleAssistWindow(themePreference);
    },
    onCloseSelectedImagePreview: closeSelectedImagePreview,
    onCloseTab: requestCloseTab,
    onConvertEncoding: convertActiveEncoding,
    onConvertLineEnding: convertActiveLineEnding,
    onExitLModeToWorkspace: exitLModeToWorkspace,
    onFinishTabPointerDrag: finishTabPointerDrag,
    onOpenAppleAssistFromLMode: () => {
      // v0.12+ Hazakura Local Assist Writing Companion mock
      // (slice 3). The L Mode action rail's Hazakura Local Assist
      // button calls the visible companion-slot toggle used
      // by the main chrome. `exitLModeToWorkspace` is
      // intentionally NOT called: showing / hiding the Apple
      // Assist window is a side-surface action, not a
      // workspace exit.
      if (!appleLocalAssistAllowed) {
        return;
      }
      void toggleAppleAssistWindow(themePreference);
    },
    onOpenCommandPalette: openCommandPalette,
    onRunCommand: runCommand,
    onPointerEnter: suspendAgentUiRefresh,
    onResizeAgentTerminal: resizeAgentTerminal,
    onResumeAgentUiRefresh: resumeAgentUiRefresh,
    onReviewChanges: requestReviewTabAgainstDisk,
    onReviewChangesFromLMode: reviewChangesFromLMode,
    onSelectTab: selectTabFromBar,
    onSendAgentTerminalData: sendAgentTerminalData,
    onSubmitRename: renameWorkspacePath,
    onStopAgentSession: requestAgentSessionStop,
    onSuspendAgentUiRefresh: suspendAgentUiRefresh,
    onTabContextMenu: openTabContextMenu,
    onTabPointerDown: handleTabPointerDown,
    onTabPointerMove: handleTabPointerMove,
    onToggleDiff: toggleDiffPane,
    onToggleEbook: toggleEbookPane,
    onToggleLMode: toggleLMode,
    onToggleOutline: toggleOutlinePane,
    onTogglePreview: togglePreviewPane,
    onCloseGlobalSearch: closeGlobalSearch,
    onOpenGlobalSearch: openGlobalSearch,
    onRunGlobalSearchMatch: runGlobalSearchMatch,
    onSetGlobalSearchActiveIndex: setGlobalSearchActiveIndex,
    onSetGlobalSearchQuery: setGlobalSearchQuery,
    openFile,
    openFilePath,
    openPreviewMarkdownLink,
    openRootWorkspaceContextMenu,
    openTabContextMenu,
    openWorkspace,
    openWorkspaceContextMenu,
    openWorkspaceFile,
    outlineTruncated: documentOutline?.truncated ?? false,
    onCancelEpubBetaExport: cancelEpubBetaExport,
    onConfirmEpubBetaExport: confirmEpubBetaExport,
    onCancelPdfExport: cancelPdfExport,
    onConfirmPdfExport: confirmPdfExport,
    pendingAppClose,
    pendingCloseTab,
    preferencesCloseButtonRef,
    preferencesCopy,
    preferencesDialogMode,
    preferencesDialogRef,
    preferencesOpen,
    previewColumnPercent,
    previewPaneRef,
    previewVisible,
    quickOpenVisible,
    recentFiles,
    restoreComplete,
    restoreBackupDialogOpen,
    onMoveEntry: (srcPath: string, dstParentPath: string) => {
      void moveWorkspacePath(srcPath, dstParentPath);
    },
    recoveryCopy,
    reopenTabFromDisk,
    replaceAll,
    saveAffirmation,
    saveAffirmationKey,
    replaceOne,
    replaceQuery,
    renameWorkspacePath,
    pendingTrash,
    requestTrashWorkspacePath,
    setPreferencesDialogMode,
    onMoveToTrash: requestTrashWorkspacePath,
    confirmPendingTrash,
    cancelPendingTrash,
    resolvedTheme,
    restartAppForAgentMode,
    reviewDraftAgainstDisk: requestReviewDraftAgainstDisk,
    reviewTabAgainstDisk: requestReviewTabAgainstDisk,
    restoreDraft,
    revealWorkspacePath,
    runSelectedFileCompare,
    safeEditorCopy,
    saveAllAndCloseWindow,
    saveAndClosePendingTab,
    saveTabById,
    scrollHudContext,
    scrollHudLine,
    scrollHudVisible,
    searchOptions,
    selectWorkspaceCompareFile,
    selectedImage,
    sendWorkspacePathToAgent,
    setAgentWorkbenchConsent: updateAgentWorkbenchConsent,
    setAgentWorkbenchPreference: updateAgentWorkbenchPreference,
    setAgentWorkbenchProvider: updateAgentWorkbenchProvider,
    setAssistSurfacePreference: updateAssistSurfacePreference,
    onApplyBackup: applyBackupToActiveTab,
    onCloseRestoreBackupDialog: closeRestoreBackupDialog,
    onSelectAutoBackupEntry: selectAutoBackupEntry,
    setCompareSource,
    setCompareTargetFile,
    setCommandPaletteActiveIndex,
    setCommandPaletteQuery,
    setEditorSettings,
    setFindQuery,
    setGoToLineValue,
    setMenuLanguage,
    setPreviewVisible,
    setReplaceQuery,
    setSearchOptions,
    setSelectionInfo,
    setThemePreference,
    shouldSuppressTabClick,
    showNextMatch,
    showPreviousMatch,
    sidePaneCopy,
    slashCommands,
    slashMenuCopy,
    sidePaneMode,
    sidePaneVisible,
    status,
    syncEditorScroll,
    syncPreviewScroll,
    tabContextMenu,
    tabs,
    themePreference,
    workspaceContextMenu,
    workspaceRootPath,
    workspaceTree,
  };
}
