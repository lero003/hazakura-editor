import {
  MarkdownQuickActions,
  type MarkdownQuickActionsCopy,
} from "./MarkdownQuickActions";
import {
  RightPaneToggleControls,
  type RightPaneToggleCopy,
} from "./RightPaneToggleControls";
import type { EditorTab } from "../types";

type DocumentMetaBarProps = {
  activeDirty: boolean;
  activeTab: EditorTab | null;
  agentAvailable: boolean;
  agentPaneActive: boolean;
  diffPaneActive: boolean;
  markdownQuickActionsCopy: MarkdownQuickActionsCopy;
  onApplyMarkdownFormat: (format: "bold" | "italic" | "code" | "link") => void;
  onReviewChanges: (tab: EditorTab) => void;
  onToggleAgent: () => void;
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
  agentAvailable,
  agentPaneActive,
  diffPaneActive,
  markdownQuickActionsCopy,
  onApplyMarkdownFormat,
  onReviewChanges,
  onToggleAgent,
  onToggleDiff,
  onToggleOutline,
  onTogglePreview,
  outlinePaneActive,
  previewPaneActive,
  recoveryReviewChangesLabel,
  sidePaneCopy,
}: DocumentMetaBarProps) {
  const showMarkdownSection = activeTab !== null;
  const showDocumentSection = activeTab !== null;

  return (
    <div className="document-meta">
      {showMarkdownSection ? (
        <>
          <section className="chrome-section" aria-label={markdownQuickActionsCopy.markdownHelpers}>
            <MarkdownQuickActions
              copy={markdownQuickActionsCopy}
              onApplyMarkdownFormat={onApplyMarkdownFormat}
            />
          </section>
          <span className="chrome-divider" aria-hidden="true" />
        </>
      ) : null}
      <section className="chrome-section" aria-label={sidePaneCopy.sidePaneMode}>
        <RightPaneToggleControls
          agentActive={agentPaneActive}
          agentAvailable={agentAvailable}
          copy={sidePaneCopy}
          diffActive={diffPaneActive}
          diffAvailable
          onToggleAgent={onToggleAgent}
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
          <section className="chrome-section chrome-section-right" aria-label={recoveryReviewChangesLabel}>
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
    </div>
  );
}
