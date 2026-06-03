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

import { useCallback, useMemo } from "react";
import { openAgentWindow } from "../../lib/tauri";
import { useAgentWorkbenchSessionActions } from "../agent/useAgentWorkbenchSessionActions";
import { useAgentTerminalActions } from "../agent/useAgentTerminalActions";
import { useAgentWorkbenchPreferenceActions } from "../agent/useAgentWorkbenchPreferenceActions";
import { useCommandPalette, type Command } from "../commandPalette/useCommandPalette";
import {
  useGlobalSearch,
  type GlobalSearchRow,
} from "../globalSearch/useGlobalSearch";
import { useCompareController } from "../diff/useCompareController";
import { useDocumentSafetyActions } from "../document/useDocumentSafetyActions";
import { useDocumentIoController } from "../document/useDocumentIoController";
import { usePastedImageAction } from "../document/usePastedImageAction";
import { useEditorTabState } from "../editor/useEditorTabState";
import { useImagePreview } from "../editor/useImagePreview";
import { useActiveDocumentIdentity } from "../document/useActiveDocumentIdentity";
import { useActiveDocumentSurface } from "../document/useActiveDocumentSurface";
import { useEditorCommands } from "../editor/useEditorCommands";
import { useTabBarController } from "../editor/useTabBarController";
import { useGoToLine } from "../editor/useGoToLine";
import { useReviewDeskController } from "../review/useReviewDeskController";
import { useWorkspaceFileOpening } from "../workspace/useWorkspaceFileOpening";
import { useAppShellFoundation } from "./useAppShellFoundation";
import { useAppShellRefs } from "./useAppShellRefs";
import { useWindowDialogActions } from "./useWindowDialogActions";
import { useLocalizedAppCopy } from "./useLocalizedAppCopy";
import { useSidePaneController } from "../editor/useSidePaneController";
import { useFindReplaceController } from "../find/useFindReplaceController";
import { useAppMenuIntegration } from "./useAppMenuIntegration";
import { useAppRuntimeEffects } from "./useAppRuntimeEffects";

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
    unpinRecentFile,
  } = foundation;

  // section: agent UI refresh gate
  const {
    agentUiSuspendedRef,
    resumeAgentUiRefresh,
    suspendAgentUiRefresh,
  } = foundation;

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
  } = foundation;

  // section: quick open
  const { closeQuickOpen, quickOpenVisible, toggleQuickOpen } =
    foundation;

  // section: localized app copy
  const {
    agentWorkbenchCopy,
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
    editorPreviewGridRef,
    editorPreviewGridStyle,
    handlePreviewResizeKeyDown,
    handlePreviewResizePointerDown,
    handlePreviewResizePointerMove,
    hasWorkspaceSelection,
    previewColumnPercent,
    sidePaneMode,
    sidePaneVisible,
    toggleDiffPane,
    toggleOutlinePane,
    togglePreviewPane,
  } = useSidePaneController({
    activeTab,
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
  const { agentOutput, applyAgentOutput, resetAgentOutput } = foundation;

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

  // section: command palette
  //
  // The palette is a thin launcher over the existing safe editor /
  // agent / file actions — every entry is a real handler already
  // section: global search
  //
  // The hook owns the search modal state, the debounced query,
  // and the (file, match) row list. Selecting a row delegates
  // to `openWorkspaceFile` for the file-open path and then asks
  // the editor to jump to the matching line. The `goToLine`
  // call is wrapped in a short `setTimeout` because
  // `openWorkspaceFile` is async and the editor pane re-mounts
  // on a fresh tab; the existing outline-jump path uses the
  // same trick. We call `editorPaneRef.current?.goToLine` directly
  // (the `goToLine` returned by `useGoToLine` reads the
  // go-to-line dialog's text input and is not what we want here).
  const handleOpenSearchMatch = useCallback(
    (row: GlobalSearchRow) => {
      void openWorkspaceFile(row.file.path).then(() => {
        setTimeout(() => {
          editorPaneRef.current?.goToLine(row.match.line);
        }, 50);
        setStatus(`Opened ${row.file.relativePath}:${row.match.line}`);
      });
    },
    [editorPaneRef, openWorkspaceFile, setStatus],
  );

  const {
    activeIndex: globalSearchActiveIndex,
    closeGlobalSearch,
    globalSearchVisible,
    openGlobalSearch,
    query: globalSearchQuery,
    rows: globalSearchRows,
    searchError: globalSearchError,
    searching: globalSearching,
    setActiveIndex: setGlobalSearchActiveIndex,
    setQuery: setGlobalSearchQuery,
    summary: globalSearchSummary,
  } = useGlobalSearch({
    workspaceRoot: workspaceRootPath,
    onOpenMatch: handleOpenSearchMatch,
  });

  // wired into the controller. `useCommandPalette` keeps the
  // latest commands array in a ref so the filtered memo does not
  // have to depend on it, and exposes a tiny state machine
  // (visible / query / active index) for the modal. Cmd+Shift+P
  // and the modal Esc handler (via useModalKeyboardGuard) drive
  // `openCommandPalette` and `closeCommandPalette`.
  const commandCommands = useMemo<Command[]>(
    () => [
      {
        category: "File",
        id: "file.new",
        keywords: ["create", "new", "tab"],
        label: "New File",
        run: () => {
          void createNewFile();
        },
        shortcut: "⌘N",
      },
      {
        category: "File",
        id: "file.open",
        keywords: ["open", "file", "load"],
        label: "Open File…",
        run: () => {
          void openFile();
        },
        shortcut: "⌘O",
      },
      {
        category: "File",
        id: "file.openWorkspace",
        keywords: ["workspace", "folder", "directory", "open"],
        label: "Open Workspace…",
        run: () => {
          void openWorkspace();
        },
        shortcut: "⇧⌘O",
      },
      {
        category: "File",
        id: "file.quickOpen",
        keywords: ["quick", "open", "file", "search"],
        label: "Quick Open File",
        run: () => {
          toggleQuickOpen();
        },
        shortcut: "⌘P",
      },
      {
        category: "File",
        id: "file.save",
        keywords: ["save", "write"],
        label: "Save",
        run: () => {
          void saveActiveTab();
        },
        shortcut: "⌘S",
      },
      {
        category: "File",
        id: "file.saveAs",
        keywords: ["save", "as", "duplicate"],
        label: "Save As…",
        run: () => {
          void saveActiveTabAs();
        },
        shortcut: "⇧⌘S",
      },
      {
        category: "File",
        id: "file.closeTab",
        keywords: ["close", "tab"],
        label: "Close Tab",
        run: () => {
          if (activeTabId) {
            requestCloseTab(activeTabId);
          }
        },
        shortcut: "⌘W",
      },
      {
        category: "File",
        id: "file.closeWindow",
        keywords: ["close", "window", "quit"],
        label: "Close Window",
        run: () => {
          void requestWindowClose();
        },
        shortcut: "⇧⌘W",
      },
      {
        category: "File",
        id: "file.exportHtml",
        keywords: ["export", "html"],
        label: "Export HTML…",
        run: () => {
          void exportHtml();
        },
      },
      {
        category: "File",
        id: "file.exportPdf",
        keywords: ["export", "pdf"],
        label: "Export PDF…",
        run: () => {
          void exportPdf();
        },
      },
      {
        category: "Edit",
        id: "edit.find",
        keywords: ["find", "search", "match"],
        label: "Find…",
        run: () => {
          setFindVisible(true);
        },
        shortcut: "⌘F",
      },
      {
        category: "Edit",
        id: "edit.findInFiles",
        keywords: ["find", "search", "files", "workspace", "grep"],
        label: "Find in Files…",
        run: () => {
          openGlobalSearch();
        },
        shortcut: "⇧⌘F",
      },
      {
        category: "Edit",
        id: "edit.bold",
        keywords: ["bold", "strong", "format", "markdown"],
        label: "Apply Bold",
        run: () => {
          applyActiveMarkdownFormat("bold");
        },
        shortcut: "⌘B",
      },
      {
        category: "Edit",
        id: "edit.italic",
        keywords: ["italic", "emphasis", "format", "markdown"],
        label: "Apply Italic",
        run: () => {
          applyActiveMarkdownFormat("italic");
        },
        shortcut: "⌘I",
      },
      {
        category: "Edit",
        id: "edit.code",
        keywords: ["code", "inline", "format", "markdown"],
        label: "Apply Inline Code",
        run: () => {
          applyActiveMarkdownFormat("code");
        },
        shortcut: "⌘E",
      },
      {
        category: "Edit",
        id: "edit.link",
        keywords: ["link", "url", "format", "markdown"],
        label: "Apply Link",
        run: () => {
          applyActiveMarkdownFormat("link");
        },
        shortcut: "⌘K",
      },
      {
        category: "Edit",
        id: "edit.insertTable",
        keywords: ["table", "insert", "grid"],
        label: "Insert Table",
        run: () => {
          insertTable();
        },
        shortcut: "⇧⌘T",
      },
      {
        category: "View",
        id: "view.preview",
        keywords: ["preview", "view", "render"],
        label: "Toggle Preview Pane",
        run: () => {
          setPreviewVisible((current) => !current);
        },
        shortcut: "⌥⌘P",
      },
      {
        category: "View",
        id: "view.wrap",
        keywords: ["wrap", "word", "line"],
        label: "Toggle Word Wrap",
        run: () => {
          setEditorSettings((current) => ({
            ...current,
            wrapLines: !current.wrapLines,
          }));
        },
        shortcut: "⌥⌘W",
      },
      {
        category: "View",
        id: "view.invisibles",
        keywords: ["invisible", "whitespace", "characters"],
        label: "Toggle Invisible Characters",
        run: () => {
          setEditorSettings((current) => ({
            ...current,
            showInvisibles: !current.showInvisibles,
          }));
        },
        shortcut: "⌥⌘I",
      },
      {
        category: "View",
        id: "view.outline",
        keywords: ["outline", "headings", "navigation"],
        label: "Toggle Outline Pane",
        run: () => {
          toggleOutlinePane();
        },
      },
      {
        category: "View",
        id: "view.diff",
        keywords: ["diff", "compare"],
        label: "Toggle Diff Pane",
        run: () => {
          toggleDiffPane();
        },
      },
      {
        category: "View",
        id: "view.nextTab",
        keywords: ["tab", "next", "focus"],
        label: "Focus Next Tab",
        run: () => {
          focusAdjacentTab("next");
        },
        shortcut: "⌥⌘→",
      },
      {
        category: "View",
        id: "view.prevTab",
        keywords: ["tab", "previous", "focus"],
        label: "Focus Previous Tab",
        run: () => {
          focusAdjacentTab("previous");
        },
        shortcut: "⌥⌘←",
      },
      {
        category: "Review",
        id: "review.open",
        keywords: ["review", "diff", "compare"],
        label: "Open Review Desk",
        run: () => {
          toggleReviewDesk();
        },
        shortcut: "⇧⌘R",
      },
      {
        category: "Review",
        id: "review.tabAgainstDisk",
        keywords: ["review", "diff", "disk"],
        label: "Review Tab Against Disk",
        run: () => {
          if (activeTab) {
            requestReviewTabAgainstDisk(activeTab);
          }
        },
      },
      {
        category: "Agent",
        id: "agent.open",
        keywords: ["agent", "claude", "codex", "opencode", "pi", "workbench"],
        label: "Open Agent Window",
        run: () => {
          void openAgentWindow(themePreference);
        },
      },
      {
        category: "Agent",
        id: "agent.sendSelection",
        keywords: ["agent", "send", "selection"],
        label: "Send Selection to Agent",
        run: () => {
          const text = editorPaneRef.current?.getSelectionText() ?? "";
          handleSendSelectionToAgent(text);
        },
      },
      {
        category: "Agent",
        id: "agent.preferences",
        keywords: ["agent", "preferences", "settings", "workbench"],
        label: "Agent Workbench Preferences…",
        run: () => {
          setPreferencesDialogMode("agent");
        },
      },
      {
        category: "Settings",
        id: "settings.open",
        keywords: ["settings", "preferences"],
        label: "Settings…",
        run: () => {
          setPreferencesDialogMode("settings");
        },
        shortcut: "⌘,",
      },
    ],
    [
      activeTab,
      activeTabId,
      applyActiveMarkdownFormat,
      createNewFile,
      editorPaneRef,
      exportHtml,
      exportPdf,
      focusAdjacentTab,
      handleSendSelectionToAgent,
      insertTable,
      openAgentWindow,
      openFile,
      openGlobalSearch,
      openWorkspace,
      requestCloseTab,
      requestReviewTabAgainstDisk,
      requestWindowClose,
      saveActiveTab,
      saveActiveTabAs,
      setEditorSettings,
      setFindVisible,
      setPreferencesDialogMode,
      setPreviewVisible,
      themePreference,
      toggleDiffPane,
      toggleOutlinePane,
      toggleQuickOpen,
      toggleReviewDesk,
    ],
  );
  const {
    activeIndex: commandPaletteActiveIndex,
    closeCommandPalette,
    commandPaletteVisible,
    filteredCommands,
    openCommandPalette,
    query: commandPaletteQuery,
    runCommand,
    setActiveIndex: setCommandPaletteActiveIndex,
    setQuery: setCommandPaletteQuery,
  } = useCommandPalette({ commands: commandCommands });

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
    closeCommandPalette,
    commandPaletteActiveIndex,
    commandPaletteQuery,
    commandPaletteVisible,
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
    onFinishTabPointerDrag: finishTabPointerDrag,
    onOpenCommandPalette: openCommandPalette,
    onRunCommand: runCommand,
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
    onToggleDiff: toggleDiffPane,
    onToggleOutline: toggleOutlinePane,
    onTogglePreview: togglePreviewPane,
    onCloseGlobalSearch: closeGlobalSearch,
    onOpenGlobalSearch: openGlobalSearch,
    onRunGlobalSearchMatch: handleOpenSearchMatch,
    onSetGlobalSearchActiveIndex: setGlobalSearchActiveIndex,
    onSetGlobalSearchQuery: setGlobalSearchQuery,
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
    pinnedFiles,
    onTogglePinRecentFile: handleTogglePinRecentFile,
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
    tabs,
    themePreference,
    workspaceContextMenu,
    workspaceRootPath,
    workspaceTree,
  };
}
