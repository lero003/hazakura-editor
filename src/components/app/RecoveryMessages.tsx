import { draftStorageKey } from "../../features/document/pathlessDraftRecovery";
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
  /** Pathless recovery candidates without a matching open tab. */
  orphanPathlessDrafts?: DraftRecord[];
  onClearSaveError: (tabId: string) => void;
  onCloseTabWithoutSaving: (tabId: string) => void;
  onDiscardDraft: (draftPathOrKey: string) => void;
  onDismissError: () => void;
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
  orphanPathlessDrafts = [],
  onClearSaveError,
  onCloseTabWithoutSaving,
  onDiscardDraft,
  onDismissError,
  onKeepEditingAfterConflict,
  onReopenTabFromDisk,
  onRestoreDraft,
  onReviewDraftAgainstDisk,
  onReviewTabAgainstDisk,
  onTrySaveAgain,
}: RecoveryMessagesProps) {
  const hasMessage =
    (activeDraft !== null && activeTab !== null) ||
    orphanPathlessDrafts.length > 0 ||
    activeError !== null;

  if (!hasMessage) {
    return null;
  }

  return (
    <div className="message-row" aria-live="polite" aria-atomic="true">
      {activeDraft && activeTab ? (
        <div className="draft-banner">
          <span className="message-copy">
            {copy.draftAvailable(activeTab.name)}
            <span className="message-detail">
              {copy.savedLocally(activeDraft.updatedAt)}
            </span>
          </span>
          <div className="message-actions" aria-label={copy.draftActions}>
            {draftReviewAvailable && activeDraft.path.length > 0 ? (
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
              onClick={() => onDiscardDraft(draftStorageKey(activeDraft))}
            >
              {copy.discardDraft}
            </button>
          </div>
        </div>
      ) : null}
      {orphanPathlessDrafts.map((draft) => {
        const label = draft.name?.trim() || copy.pathlessDraftFallbackName;
        return (
          <div
            className="draft-banner"
            data-testid="pathless-draft-recovery"
            key={draftStorageKey(draft)}
          >
            <span className="message-copy">
              {copy.pathlessDraftAvailable(label)}
              <span className="message-detail">
                {copy.savedLocally(draft.updatedAt)}
                <span className="message-detail-note">
                  {copy.pathlessDraftDetail}
                </span>
              </span>
            </span>
            <div className="message-actions" aria-label={copy.draftActions}>
              <button type="button" onClick={() => onRestoreDraft(draft)}>
                {copy.restoreDraft}
              </button>
              <button
                type="button"
                onClick={() => onDiscardDraft(draftStorageKey(draft))}
              >
                {copy.discardDraft}
              </button>
            </div>
          </div>
        );
      })}
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
          ) : (
            <div className="message-actions" aria-label={copy.errorActions}>
              <button type="button" onClick={onDismissError}>
                {copy.dismiss}
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
