import {
  RightPaneToggleControls,
  type RightPaneToggleCopy,
} from "./RightPaneToggleControls";
import { AgentWindowIcon, SparklesIcon } from "./Icons";
import type { AssistSurfacePreference, EditorTab } from "../../types";

type DocumentMetaBarProps = {
  activeDirty: boolean;
  activeTab: EditorTab | null;
  agentWorkbenchAvailable: boolean;
  assistSurfaceActive: AssistSurfacePreference;
  diffPaneActive: boolean;
  lModeEnabled: boolean;
  onOpenAgentWindow: () => void;
  onOpenAppleAssistWindow: () => void;
  onReviewChanges: (tab: EditorTab) => void;
  onToggleDiff: () => void;
  onToggleOutline: () => void;
  onTogglePreview: () => void;
  outlinePaneActive: boolean;
  previewPaneActive: boolean;
  recoveryReviewChangesLabel: string;
  sidePaneCopy: RightPaneToggleCopy;
};

export function DocumentMetaBar({
  activeDirty,
  activeTab,
  agentWorkbenchAvailable,
  assistSurfaceActive,
  diffPaneActive,
  lModeEnabled,
  onOpenAgentWindow,
  onOpenAppleAssistWindow,
  onReviewChanges,
  onToggleDiff,
  onToggleOutline,
  onTogglePreview,
  outlinePaneActive,
  previewPaneActive,
  recoveryReviewChangesLabel,
  sidePaneCopy,
}: DocumentMetaBarProps) {
  const showDocumentSection = activeTab !== null && !lModeEnabled;
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
      <section className="chrome-section" aria-label={sidePaneCopy.sidePaneMode}>
        <RightPaneToggleControls
          copy={sidePaneCopy}
          diffActive={diffPaneActive}
          diffAvailable
          onToggleDiff={onToggleDiff}
          onToggleOutline={onToggleOutline}
          onTogglePreview={onTogglePreview}
          outlineActive={outlinePaneActive}
          outlineAvailable={activeTab !== null}
          previewActive={previewPaneActive}
        />
      </section>
      {showDocumentSection ? (
        <>
          <span className="chrome-divider" aria-hidden="true" />
          <section className="chrome-section" aria-label={recoveryReviewChangesLabel}>
            {activeDirty && activeTab ? (
              <button
                className="review-changes-button"
                onClick={() => onReviewChanges(activeTab)}
                type="button"
              >
                <span className="review-changes-dot" aria-hidden="true" />
                {recoveryReviewChangesLabel}
              </button>
            ) : null}
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
