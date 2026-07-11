import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type UIEvent,
} from "react";
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
import { computeWindowedLineRange } from "./windowedTextLines";

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
  const language = isJapaneseMenuLanguage(menuLanguage) ? "ja" : "en";
  const ariaLabel = referenceRoleLabel(language, reference);
  const name = referenceDisplayName(reference);
  const textLines = useMemo(
    () =>
      isTextReference(reference) ? reference.contents.split("\n") : ([] as string[]),
    [reference],
  );
  const lineHeight = 22;
  const scrollerRef = useRef<HTMLPreElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(480);
  const windowed = useMemo(
    () =>
      computeWindowedLineRange(
        textLines.length,
        scrollTop,
        viewportHeight,
        lineHeight,
      ),
    [scrollTop, textLines.length, viewportHeight],
  );

  const onTextScroll = useCallback((event: UIEvent<HTMLPreElement>) => {
    const target = event.currentTarget;
    setScrollTop(target.scrollTop);
    setViewportHeight(target.clientHeight);
  }, []);

  const onScrollerRef = useCallback((node: HTMLPreElement | null) => {
    scrollerRef.current = node;
    if (node) {
      setViewportHeight(node.clientHeight);
    }
  }, []);

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
      <div className="reference-pane-body">
        {isTextReference(reference) ? (
          <pre
            aria-readonly="true"
            className="reference-text-surface"
            data-testid="reference-text-surface"
            onScroll={onTextScroll}
            ref={onScrollerRef}
            tabIndex={0}
          >
            <div
              className="reference-text-window"
              style={{
                height: `${Math.max(textLines.length, 1) * lineHeight}px`,
                position: "relative",
              }}
            >
              <div
                className="reference-text-window-inner"
                style={{
                  position: "absolute",
                  top: `${windowed.start * lineHeight}px`,
                  left: 0,
                  right: 0,
                }}
              >
                {textLines
                  .slice(windowed.start, windowed.end)
                  .map((line, offset) => {
                    const index = windowed.start + offset;
                    return (
                      <div
                        className="reference-text-line"
                        key={`ref-line-${index}`}
                        style={{ height: `${lineHeight}px` }}
                      >
                        <span className="reference-text-gutter" aria-hidden="true">
                          {index + 1}
                        </span>
                        <span className="reference-text-content">
                          {line || " "}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </pre>
        ) : null}
        {isPdfReference(reference) ? (
          <ReferencePdfPane
            copy={copy}
            errorLanguage={language}
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
