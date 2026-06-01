// xterm imports moved to AgentTerminalView component
import { SakuraPetals } from "./components/SakuraPetals";
import { AppOverlays } from "./components/AppOverlays";
import { AppWorkspace } from "./components/AppWorkspace";
import { AppTopChrome } from "./components/AppTopChrome";
import { AppDocumentFeedback } from "./components/AppDocumentFeedback";
import { AppStatusBar } from "./components/AppStatusBar";
import { useAppPreferences } from "./hooks/useAppPreferences";
import { useRecentEntries } from "./hooks/useRecentEntries";
import { useAppMenuIntegration } from "./hooks/useAppMenuIntegration";
import { useWindowDialogActions } from "./hooks/useWindowDialogActions";
import { usePastedImageAction } from "./hooks/usePastedImageAction";
import { useAgentWorkbenchPreferenceActions } from "./hooks/useAgentWorkbenchPreferenceActions";
import { useAgentTerminalActions } from "./hooks/useAgentTerminalActions";
import { useAgentWorkbenchSessionActions } from "./hooks/useAgentWorkbenchSessionActions";
import { useDocumentSafetyActions } from "./hooks/useDocumentSafetyActions";
import { useEditorTabState } from "./hooks/useEditorTabState";
import { useSidePaneController } from "./hooks/useSidePaneController";
import { useAppRuntimeEffects } from "./hooks/useAppRuntimeEffects";
import { useAgentOutputBuffer } from "./hooks/useAgentOutputBuffer";
import { useAgentUiRefreshGate } from "./hooks/useAgentUiRefreshGate";
import { useWorkspaceFileOpening } from "./hooks/useWorkspaceFileOpening";
import { useCompareController } from "./hooks/useCompareController";
import { useDocumentIoController } from "./hooks/useDocumentIoController";
import { useGoToLine } from "./hooks/useGoToLine";
import { useImagePreview } from "./hooks/useImagePreview";
import { useWorkspaceContextMenu } from "./hooks/useWorkspaceContextMenu";
import { useQuickOpenState } from "./hooks/useQuickOpenState";
import { useEditorCommands } from "./hooks/useEditorCommands";
import { useTabBarController } from "./hooks/useTabBarController";
import { useLocalizedAppCopy } from "./hooks/useLocalizedAppCopy";
import { useAppDialogRefs } from "./hooks/useAppDialogRefs";
import { useFindReplaceController } from "./hooks/useFindReplaceController";
import { useAppEditorRefs } from "./hooks/useAppEditorRefs";
import { useCompareState } from "./hooks/useCompareState";
import { useWorkspaceShellState } from "./hooks/useWorkspaceShellState";
import { useEditorSelectionState } from "./hooks/useEditorSelectionState";
import { useAppDialogState } from "./hooks/useAppDialogState";
import { useAppViewState } from "./hooks/useAppViewState";
import { useDraftRecoveryState } from "./hooks/useDraftRecoveryState";
import { useAppFeedbackState } from "./hooks/useAppFeedbackState";
import { useEditorTabsState } from "./hooks/useEditorTabsState";
import { useAgentWorkbenchRuntimeState } from "./hooks/useAgentWorkbenchRuntimeState";
import { useActiveDocumentIdentity } from "./hooks/useActiveDocumentIdentity";
import { useActiveDocumentSurface } from "./hooks/useActiveDocumentSurface";

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
  const { rightPaneMode, setRightPaneMode, setZenMode, zenMode } =
    useAppViewState();
  const { pendingDrafts, setPendingDrafts } = useDraftRecoveryState();
  const { globalError, setGlobalError, setStatus, status } =
    useAppFeedbackState();
  const { activeTabId, setActiveTabId, setTabs, tabs } = useEditorTabsState();
  const { selectionInfo, setSelectionInfo } = useEditorSelectionState();
  const {
    compareAnchor,
    compareTarget,
    compareView,
    setCompareAnchor,
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
    editorSettings,
    editorTheme,
    menuLanguage,
    previewVisible,
    resolvedTheme,
    setAgentWorkbenchConsent,
    setAgentWorkbenchPreference,
    setAgentWorkbenchProvider,
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
  const {
    applyActiveMarkdownFormat,
    convertActiveLineEnding,
    handleEditorChange,
    insertMarkdownAtCursor,
    insertTable,
    jumpToHeading,
  } = useEditorCommands({
    activeTab,
    activeTabId,
    editorPaneRef,
    setStatus,
    setTabs,
  });
  const {
    agentWorkbenchCopy,
    agentWorkbenchModeBadge,
    agentWorkbenchRestartRequired,
    editorChromeCopy,
    preferencesCopy,
    recoveryCopy,
    safeEditorCopy,
    sidePaneCopy,
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
    setCompareTarget,
    setCompareView,
    setGlobalError,
    setRightPaneMode,
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
      openFile,
      openWorkspace,
      openWorkspacePath,
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
      setZenMode,
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
      zenMode,
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
      setZenMode,
      zenMode,
    },
  });

  return (
    <main className={`app-shell${zenMode ? " zen-mode" : ""}`}>
      {resolvedTheme === "sakura" ? <SakuraPetals /> : null}
      <AppTopChrome
        activeDirty={activeDirty}
        activeTab={activeTab}
        activeTabId={activeTabId}
        agentAvailable={agentWorkbenchAvailable}
        agentModeBadge={agentWorkbenchModeBadge}
        agentModeBadgePending={agentWorkbenchRestartRequired}
        agentModeBadgeTitle={agentWorkbenchCopy.modeBadgeTitle}
        draggingTabId={draggingTabId}
        dragOverTabId={dragOverTabId}
        editorChromeCopy={editorChromeCopy}
        emptyTabsLabel={safeEditorCopy.emptyTabs}
        onApplyMarkdownFormat={applyActiveMarkdownFormat}
        onCloseTab={requestCloseTab}
        onConvertLineEnding={convertActiveLineEnding}
        onFinishTabPointerDrag={finishTabPointerDrag}
        onInsertTable={insertTable}
        onPointerEnter={suspendAgentUiRefresh}
        onReviewChanges={requestReviewTabAgainstDisk}
        onSelectTab={selectTabFromBar}
        onTabPointerDown={handleTabPointerDown}
        onTabPointerMove={handleTabPointerMove}
        onToggleAgent={toggleAgentPane}
        onToggleDiff={toggleDiffPane}
        onToggleOutline={toggleOutlinePane}
        onTogglePreview={togglePreviewPane}
        recoveryCopy={recoveryCopy}
        shouldSuppressTabClick={shouldSuppressTabClick}
        sidePaneCopy={sidePaneCopy}
        sidePaneMode={sidePaneMode}
        tabs={tabs}
      />

      <AppDocumentFeedback
        activeConflict={activeConflict}
        activeDraft={activeDraft}
        activeError={activeError}
        activeMatchIndex={activeMatchIndex}
        activeSaveError={activeSaveError}
        activeTab={activeTab}
        clearSaveError={clearSaveError}
        closeFindAndFocusEditor={closeFindAndFocusEditor}
        closeTabNow={closeTabNow}
        discardDraft={discardDraft}
        editorChromeCopy={editorChromeCopy}
        findInputRef={findInputRef}
        findMatchCount={findMatchCount}
        findQuery={findQuery}
        findVisible={findVisible}
        goToLine={goToLine}
        goToLineValue={goToLineValue}
        handleFindKeyDown={handleFindKeyDown}
        handleGoToLineKeyDown={handleGoToLineKeyDown}
        handleReplaceKeyDown={handleReplaceKeyDown}
        invalidRegex={invalidRegex}
        keepEditingAfterConflict={keepEditingAfterConflict}
        recoveryCopy={recoveryCopy}
        reopenTabFromDisk={reopenTabFromDisk}
        replaceAll={replaceAll}
        replaceOne={replaceOne}
        replaceQuery={replaceQuery}
        restoreDraft={restoreDraft}
        reviewDraftAgainstDisk={requestReviewDraftAgainstDisk}
        reviewTabAgainstDisk={requestReviewTabAgainstDisk}
        saveTabById={saveTabById}
        searchOptions={searchOptions}
        setFindQuery={setFindQuery}
        setGoToLineValue={setGoToLineValue}
        setReplaceQuery={setReplaceQuery}
        setSearchOptions={setSearchOptions}
        showNextMatch={showNextMatch}
        showPreviousMatch={showPreviousMatch}
      />

      <AppWorkspace
        activeContents={activeContents}
        activeDocumentLineCount={activeDocumentLineCount}
        activeMatchIndex={activeMatchIndex}
        activeTab={activeTab}
        agentLaunchGate={agentLaunchGate}
        agentOutput={agentOutput}
        agentSession={agentSession}
        agentStopPending={agentStopPending}
        agentWorkbenchProvider={agentWorkbenchProvider}
        clearCompareSource={clearCompareSource}
        clearCompareTarget={clearCompareTarget}
        closeCompareView={closeCompareView}
        compareAnchor={compareAnchor}
        compareTarget={compareTarget}
        compareView={compareView}
        createNewFile={createNewFile}
        currentHeadingLine={currentMarkdownHeading?.line ?? null}
        documentHeadings={documentHeadings}
        documentKey={documentKey}
        editorPaneRef={editorPaneRef}
        editorPreviewGridRef={editorPreviewGridRef}
        editorPreviewGridStyle={editorPreviewGridStyle}
        editorSettings={editorSettings}
        editorTheme={editorTheme}
        findMatches={findMatches}
        handleEditorChange={handleEditorChange}
        handlePasteImage={handlePasteImage}
        handlePresetPrompt={handlePresetPrompt}
        handlePreviewResizeKeyDown={handlePreviewResizeKeyDown}
        handlePreviewResizePointerDown={handlePreviewResizePointerDown}
        handlePreviewResizePointerMove={handlePreviewResizePointerMove}
        handleSendSelectionToAgent={handleSendSelectionToAgent}
        hasWorkspaceSelection={hasWorkspaceSelection}
        jumpToHeading={jumpToHeading}
        loadWorkspaceDirectory={loadWorkspaceDirectory}
        menuLanguage={menuLanguage}
        onCheckAgentGate={requestAgentLaunchGateCheck}
        onResizeAgentTerminal={resizeAgentTerminal}
        onResumeAgentUiRefresh={resumeAgentUiRefresh}
        onSendAgentTerminalData={sendAgentTerminalData}
        onStopAgentSession={requestAgentSessionStop}
        onSuspendAgentUiRefresh={suspendAgentUiRefresh}
        openFile={openFile}
        openFilePath={openFilePath}
        openPreviewMarkdownLink={openPreviewMarkdownLink}
        openWorkspace={openWorkspace}
        openWorkspaceContextMenu={openWorkspaceContextMenu}
        openWorkspaceFile={openWorkspaceFile}
        outlineTruncated={documentOutline?.truncated ?? false}
        previewColumnPercent={previewColumnPercent}
        previewPaneRef={previewPaneRef}
        previewVisible={previewVisible}
        recentFiles={recentFiles}
        resolvedTheme={resolvedTheme}
        runSelectedFileCompare={runSelectedFileCompare}
        safeEditorCopy={safeEditorCopy}
        scrollHudContext={scrollHudContext}
        scrollHudLine={scrollHudLine}
        scrollHudVisible={scrollHudVisible}
        selectedImage={selectedImage}
        selectWorkspaceCompareFile={selectWorkspaceCompareFile}
        setSelectionInfo={setSelectionInfo}
        sidePaneCopy={sidePaneCopy}
        sidePaneMode={sidePaneMode}
        sidePaneVisible={sidePaneVisible}
        syncEditorScroll={syncEditorScroll}
        syncPreviewScroll={syncPreviewScroll}
        workspaceRootPath={workspaceRootPath}
        workspaceTree={workspaceTree}
      />

      <AppStatusBar
        activeAgentSession={activeAgentSession}
        agentWorkbenchActive={agentWorkbenchActive}
        agentWorkbenchProvider={agentWorkbenchProvider}
        detail={activeStatusDetail}
        menuLanguage={menuLanguage}
        status={status}
      />

      <AppOverlays
        activeAgentSession={activeAgentSession}
        activeTab={activeTab}
        agentSession={agentSession}
        agentWorkbenchActive={agentWorkbenchActive}
        agentWorkbenchConsent={agentWorkbenchConsent}
        agentWorkbenchCopy={agentWorkbenchCopy}
        agentWorkbenchPreference={agentWorkbenchPreference}
        agentWorkbenchProvider={agentWorkbenchProvider}
        agentWorkbenchRestartRequired={agentWorkbenchRestartRequired}
        appCloseCancelButtonRef={appCloseCancelButtonRef}
        appCloseDialogRef={appCloseDialogRef}
        appRestartPending={appRestartPending}
        cancelPendingAppClose={cancelPendingAppClose}
        cancelPendingTabClose={cancelPendingTabClose}
        clearCompareSource={clearCompareSource}
        closePreferencesFromKeyboard={closePreferencesFromKeyboard}
        closeQuickOpen={closeQuickOpen}
        closeTabCancelButtonRef={closeTabCancelButtonRef}
        closeTabDialogRef={closeTabDialogRef}
        closeTabNow={closeTabNow}
        closeWorkspaceContextMenu={closeWorkspaceContextMenu}
        compareAnchor={compareAnchor}
        compareWorkspaceFiles={compareWorkspaceFiles}
        copyWorkspaceFullPath={copyWorkspaceFullPath}
        dirtyTabCount={dirtyTabCount}
        discardAllAndCloseWindow={discardAllAndCloseWindow}
        editorSettings={editorSettings}
        menuLanguage={menuLanguage}
        openWorkspaceFile={openWorkspaceFile}
        pendingAppClose={pendingAppClose}
        pendingCloseTab={pendingCloseTab}
        preferencesCloseButtonRef={preferencesCloseButtonRef}
        preferencesCopy={preferencesCopy}
        preferencesDialogMode={preferencesDialogMode}
        preferencesDialogRef={preferencesDialogRef}
        preferencesOpen={preferencesOpen}
        previewVisible={previewVisible}
        quickOpenVisible={quickOpenVisible}
        recoveryCopy={recoveryCopy}
        revealWorkspacePath={revealWorkspacePath}
        restartAppForAgentMode={restartAppForAgentMode}
        saveAllAndCloseWindow={saveAllAndCloseWindow}
        saveAndClosePendingTab={saveAndClosePendingTab}
        sendWorkspacePathToAgent={sendWorkspacePathToAgent}
        setAgentWorkbenchConsent={updateAgentWorkbenchConsent}
        setAgentWorkbenchPreference={updateAgentWorkbenchPreference}
        setAgentWorkbenchProvider={updateAgentWorkbenchProvider}
        setCompareSource={setCompareSource}
        setCompareTargetFile={setCompareTargetFile}
        setEditorSettings={setEditorSettings}
        setMenuLanguage={setMenuLanguage}
        setPreviewVisible={setPreviewVisible}
        setThemePreference={setThemePreference}
        themePreference={themePreference}
        workspaceContextMenu={workspaceContextMenu}
        workspaceRootPath={workspaceRootPath}
        workspaceTree={workspaceTree}
      />
    </main>
  );
}
