import type { RefObject } from "react";
import type { SidePaneCopy } from "../locale";
import type {
  AgentLaunchGateState,
  AgentTerminalSize,
  CompareAnchor,
  CompareCase,
  CompareViewState,
  EditorTab,
  MarkdownHeading,
  MenuLanguage,
  ResolvedTheme,
  RightPaneMode,
} from "../types";
import type {
  AgentWorkbenchOutputChunk,
  AgentWorkbenchProvider,
  AgentWorkbenchSession,
} from "../tauri";
import { AgentPaneShell } from "./AgentPaneShell";
import { DiffPane } from "./DiffPane";
import { DiffSetupPane } from "./DiffSetupPane";
import { OutlinePane } from "./OutlinePane";
import PreviewPane from "./PreviewPane";
import { PreviewUnavailablePane } from "./PreviewUnavailablePane";

type SidePaneProps = {
  activeContents: string;
  activeTab: EditorTab | null;
  agentGate: AgentLaunchGateState;
  agentOutput: AgentWorkbenchOutputChunk[];
  agentProvider: AgentWorkbenchProvider;
  agentSession: AgentWorkbenchSession | null;
  agentStopPending: boolean;
  compareSource: CompareAnchor | null;
  compareTarget: CompareAnchor | null;
  compareView: CompareViewState | null;
  copy: SidePaneCopy;
  currentHeadingLine: number | null;
  documentHeadings: MarkdownHeading[];
  getCompareCaseByKey: (caseKey: string) => CompareCase | undefined;
  menuLanguage: MenuLanguage;
  onCheckAgentGate: () => void;
  onOpenAgentWindow: () => void;
  onClearCompareSource: () => void;
  onClearCompareTarget: () => void;
  onCloseCompareView: (options?: { returnToEditor?: boolean }) => void;
  onOpenPreviewLocalLink: (path: string) => void | Promise<void>;
  onPresetPrompt: (prompt: string) => void;
  onPreviewScroll: () => void;
  onRunSelectedFileCompare: () => void;
  onSelectHeading: (heading: MarkdownHeading) => void;
  onStopAgentSession: () => void;
  onTerminalData: (data: string) => void;
  onTerminalEngage: () => void;
  onTerminalRelease: () => void;
  onTerminalResize: (size: AgentTerminalSize) => void;
  outlineTruncated: boolean;
  previewPaneRef: RefObject<HTMLDivElement | null>;
  previewVisible: boolean;
  sidePaneMode: RightPaneMode;
  theme: ResolvedTheme;
  workspaceRootPath: string | null;
};

export function SidePane({
  activeContents,
  activeTab,
  agentGate,
  agentOutput,
  agentProvider,
  agentSession,
  agentStopPending,
  compareSource,
  compareTarget,
  compareView,
  copy,
  currentHeadingLine,
  documentHeadings,
  getCompareCaseByKey,
  menuLanguage,
  onCheckAgentGate,
  onOpenAgentWindow,
  onClearCompareSource,
  onClearCompareTarget,
  onCloseCompareView,
  onOpenPreviewLocalLink,
  onPresetPrompt,
  onPreviewScroll,
  onRunSelectedFileCompare,
  onSelectHeading,
  onStopAgentSession,
  onTerminalData,
  onTerminalEngage,
  onTerminalRelease,
  onTerminalResize,
  outlineTruncated,
  previewPaneRef,
  previewVisible,
  sidePaneMode,
  theme,
  workspaceRootPath,
}: SidePaneProps) {
  const compareCase = compareView
    ? getCompareCaseByKey(compareView.caseKey) ?? null
    : null;
  // The right-pane compare route only handles file / changes cases.
  // The manual candidate case is owned by the Review Desk
  // (useReviewDeskState) and never registered with
  // useCompareState, but narrow defensively in case a future
  // slice accidentally adds a candidate case to the right pane.
  const rightPaneCompareCase =
    compareCase && compareCase.kind !== "candidate" ? compareCase : null;

  return (
    <div
      className="pane preview-pane"
      ref={sidePaneMode === "preview" ? previewPaneRef : null}
      aria-label={sidePaneAriaLabel(sidePaneMode, copy)}
      onScroll={sidePaneMode === "preview" ? onPreviewScroll : undefined}
    >
      {sidePaneMode === "compare" && compareView && rightPaneCompareCase ? (
        <DiffPane
          menuLanguage={menuLanguage}
          compareCase={rightPaneCompareCase}
          view={compareView}
          onClose={() =>
            onCloseCompareView({
              returnToEditor: rightPaneCompareCase.kind === "changes",
            })
          }
        />
      ) : sidePaneMode === "compare" ? (
        <DiffSetupPane
          compareSource={compareSource}
          compareTarget={compareTarget}
          onClearSource={onClearCompareSource}
          onClearTarget={onClearCompareTarget}
          onCompare={onRunSelectedFileCompare}
          menuLanguage={menuLanguage}
          workspaceRootPath={workspaceRootPath}
        />
      ) : sidePaneMode === "agent" ? (
        <AgentPaneShell
          gate={agentGate}
          onCheckGate={onCheckAgentGate}
          onOpenAgentWindow={onOpenAgentWindow}
          onStopSession={onStopAgentSession}
          onTerminalData={onTerminalData}
          onTerminalEngage={onTerminalEngage}
          onTerminalRelease={onTerminalRelease}
          onTerminalResize={onTerminalResize}
          onPresetPrompt={onPresetPrompt}
          output={agentOutput}
          provider={agentProvider}
          session={agentSession}
          stopPending={agentStopPending}
          menuLanguage={menuLanguage}
          theme={theme}
          workspaceRootPath={workspaceRootPath}
        />
      ) : sidePaneMode === "outline" ? (
        <OutlinePane
          copy={copy}
          currentHeadingLine={currentHeadingLine}
          headings={documentHeadings}
          onSelect={onSelectHeading}
          truncated={outlineTruncated}
        />
      ) : activeTab && previewVisible ? (
        <PreviewPane
          onOpenLocalLink={onOpenPreviewLocalLink}
          source={activeContents}
          workspaceRoot={
            workspaceRootPath ??
            (activeTab.path ? activeTab.path.replace(/\/[^/]+$/, "") : null)
          }
        />
      ) : (
        <PreviewUnavailablePane
          ariaLabel={copy.previewUnavailable}
          reason={activeTab ? copy.previewDisabled : copy.openTextFileToPreview}
        />
      )}
    </div>
  );
}

function sidePaneAriaLabel(mode: RightPaneMode, copy: SidePaneCopy): string {
  if (mode === "compare") {
    return copy.fileComparison;
  }

  if (mode === "agent") {
    return copy.agentWorkbench;
  }

  if (mode === "outline") {
    return copy.documentOutline;
  }

  return copy.markdownPreview;
}
