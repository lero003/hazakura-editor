import {
  RightPaneToggleControls,
  type RightPaneToggleCopy,
} from "./RightPaneToggleControls";
import type { EditorTab } from "../../types";

type DocumentMetaBarProps = {
  activeDirty: boolean;
  activeTab: EditorTab | null;
  diffPaneActive: boolean;
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
  diffPaneActive,
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
