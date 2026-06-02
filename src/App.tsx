// xterm imports moved to AgentTerminalView component
import { useCallback } from "react";
import { openAgentWindow } from "./tauri";
import { useAppPreferences } from "./hooks/app/useAppPreferences";
import { useAgentWorkbenchPreferences } from "./hooks/agent/useAgentWorkbenchPreferences";
import { useRecentEntries } from "./hooks/workspace/useRecentEntries";
import { useAppMenuIntegration } from "./hooks/app/useAppMenuIntegration";
import { useWindowDialogActions } from "./hooks/app/useWindowDialogActions";
import { usePastedImageAction } from "./hooks/document/usePastedImageAction";
import { useAgentWorkbenchPreferenceActions } from "./hooks/agent/useAgentWorkbenchPreferenceActions";
import { useAgentTerminalActions } from "./hooks/agent/useAgentTerminalActions";
import { useAgentWorkbenchSessionActions } from "./hooks/agent/useAgentWorkbenchSessionActions";
import { useDocumentSafetyActions } from "./hooks/document/useDocumentSafetyActions";
import { useEditorTabState } from "./hooks/editor/useEditorTabState";
import { useSidePaneController } from "./hooks/editor/useSidePaneController";
import { useAppRuntimeEffects } from "./hooks/app/useAppRuntimeEffects";
import { useMainAgentPaneFocus } from "./hooks/app/useMainAgentPaneFocus";
import { useAgentOutputBuffer } from "./hooks/agent/useAgentOutputBuffer";
import { useAgentUiRefreshGate } from "./hooks/agent/useAgentUiRefreshGate";
import { useWorkspaceFileOpening } from "./hooks/workspace/useWorkspaceFileOpening";
import { useCompareController } from "./hooks/diff/useCompareController";
import { useDocumentIoController } from "./hooks/document/useDocumentIoController";
import { useGoToLine } from "./hooks/editor/useGoToLine";
import { useImagePreview } from "./hooks/editor/useImagePreview";
import { useWorkspaceContextMenu } from "./hooks/workspace/useWorkspaceContextMenu";
import { useQuickOpenState } from "./hooks/workspace/useQuickOpenState";
import { useEditorCommands } from "./hooks/editor/useEditorCommands";
import { useSaveAffirmation } from "./hooks/document/useSaveAffirmation";
import { useTabBarController } from "./hooks/editor/useTabBarController";
import { useLocalizedAppCopy } from "./hooks/app/useLocalizedAppCopy";
import { useAppDialogRefs } from "./hooks/app/useAppDialogRefs";
import { useFindReplaceController } from "./hooks/find/useFindReplaceController";
import { useAppEditorRefs } from "./hooks/app/useAppEditorRefs";
import { useCompareState } from "./hooks/diff/useCompareState";
import { useWorkspaceShellState } from "./hooks/workspace/useWorkspaceShellState";
import { useEditorSelectionState } from "./hooks/editor/useEditorSelectionState";
import { useAppDialogState } from "./hooks/app/useAppDialogState";
import { useAppViewState } from "./hooks/app/useAppViewState";
import { useReviewDeskState } from "./hooks/review/useReviewDeskState";
import { useReviewDeskController } from "./hooks/review/useReviewDeskController";
import { useDraftRecoveryState } from "./hooks/document/useDraftRecoveryState";
import { useAppFeedbackState } from "./hooks/app/useAppFeedbackState";
import { useEditorTabsState } from "./hooks/editor/useEditorTabsState";
import { useAgentWorkbenchRuntimeState } from "./hooks/agent/useAgentWorkbenchRuntimeState";
import { useActiveDocumentIdentity } from "./hooks/document/useActiveDocumentIdentity";
import { useActiveDocumentSurface } from "./hooks/document/useActiveDocumentSurface";
import { AppShell, type AppShellProps } from "./components/AppShell";

