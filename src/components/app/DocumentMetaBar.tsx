import {
  EditingModeControl,
  RightPaneToggleControls,
  type RightPaneToggleCopy,
} from "./RightPaneToggleControls";
import { AgentWindowIcon, SparklesIcon } from "./Icons";
import type { AssistSurfacePreference, EditorTab } from "../../types";
import type { LModeCopy } from "../../lib/locale";

type DocumentMetaBarProps = {
  activeDirty: boolean;
  activeTab: EditorTab | null;
  agentWorkbenchAvailable: boolean;
  assistSurfaceActive: AssistSurfacePreference;
  diffPaneActive: boolean;
  ebookPaneActive: boolean;
  ebookAvailable?: boolean;
  lModeCopy: LModeCopy;
  lModeEnabled: boolean;
  onOpenAgentWindow: () => void;
  onOpenAppleAssistWindow: () => void;
  onReviewChanges: (tab: EditorTab) => void;
  onToggleDiff: () => void;
  onToggleEbook: () => void;
  onToggleLMode: () => void;
  onToggleOutline: () => void;
  onTogglePreview: () => void;
  onToggleReference: () => void;
  outlinePaneActive: boolean;
  previewPaneActive: boolean;
  referencePaneActive: boolean;
  recoveryReviewChangesLabel: string;
  sidePaneCopy: RightPaneToggleCopy;
};

export function DocumentMetaBar({
  activeDirty,
  activeTab,
  agentWorkbenchAvailable,
  assistSurfaceActive,
  diffPaneActive,
  ebookPaneActive,
  ebookAvailable = activeTab !== null,
  lModeCopy,
  lModeEnabled,
  onOpenAgentWindow,
  onOpenAppleAssistWindow,
  onReviewChanges,
  onToggleDiff,
  onToggleEbook,
  onToggleLMode,
  onToggleOutline,
  onTogglePreview,
  onToggleReference,
  outlinePaneActive,
  previewPaneActive,
  referencePaneActive,
  recoveryReviewChangesLabel,
  sidePaneCopy,
}: DocumentMetaBarProps) {
  const showCompanionSection =
    !lModeEnabled &&
    (assistSurfaceActive === "apple-local" ||
      (assistSurfaceActive === "external-cli" && agentWorkbenchAvailable));
  const companionCopy =
    assistSurfaceActive === "apple-local"
      ? {
          icon: <SparklesIcon />,
          label: sidePaneCopy.appleAssistWindow,
          title: sidePaneCopy.appleAssistWindowTitle,
          onClick: onOpenAppleAssistWindow,
        }
      : {
          icon: <AgentWindowIcon />,
          label: sidePaneCopy.agentWindow,
          title: sidePaneCopy.agentWindowTitle,
          onClick: onOpenAgentWindow,
        };

  return (
    <div className="document-meta">
      {!lModeEnabled ? (
        <>
          <section className="chrome-section" aria-label={lModeCopy.paletteCommand}>
            <EditingModeControl
              active={lModeEnabled}
              label={lModeCopy.preferenceLabel}
              onToggle={onToggleLMode}
              title={lModeCopy.paletteCommand}
            />
          </section>
          <span className="chrome-divider" aria-hidden="true" />
          <section className="chrome-section" aria-label={sidePaneCopy.sidePaneMode}>
            <RightPaneToggleControls
              copy={sidePaneCopy}
              diffActive={diffPaneActive}
              diffAvailable
              ebookActive={ebookPaneActive}
              ebookAvailable={ebookAvailable}
              onReviewChanges={() => {
                if (activeTab) {
                  onReviewChanges(activeTab);
                }
              }}
              onToggleDiff={onToggleDiff}
              onToggleEbook={onToggleEbook}
              onToggleOutline={onToggleOutline}
              onTogglePreview={onTogglePreview}
              onToggleReference={onToggleReference}
              outlineActive={outlinePaneActive}
              outlineAvailable={activeTab !== null}
              previewActive={previewPaneActive}
              referenceActive={referencePaneActive}
              reviewChangesAvailable={activeDirty && activeTab !== null}
              reviewChangesLabel={recoveryReviewChangesLabel}
            />
          </section>
        </>
      ) : null}
      {showCompanionSection ? (
        <>
          <span className="chrome-divider" aria-hidden="true" />
          <section
            className="chrome-section chrome-section-right"
            aria-label={companionCopy.title}
          >
            <button
              aria-label={companionCopy.title}
              className="open-agent-window-button"
              onClick={companionCopy.onClick}
              title={companionCopy.title}
              type="button"
            >
              <span className="open-agent-window-icon" aria-hidden="true">
                {companionCopy.icon}
              </span>
              <span className="open-agent-window-caption">
                {companionCopy.label}
              </span>
            </button>
          </section>
        </>
      ) : null}
    </div>
  );
}
