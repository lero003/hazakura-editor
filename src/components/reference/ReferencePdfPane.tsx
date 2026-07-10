import {
  useCallback,
  useEffect,
  useId,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type { ReferenceCompareCopy } from "../../lib/locale/referenceCompare";
import { PDF_REFERENCE_DEFAULT_MAX_PIXELS } from "../../features/referenceCompare/referenceCompare";
import type { ReferenceDocument } from "../../features/referenceCompare/types";
import {
  pdfPageImageToDataUrl,
  renderPdfReferencePage,
} from "../../lib/tauri/pdfReference";

type PdfRef = Extract<ReferenceDocument, { kind: "pdf" }>;

type ReferencePdfPaneProps = {
  copy: ReferenceCompareCopy;
  /** 0-based controlled page index (parent owns follow + user nav). */
  pageIndex: number;
  onPageIndexChange: (page: number, source: "user" | "system") => void;
  /** When true, show resume-follow control (user paused follow). */
  followPaused?: boolean;
  onResumeFollow?: () => void;
  reference: PdfRef;
};

type ZoomMode = "fit-width" | "fit-page" | "100" | "150";

function maxPixelsForZoom(mode: ZoomMode): number {
  switch (mode) {
    case "fit-page":
      return 1_600_000;
    case "fit-width":
      return 2_500_000;
    case "100":
      return 3_000_000;
    case "150":
      return PDF_REFERENCE_DEFAULT_MAX_PIXELS;
    default:
      return 2_500_000;
  }
}

/**
 * R2/R3 read-only PDF page reader. Page index is controlled by the parent
 * so Import Assist follow can drive it without fighting local state.
 */
export function ReferencePdfPane({
  copy,
  pageIndex,
  onPageIndexChange,
  followPaused = false,
  onResumeFollow,
  reference,
}: ReferencePdfPaneProps) {
  const statusId = useId();
  const [zoom, setZoom] = useState<ZoomMode>("fit-width");
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const pageCount = Math.max(1, reference.pageCount);
  const safePage = Math.min(Math.max(0, pageIndex), pageCount - 1);

  useEffect(() => {
    setZoom("fit-width");
  }, [reference.referenceId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const image = await renderPdfReferencePage(
          reference.referenceId,
          safePage,
          maxPixelsForZoom(zoom),
        );
        if (cancelled) return;
        setDataUrl(pdfPageImageToDataUrl(image));
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setDataUrl(null);
        setError(String(err));
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reference.referenceId, safePage, zoom, reloadToken]);

  const goPrev = useCallback(() => {
    onPageIndexChange(Math.max(0, safePage - 1), "user");
  }, [onPageIndexChange, safePage]);

  const goNext = useCallback(() => {
    onPageIndexChange(Math.min(pageCount - 1, safePage + 1), "user");
  }, [onPageIndexChange, pageCount, safePage]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft" || event.key === "PageUp") {
      event.preventDefault();
      goPrev();
    } else if (event.key === "ArrowRight" || event.key === "PageDown") {
      event.preventDefault();
      goNext();
    }
  };

  const pageStatus = `${copy.pageLabel} ${safePage + 1} / ${pageCount}`;

  return (
    <div
      className="reference-pdf-pane"
      data-testid="reference-pdf-pane"
      onKeyDown={onKeyDown}
      tabIndex={0}
      aria-describedby={statusId}
    >
      <div
        className="reference-pdf-toolbar"
        role="toolbar"
        aria-label={copy.pageLabel}
      >
        <button
          type="button"
          className="reference-pane-action"
          onClick={goPrev}
          disabled={safePage <= 0 || loading}
          aria-label={copy.previousPage}
        >
          ←
        </button>
        <span
          id={statusId}
          className="reference-pdf-page-label"
          aria-live="polite"
        >
          {pageStatus}
        </span>
        <button
          type="button"
          className="reference-pane-action"
          onClick={goNext}
          disabled={safePage >= pageCount - 1 || loading}
          aria-label={copy.nextPage}
        >
          →
        </button>
        {followPaused && onResumeFollow ? (
          <button
            type="button"
            className="reference-pane-action is-active"
            onClick={onResumeFollow}
            data-testid="reference-resume-follow"
          >
            {copy.resumeFollow}
          </button>
        ) : null}
        <span className="reference-pdf-toolbar-spacer" />
        <button
          type="button"
          className={`reference-pane-action${zoom === "fit-width" ? " is-active" : ""}`}
          onClick={() => setZoom("fit-width")}
          aria-pressed={zoom === "fit-width"}
        >
          {copy.fitWidth}
        </button>
        <button
          type="button"
          className={`reference-pane-action${zoom === "fit-page" ? " is-active" : ""}`}
          onClick={() => setZoom("fit-page")}
          aria-pressed={zoom === "fit-page"}
        >
          {copy.fitPage}
        </button>
        <button
          type="button"
          className={`reference-pane-action${zoom === "150" ? " is-active" : ""}`}
          onClick={() => setZoom("150")}
          aria-label={copy.zoomIn}
          aria-pressed={zoom === "150"}
        >
          150%
        </button>
      </div>
      <div
        className={`reference-pdf-stage reference-pdf-stage--${zoom}`}
        data-testid="reference-pdf-stage"
      >
        {loading ? (
          <div className="reference-placeholder" role="status">
            …
          </div>
        ) : null}
        {error ? (
          <div className="reference-pdf-error" role="alert">
            <p>{error}</p>
            <button
              type="button"
              className="reference-pane-action"
              onClick={() => setReloadToken((n) => n + 1)}
            >
              {copy.retryRender}
            </button>
          </div>
        ) : null}
        {dataUrl && !error ? (
          <img
            src={dataUrl}
            alt={`${reference.name} — ${pageStatus}`}
            className="reference-pdf-image"
            draggable={false}
          />
        ) : null}
      </div>
    </div>
  );
}
