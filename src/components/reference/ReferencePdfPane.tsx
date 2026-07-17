import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import type { ReferenceCompareCopy } from "../../lib/locale/referenceCompare";
import { nextReviewPage } from "../../features/referenceCompare/importPageMarkers";
import type { ReferenceDocument } from "../../features/referenceCompare/types";
import {
  localizePdfReferenceError,
  pdfPageImageToDataUrl,
  renderPdfReferencePage,
  type PdfReferencePageImage,
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
  /**
   * Zero-based page indices for advisory 要確認 navigation (R4).
   * Empty when no page-level confidence is available.
   */
  reviewPageIndices?: number[];
  reference: PdfRef;
  /** Prefer ja localization for render errors. */
  errorLanguage?: "ja" | "en" | "kana";
};

type ZoomMode = "fit-width" | "150";

type PageCacheEntry = {
  imageUrl: string;
  zoom: ZoomMode;
  referenceId: string;
};

const PAGE_CACHE_MAX = 3;
const PDF_PAN_STEP_PX = 80;
const PDF_WHEEL_LINE_PX = 40;

/** Shared render budget so 100% / 150% differ only by CSS scale. */
function maxPixelsForZoom(mode: ZoomMode): number {
  switch (mode) {
    case "fit-width":
      return 2_500_000;
    case "150":
      return 3_000_000;
    default:
      return 2_500_000;
  }
}

function clearPageCache(cache: Map<number, PageCacheEntry>) {
  cache.clear();
}

/**
 * R2–R4 read-only PDF page reader. Page index is controlled by the parent.
 * R4: adjacent-page cache (no full preload) + advisory review-page nav.
 */
