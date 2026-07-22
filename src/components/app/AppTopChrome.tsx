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
  SidePaneCopy,
} from "../../lib/locale";
import type {
  EditorTab,
  EditorSettings,
  ImagePreviewState,
  MenuLanguage,
  RightPaneMode,
  AssistSurfacePreference,
} from "../../types";
import type { AppleAssistAvailability } from "../../lib/tauri";
import { isDeveloperDistributionLane } from "../../lib/distributionLane";

type AppTopChromeProps = {
  activeDirty: boolean;
  activeTab: EditorTab | null;
  activeTabId: string | null;
  agentWorkbenchAvailable: boolean;
  appleAssistAvailability?: AppleAssistAvailability;
  appleAssistAvailabilityProbed?: boolean;
  assistSurfaceActive: AssistSurfacePreference;
  closeFileLabel?: (name: string) => string;
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
  onToggleReference: () => void;
  openFileTabsLabel: string;
  openFilesLabel: string;
  recoveryCopy: RecoveryCopy;
  shouldSuppressTabClick: () => boolean;
  sidePaneCopy: SidePaneCopy;
  sidePaneMode: RightPaneMode | null;
  referencePaneVisible: boolean;
  /** Reference session exists even when the column is hidden. */
  referenceLoaded?: boolean;
  selectedImage: ImagePreviewState | null;
  tabs: EditorTab[];
  unsavedFileStateLabel?: string;
};

export function AppTopChrome({
  activeDirty,
  activeTab,
  activeTabId,
  agentWorkbenchAvailable,
  appleAssistAvailability,
  appleAssistAvailabilityProbed,
  assistSurfaceActive,
  closeFileLabel,
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
  onToggleReference,
  openFileTabsLabel,
  openFilesLabel,
  recoveryCopy,
  shouldSuppressTabClick,
  sidePaneCopy,
  sidePaneMode,
  referencePaneVisible,
  referenceLoaded = false,
  selectedImage,
  tabs,
  unsavedFileStateLabel,
}: AppTopChromeProps) {
  const showDevBadge = !lModeEnabled && isDeveloperDistributionLane();

  return (
    <TabBar
      activeTabId={activeTabId}
      closeFileLabel={closeFileLabel}
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
      openFileTabsLabel={openFileTabsLabel}
      openFilesLabel={openFilesLabel}
      unsavedFileStateLabel={unsavedFileStateLabel}
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
        appleAssistAvailability={appleAssistAvailability}
        appleAssistAvailabilityProbed={appleAssistAvailabilityProbed}
        assistSurfaceActive={assistSurfaceActive}
        diffPaneActive={!referencePaneVisible && sidePaneMode === "compare"}
        ebookAvailable={activeTab !== null && selectedImage === null}
        ebookPaneActive={!referencePaneVisible && sidePaneMode === "ebook"}
        lModeCopy={lModeCopy}
        lModeEnabled={lModeEnabled}
        onOpenAgentWindow={onOpenAgentWindow}
        onOpenAppleAssistWindow={onOpenAppleAssistWindow}
        onReviewChanges={onReviewChanges}
        onToggleDiff={onToggleDiff}
        onToggleEbook={onToggleEbook}
        onToggleLMode={onToggleLMode}
        onToggleOutline={onToggleOutline}
        onTogglePreview={onTogglePreview}
        onToggleReference={onToggleReference}
        outlinePaneActive={!referencePaneVisible && sidePaneMode === "outline"}
        previewPaneActive={!referencePaneVisible && sidePaneMode === "preview"}
        referencePaneActive={referencePaneVisible}
        referenceLoaded={referenceLoaded}
        recoveryReviewChangesLabel={recoveryCopy.reviewChanges}
        sidePaneCopy={sidePaneCopy}
      />
    </TabBar>
  );
}
