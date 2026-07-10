import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type { ReferenceCompareCopy } from "../../lib/locale/referenceCompare";
import {
  isImageReference,
  isPdfReference,
  isTextReference,
  referenceDisplayName,
  referenceRoleLabel,
} from "../../features/referenceCompare/referenceCompare";
import type { ReferenceDocument } from "../../features/referenceCompare/types";
import type { MenuLanguage } from "../../types";
import { isJapaneseMenuLanguage } from "../../types";
import { ReferencePdfPane } from "./ReferencePdfPane";

type ReferenceTextPaneProps = {
  copy: ReferenceCompareCopy;
  followPaused?: boolean;
  menuLanguage: MenuLanguage;
  onClose: () => void;
  onPdfPageIndexChange?: (page: number, source: "user" | "system") => void;
  onReplace?: () => void;
  onResumeFollow?: () => void;
  onShowDiff?: () => void;
  pdfPageIndex?: number;
  reference: ReferenceDocument;
  showDiffEnabled?: boolean;
};

/**
 * Read-only reference surface: text (R1), PDF/image (R2), import follow (R3).
 */
export function ReferenceTextPane({
  copy,
  followPaused = false,
  menuLanguage,
  onClose,
  onPdfPageIndexChange,
  onReplace,
  onResumeFollow,
  onShowDiff,
  pdfPageIndex = 0,
  reference,
  showDiffEnabled = false,
}: ReferenceTextPaneProps) {
  const language = isJapaneseMenuLanguage(menuLanguage) ? "ja" : "en";
  const ariaLabel = referenceRoleLabel(language, reference);
  const name = referenceDisplayName(reference);

  const onHeaderKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <section
      aria-label={ariaLabel}
      className="reference-pane pane"
      data-testid="reference-pane"
    >
      <header className="reference-pane-header">
        <div className="reference-pane-titles">
          <span className="reference-pane-role" data-testid="reference-role">
            {copy.referenceLabel}
          </span>
          <span className="reference-pane-name" title={reference.path}>
            {name}
          </span>
          <span className="reference-pane-readonly">{copy.readOnly}</span>
        </div>
        <div className="reference-pane-actions">
          {showDiffEnabled && onShowDiff && isTextReference(reference) ? (
            <button
              type="button"
              className="reference-pane-action"
              onClick={onShowDiff}
            >
              {copy.showDiff}
            </button>
          ) : null}
          {onReplace ? (
            <button
              type="button"
              className="reference-pane-action"
              onClick={onReplace}
            >
              {copy.replaceReference}
            </button>
          ) : null}
          <button
            type="button"
            className="reference-pane-action reference-pane-close"
            onClick={onClose}
            onKeyDown={onHeaderKeyDown}
            aria-label={copy.closeReference}
          >
            ×
          </button>
        </div>
      </header>
      <div className="reference-pane-body">
        {isTextReference(reference) ? (
          <pre
            aria-readonly="true"
            className="reference-text-surface"
            data-testid="reference-text-surface"
            tabIndex={0}
          >
            {reference.contents.split("\n").map((line, index) => (
              <div className="reference-text-line" key={`ref-line-${index}`}>
                <span className="reference-text-gutter" aria-hidden="true">
                  {index + 1}
                </span>
                <span className="reference-text-content">{line || " "}</span>
              </div>
            ))}
          </pre>
        ) : null}
        {isPdfReference(reference) ? (
          <ReferencePdfPane
            copy={copy}
            followPaused={followPaused}
            onPageIndexChange={onPdfPageIndexChange ?? (() => undefined)}
            onResumeFollow={onResumeFollow}
            pageIndex={pdfPageIndex}
            reference={reference}
          />
        ) : null}
        {isImageReference(reference) ? (
          <div
            className="reference-image-stage"
            data-testid="reference-image-stage"
          >
            <img
              src={reference.url}
              alt={name}
              className="reference-image"
              draggable={false}
            />
          </div>
        ) : null}
        {!isTextReference(reference) &&
        !isPdfReference(reference) &&
        !isImageReference(reference) ? (
          <div className="reference-placeholder" role="status">
            {copy.unsupportedType}
          </div>
        ) : null}
      </div>
    </section>
  );
}
