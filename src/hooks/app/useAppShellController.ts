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

import { useCallback, useEffect, useMemo } from "react";
import { openAgentWindow } from "../../lib/tauri";
import { useAgentWorkbenchController } from "../agent/useAgentWorkbenchController";
import { useCommandPaletteController } from "../commandPalette/useCommandPaletteController";
import { useCompareController } from "../diff/useCompareController";
import { useDocumentSafetyActions } from "../document/useDocumentSafetyActions";
import { useDocumentIoController } from "../document/useDocumentIoController";
import { useDocumentCoreController } from "../document/useDocumentCoreController";
import { useDocumentPreviewController } from "../document/useDocumentPreviewController";
import { useEditorSurfaceController } from "../document/useEditorSurfaceController";
import { useEditorCommands } from "../editor/useEditorCommands";
import { useEditorFindController } from "../editor/useEditorFindController";
import { useTabBarController } from "../editor/useTabBarController";
import { useReviewDeskController } from "../review/useReviewDeskController";
import { useWorkspaceFileOpening } from "../workspace/useWorkspaceFileOpening";
import { useAppShellFoundation } from "./useAppShellFoundation";
import { useAppShellRefs } from "./useAppShellRefs";
import { useWindowDialogActions } from "./useWindowDialogActions";
import { useLocalizedAppCopy } from "./useLocalizedAppCopy";
import { useAppShellSideEffectsController } from "./useAppShellSideEffectsController";
import { useAutoBackupRestore } from "../workspace/useAutoBackupRestore";

