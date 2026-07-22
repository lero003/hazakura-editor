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
  closePdfReference,
  openAgentWindow,
  openAppleAssistWindow,
  toggleAppleAssistWindow,
} from "../../lib/tauri";
import { isAppleLocalAssistSurfaceAllowed } from "../../lib/distributionLane";
import { useAgentWorkbenchController } from "../agent/useAgentWorkbenchController";
import { useAppExitConfirmation } from "./useAppExitConfirmation";
import { useAppleAssistAvailability } from "../agent/useAppleAssistAvailability";
import { useCommandPaletteController } from "../commandPalette/useCommandPaletteController";
import { useOkfReview } from "../okf/useOkfReview";
import { useCompareController } from "../diff/useCompareController";
import { useReferenceCompareActions } from "../referenceCompare/useReferenceCompareActions";
import { useImportPageFollow } from "../referenceCompare/useImportPageFollow";
import { useReferenceExternalChange } from "../referenceCompare/useReferenceExternalChange";
import { buildLineDiff } from "../../features/diff/diff";
import { compareColumnLabel } from "../../lib/locale/review";
import { localizeCompareError } from "../../lib/utils";
import type { CompareCase } from "../../types";
import {
  approveParentFolderForContext,
  effectiveApprovedRoots,
  type MediaImageApprovalState,
} from "../../features/editor/mediaImageApprovals";
import { useDocumentSafetyActions } from "../document/useDocumentSafetyActions";
import { useDocumentIoController } from "../document/useDocumentIoController";
import { useDocumentCoreController } from "../document/useDocumentCoreController";
import { useDocumentPreviewController } from "../document/useDocumentPreviewController";
import { usePinExternalImagesAction } from "../document/usePinExternalImagesAction";
import { useEditorSurfaceController } from "../document/useEditorSurfaceController";
import { useAppleAssistTargetSync } from "../editor/useAppleAssistTargetSync";
import { useAppleAssistApplyHandler } from "../editor/useAppleAssistApplyHandler";
import { stopAppleAssistGeneration } from "../../lib/tauri";
import { aiEditTransactionStore } from "../../features/editor/aiEditTransactions";
import {
  replaceTabsBufferByPath,
  replaceTabsBufferBySessionId,
  updateTabsById,
} from "../../features/editor/editorTabs";
import {
  assertTabEditable,
  isAppleAssistTabLocked,
} from "../../features/editor/appleAssistEditGuard";
import {
  isLModeEnabledForDocument,
  isLModeSupportedDocument,
} from "../../features/editor/lMode/documentSupport";
import { useEditorCommands } from "../editor/useEditorCommands";
import { useEditorFindController } from "../editor/useEditorFindController";
import { useTabBarController } from "../editor/useTabBarController";
import { useWorkspaceFileOpening } from "../workspace/useWorkspaceFileOpening";
import { useBookScopeController } from "../workspace/useBookScopeController";
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
import type { AppleAssistGenerationLock, EditorTab } from "../../types";

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
  // Q-STR-2: single editability gate for Local Assist generation.
  const rejectIfAppleAssistLocksTab = useCallback(
    (tab: Pick<EditorTab, "id" | "path"> | null | undefined): boolean => {
      const result = assertTabEditable(appleAssistGenerationLock, tab);
      if (!result.editable) {
        setStatus(result.statusMessage);
        return true;
      }
      return false;
    },
    [appleAssistGenerationLock, setStatus],
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

  // section: v1.7 Reference Compare (read-only reference beside editor)
  const {
    clearReferenceCompare,
    markReferenceExternalChange,
    pdfPageIndex,
    referenceColumnPercent,
    referenceCompare,
    referenceNarrowFocus,
    referencePaneVisible,
    setPdfPageIndex,
    setReferenceColumnPercent,
    setReferenceDocument,
    setReferenceFollowMode,
    setReferenceNarrowFocus,
    setReferencePaneVisible,
  } = foundation;

  // Filled after useReferenceCompareActions; Import Assist pairs through this ref
  // so file-opening can run earlier in the hook order.
  const pairImportAssistReferenceRef = useRef<
    | ((
        sourcePath: string,
        editorSessionId: string,
      ) => Promise<boolean | void>)
    | null
  >(null);

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
    orphanPathlessDrafts,
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
    activeTab &&
    isAppleAssistTabLocked(
      appleAssistGenerationLock,
      activeTab.id,
      activeTab.path,
    )
      ? appleAssistGenerationLock
      : null;
  // Render L Mode only when the active document supports it. The preference
  // reset below is intentionally asynchronous, but this value reaches
  // EditorPane in the same render as a tab switch so CSS/HTML never mounts
  // with the forced Markdown parser.
  const activeLModeEnabled = isLModeEnabledForDocument(
    editorSettings.lModeEnabled,
    activeTab?.path || activeTab?.name,
  );
  const activeEditorSettings =
    activeLModeEnabled === editorSettings.lModeEnabled
      ? editorSettings
      : { ...editorSettings, lModeEnabled: false };
  const mediaApprovalContextKey =
    workspaceRootPath && activeTab
      ? `${workspaceRootPath}\u0000${activeTab.sessionId}`
      : null;
  const [mediaImageApprovalState, setMediaImageApprovalState] =
    useState<MediaImageApprovalState>({ contextKey: null, roots: [] });
  const approvedImageRoots = useMemo(
    () =>
      effectiveApprovedRoots(
        mediaImageApprovalState,
        mediaApprovalContextKey,
        editorSettings.outsideImages,
      ),
    [
      editorSettings.outsideImages,
      mediaApprovalContextKey,
      mediaImageApprovalState,
    ],
  );
  const approveLocalImageParent = useCallback(
    (resolvedPath: string) => {
      setMediaImageApprovalState((current) =>
        approveParentFolderForContext(
          current,
          mediaApprovalContextKey,
          resolvedPath,
          editorSettings.outsideImages,
        ),
      );
    },
    [editorSettings.outsideImages, mediaApprovalContextKey],
  );

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
    appleAssistCopy,
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
    documentStructureAdvisories,
    documentStructureItems,
    documentStructureTruncated,
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
    hideSidePane,
    toggleDiffPane: toggleDiffPaneBase,
    toggleEbookPane: toggleEbookPaneBase,
    toggleOutlinePane: toggleOutlinePaneBase,
    togglePreviewPane: togglePreviewPaneBase,
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

  const switchFromReference = useCallback(
    (togglePane: () => void) => {
      setReferencePaneVisible(false);
      togglePane();
    },
    [setReferencePaneVisible],
  );
  const toggleDiffPane = useCallback(
    () => switchFromReference(toggleDiffPaneBase),
    [switchFromReference, toggleDiffPaneBase],
  );
  const toggleEbookPane = useCallback(
    () => switchFromReference(toggleEbookPaneBase),
    [switchFromReference, toggleEbookPaneBase],
  );
  const toggleOutlinePane = useCallback(
    () => switchFromReference(toggleOutlinePaneBase),
    [switchFromReference, toggleOutlinePaneBase],
  );
  const togglePreviewPane = useCallback(
    () => switchFromReference(togglePreviewPaneBase),
    [switchFromReference, togglePreviewPaneBase],
  );

  useEffect(() => {
    if (referencePaneVisible) {
      setSidePaneOpen(false);
    }
  }, [referencePaneVisible, setSidePaneOpen]);

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
    setActiveTabContents: (next: string, sessionId: string) => {
      // Match by sessionId (Q-STR-1/3): survives Save As path rekey and
      // tab switch during generation without writing the wrong buffer.
      setTabs((currentTabs) =>
        replaceTabsBufferBySessionId(currentTabs, sessionId, next),
      );
    },
    setStatus,
    setGenerationLock: setAppleAssistGenerationLockWithMirror,
  });

  const bookScope = useBookScopeController({
    menuLanguage,
    setGlobalError,
    setStatus,
    workspaceRootPath,
  });

  // section: workspace file opening
  const {
    cancelPendingRename,
    confirmPendingRename,
    createFile,
    createFolder,
    createOkfScaffoldAt,
    createNewFile,
    importSourceAsMarkdownDraft,
    importSourcePathAsMarkdownDraft,
    loadWorkspaceDirectory,
    moveWorkspacePath,
    openExternalFilePaths,
    openFile,
    openFilePath,
    openWorkspace,
    openWorkspacePath,
    reopenPersistedWorkspace,
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
    pairImportAssistReference: async (sourcePath, editorSessionId) => {
      const pair = pairImportAssistReferenceRef.current;
      if (pair) {
        await pair(sourcePath, editorSessionId);
      }
    },
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
    onWorkspaceEntryRekey: bookScope.remapBookScopeWorkspaceEntry,
    onWorkspaceEntryRemoved: bookScope.removeBookScopeWorkspaceEntry,
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

  const {
    closeReferenceCompare,
    openReferenceFile,
    openTextPathAsReference,
    pairImportAssistReference,
    pauseReferenceFollow,
    referenceCopy,
    reloadReferenceFromDisk,
    resumeReferenceFollow,
  } = useReferenceCompareActions({
    activeTab,
    clearReferenceCompare,
    menuLanguage,
    referenceCompare,
    requestReviewTabAgainstDisk,
    setGlobalError,
    setReferenceDocument,
    setReferenceFollowMode,
    setStatus,
    workspaceRootPath,
  });
  pairImportAssistReferenceRef.current = pairImportAssistReference;

  const toggleReferencePane = useCallback(() => {
    if (!referenceCompare) {
      void openReferenceFile();
      return;
    }
    setReferencePaneVisible((current) => {
      const next = !current;
      if (!next) {
        setStatus(sidePaneCopy.referenceRetainedStatus);
      }
      return next;
    });
    setSidePaneOpen(false);
  }, [
    openReferenceFile,
    referenceCompare,
    setReferencePaneVisible,
    setSidePaneOpen,
    setStatus,
    sidePaneCopy.referenceRetainedStatus,
  ]);

  useImportPageFollow({
    activeContents: activeTab?.contents ?? "",
    activeTab,
    cursorLine: selectionInfo.line,
    referenceCompare,
    setPdfPageIndex,
    setReferenceFollowMode,
  });

  useReferenceExternalChange({
    referenceCompare,
    onExternalChange: () => {
      markReferenceExternalChange(true);
      setStatus("Reference file changed on disk");
    },
  });

  /**
   * Text reference → existing Diff workbench (left = reference snapshot,
   * right = editor buffer). Closes the reference pair so the Diff side pane
   * can show; visual side-by-side remains the default until this action.
   */
  const showReferenceTextDiff = useCallback(() => {
    const reference = referenceCompare?.reference;
    if (!reference || reference.kind !== "text" || !activeTab) {
      return;
    }
    setGlobalError(null);
    try {
      const diff = buildLineDiff(reference.contents, activeTab.contents);
      const caseKey = crypto.randomUUID();
      const sourceLabel = compareColumnLabel(menuLanguage, "source");
      const editorLabel = compareColumnLabel(menuLanguage, "editor");
      const compareCase: CompareCase = {
        kind: "file",
        key: caseKey,
        leftPath: reference.path,
        rightPath: activeTab.path || `session:${activeTab.sessionId}`,
        anchor: {
          path: reference.path,
          name: reference.name,
          label: sourceLabel,
        },
        target: {
          path: activeTab.path || "",
          name: activeTab.name,
          label: editorLabel,
        },
      };
      setCompareCaseEntry(compareCase);
      setCompareView({
        caseKey,
        ...diff,
      });
      // Text references hold no PDF handle; clear pair so Diff side pane can show.
      clearReferenceCompare();
      setRightPaneMode("compare");
      setSidePaneOpen(true);
      setStatus("Compare ready");
    } catch (err) {
      const message = String(err);
      setGlobalError(
        menuLanguage !== "en"
          ? localizeCompareError(message, menuLanguage)
          : message,
      );
      setStatus("Compare failed");
    }
  }, [
    activeTab,
    clearReferenceCompare,
    menuLanguage,
    referenceCompare,
    setCompareCaseEntry,
    setCompareView,
    setGlobalError,
    setRightPaneMode,
    setSidePaneOpen,
    setStatus,
  ]);

  const handlePdfPageIndexChange = useCallback(
    (page: number, source: "user" | "system") => {
      setPdfPageIndex(page);
      if (source === "user") {
        pauseReferenceFollow();
      }
    },
    [pauseReferenceFollow, setPdfPageIndex],
  );

  // R4 reliability: release the PDF helper handle if the shell unmounts
  // without an explicit close (app quit / route teardown).
  const referenceCompareRef = useRef(referenceCompare);
  referenceCompareRef.current = referenceCompare;
  useEffect(() => {
    return () => {
      const current = referenceCompareRef.current;
      if (current?.reference.kind === "pdf") {
        void closePdfReference(current.reference.referenceId).catch(() => {
          // Best-effort cleanup on unmount.
        });
      }
    };
  }, []);

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
      if (rejectIfAppleAssistLocksTab(targetTab)) {
        return;
      }
      setTabs((currentTabs) =>
        replaceTabsBufferByPath(currentTabs, documentPath, backupContents),
      );
      setActiveTabId(targetTab.id);
      closeCompareView();
      setStatus("Backup applied — save to keep changes");
    },
    [
      closeCompareView,
      rejectIfAppleAssistLocksTab,
      setActiveTabId,
      setStatus,
      setTabs,
      tabs,
    ],
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
    bookScopeChapters: bookScope.bookScopeChapters,
    bookScopeNodes: bookScope.bookScopeNodes,
    bookScopeUnavailable: bookScope.bookScopeUnavailable,
    materializeImagesOnExport: editorSettings.materializeImagesOnExport,
    mediaAccess: {
      outsideImages: editorSettings.outsideImages,
      loadRemoteImages: editorSettings.loadRemoteImages,
      approvedRoots: approvedImageRoots,
    },
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
    if (rejectIfAppleAssistLocksTab(activeTab)) {
      return;
    }
    await saveActiveTabUnsafe();
  }, [activeTab, rejectIfAppleAssistLocksTab, saveActiveTabUnsafe]);
  const saveActiveTabAs = useCallback(async () => {
    if (rejectIfAppleAssistLocksTab(activeTab)) {
      return;
    }
    await saveActiveTabAsUnsafe();
  }, [activeTab, rejectIfAppleAssistLocksTab, saveActiveTabAsUnsafe]);
  const saveTabById = useCallback(
    async (tabId: string): Promise<boolean> => {
      const targetTab = tabs.find((tab) => tab.id === tabId) ?? null;
      if (rejectIfAppleAssistLocksTab(targetTab)) {
        return false;
      }
      return saveTabByIdUnsafe(tabId);
    },
    [rejectIfAppleAssistLocksTab, saveTabByIdUnsafe, tabs],
  );
  const epubExportSettingsOpen = epubExportRequest !== null;
  const pdfExportSettingsOpen = pdfExportRequest !== null;
  const modalOpenWithBlockingDialogs =
    modalOpen ||
    pendingTrashOpen ||
    pendingAssistDiscardOpen ||
    epubExportSettingsOpen ||
    pdfExportSettingsOpen;

  // L Mode (えるモード) is Markdown-only. CSS/HTML remount switches the
  // parser and drops undo history; refuse non-Markdown with a status note.
  const toggleLMode = useCallback(() => {
    setEditorSettings((current) => {
      if (current.lModeEnabled) {
        return { ...current, lModeEnabled: false };
      }
      const key = activeTab?.path || activeTab?.name || "";
      if (!isLModeSupportedDocument(key)) {
        setStatus(
          "L Mode is for Markdown writing. Open a .md file to use L Mode.",
        );
        return current;
      }
      return { ...current, lModeEnabled: true };
    });
  }, [activeTab?.name, activeTab?.path, setEditorSettings, setStatus]);

  const exitLMode = useCallback(() => {
    setEditorSettings((current) => ({
      ...current,
      lModeEnabled: false,
    }));
  }, [setEditorSettings]);

  // Leave L Mode when the active document is not Markdown so CSS/HTML
  // never remount through the Markdown parser while L Mode stays on.
  useEffect(() => {
    if (!editorSettings.lModeEnabled) {
      return;
    }
    const key = activeTab?.path || activeTab?.name || "";
    if (!isLModeSupportedDocument(key)) {
      setEditorSettings((current) =>
        current.lModeEnabled ? { ...current, lModeEnabled: false } : current,
      );
      setStatus("L Mode left because this file is not Markdown.");
    }
  }, [
    activeTab?.name,
    activeTab?.path,
    editorSettings.lModeEnabled,
    setEditorSettings,
    setStatus,
  ]);

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

  // T-1 L Mode continuity: snapshot side-pane mode on entry and restore
  // on exit. Compare anchors are intentionally kept in memory (not
  // cleared) so returning from L Mode does not discard a review setup.
  const lModeSurfaceSnapshotRef = useRef<{
    sidePaneOpen: boolean;
    rightPaneMode: typeof rightPaneMode;
  } | null>(null);
  const wasLModeEnabledRef = useRef(editorSettings.lModeEnabled);
  const sidePaneOpenRef = useRef(sidePaneOpen);
  const rightPaneModeRef = useRef(rightPaneMode);
  sidePaneOpenRef.current = sidePaneOpen;
  rightPaneModeRef.current = rightPaneMode;

  useEffect(() => {
    const wasEnabled = wasLModeEnabledRef.current;
    const isEnabled = editorSettings.lModeEnabled;

    if (!wasEnabled && isEnabled) {
      lModeSurfaceSnapshotRef.current = {
        sidePaneOpen: sidePaneOpenRef.current,
        rightPaneMode: rightPaneModeRef.current,
      };
      setSidePaneOpen(false);
      if (referenceCompare) {
        setStatus(sidePaneCopy.lModeReferenceRetainedStatus);
      }
    } else if (wasEnabled && !isEnabled) {
      const snapshot = lModeSurfaceSnapshotRef.current;
      lModeSurfaceSnapshotRef.current = null;
      if (snapshot) {
        setSidePaneOpen(snapshot.sidePaneOpen);
        setRightPaneMode(snapshot.rightPaneMode);
      }
    }

    wasLModeEnabledRef.current = isEnabled;
  }, [
    editorSettings.lModeEnabled,
    referenceCompare,
    setRightPaneMode,
    setSidePaneOpen,
    setStatus,
    sidePaneCopy.lModeReferenceRetainedStatus,
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
        updateTabsById(currentTabs, activeTabId, (tab) =>
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
    changeHeadingLevel: changeHeadingLevelUnsafe,
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
      if (rejectIfAppleAssistLocksTab(activeTab)) {
        return;
      }
      handleEditorChangeUnsafe(nextValue);
    },
    [activeTab, handleEditorChangeUnsafe, rejectIfAppleAssistLocksTab],
  );
  const changeHeadingLevel = useCallback(
    (...args: Parameters<typeof changeHeadingLevelUnsafe>) => {
      if (rejectIfAppleAssistLocksTab(activeTab)) {
        return false;
      }
      return changeHeadingLevelUnsafe(...args);
    },
    [activeTab, changeHeadingLevelUnsafe, rejectIfAppleAssistLocksTab],
  );
  const onConvertLineEnding = useCallback(
    (lineEnding: Parameters<typeof convertActiveLineEnding>[0]) => {
      if (rejectIfAppleAssistLocksTab(activeTab)) {
        return;
      }
      convertActiveLineEnding(lineEnding);
    },
    [activeTab, convertActiveLineEnding, rejectIfAppleAssistLocksTab],
  );
  const onConvertEncoding = useCallback(
    (encoding: Parameters<typeof convertActiveEncoding>[0]) => {
      if (rejectIfAppleAssistLocksTab(activeTab)) {
        return;
      }
      convertActiveEncoding(encoding);
    },
    [activeTab, convertActiveEncoding, rejectIfAppleAssistLocksTab],
  );

  // section: command palette + global search
  const appleLocalAssistActive =
    appleLocalAssistAllowed && assistSurfaceActive === "apple-local";
  const {
    availability: appleAssistAvailability,
    probed: appleAssistAvailabilityProbed,
  } = useAppleAssistAvailability(
    appleLocalAssistActive && preferencesDialogMode === "agent",
  );

  // Q-STR-4: shared open/save/export/import actions for menu + palette.
  // Surface-specific keys stay on each consumer (palette has more editor
  // commands; menu has quit / openWorkspacePath / theme-less window open).
  const createOkfScaffold = useCallback(
    (templateId: "minimal" | "book-like") => {
      if (!workspaceRootPath) {
        setStatus("No workspace open");
        return;
      }
      void createOkfScaffoldAt(workspaceRootPath, templateId);
    },
    [createOkfScaffoldAt, setStatus, workspaceRootPath],
  );

  const sharedShellDocumentActions = useMemo(
    () => ({
      createNewFile,
      createOkfScaffold,
      exportEpubBeta,
      exportHtml,
      exportPdf,
      importSourceAsMarkdownDraft,
      openFile,
      openReferenceFile,
      openWorkspace,
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
      openFile,
      openReferenceFile,
      openWorkspace,
      requestWindowClose,
      saveActiveTab,
      saveActiveTabAs,
    ],
  );

  const {
    closeOkfReview,
    isOkfPathDirty,
    okfBundleRoot,
    okfCancelRequested,
    okfReviewError,
    okfReviewRerunError,
    okfReviewResult,
    okfReviewVisible,
    okfScanning,
    openOkfConcept,
    openOkfReview,
    rerunOkfReview,
    requestCancelOkfReview,
  } = useOkfReview({
    editorPaneRef,
    menuLanguage,
    openWorkspaceFile,
    setStatus,
    tabs,
    workspaceRootPath,
  });

  const { pinExternalImages } = usePinExternalImagesAction({
    activeTab,
    appleAssistGenerationLock,
    editorPaneRef,
    mediaAccess: {
      outsideImages: editorSettings.outsideImages,
      loadRemoteImages: editorSettings.loadRemoteImages,
      approvedRoots: approvedImageRoots,
    },
    menuLanguage,
    setStatus,
    workspaceRootPath,
  });

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
      ...sharedShellDocumentActions,
      applyActiveMarkdownFormat,
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
      openOkfReview,
      openWorkspaceFile,
      pinExternalImages,
      requestCloseTab,
      requestRestoreFromBackup,
      requestReviewTabAgainstDisk,
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
    menuLanguage,
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
        replaceTabsBufferBySessionId(currentTabs, sessionId, beforeBuffer),
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
      ...sharedShellDocumentActions,
      openAgentWindow: () => {
        void openAgentWindow(themePreference);
      },
      openAppleAssistWindow: () => {
        if (!appleLocalAssistActive) {
          return;
        }
        void openAppleAssistWindow(themePreference);
      },
      openWorkspacePath,
      requestAppQuit,
    },
    listener: {
      onOpenRecentFile: openFilePath,
      recentFilesRef,
      recentFoldersRef,
      setEditorSettings,
      setPreferencesDialogMode,
      setPreviewVisible,
      setThemePreference,
      onToggleLMode: toggleLMode,
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
      okfReviewVisible,
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
      onCloseOkfReview: closeOkfReview,
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
      onToggleLMode: toggleLMode,
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
    orphanPathlessDrafts,
    activeTab,
    activeTabId,
    approvedImageRoots,
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
    appleAssistCopy,
    appleAssistAvailability,
    appleAssistAvailabilityProbed,
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
    changeHeadingLevel,
    clearSaveError,
    closeReferenceCompare,
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
    createOkfScaffoldAt,
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
    documentStructureAdvisories,
    documentStructureItems,
    documentKey,
    draggingTabId,
    dragOverTabId,
    editorChromeCopy,
    editorPaneRef,
    editorPreviewGridRef,
    editorPreviewGridStyle,
    editorSettings: activeEditorSettings,
    editorTheme,
    epubExportCancelButtonRef,
    epubExportDialogRef,
    epubExportRequest,
    pdfExportCancelButtonRef,
    pdfExportDialogRef,
    pdfExportRequest,
    lModeCopy,
    lModeEnabled: activeLModeEnabled,
    closeFileLabel: safeEditorCopy.closeFile,
    emptyTabsLabel: safeEditorCopy.emptyTabs,
    openFileTabsLabel: safeEditorCopy.openFileTabs,
    openFilesLabel: safeEditorCopy.openFiles,
    unsavedFileStateLabel: fileOpsCopy.unsavedOpenFileState,
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
    isOkfPathDirty,
    okfBundleRoot,
    okfCancelRequested,
    okfReviewError,
    okfReviewRerunError,
    okfReviewResult,
    okfReviewVisible,
    okfScanning,
    onCancelOkfReviewScan: requestCancelOkfReview,
    onCloseOkfReview: closeOkfReview,
    onOpenOkfConcept: openOkfConcept,
    onOpenOkfReview: openOkfReview,
    onRerunOkfReview: rerunOkfReview,
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
    onConvertEncoding: onConvertEncoding,
    onConvertLineEnding: onConvertLineEnding,
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
    hideSidePane,
    onToggleOutline: toggleOutlinePane,
    onTogglePreview: togglePreviewPane,
    onToggleReference: toggleReferencePane,
    onCloseGlobalSearch: closeGlobalSearch,
    onOpenGlobalSearch: openGlobalSearch,
    onRunGlobalSearchMatch: runGlobalSearchMatch,
    onSetGlobalSearchActiveIndex: setGlobalSearchActiveIndex,
    onSetGlobalSearchQuery: setGlobalSearchQuery,
    openFile,
    openFilePath,
    openPreviewMarkdownLink,
    openReferenceFile,
    openTextPathAsReference,
    openRootWorkspaceContextMenu,
    pdfPageIndex,
    onPdfPageIndexChange: handlePdfPageIndexChange,
    onReloadReference: reloadReferenceFromDisk,
    onResumeReferenceFollow: resumeReferenceFollow,
    onShowReferenceDiff: showReferenceTextDiff,
    referenceColumnPercent,
    referenceCompare,
    referenceCopy,
    referenceFollowPaused: referenceCompare?.followMode === "paused",
    referenceLoaded: referenceCompare !== null,
    referenceNarrowFocus,
    referencePaneVisible,
    setReferenceColumnPercent,
    setReferenceNarrowFocus,
    openTabContextMenu,
    openWorkspace,
    openWorkspacePath,
    openWorkspaceContextMenu,
    openWorkspaceFile,
    recentFolders,
    reopenPersistedWorkspace,
    importSourcePathAsMarkdownDraft,
    outlineTruncated: documentStructureTruncated,
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
    onApproveLocalImageParent: approveLocalImageParent,
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
    ...bookScope,
  };
}
