import type { ComponentProps } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isJapaneseMenuLanguage, type MenuLanguage, type AssistSurfacePreference } from "../../types";
import type { AppleAssistAvailability } from "../../lib/tauri";
import type { RightPaneToggleCopy } from "./RightPaneToggleControls";
import { appleAssistButtonTitle } from "./DocumentMetaBar";
import { isDeveloperDistributionLane } from "../../lib/distributionLane";
import { AgentWindowIcon, SparklesIcon, PanelLeftOpenIcon } from "./Icons";
import { WorkspaceModeNavigation } from "./WorkspaceModeNavigation";

export function AppPrimaryToolbar({ documentName, workspaceName, menuLanguage, navigation,
  sidebarCollapsed, onToggleSidebar, canSave, saving, onSave, assistSurfaceActive,
  agentWorkbenchAvailable, appleAssistAvailability, appleAssistAvailabilityProbed,
  sidePaneCopy, onOpenAppleAssistWindow, onOpenAgentWindow }: {
  documentName: string;
  workspaceName: string;
  menuLanguage: MenuLanguage;
  navigation: ComponentProps<typeof WorkspaceModeNavigation>;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  canSave: boolean;
  saving: boolean;
  onSave: () => void;
  assistSurfaceActive: AssistSurfacePreference;
  agentWorkbenchAvailable: boolean;
  appleAssistAvailability?: AppleAssistAvailability;
  appleAssistAvailabilityProbed?: boolean;
  sidePaneCopy: RightPaneToggleCopy;
  onOpenAppleAssistWindow: () => void;
  onOpenAgentWindow: () => void;
}) {
  const ja = isJapaneseMenuLanguage(menuLanguage);
  const apple = assistSurfaceActive === "apple-local";
  const showCompanion = apple || (assistSurfaceActive === "external-cli" && agentWorkbenchAvailable && isDeveloperDistributionLane());
  const companionTitle = apple ? (appleAssistAvailabilityProbed === false ? sidePaneCopy.appleAssistWindowTitle
    : appleAssistButtonTitle(sidePaneCopy.appleAssistWindowTitle, appleAssistAvailability ?? { kind: "unsupported" }, sidePaneCopy))
    : sidePaneCopy.agentWindowTitle;
  return <header className="app-primary-toolbar" data-tauri-drag-region="true" onMouseDown={(event) => {
    if (event.button === 0 && !(event.target as HTMLElement).closest("button, [role=group]")) {
      void getCurrentWindow().startDragging().catch(() => {});
    }
  }}>
    <div className="primary-document-identity">
      <button type="button" className="primary-sidebar-toggle" aria-expanded={!sidebarCollapsed}
        aria-label={ja ? "サイドバーを切り替える" : "Toggle sidebar"} onClick={onToggleSidebar}>
        <PanelLeftOpenIcon />
      </button>
      <div className="primary-document-name"><strong title={documentName}>{documentName}</strong>
        <small title={workspaceName}>{workspaceName || "Hazakura Editor"}</small></div>
      {isDeveloperDistributionLane() && <span className="distribution-badge distribution-badge-dev">DEV</span>}
    </div>
    <WorkspaceModeNavigation {...navigation} />
    <div className="primary-document-actions">
      {showCompanion && <button type="button" className="primary-companion" title={companionTitle}
        aria-label={companionTitle} onClick={apple ? onOpenAppleAssistWindow : onOpenAgentWindow}>
        <span aria-hidden="true">{apple ? <SparklesIcon /> : <AgentWindowIcon />}</span>
        <span>{apple ? "Local Assist" : sidePaneCopy.agentWindow}</span>
      </button>}
      <button type="button" className="primary-save" disabled={!canSave} onClick={onSave}>
        {ja ? (saving ? "保存中…" : "保存") : (saving ? "Saving…" : "Save")}
      </button>
    </div>
  </header>;
}