export function ReferencePdfPane({
  copy,
  pageIndex,
  onPageIndexChange,
  followPaused = false,
  onResumeFollow,
  reviewPageIndices = [],
  reference,
  errorLanguage = "ja",
}: ReferencePdfPaneProps) {
  const statusId = useId();
  const [zoom, setZoom] = useState<ZoomMode>("fit-width");
  const [pageUrl, setPageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const cacheRef = useRef<Map<number, PageCacheEntry>>(new Map());
  /** Bumped on reference change / unmount so in-flight prefetch cannot poison cache. */
  const generationRef = useRef(0);

  const pageCount = Math.max(1, reference.pageCount);
  const safePage = Math.min(Math.max(0, pageIndex), pageCount - 1);
  const hasReview = reviewPageIndices.length > 0;

  useEffect(() => {
    setZoom("fit-width");
    clearPageCache(cacheRef.current);
    generationRef.current += 1;
    setPageUrl(null);
    setError(null);
  }, [reference.referenceId]);

  useEffect(() => {
    return () => {
      generationRef.current += 1;
      clearPageCache(cacheRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const generation = generationRef.current;
    const cached = cacheRef.current.get(safePage);
    if (
      cached &&
      cached.zoom === zoom &&
      cached.referenceId === reference.referenceId
    ) {
      setPageUrl(cached.imageUrl);
      setError(null);
      setLoading(false);
      void prefetchAdjacent({
        referenceId: reference.referenceId,
        page: safePage,
        pageCount,
        zoom,
        cache: cacheRef.current,
        generation,
        isCurrent: () =>
          !cancelled && generationRef.current === generation,
      });
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const image = await renderPdfReferencePage(
          reference.referenceId,
          safePage,
          maxPixelsForZoom(zoom),
        );
        if (cancelled || generationRef.current !== generation) return;
        if (image.referenceId !== reference.referenceId) return;
        const imageUrl = pdfPageImageToDataUrl(image);
        rememberPage(cacheRef.current, safePage, {
          imageUrl,
          zoom,
          referenceId: reference.referenceId,
        });
        setPageUrl(imageUrl);
        setLoading(false);
        void prefetchAdjacent({
          referenceId: reference.referenceId,
          page: safePage,
          pageCount,
          zoom,
          cache: cacheRef.current,
          generation,
          isCurrent: () =>
            !cancelled && generationRef.current === generation,
        });
      } catch (err) {
        if (cancelled || generationRef.current !== generation) return;
        setPageUrl(null);
        setError(localizePdfReferenceError(err, errorLanguage));
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    reference.referenceId,
    safePage,
    zoom,
    reloadToken,
    pageCount,
    errorLanguage,
  ]);

  const goPrev = useCallback(() => {
    onPageIndexChange(Math.max(0, safePage - 1), "user");
  }, [onPageIndexChange, safePage]);

  const goNext = useCallback(() => {
    onPageIndexChange(Math.min(pageCount - 1, safePage + 1), "user");
  }, [onPageIndexChange, pageCount, safePage]);

  const goReview = useCallback(
    (direction: 1 | -1) => {
      const target = nextReviewPage(reviewPageIndices, safePage, direction);
      if (target == null) return;
      onPageIndexChange(target, "user");
    },
    [onPageIndexChange, reviewPageIndices, safePage],
  );

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft" || event.key === "PageUp") {
      event.preventDefault();
      goPrev();
    } else if (event.key === "ArrowRight" || event.key === "PageDown") {
      event.preventDefault();
      goNext();
    }
  };

  const onStageKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (zoom !== "150") return;

    const stage = event.currentTarget;
    const pageStep = Math.max(PDF_PAN_STEP_PX, stage.clientHeight * 0.8);
    let left = 0;
    let top = 0;
    if (event.key === "ArrowLeft") left = -PDF_PAN_STEP_PX;
    else if (event.key === "ArrowRight") left = PDF_PAN_STEP_PX;
    else if (event.key === "ArrowUp") top = -PDF_PAN_STEP_PX;
    else if (event.key === "ArrowDown") top = PDF_PAN_STEP_PX;
    else if (event.key === "PageUp") top = -pageStep;
    else if (event.key === "PageDown") top = pageStep;
    else return;

    event.preventDefault();
    event.stopPropagation();
    stage.scrollLeft += left;
    stage.scrollTop += top;
  };

  const onStageWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (zoom !== "150" || event.ctrlKey || event.deltaX !== 0) return;

    const stage = event.currentTarget;
    const delta = normalizeWheelDelta(
      event.deltaY,
      event.deltaMode,
      stage.clientHeight,
    );
    if (delta === 0) return;

    let horizontalDelta = delta;
    let nextTop = stage.scrollTop;
    if (!event.shiftKey) {
      const maxTop = Math.max(0, stage.scrollHeight - stage.clientHeight);
      nextTop = clamp(stage.scrollTop + delta, 0, maxTop);
      horizontalDelta -= nextTop - stage.scrollTop;
    }

    const maxLeft = Math.max(0, stage.scrollWidth - stage.clientWidth);
    const nextLeft = clamp(stage.scrollLeft + horizontalDelta, 0, maxLeft);
    if (nextTop === stage.scrollTop && nextLeft === stage.scrollLeft) return;

    event.preventDefault();
    stage.scrollTop = nextTop;
    stage.scrollLeft = nextLeft;
  };

  const pageStatus = `${copy.pageLabel} ${safePage + 1} / ${pageCount}`;
  const reviewStatus = hasReview
    ? `${copy.reviewLabel} ${reviewPageIndices.indexOf(safePage) >= 0 ? reviewPageIndices.indexOf(safePage) + 1 : "–"} / ${reviewPageIndices.length}`
    : null;

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
        {hasReview ? (
          <>
            <button
              type="button"
              className="reference-pane-action"
              onClick={() => goReview(-1)}
              aria-label={copy.previousReview}
              title={copy.reviewAdvisory}
              data-testid="reference-prev-review"
            >
              ‹ {copy.reviewLabel}
            </button>
            <span
              className="reference-pdf-review-label"
              title={copy.reviewAdvisory}
              data-testid="reference-review-status"
            >
              {reviewStatus}
            </span>
            <button
              type="button"
              className="reference-pane-action"
              onClick={() => goReview(1)}
              aria-label={copy.nextReview}
              title={copy.reviewAdvisory}
              data-testid="reference-next-review"
            >
              {copy.reviewLabel} ›
            </button>
          </>
        ) : null}
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
          className={`reference-pane-action${zoom === "150" ? " is-active" : ""}`}
          onClick={() => setZoom("150")}
          aria-label={copy.zoomIn}
          aria-pressed={zoom === "150"}
        >
          150%
        </button>
      </div>
      {hasReview ? (
        <p className="reference-pdf-review-hint" role="note">
          {copy.reviewAdvisory}
        </p>
      ) : null}
      <div
        aria-label={
          zoom === "150"
            ? `${reference.name} — ${pageStatus} — 150%`
            : undefined
        }
        className={`reference-pdf-stage reference-pdf-stage--${zoom}`}
        data-testid="reference-pdf-stage"
        onKeyDown={onStageKeyDown}
        onWheel={onStageWheel}
        role={zoom === "150" ? "region" : undefined}
        tabIndex={zoom === "150" ? 0 : undefined}
      >
        {loading ? (
          <div className="reference-placeholder" role="status">
            {copy.loadingPage}
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
        {pageUrl && !error ? (
          <img
            src={pageUrl}
            alt={`${reference.name} — ${pageStatus}`}
            className="reference-pdf-image"
            draggable={false}
          />
        ) : null}
      </div>
    </div>
  );
}

function normalizeWheelDelta(
  delta: number,
  deltaMode: number,
  viewportHeight: number,
): number {
  if (deltaMode === WheelEvent.DOM_DELTA_LINE) {
    return delta * PDF_WHEEL_LINE_PX;
  }
  if (deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return delta * Math.max(PDF_PAN_STEP_PX, viewportHeight * 0.8);
  }
  return delta;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function rememberPage(
  cache: Map<number, PageCacheEntry>,
  page: number,
  entry: PageCacheEntry,
) {
  cache.delete(page);
  cache.set(page, entry);
  while (cache.size > PAGE_CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

async function prefetchAdjacent(options: {
  referenceId: string;
  page: number;
  pageCount: number;
  zoom: ZoomMode;
  cache: Map<number, PageCacheEntry>;
  generation: number;
  isCurrent: () => boolean;
}) {
  const { referenceId, page, pageCount, zoom, cache, isCurrent } = options;
  const neighbors = [page - 1, page + 1].filter((p) => {
    if (p < 0 || p >= pageCount) return false;
    const existing = cache.get(p);
    return !(
      existing &&
      existing.zoom === zoom &&
      existing.referenceId === referenceId
    );
  });
  for (const neighbor of neighbors) {
    if (!isCurrent()) return;
    try {
      const image: PdfReferencePageImage = await renderPdfReferencePage(
        referenceId,
        neighbor,
        maxPixelsForZoom(zoom),
      );
      if (!isCurrent()) return;
      if (image.referenceId !== referenceId) return;
      const imageUrl = pdfPageImageToDataUrl(image);
      if (!isCurrent()) return;
      rememberPage(cache, neighbor, {
        imageUrl,
        zoom,
        referenceId,
      });
    } catch {
      // Prefetch is best-effort.
    }
  }
}
