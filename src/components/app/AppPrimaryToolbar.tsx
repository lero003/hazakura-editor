import type { ComponentProps } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isJapaneseMenuLanguage, type MenuLanguage, type AssistSurfacePreference } from "../../types";
import type { AppleAssistAvailability } from "../../lib/tauri";
import type { RightPaneToggleCopy } from "./RightPaneToggleControls";
import { appleAssistButtonTitle } from "./DocumentMetaBar";
import { isDeveloperDistributionLane } from "../../lib/distributionLane";
import { toggleWindowZoom } from "../../features/workspace/windowZoom";
import { AgentWindowIcon, SparklesIcon } from "./Icons";
import { WorkspaceModeNavigation } from "./WorkspaceModeNavigation";

export function AppPrimaryToolbar({ documentName, workspaceName, menuLanguage, navigation,
  canSave, saving, onSave, assistSurfaceActive,
  agentWorkbenchAvailable, appleAssistAvailability, appleAssistAvailabilityProbed,
  sidePaneCopy, onOpenAppleAssistWindow, onOpenAgentWindow }: {
  documentName: string;
  workspaceName: string;
  menuLanguage: MenuLanguage;
  navigation: ComponentProps<typeof WorkspaceModeNavigation>;
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
  /** 操作部品の上では、ドラッグもダブルクリックのズームも起こさない。 */
  const isInteractiveTarget = (target: EventTarget | null) =>
    target instanceof HTMLElement && target.closest("button, [role=group]") !== null;
  return <header className="app-primary-toolbar" data-tauri-drag-region="true"
    onDoubleClick={(event) => {
      // macOS のタイトルバーと同じく、ダブルクリックは「最大化」。フルスクリーンにはしない。
      if (!isInteractiveTarget(event.target)) toggleWindowZoom();
    }}
    onMouseDown={(event) => {
      if (event.button === 0 && !isInteractiveTarget(event.target)) {
        void getCurrentWindow().startDragging().catch(() => {});
      }
    }}>
    {/* サイドバーの開閉はサイドバー自身の折りたたみ（畳んだ後は左端のレール）に一本化した。
        ここに置くと、ロゴの場所に開閉ボタンがあるように見えて用途が読めない（実機指摘）。 */}
    <div className="primary-document-identity">
      <div className="primary-document-name"><strong title={documentName}>{documentName}</strong>
        {/* 副題は開いているフォルダ名。無いときは何も出さない（製品名をここへ
            繰り返すと上段と下段で同じ文字列が二度並ぶ）。 */}
        {workspaceName ? <small title={workspaceName}>{workspaceName}</small> : null}</div>
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
