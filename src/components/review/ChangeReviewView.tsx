import type {
  CompareCase,
  CompareViewState,
  EditorTab,
  MenuLanguage,
} from "../../types";
import { getReviewCopy } from "../../lib/locale/review";
import {
  getChangeReviewStaleReason,
  isStaleAwareScope,
} from "../../features/diff/changeReviewStale";
import { DiffBody } from "../diff/DiffBody";

type ChangeReviewCase = Extract<CompareCase, { kind: "changes" }>;

type ChangeReviewViewProps = {
  compareCase: ChangeReviewCase;
  documentTab?: EditorTab | null;
  menuLanguage: MenuLanguage;
  onApplyBackup?: (documentPath: string, backupContents: string) => void;
  onClose: () => void;
  view: CompareViewState;
};

export function ChangeReviewView({
  compareCase,
  documentTab = null,
  menuLanguage,
  onApplyBackup,
  onClose,
  view,
}: ChangeReviewViewProps) {
  const labels = getReviewCopy(menuLanguage);

  // Stale detection only applies to buffer-backed scopes whose right
  // column is the live editor buffer. Draft and AI-edit scopes compare
  // against a fixed snapshot and never go stale.
  const staleReason =
    compareCase.capturedSnapshot && isStaleAwareScope(compareCase.scope)
      ? getChangeReviewStaleReason(compareCase.capturedSnapshot, documentTab)
      : null;

  const staleDetail = staleReason
    ? staleReason === "buffer-edited"
      ? labels.staleReasonBufferEdited
      : staleReason === "tab-switched"
        ? labels.staleReasonTabSwitched
        : labels.staleReasonTabClosed
    : null;

  // The apply button is only meaningful for the auto-backup
  // restore scope — disk / draft / conflict diffs are read-only.
  // Showing it unconditionally would tempt the user to think
  // any diff is reversible with one click, which is false.
  const showApplyBackup =
    compareCase.scope === "backup-vs-buffer" &&
    compareCase.backupApplyAction !== undefined &&
    onApplyBackup !== undefined;

  return (
    <div className="diff-pane">
      <div className="diff-header">
        <div className="diff-title">
          <span>{labels.changesTitle}</span>
          <strong>
            <span title={compareCase.documentPath}>
              {compareCase.documentLabel} ({compareCase.leftColumnLabel})
            </span>
            <span aria-hidden="true">{labels.to}</span>
            <span title={compareCase.documentPath}>
              {compareCase.documentLabel} ({compareCase.rightColumnLabel})
            </span>
          </strong>
        </div>
        <div className="diff-summary" aria-label={labels.summary}>
          <span className="diff-added" title={labels.additions}>
            +{view.additions}
          </span>
          <span className="diff-removed" title={labels.removed}>
            -{view.removals}
          </span>
          {showApplyBackup ? (
            <button
              type="button"
              onClick={() => {
                if (compareCase.backupApplyAction && onApplyBackup) {
                  onApplyBackup(
                    compareCase.documentPath,
                    compareCase.backupApplyAction.backupContents,
                  );
                }
              }}
            >
              {labels.applyBackup}
            </button>
          ) : null}
          <button type="button" onClick={onClose}>
            {labels.close}
          </button>
        </div>
      </div>
      {staleReason ? (
        <div
          className="diff-stale-banner"
          role="status"
          aria-live="polite"
        >
          <strong>{labels.staleHeading}</strong>
          <span>{staleDetail}</span>
        </div>
      ) : null}
      <div className="diff-table" role="table" aria-label={labels.table}>
        <div className="diff-split-row diff-row-header" role="row">
          <span className="diff-line-number" role="columnheader" />
          <span className="diff-text-column" role="columnheader">
            {compareCase.leftColumnLabel}
          </span>
          <span className="diff-line-number" role="columnheader" />
          <span className="diff-text-column" role="columnheader">
            {compareCase.rightColumnLabel}
          </span>
        </div>
        <DiffBody compareCase={compareCase} menuLanguage={menuLanguage} view={view} />
      </div>
    </div>
  );
}
