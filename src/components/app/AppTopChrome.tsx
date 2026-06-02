import type { PointerEvent as ReactPointerEvent } from "react";
import { DocumentMetaBar } from "./DocumentMetaBar";
import { TabBar } from "../editor/TabBar";
import type {
  RecoveryCopy,
  SidePaneCopy,
} from "../../lib/locale";
import type {
  EditorTab,
  RightPaneMode,
} from "../../types";

type AppTopChromeProps = {
  activeDirty: boolean;
  activeTab: EditorTab | null;
  activeTabId: string | null;
  draggingTabId: string | null;
  dragOverTabId: string | null;
  emptyTabsLabel: string;
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
  onToggleDiff: () => void;
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
  draggingTabId,
  dragOverTabId,
  emptyTabsLabel,
  onCloseTab,
  onFinishTabPointerDrag,
  onPointerEnter,
  onReviewChanges,
  onSelectTab,
  onTabPointerDown,
  onTabPointerMove,
  onToggleDiff,
  onToggleOutline,
  onTogglePreview,
  recoveryCopy,
  shouldSuppressTabClick,
  sidePaneCopy,
  sidePaneMode,
  tabs,
}: AppTopChromeProps) {
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
      onTabPointerDown={onTabPointerDown}
      onTabPointerMove={onTabPointerMove}
      shouldSuppressTabClick={shouldSuppressTabClick}
      tabs={tabs}
    >
      <DocumentMetaBar
        activeDirty={activeDirty}
        activeTab={activeTab}
        diffPaneActive={sidePaneMode === "compare"}
        onReviewChanges={onReviewChanges}
        onToggleDiff={onToggleDiff}
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
