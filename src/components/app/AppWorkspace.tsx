import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from "react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { EBookReaderLocation } from "../editor/preview/EBookPane";
import type { EditorPaneHandle, EditorSelectionInfo } from "../editor/EditorPane";
import { EditorMainPane } from "../editor/EditorMainPane";
import { PaneResizer } from "../editor/PaneResizer";
import { SidePane } from "./SidePane";
import { WorkspaceSidebar } from "../workspace/WorkspaceSidebar";
import { PanelLeftOpenIcon } from "./Icons";
import {
  coalesceChaptersToTopLevel,
  splitMarkdownIntoChapters,
} from "../../features/editor/ebookChapters";
import {
  patchDocumentViewState,
  pruneDocumentViewStates,
  rekeyDocumentViewState,
  type DocumentViewStateRegistry,
  type EditorViewStatePatch,
  type PreviewViewState,
} from "../../features/editor/documentViewState";
import { getWorkspaceTabMarkerPaths } from "../../features/editor/editorTabs";
import type {
  LModeCopy,
  SafeEditorCopy,
  SidePaneCopy,
  SlashMenuCopy,
} from "../../lib/locale";
import type {
  AgentWorkbenchOutputChunk,
  AgentWorkbenchProvider,
  AgentWorkbenchSession,
  WorkspaceTreeEntry,
} from "../../lib/tauri";
import type {
  AgentLaunchGateState,
  AgentTerminalSize,
  AppleAssistGenerationLock,
  BaseTheme,
  CompareAnchor,
  CompareCase,
  CompareViewState,
  EditorSettings,
  EditorTab,
  ImagePreviewState,
  MarkdownHeading,
  MarkdownHeadingContext,
  MenuLanguage,
  ResolvedTheme,
  RightPaneMode,
  TextMatch,
} from "../../types";
import {
  MAX_PREVIEW_COLUMN_PERCENT,
  MIN_PREVIEW_COLUMN_PERCENT,
} from "../../types";
import { ReferenceTextPane } from "../reference/ReferenceTextPane";
import type { ReferenceCompareState } from "../../features/referenceCompare/types";
import type { ReferenceCompareCopy } from "../../lib/locale/referenceCompare";
import type { ReferenceNarrowFocus } from "../../features/referenceCompare/types";

const EBookPane = lazy(() => import("../editor/preview/EBookPane"));

