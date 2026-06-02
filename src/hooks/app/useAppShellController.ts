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

import { useCallback } from "react";
import { openAgentWindow } from "../../lib/tauri";
import { useAgentWorkbenchRuntimeState } from "../agent/useAgentWorkbenchRuntimeState";
import { useAgentWorkbenchPreferences } from "../agent/useAgentWorkbenchPreferences";
import { useAgentUiRefreshGate } from "../agent/useAgentUiRefreshGate";
import { useAgentOutputBuffer } from "../agent/useAgentOutputBuffer";
import { useAgentWorkbenchSessionActions } from "../agent/useAgentWorkbenchSessionActions";
import { useAgentTerminalActions } from "../agent/useAgentTerminalActions";
import { useAgentWorkbenchPreferenceActions } from "../agent/useAgentWorkbenchPreferenceActions";
import { useCompareState } from "../diff/useCompareState";
import { useCompareController } from "../diff/useCompareController";
import { useDocumentSafetyActions } from "../document/useDocumentSafetyActions";
import { useDocumentIoController } from "../document/useDocumentIoController";
import { usePastedImageAction } from "../document/usePastedImageAction";
import { useEditorTabState } from "../editor/useEditorTabState";
import { useImagePreview } from "../editor/useImagePreview";
import { useActiveDocumentIdentity } from "../document/useActiveDocumentIdentity";
import { useActiveDocumentSurface } from "../document/useActiveDocumentSurface";
import { useSaveAffirmation } from "../document/useSaveAffirmation";
import { useDraftRecoveryState } from "../document/useDraftRecoveryState";
import { useEditorTabsState } from "../editor/useEditorTabsState";
import { useEditorSelectionState } from "../editor/useEditorSelectionState";
import { useEditorCommands } from "../editor/useEditorCommands";
import { useTabBarController } from "../editor/useTabBarController";
import { useGoToLine } from "../editor/useGoToLine";
import { useReviewDeskState } from "../review/useReviewDeskState";
import { useReviewDeskController } from "../review/useReviewDeskController";
import { useWorkspaceShellState } from "../workspace/useWorkspaceShellState";
import { useRecentEntries } from "../workspace/useRecentEntries";
import { useWorkspaceContextMenu } from "../workspace/useWorkspaceContextMenu";
import { useQuickOpenState } from "../workspace/useQuickOpenState";
import { useWorkspaceFileOpening } from "../workspace/useWorkspaceFileOpening";
import { useAppPreferences } from "./useAppPreferences";
import { useAppViewState } from "./useAppViewState";
import { useAppDialogState } from "./useAppDialogState";
import { useAppFeedbackState } from "./useAppFeedbackState";
import { useAppEditorRefs } from "./useAppEditorRefs";
import { useAppDialogRefs } from "./useAppDialogRefs";
import { useWindowDialogActions } from "./useWindowDialogActions";
import { useLocalizedAppCopy } from "./useLocalizedAppCopy";
import { useSidePaneController } from "../editor/useSidePaneController";
import { useFindReplaceController } from "../find/useFindReplaceController";
import { useAppMenuIntegration } from "./useAppMenuIntegration";
import { useAppRuntimeEffects } from "./useAppRuntimeEffects";
import { useMainAgentPaneFocus } from "./useMainAgentPaneFocus";

export function useAppShellController() {
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
  } = useAgentWorkbenchRuntimeState();

  // section: chrome dialog state
  const {
    pendingAppClose,
    pendingCloseTabId,
    preferencesDialogMode,
    setPendingAppClose,
    setPendingCloseTabId,
    setPreferencesDialogMode,
  } = useAppDialogState();

  // section: chrome view state
  const {
    rightPaneMode,
    setRightPaneMode,
    setReviewSurface,
    setSidePaneOpen,
    sidePaneOpen,
    reviewSurface,
  } = useAppViewState();

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
  } = useReviewDeskState();

  // section: review desk controller (depends on review state + chrome view state)
  const { toggleReviewDesk, closeReviewDesk } = useReviewDeskController({
    reviewSurface,
    resetReviewDesk,
    setReviewSurface,
  });

  // section: draft recovery
  const { pendingDrafts, setPendingDrafts } = useDraftRecoveryState();

  // section: chrome feedback
  const { globalError, setGlobalError, setStatus, status } =
    useAppFeedbackState();

  // section: save affirmation (depends on status)
  const { affirmation: saveAffirmation, lastAffirmedAt: saveAffirmationKey } =
    useSaveAffirmation(status);

  // section: editor tabs
  const { activeTabId, setActiveTabId, setTabs, tabs } = useEditorTabsState();

  // section: editor selection
  const { selectionInfo, setSelectionInfo } = useEditorSelectionState();

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
  } = useCompareState();

  // section: workspace shell state
  const {
    restoreComplete,
    setRestoreComplete,
    setWorkspaceRootPath,
    setWorkspaceTree,
    workspaceRootPath,
    workspaceTree,
  } = useWorkspaceShellState();

  // section: agent workbench preferences
  const {
    agentWorkbenchActive,
    agentWorkbenchConsent,
    agentWorkbenchPreference,
    agentWorkbenchProvider,
    setAgentWorkbenchConsent,
    setAgentWorkbenchPreference,
    setAgentWorkbenchProvider,
  } = useAgentWorkbenchPreferences();

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
  } = useAppPreferences();

  // section: editor refs (depends on tabs)
  const {
    editorPaneRef,
    findInputRef,
    previewPaneRef,
    tabsRef,
  } = useAppEditorRefs(tabs);

  // section: recent entries
  const {
    recentFiles,
    recentFilesRef,
    recentFolders,
    recentFoldersRef,
    rememberRecentFile,
    rememberRecentFolder,
  } = useRecentEntries();

  // section: agent UI refresh gate
  const {
    agentUiSuspendedRef,
    resumeAgentUiRefresh,
    suspendAgentUiRefresh,
  } = useAgentUiRefreshGate();

  // section: editor tab state
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

  // section: image preview
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

  // section: document identity
  const {
    activeTabPath,
    documentKey,
    hasActiveDocument,
    selectedImageOpen,
  } = useActiveDocumentIdentity({
    activeTab,
    selectedImage,
  });

  // section: workspace context menu
  const {
    closeWorkspaceContextMenu,
    openWorkspaceContextMenu,
    workspaceContextMenu,
  } = useWorkspaceContextMenu();

  // section: quick open
  const { closeQuickOpen, quickOpenVisible, toggleQuickOpen } =
    useQuickOpenState();

  // section: localized app copy
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

  // section: side pane controller
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

  // section: active document surface
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

  // section: find / replace
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

  // section: go to line
  const {
    goToLine,
    goToLineValue,
    handleGoToLineKeyDown,
    setGoToLineValue,
  } = useGoToLine({
    editorPaneRef,
    onStatus: setStatus,
  });

  // section: agent output buffer
  const { agentOutput, applyAgentOutput, resetAgentOutput } =
    useAgentOutputBuffer();

  // section: workspace file opening
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

  // section: dialog refs
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

  // section: app menu integration (side effect)
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

  // section: agent preference actions
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

  // section: agent session actions
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

  // section: agent terminal actions
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

  // section: pasted image action
  const { handlePasteImage } = usePastedImageAction({
    activeTabPath,
    setStatus,
    workspaceRootPath,
  });

  // section: editor commands
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

  // section: app runtime effects (side effect)
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

  // section: main agent pane focus (side effect)
  useMainAgentPaneFocus({ onOpen: toggleAgentPane });

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
}
