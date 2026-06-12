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
  ImagePreviewState,
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
  newFileLabel?: string;
  onCloseTab: (tabId: string) => void;
  onCloseSelectedImagePreview: () => void;
  onCreateNewFile?: () => void;
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
  onToggleWorkspaceSidebar?: () => void;
  recoveryCopy: RecoveryCopy;
  shouldSuppressTabClick: () => boolean;
  sidePaneCopy: SidePaneCopy;
  sidePaneMode: RightPaneMode | null;
  selectedImage: ImagePreviewState | null;
  tabs: EditorTab[];
  workspaceSidebarCollapsed?: boolean;
  workspaceSidebarToggleLabel?: string;
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
  newFileLabel,
  onCloseTab,
  onCloseSelectedImagePreview,
  onCreateNewFile,
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
  onToggleWorkspaceSidebar,
  recoveryCopy,
  shouldSuppressTabClick,
  sidePaneCopy,
  sidePaneMode,
  selectedImage,
  tabs,
  workspaceSidebarCollapsed = false,
  workspaceSidebarToggleLabel,
}: AppTopChromeProps) {
  const showDevBadge = isDeveloperDistributionLane();

  return (
    <TabBar
      activeTabId={activeTabId}
      draggingTabId={draggingTabId}
      dragOverTabId={dragOverTabId}
      emptyTabsLabel={emptyTabsLabel}
      newFileLabel={newFileLabel}
      onCloseTab={onCloseTab}
      onCloseSelectedImagePreview={onCloseSelectedImagePreview}
      onCreateNewFile={onCreateNewFile}
      onFinishTabPointerDrag={onFinishTabPointerDrag}
      onPointerEnter={onPointerEnter}
      onSelectTab={onSelectTab}
      onTabContextMenu={onTabContextMenu}
      onTabPointerDown={onTabPointerDown}
      onTabPointerMove={onTabPointerMove}
      shouldSuppressTabClick={shouldSuppressTabClick}
      selectedImage={selectedImage}
      tabs={tabs}
      workspaceSidebarCollapsed={workspaceSidebarCollapsed}
      workspaceSidebarToggleLabel={workspaceSidebarToggleLabel}
      onToggleWorkspaceSidebar={
        lModeEnabled ? undefined : onToggleWorkspaceSidebar
      }
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
