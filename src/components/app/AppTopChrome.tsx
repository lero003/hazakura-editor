import type { PointerEvent as ReactPointerEvent } from "react";
import { DocumentMetaBar } from "./DocumentMetaBar";
import { TabBar } from "../editor/TabBar";
import type {
  LModeCopy,
  RecoveryCopy,
  SidePaneCopy,
} from "../../lib/locale";
import type {
  EditorTab,
  RightPaneMode,
  AssistSurfacePreference,
} from "../../types";
import { isDeveloperDistributionLane } from "../../lib/distributionLane";

type AppTopChromeProps = {
  activeDirty: boolean;
  activeTab: EditorTab | null;
  activeTabId: string | null;
  agentWorkbenchAvailable: boolean;
  assistSurfaceActive: AssistSurfacePreference;
  draggingTabId: string | null;
  dragOverTabId: string | null;
  emptyTabsLabel: string;
  lModeEnabled: boolean;
  lModeCopy: LModeCopy;
  onCloseTab: (tabId: string) => void;
  onFinishTabPointerDrag: (target?: EventTarget | null) => void;
  onOpenAgentWindow: () => void;
  onOpenAppleAssistWindow: () => void;
  onPointerEnter: () => void;
  onReviewChanges: (tab: EditorTab) => void;
  onSelectTab: (tabId: string) => void;
  onTabContextMenu: (
    path: string,
    event: import("react").MouseEvent<HTMLDivElement>,
  ) => void;
  onTabPointerDown: (
    event: ReactPointerEvent<HTMLDivElement>,
    tabId: string,
  ) => void;
  onTabPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onToggleDiff: () => void;
  onToggleLMode: () => void;
  onToggleOutline: () => void;
  onTogglePreview: () => void;
  recoveryCopy: RecoveryCopy;
  shouldSuppressTabClick: () => boolean;
  sidePaneCopy: SidePaneCopy;
  sidePaneMode: RightPaneMode | null;
  tabs: EditorTab[];
};

export function AppTopChrome({
  activeDirty,
  activeTab,
  activeTabId,
  agentWorkbenchAvailable,
  assistSurfaceActive,
  draggingTabId,
  dragOverTabId,
  emptyTabsLabel,
  lModeEnabled,
  lModeCopy,
  onCloseTab,
  onFinishTabPointerDrag,
  onOpenAgentWindow,
  onOpenAppleAssistWindow,
  onPointerEnter,
  onReviewChanges,
  onSelectTab,
  onTabContextMenu,
  onTabPointerDown,
  onTabPointerMove,
  onToggleDiff,
  onToggleLMode,
  onToggleOutline,
  onTogglePreview,
  recoveryCopy,
  shouldSuppressTabClick,
  sidePaneCopy,
  sidePaneMode,
  tabs,
}: AppTopChromeProps) {
  const showDevBadge = isDeveloperDistributionLane();

  return (
    <TabBar
      activeTabId={activeTabId}
      draggingTabId={draggingTabId}
      dragOverTabId={dragOverTabId}
      emptyTabsLabel={emptyTabsLabel}
      onCloseTab={onCloseTab}
      onFinishTabPointerDrag={onFinishTabPointerDrag}
      onPointerEnter={onPointerEnter}
      onSelectTab={onSelectTab}
      onTabContextMenu={onTabContextMenu}
      onTabPointerDown={onTabPointerDown}
      onTabPointerMove={onTabPointerMove}
      shouldSuppressTabClick={shouldSuppressTabClick}
      tabs={tabs}
    >
      {showDevBadge ? (
        <span
          className="distribution-badge distribution-badge-dev"
          title="Developer / GitHub preview build"
        >
          DEV
        </span>
      ) : null}
      <DocumentMetaBar
        activeDirty={activeDirty}
        activeTab={activeTab}
        agentWorkbenchAvailable={agentWorkbenchAvailable}
        assistSurfaceActive={assistSurfaceActive}
        diffPaneActive={sidePaneMode === "compare"}
        lModeCopy={lModeCopy}
        lModeEnabled={lModeEnabled}
        onOpenAgentWindow={onOpenAgentWindow}
        onOpenAppleAssistWindow={onOpenAppleAssistWindow}
        onReviewChanges={onReviewChanges}
        onToggleDiff={onToggleDiff}
        onToggleLMode={onToggleLMode}
        onToggleOutline={onToggleOutline}
        onTogglePreview={onTogglePreview}
        outlinePaneActive={sidePaneMode === "outline"}
        previewPaneActive={sidePaneMode === "preview"}
        recoveryReviewChangesLabel={recoveryCopy.reviewChanges}
        sidePaneCopy={sidePaneCopy}
      />
    </TabBar>
  );
}
