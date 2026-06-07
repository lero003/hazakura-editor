import type { RecoveryCopy } from "../../lib/locale";
import type { DraftRecord, EditorTab } from "../../types";

type RecoveryMessagesProps = {
  activeConflict: boolean;
  activeDraft: DraftRecord | null;
  activeError: string | null;
  activeSaveError: boolean;
  activeTab: EditorTab | null;
  copy: RecoveryCopy;
  draftReviewAvailable?: boolean;
  onClearSaveError: (tabId: string) => void;
  onCloseTabWithoutSaving: (tabId: string) => void;
  onDiscardDraft: (draftPath: string) => void;
  onKeepEditingAfterConflict: (tabId: string) => void;
  onReopenTabFromDisk: (tabId: string) => void;
  onRestoreDraft: (draft: DraftRecord) => void;
  onReviewDraftAgainstDisk: (tab: EditorTab, draft: DraftRecord) => void;
  onReviewTabAgainstDisk: (tab: EditorTab) => void;
  onTrySaveAgain: (tabId: string) => void;
};

export function RecoveryMessages({
  activeConflict,
  activeDraft,
  activeError,
  activeSaveError,
  activeTab,
  copy,
  draftReviewAvailable = true,
  onClearSaveError,
  onCloseTabWithoutSaving,
  onDiscardDraft,
  onKeepEditingAfterConflict,
  onReopenTabFromDisk,
  onRestoreDraft,
  onReviewDraftAgainstDisk,
  onReviewTabAgainstDisk,
  onTrySaveAgain,
}: RecoveryMessagesProps) {
  const hasMessage =
    (activeDraft !== null && activeTab !== null) ||
    activeError !== null;

  if (!hasMessage) {
    return null;
  }

  return (
    <div className="message-row">
      {activeDraft && activeTab ? (
        <div className="draft-banner">
          <span className="message-copy">
            {copy.draftAvailable(activeTab.name)}
            <span className="message-detail">
              {copy.savedLocally(activeDraft.updatedAt)}
            </span>
          </span>
          <div className="message-actions" aria-label={copy.draftActions}>
            {draftReviewAvailable ? (
              <button
                type="button"
                onClick={() => onReviewDraftAgainstDisk(activeTab, activeDraft)}
              >
                {copy.reviewChanges}
              </button>
            ) : null}
            <button type="button" onClick={() => onRestoreDraft(activeDraft)}>
              {copy.restoreDraft}
            </button>
            <button
              type="button"
              onClick={() => onDiscardDraft(activeDraft.path)}
            >
              {copy.discardDraft}
            </button>
          </div>
        </div>
      ) : null}
      {activeError ? (
        <div className={activeConflict ? "conflict-banner" : "error-banner"}>
          <span className="message-copy">
            {activeConflict
              ? copy.conflictHeading
              : activeSaveError
                ? copy.saveFailure
                : activeError}
            {activeConflict || activeSaveError ? (
              <span className="message-detail">
                {activeConflict ? copy.conflictDetail : activeError}
              </span>
            ) : null}
          </span>
          {activeConflict && activeTab ? (
            <div className="message-actions" aria-label={copy.conflictActions}>
              <button
                type="button"
                onClick={() => onReviewTabAgainstDisk(activeTab)}
              >
                {copy.reviewChanges}
              </button>
              <button
                type="button"
                onClick={() => onReopenTabFromDisk(activeTab.id)}
              >
                {copy.reopenFromDisk}
              </button>
              <button
                type="button"
                onClick={() => onCloseTabWithoutSaving(activeTab.id)}
              >
                {copy.closeWithoutSaving}
              </button>
              <button
                type="button"
                onClick={() => onKeepEditingAfterConflict(activeTab.id)}
              >
                {copy.keepEditing}
              </button>
            </div>
          ) : activeSaveError && activeTab ? (
            <div className="message-actions" aria-label={copy.saveErrorActions}>
              <button type="button" onClick={() => onTrySaveAgain(activeTab.id)}>
                {copy.trySaveAgain}
              </button>
              <button
                type="button"
                onClick={() => onClearSaveError(activeTab.id)}
              >
                {copy.keepEditing}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
