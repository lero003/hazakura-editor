import type {
  CompareCase,
  CompareViewState,
  MenuLanguage,
} from "../../types";
import { isJapaneseMenuLanguage } from "../../types";
import { isKanaStyle } from "../../lib/locale/_helpers";
import { DiffBody } from "../diff/DiffBody";

type ChangeReviewCase = Extract<CompareCase, { kind: "changes" }>;

type ChangeReviewViewProps = {
  compareCase: ChangeReviewCase;
  menuLanguage: MenuLanguage;
  onApplyBackup?: (documentPath: string, backupContents: string) => void;
  onClose: () => void;
  view: CompareViewState;
};

export function ChangeReviewView({
  compareCase,
  menuLanguage,
  onApplyBackup,
  onClose,
  view,
}: ChangeReviewViewProps) {
  const labels = isKanaStyle(menuLanguage)
    ? {
        additions: "ついかぎょう",
        changesTitle: "へんこう かくにん",
        close: "とぢる",
        applyBackup: "この ばっくあっぷに もどす",
        removed: "さくじょぎょう",
        summary: "くらべの がいよう",
        to: "と",
        table: "へんこう かくにん",
      }
    : isJapaneseMenuLanguage(menuLanguage)
      ? {
          additions: "追加行",
          changesTitle: "変更確認",
          close: "閉じる",
          applyBackup: "このバックアップを復元",
          removed: "削除行",
          summary: "比較の概要",
          to: "と",
          table: "変更確認",
        }
      : {
          additions: "Added lines",
          changesTitle: "Change review",
          close: "Close",
          applyBackup: "Restore this backup",
          removed: "Removed lines",
          summary: "Comparison summary",
          to: "to",
          table: "Change review",
        };

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