type AppWorkspaceProps = {
  activeContents: string;
  activeDocumentLineCount: number;
  activeMatchIndex: number;
  activeTab: EditorTab | null;
  agentLaunchGate: AgentLaunchGateState;
  agentOutput: AgentWorkbenchOutputChunk[];
  agentSession: AgentWorkbenchSession | null;
  agentStopPending: boolean;
  agentWorkbenchProvider: AgentWorkbenchProvider;
  appleAssistGenerationLock?: AppleAssistGenerationLock | null;
  clearCompareSource: () => void;
  clearCompareTarget: () => void;
  closeCompareView: (options?: { returnToEditor?: boolean }) => void;
  closeReferenceCompare: () => void;
  compareAnchor: CompareAnchor | null;
  compareTarget: CompareAnchor | null;
  compareView: CompareViewState | null;
  createFile: (parentPath: string) => Promise<void> | void;
  createFolder: (parentPath: string) => Promise<void> | void;
  createNewFile: () => unknown;
  currentHeadingLine: number | null;
  documentHeadings: MarkdownHeading[];
  documentKey: string;
  editorPaneRef: RefObject<EditorPaneHandle | null>;
  editorPreviewGridRef: RefObject<HTMLDivElement | null>;
  editorPreviewGridStyle: CSSProperties | undefined;
  editorSettings: EditorSettings;
  editorTheme: BaseTheme;
  fileOpsCopy: import("../../lib/locale").WorkspaceFileOpsCopy;
  findMatches: TextMatch[];
  getCompareCaseByKey: (caseKey: string) => CompareCase | undefined;
  handleEditorChange: (nextValue: string) => void;
  handlePasteImage: (
    dataBase64: string,
    fileName: string,
  ) => Promise<string | null>;
  handlePresetPrompt: (prompt: string) => void;
  handlePreviewResizeKeyDown: (
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) => void;
  handlePreviewResizePointerDown: (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => void;
  handlePreviewResizePointerMove: (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => void;
  handleSendSelectionToAgent: (text: string) => void;
  hasWorkspaceSelection: boolean;
  jumpToHeading: (heading: MarkdownHeading) => void;
  onApplyBackup?: (documentPath: string, backupContents: string) => void;
  loadWorkspaceDirectory: (path: string) => Promise<void>;
  lModeCopy: LModeCopy;
  menuLanguage: MenuLanguage;
  onMoveEntry: (srcPath: string, dstParentPath: string) => void;
  onMoveToTrash: (path: string, name: string, isDirectory: boolean) => void;
  onSubmitRename: (srcPath: string, newName: string) => void;
  onWorkspaceSidebarCollapsedChange?: (collapsed: boolean) => void;
  requestRename: (path: string) => void;
  renamingPath: string | null;
  restoreComplete: boolean;
  openFile: () => unknown;
  openFilePath: (path: string) => unknown;
  openPreviewMarkdownLink: (path: string) => void | Promise<void>;
  openReferenceFile: () => void | Promise<void>;
  openWorkspace: () => unknown;
  openWorkspaceContextMenu: (
    entry: WorkspaceTreeEntry,
    event: ReactMouseEvent<HTMLButtonElement>,
    kind: "file" | "directory" | "root",
  ) => void;
  openRootWorkspaceContextMenu: (event: ReactMouseEvent<HTMLDivElement>) => void;
  openWorkspaceFile: (path: string) => unknown;
  previewColumnPercent: number;
  previewPaneRef: RefObject<HTMLDivElement | null>;
  previewVisible: boolean;
  referenceColumnPercent: number;
  referenceCompare: ReferenceCompareState | null;
  referenceCopy: ReferenceCompareCopy;
  referenceNarrowFocus: ReferenceNarrowFocus;
  resolvedTheme: ResolvedTheme;
  runSelectedFileCompare: () => void;
  safeEditorCopy: SafeEditorCopy;
  setReferenceColumnPercent: (value: number) => void;
  setReferenceNarrowFocus: (focus: ReferenceNarrowFocus) => void;
  scrollHudContext: MarkdownHeadingContext;
  scrollHudLine: number;
  scrollHudVisible: boolean;
  selectedImage: ImagePreviewState | null;
  selectWorkspaceCompareFile: (entry: WorkspaceTreeEntry) => void;
  setSelectionInfo: (selection: EditorSelectionInfo) => void;
  sidePaneCopy: SidePaneCopy;
  slashCommands: import("../../types/slash").SlashCommand[];
  slashMenuCopy: SlashMenuCopy;
  sidePaneMode: RightPaneMode | null;
  sidePaneVisible: boolean;
  syncEditorScroll: () => void;
  syncPreviewScroll: (ratio: number) => void;
  tabs: readonly EditorTab[];
  onCheckAgentGate: () => void;
  onOpenAgentWindow: () => void;
  onResumeAgentUiRefresh: () => void;
  onResizeAgentTerminal: (size: AgentTerminalSize) => void;
  onSendAgentTerminalData: (data: string) => void;
  onStopAgentSession: () => void;
  onSuspendAgentUiRefresh: () => void;
  outlineTruncated: boolean;
  workspaceRootPath: string | null;
  workspaceSidebarCollapsedOverride?: boolean;
  workspaceTree: WorkspaceTreeEntry | null;
};

export function AppWorkspace({
  activeContents,
  activeDocumentLineCount,
  activeMatchIndex,
  activeTab,
  agentLaunchGate,
  agentOutput,
  agentSession,
  agentStopPending,
  agentWorkbenchProvider,
  appleAssistGenerationLock = null,
  clearCompareSource,
  clearCompareTarget,
  closeCompareView,
  closeReferenceCompare,
  compareAnchor,
  compareTarget,
  compareView,
  createFile,
  createFolder,
  createNewFile,
  currentHeadingLine,
  documentHeadings,
  documentKey,
  editorPaneRef,
  editorPreviewGridRef,
  editorPreviewGridStyle,
  editorSettings,
  editorTheme,
  fileOpsCopy,
  findMatches,
  getCompareCaseByKey,
  handleEditorChange,
  handlePasteImage,
  handlePresetPrompt,
  handlePreviewResizeKeyDown,
  handlePreviewResizePointerDown,
  handlePreviewResizePointerMove,
  handleSendSelectionToAgent,
  hasWorkspaceSelection,
  jumpToHeading,
  loadWorkspaceDirectory,
  lModeCopy,
  onApplyBackup,
  menuLanguage,
  onMoveEntry,
  onMoveToTrash,
  onSubmitRename,
  onWorkspaceSidebarCollapsedChange,
  requestRename,
  renamingPath,
  restoreComplete,
  openFile,
  openFilePath,
  openPreviewMarkdownLink,
  openReferenceFile,
  openWorkspace,
  openWorkspaceContextMenu,
  openRootWorkspaceContextMenu,
  openWorkspaceFile,
  previewColumnPercent,
  previewPaneRef,
  previewVisible,
  referenceColumnPercent,
  referenceCompare,
  referenceCopy,
  referenceNarrowFocus,
  resolvedTheme,
  runSelectedFileCompare,
  safeEditorCopy,
  setReferenceColumnPercent,
  setReferenceNarrowFocus,
  scrollHudContext,
  scrollHudLine,
  scrollHudVisible,
  selectedImage,
  selectWorkspaceCompareFile,
  setSelectionInfo,
  sidePaneCopy,
  slashCommands,
  slashMenuCopy,
  sidePaneMode,
  sidePaneVisible,
  syncEditorScroll,
  syncPreviewScroll,
  tabs,
  onCheckAgentGate,
  onOpenAgentWindow,
  onResumeAgentUiRefresh,
  onResizeAgentTerminal,
  onSendAgentTerminalData,
  onStopAgentSession,
  onSuspendAgentUiRefresh,
  outlineTruncated,
  workspaceRootPath,
  workspaceSidebarCollapsedOverride,
  workspaceTree,
}: AppWorkspaceProps) {
  const [internalWorkspaceSidebarCollapsed, setInternalWorkspaceSidebarCollapsed] =
    useState(false);
  const [ebookFocusOpen, setEbookFocusOpen] = useState(false);
  // v1.1 position-continuity: AppWorkspace owns the per-document view state
  // shared by Editor, e-book, and (when real-layout evidence requires it)
  // Preview. Individual panes report patches without owning a parallel map.
  const [documentViewStates, setDocumentViewStates] =
    useState<DocumentViewStateRegistry>({});
  const previousDocumentIdentityRef = useRef<{
    documentKey: string;
    tabSessionId: string;
  } | null>(null);
  const previousSidePaneModeRef = useRef<RightPaneMode | null>(null);
  const workspaceSidebarCollapsed =
    workspaceSidebarCollapsedOverride ?? internalWorkspaceSidebarCollapsed;
  const setWorkspaceSidebarCollapsed = (collapsed: boolean) => {
    if (workspaceSidebarCollapsedOverride === undefined) {
      setInternalWorkspaceSidebarCollapsed(collapsed);
    }
    onWorkspaceSidebarCollapsedChange?.(collapsed);
  };
  const isWorkspaceSidebarCollapsed =
    workspaceSidebarCollapsed && !editorSettings.lModeEnabled;
  const activeDocumentKey = activeTab ? documentViewStateKey(activeTab) : null;
  const previousDocumentIdentity = previousDocumentIdentityRef.current;
  const saveAsPreviousKey =
    activeTab &&
    activeDocumentKey &&
    previousDocumentIdentity?.tabSessionId === activeTab.sessionId &&
    previousDocumentIdentity.documentKey !== activeDocumentKey
      ? previousDocumentIdentity.documentKey
      : null;
  const activeDocumentViewState =
    activeDocumentKey != null
      ? documentViewStates[activeDocumentKey] ??
        (saveAsPreviousKey
          ? documentViewStates[saveAsPreviousKey] ?? null
          : null)
      : null;
  const activeEbookLocation = activeDocumentViewState?.ebook ?? null;
  const editorAnchorLine =
    scrollHudVisible && scrollHudLine > 0 ? scrollHudLine : currentHeadingLine;
  const editorAnchoredEbookLocation =
    editorAnchorLine !== null
      ? getEbookLocationForEditorLine(activeContents, editorAnchorLine)
      : null;
  const enteringEbookPane =
    sidePaneMode === "ebook" && previousSidePaneModeRef.current !== "ebook";
  const initialEbookLocation =
    enteringEbookPane && editorAnchoredEbookLocation
      ? editorAnchoredEbookLocation
      : activeEbookLocation ?? editorAnchoredEbookLocation;
  useEffect(() => {
    if (activeTab && activeDocumentKey) {
      if (saveAsPreviousKey) {
        setDocumentViewStates((current) =>
          rekeyDocumentViewState(
            current,
            saveAsPreviousKey,
            activeDocumentKey,
          ),
        );
      }
      previousDocumentIdentityRef.current = {
        documentKey: activeDocumentKey,
        tabSessionId: activeTab.sessionId,
      };
      return;
    }

    previousDocumentIdentityRef.current = null;
  }, [activeDocumentKey, activeTab, saveAsPreviousKey]);
  useEffect(() => {
    previousSidePaneModeRef.current = sidePaneMode;
  }, [sidePaneMode]);
  useEffect(() => {
    const keepDocumentKeys = tabs.map(documentViewStateKey);
    if (
      activeDocumentKey &&
      !keepDocumentKeys.includes(activeDocumentKey)
    ) {
      keepDocumentKeys.push(activeDocumentKey);
    }
    setDocumentViewStates((current) =>
      pruneDocumentViewStates(current, keepDocumentKeys),
    );
  }, [activeDocumentKey, tabs]);
  const handleEbookLocationChange = (location: EBookReaderLocation) => {
    if (!activeDocumentKey) {
      return;
    }
    setDocumentViewStates((current) =>
      patchDocumentViewState(current, activeDocumentKey, {
        ebook: location,
      }),
    );
  };
  const handleEditorViewStateChange = (patch: EditorViewStatePatch) => {
    if (!activeDocumentKey) {
      return;
    }
    setDocumentViewStates((current) =>
      patchDocumentViewState(current, activeDocumentKey, {
        editor: patch,
      }),
    );
  };
  const handlePreviewViewStateChange = (state: PreviewViewState) => {
    if (!activeDocumentKey) {
      return;
    }
    setDocumentViewStates((current) =>
      patchDocumentViewState(current, activeDocumentKey, {
        preview: state,
      }),
    );
  };
  const moveEditorToEbookLocation = (
    location: EBookReaderLocation | null,
    options?: { focus?: boolean },
  ) => {
    if (!location) {
      return;
    }
    const editorLine = getEditorLineForEbookLocation(activeContents, location);
    if (editorLine !== null) {
      // While reading in the side pane, paging the e-book must not yank
      // focus back to the editor on every turn; the reader keeps keyboard
      // focus so arrow-key flipping stays responsive. Closing reading
      // focus still focuses the editor (default) because the user is
      // returning to edit.
      editorPaneRef.current?.goToLine(editorLine, {
        focus: options?.focus ?? false,
      });
    }
  };
  const handleSidePaneEbookLocationChange = (
    location: EBookReaderLocation,
  ) => {
    handleEbookLocationChange(location);
    moveEditorToEbookLocation(location);
  };
  const openEbookReadingFocus = (location: EBookReaderLocation) => {
    handleEbookLocationChange(location);
    setEbookFocusOpen(true);
  };
  const closeEbookReadingFocus = (location?: EBookReaderLocation) => {
    const returnLocation = location ?? activeEbookLocation;
    if (returnLocation) {
      handleEbookLocationChange(returnLocation);
    }
    setEbookFocusOpen(false);
    moveEditorToEbookLocation(returnLocation, { focus: true });
  };
  const ebookReadingFocusActive =
    ebookFocusOpen && activeTab !== null && previewVisible && selectedImage === null;
  const workspaceTabMarkers = useMemo(
    () => getWorkspaceTabMarkerPaths(tabs, workspaceRootPath),
    [tabs, workspaceRootPath],
  );

  return (
    <section
      className={`workspace${isWorkspaceSidebarCollapsed ? " workspace-sidebar-collapsed" : ""}${ebookReadingFocusActive ? " workspace-reading-focus" : ""}`}
    >
      {isWorkspaceSidebarCollapsed ? (
        <div className="workspace-sidebar-rail">
          <button
            aria-label={safeEditorCopy.restoreWorkspaceSidebar}
            className="workspace-restore-button"
            onClick={() => setWorkspaceSidebarCollapsed(false)}
            title={safeEditorCopy.restoreWorkspaceSidebar}
            type="button"
          >
            <PanelLeftOpenIcon />
          </button>
        </div>
      ) : (
        <WorkspaceSidebar
          activePath={selectedImage?.path ?? activeTab?.path ?? null}
          compareSelectionEnabled={sidePaneMode === "compare"}
          compareSourcePath={compareAnchor?.path ?? null}
          compareTargetPath={compareTarget?.path ?? null}
          copy={safeEditorCopy}
          dirtyFilePaths={workspaceTabMarkers.dirtyFilePaths}
          fileOpsCopy={fileOpsCopy}
          onCollapse={
            editorSettings.lModeEnabled
              ? undefined
              : () => setWorkspaceSidebarCollapsed(true)
          }
          onCreateFile={() => {
            if (workspaceRootPath) {
              void createFile(workspaceRootPath);
            }
          }}
          onCreateFolder={() => {
            if (workspaceRootPath) {
              void createFolder(workspaceRootPath);
            }
          }}
          onLoadDirectory={loadWorkspaceDirectory}
          onMoveEntry={onMoveEntry}
          onMoveToTrash={onMoveToTrash}
          onOpenContextMenu={openWorkspaceContextMenu}
          onOpenRootContextMenu={openRootWorkspaceContextMenu}
          onOpenFile={(path) => void openWorkspaceFile(path)}
          onOpenWorkspace={() => void openWorkspace()}
          openFilePaths={workspaceTabMarkers.openFilePaths}
          onClearCompareSelection={() => {
            clearCompareSource();
            clearCompareTarget();
          }}
          onSelectCompareFile={selectWorkspaceCompareFile}
          onSubmitRename={onSubmitRename}
          renamingPath={renamingPath}
          requestRename={requestRename}
          workspaceRootPath={workspaceRootPath}
          workspaceTree={workspaceTree}
        />
      )}
      <div
        ref={editorPreviewGridRef}
        className={`editor-preview-grid${sidePaneVisible && !referenceCompare ? "" : " preview-hidden"}${hasWorkspaceSelection ? "" : " empty-session"}${sidePaneMode === "compare" ? " diff-workbench" : ""}${referenceCompare ? " reference-compare" : ""}${referenceCompare && referenceNarrowFocus === "reference" ? " reference-focus-ref" : ""}${referenceCompare && referenceNarrowFocus === "editor" ? " reference-focus-editor" : ""}`}
        style={
          referenceCompare
            ? {
                gridTemplateColumns: `minmax(240px, ${referenceColumnPercent}%) 6px minmax(280px, ${100 - referenceColumnPercent}%)`,
              }
            : editorPreviewGridStyle
        }
      >
        {referenceCompare ? (
          <>
            <div className="reference-compare-pane">
              <ReferenceTextPane
                copy={referenceCopy}
                menuLanguage={menuLanguage}
                onClose={closeReferenceCompare}
                onReplace={() => void openReferenceFile()}
                reference={referenceCompare.reference}
                showDiffEnabled={false}
              />
            </div>
            <PaneResizer
              label={referenceCopy.referenceLabel}
              max={MAX_PREVIEW_COLUMN_PERCENT}
              min={MIN_PREVIEW_COLUMN_PERCENT}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft") {
                  event.preventDefault();
                  setReferenceColumnPercent(
                    Math.max(
                      MIN_PREVIEW_COLUMN_PERCENT,
                      referenceColumnPercent - 2,
                    ),
                  );
                } else if (event.key === "ArrowRight") {
                  event.preventDefault();
                  setReferenceColumnPercent(
                    Math.min(
                      MAX_PREVIEW_COLUMN_PERCENT,
                      referenceColumnPercent + 2,
                    ),
                  );
                }
              }}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                const grid = editorPreviewGridRef.current;
                if (!grid) return;
                const rect = grid.getBoundingClientRect();
                const percent = ((event.clientX - rect.left) / rect.width) * 100;
                setReferenceColumnPercent(
                  Math.min(
                    MAX_PREVIEW_COLUMN_PERCENT,
                    Math.max(MIN_PREVIEW_COLUMN_PERCENT, percent),
                  ),
                );
              }}
              onPointerMove={(event) => {
                if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
                  return;
                }
                const grid = editorPreviewGridRef.current;
                if (!grid) return;
                const rect = grid.getBoundingClientRect();
                const percent = ((event.clientX - rect.left) / rect.width) * 100;
                setReferenceColumnPercent(
                  Math.min(
                    MAX_PREVIEW_COLUMN_PERCENT,
                    Math.max(MIN_PREVIEW_COLUMN_PERCENT, percent),
                  ),
                );
              }}
              title={referenceCopy.referenceLabel}
              value={referenceColumnPercent}
            />
            {referenceCompare ? (
              <div className="reference-narrow-switch" role="toolbar">
                <button
                  type="button"
                  className={
                    referenceNarrowFocus === "reference" ? "is-active" : ""
                  }
                  onClick={() => setReferenceNarrowFocus("reference")}
                >
                  {referenceCopy.showReference}
                </button>
                <button
                  type="button"
                  className={
                    referenceNarrowFocus === "editor" ? "is-active" : ""
                  }
                  onClick={() => setReferenceNarrowFocus("editor")}
                >
                  {referenceCopy.showEditor}
                </button>
              </div>
            ) : null}
          </>
        ) : null}
        <div className="reference-editor-host">
          <EditorMainPane
            activeContents={activeContents}
            activeDocumentLineCount={activeDocumentLineCount}
            activeSearchMatchIndex={activeMatchIndex}
            activeTab={activeTab}
            copy={safeEditorCopy}
            documentKey={documentKey}
            editorSessionKey={activeTab?.sessionId ?? documentKey}
            editorPaneRef={editorPaneRef}
            editorSettings={editorSettings}
            editorTheme={editorTheme}
            editorViewState={activeDocumentViewState?.editor ?? null}
            generationLock={appleAssistGenerationLock}
            imagePreviewTitle={sidePaneCopy.imagePreview}
            lModeCopy={lModeCopy}
            menuLanguage={menuLanguage}
            onChange={handleEditorChange}
            onEditorViewStateChange={handleEditorViewStateChange}
            onNewFile={() => void createNewFile()}
            onOpenFile={() => void openFile()}
            onOpenFolder={() => void openWorkspace()}
            onPasteImage={handlePasteImage}
            onScrollRatioChange={syncPreviewScroll}
            onSelectionChange={setSelectionInfo}
            onSendToAgent={handleSendSelectionToAgent}
            restoreComplete={restoreComplete}
            scrollHudContext={scrollHudContext}
            scrollHudLine={scrollHudLine}
            scrollHudVisible={scrollHudVisible}
            searchMatches={findMatches}
            selectedImage={selectedImage}
            slashCommands={slashCommands}
            slashMenuCopy={slashMenuCopy}
            workspaceRootPath={workspaceRootPath}
          />
          {!activeTab && referenceCompare ? (
            <p className="reference-empty-editor-hint" role="status">
              {referenceCopy.emptyEditorHint}
            </p>
          ) : null}
        </div>
        {sidePaneVisible && !referenceCompare ? (
          <PaneResizer
            label={sidePaneCopy.resizeColumns}
            max={MAX_PREVIEW_COLUMN_PERCENT}
            min={MIN_PREVIEW_COLUMN_PERCENT}
            onKeyDown={handlePreviewResizeKeyDown}
            onPointerDown={handlePreviewResizePointerDown}
            onPointerMove={handlePreviewResizePointerMove}
            title={sidePaneCopy.resizeColumnsTitle}
            value={previewColumnPercent}
          />
        ) : null}
        {sidePaneMode && !referenceCompare ? (
          <SidePane
            activeContents={activeContents}
            activeTab={activeTab}
            compareSource={compareAnchor}
            compareTarget={compareTarget}
            compareView={compareView}
            copy={sidePaneCopy}
            getCompareCaseByKey={getCompareCaseByKey}
            currentHeadingLine={currentHeadingLine}
            documentHeadings={documentHeadings}
            menuLanguage={menuLanguage}
            onClearCompareSource={clearCompareSource}
            onClearCompareTarget={clearCompareTarget}
            onApplyBackup={onApplyBackup}
            onCloseCompareView={closeCompareView}
            ebookLocation={initialEbookLocation}
            onEbookLocationChange={handleSidePaneEbookLocationChange}
            onOpenEbookReadingFocus={openEbookReadingFocus}
            onOpenPreviewLocalLink={openPreviewMarkdownLink}
            onPreviewScroll={syncEditorScroll}
            onPreviewViewStateChange={handlePreviewViewStateChange}
            onRunSelectedFileCompare={runSelectedFileCompare}
            onSelectHeading={jumpToHeading}
            outlineTruncated={outlineTruncated}
            previewPaneRef={previewPaneRef}
            previewViewState={activeDocumentViewState?.preview ?? null}
            previewVisible={previewVisible}
            sidePaneMode={sidePaneMode}
            workspaceRootPath={workspaceRootPath}
          />
        ) : null}
      </div>
      {ebookReadingFocusActive && activeTab ? (
        <div
          aria-label={sidePaneCopy.ebookReading}
          className="ebook-reading-focus-surface"
        >
          <Suspense fallback={null}>
            <EBookPane
              documentKey={activeDocumentKey ?? undefined}
              documentPath={activeTab.path}
              initialLocation={initialEbookLocation}
              menuLanguage={menuLanguage}
              onExitReadingFocus={closeEbookReadingFocus}
              onLocationChange={handleEbookLocationChange}
              onOpenLocalLink={openPreviewMarkdownLink}
              readingFocusActive
              source={activeContents}
              workspaceRoot={
                workspaceRootPath ??
                (activeTab.path ? activeTab.path.replace(/\/[^/]+$/, "") : null)
              }
            />
          </Suspense>
        </div>
      ) : null}
    </section>
  );
}