export function useAppShellController() {
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
    setReviewSurface,
    setSidePaneOpen,
    sidePaneOpen,
    reviewSurface,
  } = foundation;

  // section: review desk state
  const {
    candidateCompareCase,
    candidateCompareView,
    candidateErrorMessage,
    candidateInputText,
    clearCandidate,
    resetReviewDesk,
    reviewDeskMode,
    runCandidateCompare,
    setCandidateInputText,
  } = foundation;

  // section: review desk controller (depends on review state + chrome view state)
  const { toggleReviewDesk, closeReviewDesk } = useReviewDeskController({
    reviewSurface,
    resetReviewDesk,
    setReviewSurface,
  });

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
    setAgentWorkbenchConsent,
    setAgentWorkbenchPreference,
    setAgentWorkbenchProvider,
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
    pinRecentFile,
    recentFiles,
    recentFilesRef,
    recentFolders,
    recentFoldersRef,
    rememberRecentFile,
    rememberRecentFolder,
    setRecentFiles,
    setRecentFolders,
    unpinRecentFile,
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
    pendingCloseTabId,
    pendingDrafts,
    setStatus,
    tabs,
    workspaceRootPath,
  });

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
    modalOpen,
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
    reviewDeskCopy,
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
    activeDocumentLineCount,
    activeStatusDetail,
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
    setPendingDrafts,
    setRecentFiles,
    setStatus,
    setTabs,
    setWorkspaceRootPath,
    setWorkspaceTree,
    tabs,
    workspaceRootPath,
  });

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
    onShowDocumentSurface: () => setReviewSurface(null),
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
      requestReviewBackupAgainstBuffer,
      setGlobalError,
      setStatus,
      workspaceRootPath,
    ],
  );

  // Apply a previously-selected backup to the active tab. The
  // `compareCase` comes from the diff view's state (the
  // `backupApplyAction` payload is set when the case is built,
  // not when the apply button is clicked), so the right-pane
  // view is the source of truth for "which backup am I
  // applying". The buffer is marked dirty so the user still
  // has to save to persist; this avoids a silent disk write
  // when the user just wanted to peek at a backup.
  const applyBackupToActiveTab = useCallback(
    (backupContents: string) => {
      if (!activeTab) {
        setStatus("Backup apply failed");
        return;
      }
      setTabs((currentTabs) =>
        currentTabs.map((tab) =>
          tab.id === activeTab.id
            ? {
                ...tab,
                contents: backupContents,
                saveStatus: "idle",
                error: null,
              }
            : tab,
        ),
      );
      closeCompareView();
      setStatus("Backup applied — save to keep changes");
    },
    [activeTab, closeCompareView, setStatus, setTabs],
  );

  // section: document IO controller
  const {
    exportHtml,
    exportPdf,
    saveActiveTab,
    saveActiveTabAs,
    saveTabById,
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
    workspaceRootPath,
  });

  // section: pinned file toggle
  //
  // The start panel surfaces pinned files above recents. The
  // toggle flips the pin state in place — a quick affordance
  // for the daily-driver case where the same note is opened
  // every session. The toggle callback is a no-op if the file
  // is already in the requested state, so re-clicking the pin
  // star on a pinned file un-pins it.
  const pinnedFiles = useMemo(
    () => recentFiles.filter((entry) => entry.pinnedAt !== null),
    [recentFiles],
  );

  const handleTogglePinRecentFile = useCallback(
    (path: string) => {
      const entry = recentFiles.find((candidate) => candidate.path === path);
      if (!entry) {
        return;
      }
      if (entry.pinnedAt === null) {
        pinRecentFile(path);
      } else {
        unpinRecentFile(path);
      }
    },
    [pinRecentFile, recentFiles, unpinRecentFile],
  );

  // L Mode (えるモード) toggle. Wraps a simple
  // setEditorSettings flip so the command palette and the
  // Cmd+Shift+L shortcut can share one code path.
  const toggleLMode = useCallback(() => {
    setEditorSettings((current) => ({
      ...current,
      lModeEnabled: !current.lModeEnabled,
    }));
  }, [setEditorSettings]);

  // Escape hatches surfaced inside the L Mode status bar pill.
  // The pill is the only chrome the user sees in L Mode, so
  // any "I want to leave L Mode and do X" affordance has to
  // live there. Both handlers exit L Mode first (the diff
  // pane and the workspace tree are hidden in L Mode, so the
  // user has no other way to reach them); the review-changes
  // one then opens the diff against disk. The workspace one
  // is just an exit — the file tree / side pane are revealed
  // by the same toggle, and the user can pick up from there.
  const reviewChangesFromLMode = useCallback(() => {
    toggleLMode();
    if (activeTab) {
      requestReviewTabAgainstDisk(activeTab);
    }
  }, [activeTab, requestReviewTabAgainstDisk, toggleLMode]);
  const exitLModeToWorkspace = useCallback(() => {
    toggleLMode();
  }, [toggleLMode]);

  // When L Mode turns on, force the side pane and the Review
  // Desk closed. The CSS hides the toggles in L Mode so the user
  // cannot re-open them from chrome alone; this effect keeps the
  // state consistent so the next time the user toggles L Mode off,
  // the workspace is in a clean (collapsed) state.
  useEffect(() => {
    if (!editorSettings.lModeEnabled) {
      return;
    }
    setSidePaneOpen(false);
    if (reviewSurface !== null) {
      closeReviewDesk();
    }
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
    closeReviewDesk,
    compareAnchor,
    compareTarget,
    editorSettings.lModeEnabled,
    reviewSurface,
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
    allowWindowCloseRef,
    dirtyTabs,
    discardingWindowCloseRef,
    focusEditorSoon,
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
  } = useAgentWorkbenchController({
    activeAgentSession,
    agentSession,
    agentTerminalSize,
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
    handleEditorChange,
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
    openReviewDesk: toggleReviewDesk,
    requestReviewDraftAgainstDisk,
    requestReviewTabAgainstDisk,
    setStatus,
    setTabs,
  });

  // section: command palette + global search
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
    setCommandPaletteActiveIndex,
    setCommandPaletteQuery,
    setGlobalSearchActiveIndex,
    setGlobalSearchQuery,
  } = useCommandPaletteController({
    actions: {
      applyActiveMarkdownFormat,
      createNewFile,
      exportHtml,
      exportPdf,
      focusAdjacentTab,
      handleSendSelectionToAgent,
      insertTable,
      openAgentWindow: (theme) => {
        void openAgentWindow(theme);
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
      toggleReviewDesk,
    },
    activeTab,
    activeTabId,
    editorPaneRef,
    lModeCopy,
    setStatus,
    themePreference,
    workspaceRootPath,
  });

  // section: app side effects (menu integration + runtime effects)
  useAppShellSideEffectsController({
    actions: {
      createNewFile,
      exportHtml,
      exportPdf,
      openAgentWindow: () => {
        void openAgentWindow(themePreference);
      },
      openFile,
      openWorkspace,
      openWorkspacePath,
      requestWindowClose,
      saveActiveTab,
      saveActiveTabAs,
      toggleReviewDesk,
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
      discardingWindowCloseRef,
      editorSettings,
      menuLanguage,
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
      closeTabCancelButtonRef,
      closeTabDialogRef,
      commandPaletteVisible,
      dirtyTabCount,
      editorPaneRef,
      findInputRef,
      findVisible,
      globalSearchVisible,
      modalOpen,
      onApplyMarkdownFormat: applyActiveMarkdownFormat,
      onCancelAppClose: cancelPendingAppClose,
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
      onOpenCommandPalette: openCommandPalette,
      onOpenFile: openFile,
      onOpenGlobalSearch: openGlobalSearch,
      onOpenWorkspace: openWorkspace,
      onRequestCloseTab: requestCloseTab,
      onRequestWindowClose: requestWindowClose,
      onSaveActiveTab: saveActiveTab,
      onSaveActiveTabAs: saveActiveTabAs,
      onToggleReviewDesk: toggleReviewDesk,
      pendingAppClose,
      pendingCloseTabOpen,
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

  // section: manual candidate apply helper
  const applyManualCandidateToActiveTab = useCallback(
    (
      candidateText: string,
      documentTabId: string,
      documentContents: string,
    ) => {
      if (
        !activeTab ||
        activeTab.id !== documentTabId ||
        activeTab.contents !== documentContents
      ) {
        setStatus("Manual candidate apply failed");
        return;
      }

      setTabs((currentTabs) =>
        currentTabs.map((tab) =>
          tab.id === activeTab.id
            ? {
                ...tab,
                contents: candidateText,
                saveStatus: "idle",
                error: null,
              }
            : tab,
        ),
      );
      clearCandidate();
      setStatus("Manual candidate applied");
    },
    [activeTab, clearCandidate, setStatus, setTabs],
  );

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
    autoBackupRestoreCopy,
    autoBackupRestoreEntries: autoBackupRestore.backups,
    autoBackupRestoreError: autoBackupRestore.error,
    autoBackupRestoreLoading: autoBackupRestore.loading,
    candidateCompareCase,
    candidateCompareView,
    candidateErrorMessage,
    candidateInputText,
    clearCandidate,
    appCloseCancelButtonRef,
    appCloseDialogRef,
    appRestartPending,
    cancelPendingAppClose,
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
    dirtyTabCount,
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
    onApplyManualCandidate: applyManualCandidateToActiveTab,
    onCheckAgentGate: requestAgentLaunchGateCheck,
    onOpenAgentWindow: () => {
      void openAgentWindow(themePreference);
    },
    onCloseReviewDesk: closeReviewDesk,
    onCloseTab: requestCloseTab,
    onConvertEncoding: convertActiveEncoding,
    onConvertLineEnding: convertActiveLineEnding,
    onExitLModeToWorkspace: exitLModeToWorkspace,
    onFinishTabPointerDrag: finishTabPointerDrag,
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
    onToggleLMode: toggleLMode,
    onToggleOutline: toggleOutlinePane,
    onTogglePreview: togglePreviewPane,
    onCloseGlobalSearch: closeGlobalSearch,
    onOpenGlobalSearch: openGlobalSearch,
    onRunGlobalSearchMatch: openGlobalSearch,
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
    pinnedFiles,
    onTogglePinRecentFile: handleTogglePinRecentFile,
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
    onMoveToTrash: requestTrashWorkspacePath,
    confirmPendingTrash,
    cancelPendingTrash,
    resolvedTheme,
    restartAppForAgentMode,
    reviewDeskCopy,
    reviewDeskMode,
    reviewDraftAgainstDisk: requestReviewDraftAgainstDisk,
    reviewSurface,
    reviewTabAgainstDisk: requestReviewTabAgainstDisk,
    restoreDraft,
    revealWorkspacePath,
    runCandidateCompare,
    runSelectedFileCompare,
    safeEditorCopy,
    setCandidateInputText,
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
