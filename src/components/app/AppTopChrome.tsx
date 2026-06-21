import type {
  Dispatch,
  PointerEvent as ReactPointerEvent,
  SetStateAction,
} from "react";
import { DocumentMetaBar } from "./DocumentMetaBar";
import { EditorQuickSettingsMenu } from "./EditorQuickSettingsMenu";
import { TabBar } from "../editor/TabBar";
import type {
  LModeCopy,
  RecoveryCopy,
  ReviewDeskCopy,
  SidePaneCopy,
} from "../../lib/locale";
import type {
  EditorTab,
  EditorSettings,
  ImagePreviewState,
  MenuLanguage,
  RightPaneMode,
  AssistSurfacePreference,
  ReviewSurface,
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
  editorSettings: EditorSettings;
  lModeEnabled: boolean;
  lModeCopy: LModeCopy;
  menuLanguage: MenuLanguage;
  onCloseTab: (tabId: string) => void;
  onCloseSelectedImagePreview: () => void;
  onEditorSettingsChange: Dispatch<SetStateAction<EditorSettings>>;
  onFinishTabPointerDrag: (target?: EventTarget | null) => void;
  onOpenAgentWindow: () => void;
  onOpenAppleAssistWindow: () => void;
  onOpenReviewDesk: () => void;
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
  onToggleEbook: () => void;
  onToggleLMode: () => void;
  onToggleOutline: () => void;
  onTogglePreview: () => void;
  recoveryCopy: RecoveryCopy;
  reviewDeskCopy: ReviewDeskCopy;
  reviewSurface: ReviewSurface;
  shouldSuppressTabClick: () => boolean;
  sidePaneCopy: SidePaneCopy;
  sidePaneMode: RightPaneMode | null;
  selectedImage: ImagePreviewState | null;
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
  editorSettings,
  lModeEnabled,
  lModeCopy,
  menuLanguage,
  onCloseTab,
  onCloseSelectedImagePreview,
  onEditorSettingsChange,
  onFinishTabPointerDrag,
  onOpenAgentWindow,
  onOpenAppleAssistWindow,
  onOpenReviewDesk,
  onPointerEnter,
  onReviewChanges,
  onSelectTab,
  onTabContextMenu,
  onTabPointerDown,
  onTabPointerMove,
  onToggleDiff,
  onToggleEbook,
  onToggleLMode,
  onToggleOutline,
  onTogglePreview,
  recoveryCopy,
  reviewDeskCopy,
  reviewSurface,
  shouldSuppressTabClick,
  sidePaneCopy,
  sidePaneMode,
  selectedImage,
  tabs,
}: AppTopChromeProps) {
  const showDevBadge = !lModeEnabled && isDeveloperDistributionLane();

  return (
    <TabBar
      activeTabId={activeTabId}
      draggingTabId={draggingTabId}
      dragOverTabId={dragOverTabId}
      emptyTabsLabel={emptyTabsLabel}
      leadingControl={
        lModeEnabled ? null : (
          <EditorQuickSettingsMenu
            editorSettings={editorSettings}
            menuLanguage={menuLanguage}
            onEditorSettingsChange={onEditorSettingsChange}
          />
        )
      }
      onCloseTab={onCloseTab}
      onCloseSelectedImagePreview={onCloseSelectedImagePreview}
      onFinishTabPointerDrag={onFinishTabPointerDrag}
      onPointerEnter={onPointerEnter}
      onSelectTab={onSelectTab}
      onTabContextMenu={onTabContextMenu}
      onTabPointerDown={onTabPointerDown}
      onTabPointerMove={onTabPointerMove}
      shouldSuppressTabClick={shouldSuppressTabClick}
      selectedImage={selectedImage}
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
        ebookAvailable={activeTab !== null && selectedImage === null}
        ebookPaneActive={sidePaneMode === "ebook"}
        lModeCopy={lModeCopy}
        lModeEnabled={lModeEnabled}
        onOpenAgentWindow={onOpenAgentWindow}
        onOpenAppleAssistWindow={onOpenAppleAssistWindow}
        onOpenReviewDesk={onOpenReviewDesk}
        onReviewChanges={onReviewChanges}
        onToggleDiff={onToggleDiff}
        onToggleEbook={onToggleEbook}
        onToggleLMode={onToggleLMode}
        onToggleOutline={onToggleOutline}
        onTogglePreview={onTogglePreview}
        outlinePaneActive={sidePaneMode === "outline"}
        previewPaneActive={sidePaneMode === "preview"}
        recoveryReviewChangesLabel={recoveryCopy.reviewChanges}
        reviewDeskActive={reviewSurface === "review"}
        reviewDeskCopy={reviewDeskCopy}
        sidePaneCopy={sidePaneCopy}
      />
    </TabBar>
  );
}
