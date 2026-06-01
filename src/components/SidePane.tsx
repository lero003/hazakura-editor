import type { RefObject } from "react";
import type { SidePaneCopy } from "../locale";
import type {
  AgentLaunchGateState,
  AgentTerminalSize,
  CompareAnchor,
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
  menuLanguage: MenuLanguage;
  onCheckAgentGate: () => void;
  onClearCompareSource: () => void;
  onClearCompareTarget: () => void;
  onCloseCompareView: () => void;
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
  menuLanguage,
  onCheckAgentGate,
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
  return (
    <div
      className="pane preview-pane"
      ref={sidePaneMode === "preview" ? previewPaneRef : null}
      aria-label={sidePaneAriaLabel(sidePaneMode, copy)}
      onScroll={sidePaneMode === "preview" ? onPreviewScroll : undefined}
    >
      {sidePaneMode === "compare" && compareView ? (
        <DiffPane
          menuLanguage={menuLanguage}
          view={compareView}
          onClose={onCloseCompareView}
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
