import {
  RightPaneToggleControls,
  type RightPaneToggleCopy,
} from "./RightPaneToggleControls";
import { AgentWindowIcon } from "./Icons";
import type { EditorTab } from "../../types";

type DocumentMetaBarProps = {
  activeDirty: boolean;
  activeTab: EditorTab | null;
  agentWorkbenchAvailable: boolean;
  diffPaneActive: boolean;
  onOpenAgentWindow: () => void;
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
  diffPaneActive,
  onOpenAgentWindow,
  onReviewChanges,
  onToggleDiff,
  onToggleOutline,
  onTogglePreview,
  outlinePaneActive,
  previewPaneActive,
  recoveryReviewChangesLabel,
  sidePaneCopy,
}: DocumentMetaBarProps) {
  const showDocumentSection = activeTab !== null;
  const showAgentSection = agentWorkbenchAvailable;

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
      {showAgentSection ? (
        <>
          <span className="chrome-divider" aria-hidden="true" />
          <section
            className="chrome-section chrome-section-right"
            aria-label={sidePaneCopy.agentWindowTitle}
          >
            <button
              aria-label={sidePaneCopy.agentWindowTitle}
              className="open-agent-window-button"
              onClick={onOpenAgentWindow}
              title={sidePaneCopy.agentWindowTitle}
              type="button"
            >
              <span className="open-agent-window-icon" aria-hidden="true">
                <AgentWindowIcon />
              </span>
              <span className="open-agent-window-caption">{sidePaneCopy.agentWindow}</span>
            </button>
          </section>
        </>
      ) : null}
    </div>
  );
}
