import { useMemo } from "react";
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
import { isKanaStyle } from "../../lib/locale/_helpers";
import { resolveReferencePaneHeader } from "../../features/workspace/rightPaneHeaderModel";
import { RightPaneHeader } from "../app/RightPaneHeader";
import { ReferencePdfPane } from "./ReferencePdfPane";

type ReferenceTextPaneProps = {
  copy: ReferenceCompareCopy;
  externalChangePending?: boolean;
  followPaused?: boolean;
  menuLanguage: MenuLanguage;
  onClose: () => void;
  onPdfPageIndexChange?: (page: number, source: "user" | "system") => void;
  onReloadReference?: () => void;
  onReplace?: () => void;
  onResumeFollow?: () => void;
  onShowDiff?: () => void;
  pdfPageIndex?: number;
  reference: ReferenceDocument;
  /** R4 advisory review pages (0-based); empty when no confidence data. */
  reviewPageIndices?: number[];
  showDiffEnabled?: boolean;
};

/**
 * Read-only reference surface: text (R1), PDF/image (R2), import follow (R3),
 * advisory review nav (R4).
 *
 * Text scrolling uses `.reference-pane-body` (the real overflow container).
 * Text rows use natural height so Japanese wrapping, selection, and scroll
 * position stay correct. A fixed-height virtualizer is intentionally not used
 * here: it cannot safely represent wrapped logical lines.
 */
export function ReferenceTextPane({
  copy,
  externalChangePending = false,
  followPaused = false,
  menuLanguage,
  onClose,
  onPdfPageIndexChange,
  onReloadReference,
  onReplace,
  onResumeFollow,
  onShowDiff,
  pdfPageIndex = 0,
  reference,
  reviewPageIndices = [],
  showDiffEnabled = false,
}: ReferenceTextPaneProps) {
  const language = isKanaStyle(menuLanguage)
    ? "kana"
    : isJapaneseMenuLanguage(menuLanguage)
      ? "ja"
      : "en";
  const errorLanguage = language;
  const ariaLabel = referenceRoleLabel(language, reference);
  const name = referenceDisplayName(reference);
  const textLines = useMemo(
    () =>
      isTextReference(reference) ? reference.contents.split("\n") : ([] as string[]),
    [reference],
  );
  const header = resolveReferencePaneHeader({
    title: copy.referenceLabel,
    fileName: name,
    filePath: reference.path,
    readOnlyLabel: copy.readOnly,
    closeLabel: copy.closeReference,
  });

  return (
    <section
      aria-label={ariaLabel}
      className="reference-pane pane"
      data-testid="reference-pane"
    >
      <div data-testid="reference-role" hidden>
        {copy.referenceLabel}
      </div>
      <RightPaneHeader
        mode={header.mode}
        title={header.title}
        purpose={header.purpose}
        purposeTitle={header.purposeTitle}
        closeLabel={header.closeLabel}
        onClose={onClose}
        actions={
          <>
            {showDiffEnabled && onShowDiff && isTextReference(reference) ? (
              <button
                type="button"
                className="reference-pane-action"
                onClick={onShowDiff}
                data-testid="reference-show-diff"
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
          </>
        }
      />
      {externalChangePending ? (
        <div
          className="reference-external-change"
          role="status"
          data-testid="reference-external-change"
        >
          <span>{copy.externalChangeNotice}</span>
          {onReloadReference ? (
            <button
              type="button"
              className="reference-pane-action"
              onClick={onReloadReference}
              data-testid="reference-reload"
            >
              {copy.reloadReference}
            </button>
          ) : null}
        </div>
      ) : null}
      <div
        className="reference-pane-body"
        data-testid="reference-pane-body"
      >
        {isTextReference(reference) ? (
          <pre
            aria-readonly="true"
            className="reference-text-surface"
            data-testid="reference-text-surface"
            data-windowed="false"
            tabIndex={0}
          >
            {textLines.map((line, index) => {
              return (
                <div className="reference-text-line" key={`ref-line-${index}`}>
                  <span className="reference-text-gutter" aria-hidden="true">
                    {index + 1}
                  </span>
                  <span className="reference-text-content">{line || " "}</span>
                </div>
              );
            })}
          </pre>
        ) : null}
        {isPdfReference(reference) ? (
          <ReferencePdfPane
            copy={copy}
            errorLanguage={errorLanguage}
            followPaused={followPaused}
            onPageIndexChange={onPdfPageIndexChange ?? (() => undefined)}
            onResumeFollow={onResumeFollow}
            pageIndex={pdfPageIndex}
            reference={reference}
            reviewPageIndices={reviewPageIndices}
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
