import type {
  CompareCase,
  CompareViewState,
  MenuLanguage,
} from "../types";
import { DiffBody } from "./DiffBody";

type ChangeReviewCase = Extract<CompareCase, { kind: "changes" }>;

export function ChangeReviewView({
  compareCase,
  menuLanguage,
  onClose,
  view,
}: {
  compareCase: ChangeReviewCase;
  menuLanguage: MenuLanguage;
  onClose: () => void;
  view: CompareViewState;
}) {
  const labels =
    menuLanguage !== "en"
      ? {
          additions: "追加行",
          changesTitle: "変更確認",
          close: "閉じる",
          removed: "削除行",
          summary: "比較の概要",
          to: "と",
          table: "変更確認",
        }
      : {
          additions: "Added lines",
          changesTitle: "Change review",
          close: "Close",
          removed: "Removed lines",
          summary: "Comparison summary",
          to: "to",
          table: "Change review",
        };

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
