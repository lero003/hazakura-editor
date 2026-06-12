import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from "react";
import { useState } from "react";
import type { EditorPaneHandle, EditorSelectionInfo } from "../editor/EditorPane";
import { EditorMainPane } from "../editor/EditorMainPane";
import { PaneResizer } from "../editor/PaneResizer";
import { SidePane } from "./SidePane";
import { WorkspaceSidebar } from "../workspace/WorkspaceSidebar";
import { PanelLeftOpenIcon } from "./Icons";
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
  clearCompareSource: () => void;
  clearCompareTarget: () => void;
  closeCompareView: (options?: { returnToEditor?: boolean }) => void;
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
  openFile: () => unknown;
  openFilePath: (path: string) => unknown;
  openPreviewMarkdownLink: (path: string) => void | Promise<void>;
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
  resolvedTheme: ResolvedTheme;
  runSelectedFileCompare: () => void;
  safeEditorCopy: SafeEditorCopy;
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
  clearCompareSource,
  clearCompareTarget,
  closeCompareView,
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
  openFile,
  openFilePath,
  openPreviewMarkdownLink,
  openWorkspace,
  openWorkspaceContextMenu,
  openRootWorkspaceContextMenu,
  openWorkspaceFile,
  previewColumnPercent,
  previewPaneRef,
  previewVisible,
  resolvedTheme,
  runSelectedFileCompare,
  safeEditorCopy,
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

  return (
    <section
      className={`workspace${isWorkspaceSidebarCollapsed ? " workspace-sidebar-collapsed" : ""}`}
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
        className={`editor-preview-grid${sidePaneVisible ? "" : " preview-hidden"}${hasWorkspaceSelection ? "" : " empty-session"}${sidePaneMode === "compare" ? " diff-workbench" : ""}`}
        style={editorPreviewGridStyle}
      >
        <EditorMainPane
          activeContents={activeContents}
          activeDocumentLineCount={activeDocumentLineCount}
          activeSearchMatchIndex={activeMatchIndex}
          activeTab={activeTab}
          copy={safeEditorCopy}
          documentKey={documentKey}
          editorPaneRef={editorPaneRef}
          editorSettings={editorSettings}
          editorTheme={editorTheme}
          imagePreviewTitle={sidePaneCopy.imagePreview}
          lModeCopy={lModeCopy}
          menuLanguage={menuLanguage}
          onChange={handleEditorChange}
          onNewFile={() => void createNewFile()}
          onOpenFile={() => void openFile()}
          onOpenFolder={() => void openWorkspace()}
          onPasteImage={handlePasteImage}
          onScrollRatioChange={syncPreviewScroll}
          onSelectionChange={setSelectionInfo}
          onSendToAgent={handleSendSelectionToAgent}
          scrollHudContext={scrollHudContext}
          scrollHudLine={scrollHudLine}
          scrollHudVisible={scrollHudVisible}
          searchMatches={findMatches}
          selectedImage={selectedImage}
          slashCommands={slashCommands}
          slashMenuCopy={slashMenuCopy}
          workspaceRootPath={workspaceRootPath}
        />
        {sidePaneVisible ? (
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
        {sidePaneMode ? (
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
            onOpenPreviewLocalLink={openPreviewMarkdownLink}
            onPreviewScroll={syncEditorScroll}
            onRunSelectedFileCompare={runSelectedFileCompare}
            onSelectHeading={jumpToHeading}
            outlineTruncated={outlineTruncated}
            previewPaneRef={previewPaneRef}
            previewVisible={previewVisible}
            sidePaneMode={sidePaneMode}
            workspaceRootPath={workspaceRootPath}
          />
        ) : null}
      </div>
    </section>
  );
}