export default function App() {
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
  } = useAgentWorkbenchRuntimeState();
  const {
    pendingAppClose,
    pendingCloseTabId,
    preferencesDialogMode,
    setPendingAppClose,
    setPendingCloseTabId,
    setPreferencesDialogMode,
  } = useAppDialogState();
  const {
    rightPaneMode,
    setRightPaneMode,
    setReviewSurface,
    setSidePaneOpen,
    sidePaneOpen,
    reviewSurface,
  } = useAppViewState();
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
  } = useReviewDeskState();
  const { toggleReviewDesk, closeReviewDesk } = useReviewDeskController({
    reviewSurface,
    resetReviewDesk,
    setReviewSurface,
  });
  const { pendingDrafts, setPendingDrafts } = useDraftRecoveryState();
  const { globalError, setGlobalError, setStatus, status } =
    useAppFeedbackState();
  const { affirmation: saveAffirmation, lastAffirmedAt: saveAffirmationKey } =
    useSaveAffirmation(status);
  const { activeTabId, setActiveTabId, setTabs, tabs } = useEditorTabsState();
  const { selectionInfo, setSelectionInfo } = useEditorSelectionState();
  const {
    compareAnchor,
    compareTarget,
    compareView,
    getCompareCaseByKey,
    setCompareAnchor,
    setCompareCaseEntry,
    setCompareTarget,
    setCompareView,
  } = useCompareState();
  const {
    restoreComplete,
    setRestoreComplete,
    setWorkspaceRootPath,
    setWorkspaceTree,
    workspaceRootPath,
    workspaceTree,
  } = useWorkspaceShellState();
  const {
    agentWorkbenchActive,
    agentWorkbenchConsent,
    agentWorkbenchPreference,
    agentWorkbenchProvider,
    setAgentWorkbenchConsent,
    setAgentWorkbenchPreference,
    setAgentWorkbenchProvider,
  } = useAgentWorkbenchPreferences();
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
  } = useAppPreferences();
  const {
    editorPaneRef,
    findInputRef,
    previewPaneRef,
    tabsRef,
  } = useAppEditorRefs(tabs);
  const {
    recentFiles,
    recentFilesRef,
    recentFolders,
    recentFoldersRef,
    rememberRecentFile,
    rememberRecentFolder,
  } = useRecentEntries();
  const {
    agentUiSuspendedRef,
    resumeAgentUiRefresh,
    suspendAgentUiRefresh,
  } = useAgentUiRefreshGate();

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
    pendingCloseTab,
  } = useEditorTabState({
    activeTabId,
    globalError,
    pendingCloseTabId,
    pendingDrafts,
    tabs,
  });
  const {
    clearImagePreview,
    closeSelectedImagePreview,
    imageReturnTabId,
    openImagePreview,
    selectedImage,
  } = useImagePreview({
    activeTabId,
    onError: setGlobalError,
    onStatus: setStatus,
    setActiveTabId,
    setCompareView,
    tabs,
    workspaceRootPath,
  });
  const {
    activeTabPath,
    documentKey,
    hasActiveDocument,
    selectedImageOpen,
  } =
    useActiveDocumentIdentity({
      activeTab,
      selectedImage,
    });
  const {
    closeWorkspaceContextMenu,
    openWorkspaceContextMenu,
    workspaceContextMenu,
  } = useWorkspaceContextMenu();
  const {
    closeQuickOpen,
    quickOpenVisible,
    toggleQuickOpen,
  } = useQuickOpenState();
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
  const {
    agentWorkbenchCopy,
    agentWorkbenchModeBadge,
    agentWorkbenchRestartRequired,
    editorChromeCopy,
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
  const {
    agentPaneVisible,
    agentWorkbenchAvailable,
    editorPreviewGridRef,
    editorPreviewGridStyle,
    handlePreviewResizeKeyDown,
    handlePreviewResizePointerDown,
    handlePreviewResizePointerMove,
    hasWorkspaceSelection,
    previewColumnPercent,
    sidePaneMode,
    sidePaneVisible,
    toggleAgentPane,
    toggleDiffPane,
    toggleOutlinePane,
    togglePreviewPane,
  } = useSidePaneController({
    activeTab,
    agentWorkbenchActive,
    agentWorkbenchConsent,
    compareView,
    previewVisible,
    rightPaneMode,
    selectedImage,
    setPreviewVisible,
    setRightPaneMode,
    setSidePaneOpen,
    sidePaneOpen,
  });
  const {
    activeDocumentLineCount,
    activeStatusDetail,
    currentMarkdownHeading,
    documentHeadings,
    documentOutline,
    scrollHudContext,
    scrollHudLine,
    scrollHudVisible,
    syncEditorScroll,
    syncPreviewScroll,
  } = useActiveDocumentSurface({
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
    selectedImage,
    selectionInfo,
    sidePaneMode,
  });
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
  } = useFindReplaceController({
    documentKey,
    editorPaneRef,
    setStatus,
    source: activeContents,
  });
  const {
    goToLine,
    goToLineValue,
    handleGoToLineKeyDown,
    setGoToLineValue,
  } = useGoToLine({
    editorPaneRef,
    onStatus: setStatus,
  });
  const { agentOutput, applyAgentOutput, resetAgentOutput } =
    useAgentOutputBuffer();
  const {
    createNewFile,
    loadWorkspaceDirectory,
    openExternalFilePaths,
    openFile,
    openFilePath,
    openWorkspace,
    openWorkspacePath,
    openPreviewMarkdownLink,
    openWorkspaceFile,
    refreshWorkspaceTree,
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
    setStatus,
    setTabs,
    setWorkspaceRootPath,
    setWorkspaceTree,
    tabs,
    workspaceRootPath,
  });
  const {
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
  } = useAppDialogRefs({
    pendingAppClose,
    pendingCloseTab,
    preferencesDialogMode,
  });
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

  const {
    clearCompareSource,
    clearCompareTarget,
    closeCompareView,
    compareWorkspaceFiles,
    copyWorkspaceFullPath,
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

  useAppMenuIntegration({
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
  });

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

  const {
    restartAppForAgentMode,
    updateAgentWorkbenchConsent,
    updateAgentWorkbenchPreference,
    updateAgentWorkbenchProvider,
  } = useAgentWorkbenchPreferenceActions({
    activeAgentSession,
    agentWorkbenchActive,
    menuLanguage,
    setAgentLaunchGate,
    setAgentWorkbenchConsent,
    setAgentWorkbenchPreference,
    setAgentWorkbenchProvider,
    setAppRestartPending,
    setGlobalError,
    setStatus,
  });

  const {
    refreshAgentSessionState,
    requestAgentLaunchGateCheck,
    requestAgentSessionStop,
    sendWorkspacePathToAgent,
  } = useAgentWorkbenchSessionActions({
    agentSession,
    agentTerminalSize,
    agentWorkbenchActive,
    agentWorkbenchConsent,
    agentWorkbenchProvider,
    applyAgentOutput,
    closeWorkspaceContextMenu,
    menuLanguage,
    setAgentLaunchGate,
    setAgentSession,
    setAgentStopPending,
    setGlobalError,
    setStatus,
    workspaceRootPath,
  });

  const {
    handlePresetPrompt,
    handleSendSelectionToAgent,
    resizeAgentTerminal,
    sendAgentTerminalData,
  } = useAgentTerminalActions({
    agentSession,
    editorPaneRef,
    onRefreshAgentSessionState: refreshAgentSessionState,
    setAgentLaunchGate,
    setAgentSession,
    setAgentTerminalSize,
    setStatus,
  });

  const { handlePasteImage } = usePastedImageAction({
    activeTabPath,
    setStatus,
    workspaceRootPath,
  });

  const {
    applyActiveMarkdownFormat,
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

  useAppRuntimeEffects({
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
      rightPaneMode,
      setAgentLaunchGate,
      setAgentSession,
      setRightPaneMode,
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
      dirtyTabCount,
      editorPaneRef,
      findInputRef,
      findVisible,
      modalOpen,
      onApplyMarkdownFormat: applyActiveMarkdownFormat,
      onCancelAppClose: cancelPendingAppClose,
      onCancelTabClose: cancelPendingTabClose,
      onCheckTabForExternalChange: checkTabForExternalChange,
      onCloseFindAndFocusEditor: closeFindAndFocusEditor,
      onClosePreferences: closePreferencesFromKeyboard,
      onCloseSelectedImagePreview: closeSelectedImagePreview,
      onCreateNewFile: createNewFile,
      onFocusAdjacentTab: focusAdjacentTab,
      onFocusEditorSoon: focusEditorSoon,
      onNeedsWindowCloseConfirmation: requestAppCloseConfirmation,
      onOpenFile: openFile,
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

  // Reverse link from the detached Agent window: when the user clicks
  // "Show in main pane" in the detached window's footer, the Rust
  // command emits OPEN_MAIN_AGENT_PANE_EVENT to the main window. We
  // flip the right pane to Agent mode (and open the side pane if it
  // was closed) by reusing the right-pane toggle. The right pane
  // remains a valid fallback surface — this is just a navigation
  // affordance, not a policy change. See
  // docs/assist-surface-strategy.md and the open_main_agent_pane
  // command in src-tauri/src/lib.rs (main|agent gate).
  useMainAgentPaneFocus({ onOpen: toggleAgentPane });

  const shellProps: AppShellProps = {
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
    agentAvailable: agentWorkbenchAvailable,
    agentLaunchGate,
    agentOutput,
    agentSession,
    agentStopPending,
    agentWorkbenchActive,
    agentWorkbenchConsent,
    agentWorkbenchCopy,
    agentWorkbenchPreference,
    agentWorkbenchProvider,
    agentWorkbenchRestartRequired,
    candidateCompareCase,
    candidateCompareView,
    candidateErrorMessage,
    candidateInputText,
    clearCandidate,
    agentModeBadge: agentWorkbenchModeBadge,
    agentModeBadgePending: agentWorkbenchRestartRequired,
    agentModeBadgeTitle: agentWorkbenchCopy.modeBadgeTitle,
    appCloseCancelButtonRef,
    appCloseDialogRef,
    appRestartPending,
    cancelPendingAppClose,
    cancelPendingTabClose,
    clearCompareSource,
    clearCompareTarget,
    clearSaveError,
    closeCompareView,
    closeFindAndFocusEditor,
    closePreferencesFromKeyboard,
    closeQuickOpen,
    closeTabCancelButtonRef,
    closeTabDialogRef,
    closeTabNow,
    closeWorkspaceContextMenu,
    compareAnchor,
    compareTarget,
    compareView,
    compareWorkspaceFiles,
    copyWorkspaceFullPath,
    createNewFile,
    currentHeadingLine: currentMarkdownHeading?.line ?? null,
    detail: activeStatusDetail,
    dirtyTabCount,
    discardAllAndCloseWindow,
    discardDraft,
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
    emptyTabsLabel: safeEditorCopy.emptyTabs,
    findInputRef,
    findMatchCount,
    findMatches,
    findQuery,
    findVisible,
    getCompareCaseByKey,
    goToLine,
    goToLineValue,
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
    onApplyMarkdownFormat: applyActiveMarkdownFormat,
    onApplyManualCandidate: applyManualCandidateToActiveTab,
    onCheckAgentGate: requestAgentLaunchGateCheck,
    onOpenAgentWindow: () => {
      void openAgentWindow(themePreference);
    },
    onCloseReviewDesk: closeReviewDesk,
    onCloseTab: requestCloseTab,
    onConvertLineEnding: convertActiveLineEnding,
    onFinishTabPointerDrag: finishTabPointerDrag,
    onPointerEnter: suspendAgentUiRefresh,
    onResizeAgentTerminal: resizeAgentTerminal,
    onResumeAgentUiRefresh: resumeAgentUiRefresh,
    onReviewChanges: requestReviewTabAgainstDisk,
    onSelectTab: selectTabFromBar,
    onSendAgentTerminalData: sendAgentTerminalData,
    onStopAgentSession: requestAgentSessionStop,
    onSuspendAgentUiRefresh: suspendAgentUiRefresh,
    onTabPointerDown: handleTabPointerDown,
    onTabPointerMove: handleTabPointerMove,
    onToggleAgent: toggleAgentPane,
    onToggleDiff: toggleDiffPane,
    onToggleOutline: toggleOutlinePane,
    onTogglePreview: togglePreviewPane,
    openFile,
    openFilePath,
    openPreviewMarkdownLink,
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
    recoveryCopy,
    reopenTabFromDisk,
    replaceAll,
    saveAffirmation,
    saveAffirmationKey,
    replaceOne,
    replaceQuery,
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
    setCompareSource,
    setCompareTargetFile,
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
    tabs,
    themePreference,
    workspaceContextMenu,
    workspaceRootPath,
    workspaceTree,
  };

  return <AppShell {...shellProps} />;
}
