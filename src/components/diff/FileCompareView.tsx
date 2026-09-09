import { useComparisonFocus } from "./useComparisonFocus";
import { ComparisonTargets } from "./ComparisonTargets";
import type {
  CompareCase,
  CompareViewState,
  MenuLanguage,
} from "../../types";
import { isJapaneseMenuLanguage } from "../../types";
import { isKanaStyle } from "../../lib/locale/_helpers";
import { DiffBody } from "./DiffBody";

type FileCompareCase = Extract<CompareCase, { kind: "file" }>;

export function FileCompareView({
  focusOnOpen = false,
  compareCase,
  menuLanguage,
  onClose,
  view,
}: {
  focusOnOpen?: boolean;
  compareCase: FileCompareCase;
  menuLanguage: MenuLanguage;
  onClose: () => void;
  view: CompareViewState;
}) {
  const closeRef = useComparisonFocus(view.caseKey, focusOnOpen);
  const labels = isKanaStyle(menuLanguage)
    ? {
        additions: "ついかぎょう",
        close: "くらべけっかを とぢる",
        fileTitle: "Diff",
        removed: "さくじょぎょう",
        summary: "くらべの がいよう",
        to: "と",
        table: "ふみ くらべ",
      }
    : isJapaneseMenuLanguage(menuLanguage)
      ? {
          additions: "追加行",
          close: "比較結果を閉じる",
          fileTitle: "Diff",
          removed: "削除行",
          summary: "比較の概要",
          to: "と",
          table: "ファイル比較",
        }
      : {
          additions: "Added lines",
          close: "Close comparison result",
          fileTitle: "Diff",
          removed: "Removed lines",
          summary: "Comparison summary",
          to: "to",
          table: "File comparison",
        };

  return (
    <div className="diff-pane">
      <div className="diff-header">
        <div className="diff-title">
          <span>{labels.fileTitle}</span>
        </div>
        <div className="diff-summary" aria-label={labels.summary}>
          <span className="diff-added" title={labels.additions}>
            +{view.additions}
          </span>
          <span className="diff-removed" title={labels.removed}>
            -{view.removals}
          </span>
          <button ref={closeRef} type="button" onClick={onClose}>
            {labels.close}
          </button>
        </div>
      </div>
      <ComparisonTargets left={compareCase.anchor} right={compareCase.target} menuLanguage={menuLanguage} />
      <div className="diff-table" role="table" aria-label={labels.table}>
        <div className="diff-split-row diff-row-header" role="row">
          <span className="diff-line-number" role="columnheader" />
          <span className="diff-text-column" role="columnheader">
            {compareCase.anchor.label}
          </span>
          <span className="diff-line-number" role="columnheader" />
          <span className="diff-text-column" role="columnheader">
            {compareCase.target.label}
          </span>
        </div>
        <DiffBody compareCase={compareCase} menuLanguage={menuLanguage} view={view} />
      </div>
    </div>
  );
}
