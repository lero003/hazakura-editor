import type { PointerEvent as ReactPointerEvent } from "react";
import type { MarkdownFormat } from "./EditorPane";
import { DocumentMetaBar } from "./DocumentMetaBar";
import { TabBar } from "./TabBar";
import type {
  EditorChromeCopy,
  RecoveryCopy,
  ReviewDeskCopy,
  SidePaneCopy,
} from "../locale";
import type {
  EditorTab,
  RightPaneMode,
} from "../types";

type AppTopChromeProps = {
  activeDirty: boolean;
  activeTab: EditorTab | null;
  activeTabId: string | null;
  agentAvailable: boolean;
  agentModeBadge: string | null;
  agentModeBadgePending: boolean;
  agentModeBadgeTitle: string;
  draggingTabId: string | null;
  dragOverTabId: string | null;
  editorChromeCopy: EditorChromeCopy;
  emptyTabsLabel: string;
  onApplyMarkdownFormat: (format: MarkdownFormat) => void;
  onCloseTab: (tabId: string) => void;
  onFinishTabPointerDrag: (target?: EventTarget | null) => void;
  onPointerEnter: () => void;
  onReviewChanges: (tab: EditorTab) => void;
  onSelectTab: (tabId: string) => void;
  onTabPointerDown: (
    event: ReactPointerEvent<HTMLDivElement>,
    tabId: string,
  ) => void;
  onTabPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onToggleAgent: () => void;
  onToggleDiff: () => void;
  onToggleOutline: () => void;
  onTogglePreview: () => void;
  onToggleReviewDesk: () => void;
  recoveryCopy: RecoveryCopy;
  reviewDeskActive: boolean;
  reviewDeskCopy: ReviewDeskCopy;
  shouldSuppressTabClick: () => boolean;
  sidePaneCopy: SidePaneCopy;
  sidePaneMode: RightPaneMode | null;
  tabs: EditorTab[];
};

export function AppTopChrome({
  activeDirty,
  activeTab,
  activeTabId,
  agentAvailable,
  agentModeBadge,
  agentModeBadgePending,
  agentModeBadgeTitle,
  draggingTabId,
  dragOverTabId,
  editorChromeCopy,
  emptyTabsLabel,
  onApplyMarkdownFormat,
  onCloseTab,
  onFinishTabPointerDrag,
  onPointerEnter,
  onReviewChanges,
  onSelectTab,
  onTabPointerDown,
  onTabPointerMove,
  onToggleAgent,
  onToggleDiff,
  onToggleOutline,
  onTogglePreview,
  onToggleReviewDesk,
  recoveryCopy,
  reviewDeskActive,
  reviewDeskCopy,
  shouldSuppressTabClick,
  sidePaneCopy,
  sidePaneMode,
  tabs,
}: AppTopChromeProps) {
  return (
    <TabBar
      activeTabId={activeTabId}
      agentModeBadge={agentModeBadge}
      agentModeBadgePending={agentModeBadgePending}
      agentModeBadgeTitle={agentModeBadgeTitle}
      draggingTabId={draggingTabId}
      dragOverTabId={dragOverTabId}
      emptyTabsLabel={emptyTabsLabel}
      onCloseTab={onCloseTab}
      onFinishTabPointerDrag={onFinishTabPointerDrag}
      onPointerEnter={onPointerEnter}
      onSelectTab={onSelectTab}
      onTabPointerDown={onTabPointerDown}
      onTabPointerMove={onTabPointerMove}
      shouldSuppressTabClick={shouldSuppressTabClick}
      tabs={tabs}
    >
      <DocumentMetaBar
        activeDirty={activeDirty}
        activeTab={activeTab}
        agentAvailable={agentAvailable}
        agentPaneActive={sidePaneMode === "agent"}
        diffPaneActive={sidePaneMode === "compare"}
        markdownQuickActionsCopy={editorChromeCopy}
        onApplyMarkdownFormat={onApplyMarkdownFormat}
        onReviewChanges={onReviewChanges}
        onToggleAgent={onToggleAgent}
        onToggleDiff={onToggleDiff}
        onToggleOutline={onToggleOutline}
        onTogglePreview={onTogglePreview}
        onToggleReviewDesk={onToggleReviewDesk}
        outlinePaneActive={sidePaneMode === "outline"}
        previewPaneActive={sidePaneMode === "preview"}
        recoveryReviewChangesLabel={recoveryCopy.reviewChanges}
        reviewDeskActive={reviewDeskActive}
        reviewDeskCopy={reviewDeskCopy}
        sidePaneCopy={sidePaneCopy}
      />
    </TabBar>
  );
}
