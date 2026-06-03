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
  compareCase,
  menuLanguage,
  onClose,
  view,
}: {
  compareCase: FileCompareCase;
  menuLanguage: MenuLanguage;
  onClose: () => void;
  view: CompareViewState;
}) {
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
          <strong>
            <span title={compareCase.anchor.path}>
              {compareCase.anchor.name}
            </span>
            <span aria-hidden="true">{labels.to}</span>
            <span title={compareCase.target.path}>
              {compareCase.target.name}
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