function documentViewStateKey(tab: EditorTab): string {
  return tab.path || tab.id;
}

function getEbookLocationForEditorLine(
  source: string,
  line: number,
): EBookReaderLocation {
  // Use the same H1/H2 coalescing as the reader so chapter indices line up
  // across the editor line bridge and the EBookPane.
  const chapters = coalesceChaptersToTopLevel(splitMarkdownIntoChapters(source));
  let chapterIndex = 0;

  for (const chapter of chapters) {
    if (chapter.startLine > line) {
      break;
    }
    chapterIndex = chapter.index;
  }

  return {
    chapterIndex,
    pageIndex: 0,
  };
}

function getEditorLineForEbookLocation(
  source: string,
  location: EBookReaderLocation,
): number | null {
  if (
    location.sourceLine !== undefined &&
    Number.isFinite(location.sourceLine)
  ) {
    return Math.max(1, Math.trunc(location.sourceLine));
  }

  // Use the same H1/H2 coalescing as the reader so chapter indices line up
  // across the editor line bridge and the EBookPane.
  const chapters = coalesceChaptersToTopLevel(splitMarkdownIntoChapters(source));
  const chapter =
    chapters[Math.min(Math.max(location.chapterIndex, 0), chapters.length - 1)];
  return chapter?.startLine ?? null;
}
