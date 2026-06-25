// v0.24 e-book Mode — display-only active chapter reader.
//
// This is still Path Y: Markdown is rendered through the existing
// `renderMarkdown()` / `inlineWorkspaceAssetImages()` safety pipeline,
// never through CodeMirror decoration. The Markdown source is never
// edited here; this pane is read-only by construction (it only sets
// `dangerouslySetInnerHTML` on sanitised HTML, with no input or
// contenteditable surface).
//
// The reader keeps one active paginated chapter and pages that chapter
// body with CSS Columns. Reading Focus can preview the next chapter on a
// spare right spread page, but reader state and editor sync stay anchored
// to the active left page. Reader chrome, including the footer, stays
// outside the paginated flow so the columns never own navigation UI.

import {
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type WheelEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  applyEbookPageBreakMarkers,
  type EbookChapter,
  splitMarkdownIntoChapters,
} from "../../../features/editor/ebookChapters";
import {
  inlineWorkspaceAssetImages,
  renderMarkdown,
} from "../../../features/editor/markdown";
import { schedulePreviewRender } from "../../../features/editor/previewRenderDebounce";
import { openWorkspaceImage } from "../../../lib/tauri";
import type { MenuLanguage } from "../../../types";
import { isJapaneseMenuLanguage } from "../../../types";
import {
  getEBookPageOffset,
  measureEBookPageCount,
} from "./ebookPagination";

type EBookPaneProps = {
  documentKey?: string;
  documentPath?: string | null;
  initialLocation?: EBookReaderLocation | null;
  menuLanguage?: MenuLanguage;
  onEnterReadingFocus?: (location: EBookReaderLocation) => void;
  onExitReadingFocus?: (location: EBookReaderLocation) => void;
  onLocationChange?: (location: EBookReaderLocation) => void;
  onOpenLocalLink?: (href: string) => void;
  readingFocusActive?: boolean;
  source: string;
  workspaceRoot?: string | null;
};

export type EBookReaderLocation = {
  chapterIndex: number;
  pageIndex: number;
  sourceLine?: number;
};

type RenderedChapter = {
  index: number;
  headingLevel: number | null;
  headingText: string | null;
  html: string;
  isStandaloneImage: boolean;
};

type EBookPageFlowStyle = CSSProperties & {
  "--ebook-page-viewport-height"?: string;
};

type PendingPageTarget = "first" | "last" | number;

type ReaderPageTarget = {
  chapterIndex: number;
  pageIndex: PendingPageTarget;
};

type EBookReaderCopy = {
  body: string;
  chapterProgress: string;
  closeTableOfContents: string;
  enterReadingFocus: string;
  exitReadingFocus: string;
  footerChapter: string;
  footerPageProgress: string;
  frontMatter: string;
  nextPage: string;
  pageProgress: string;
  previousPage: string;
  readerLabel: string;
  tableOfContents: string;
};

const WHEEL_PAGE_THRESHOLD = 40;
const WHEEL_PAGE_COOLDOWN_MS = 220;
const EBOOK_SPREAD_CONTAINER_MIN_WIDTH = 920;
const EBOOK_SPREAD_WIDTH_TOLERANCE = 1;

export default function EBookPane({
  documentKey,
  documentPath,
  initialLocation,
  menuLanguage = "en",
  onEnterReadingFocus,
  onExitReadingFocus,
  onLocationChange,
  onOpenLocalLink,
  readingFocusActive = false,
  source,
  workspaceRoot,
}: EBookPaneProps) {
  const copy = getEBookReaderCopy(menuLanguage);
  const chapters = useMemo(() => splitMarkdownIntoChapters(source), [source]);
  const [activeChapterIndex, setActiveChapterIndex] = useState(
    () => initialLocation?.chapterIndex ?? 0,
  );
  const [activePageIndex, setActivePageIndex] = useState(
    () => initialLocation?.pageIndex ?? 0,
  );
  const [measuredPageCount, setMeasuredPageCount] = useState(1);
  const [pageOffset, setPageOffset] = useState(0);
  const [pageViewportHeight, setPageViewportHeight] = useState(0);
  const [visiblePageStep, setVisiblePageStep] = useState(1);
  const [pageTransitionSuppressed, setPageTransitionSuppressed] =
    useState(false);
  const [tableOfContentsOpen, setTableOfContentsOpen] = useState(false);
  const pendingPageTargetRef = useRef<PendingPageTarget | null>(null);
  const chapterPageCountsRef = useRef<Map<number, number>>(new Map());
  const flowRef = useRef<HTMLDivElement | null>(null);
  const nextPreviewFlowRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const wheelDeltaRef = useRef(0);
  const wheelCooldownRef = useRef<number | null>(null);
  const pendingLocationNotificationRef = useRef(false);
  // v0.34: ページ計測（全子要素の getClientRects ループ = 強制リフロー）を
  // 複数の発火源（レイアウト効果・ResizeObserver・MutationObserver・画像load）
  // から rAF で1フレームに1回に coalesce する。
  const measureFrameRef = useRef<number | null>(null);
  const documentLocationKey = documentKey ?? documentPath ?? "";
  const lastNotifiedLocationRef = useRef<{
    documentLocationKey: string;
    location: EBookReaderLocation;
  } | null>(null);

  useEffect(() => {
    chapterPageCountsRef.current.clear();
    pendingPageTargetRef.current = initialLocation ? null : "first";
    setTableOfContentsOpen(false);
    setActiveChapterIndex(
      clampChapterIndex(initialLocation?.chapterIndex ?? 0, chapters.length),
    );
    setActivePageIndex(Math.max(initialLocation?.pageIndex ?? 0, 0));
  }, [documentLocationKey]);

  useEffect(() => {
    if (!initialLocation) {
      return;
    }
    const lastNotifiedLocation = lastNotifiedLocationRef.current;
    if (
      lastNotifiedLocation?.documentLocationKey === documentLocationKey &&
      readerLocationsEqual(lastNotifiedLocation.location, initialLocation)
    ) {
      return;
    }
    setActiveChapterIndex(
      clampChapterIndex(initialLocation.chapterIndex, chapters.length),
    );
    setActivePageIndex(Math.max(initialLocation.pageIndex, 0));
  }, [
    chapters.length,
    documentLocationKey,
    initialLocation?.chapterIndex,
    initialLocation?.pageIndex,
  ]);

  useEffect(() => {
    if (!readingFocusActive) {
      setTableOfContentsOpen(false);
    }
  }, [readingFocusActive]);

  useEffect(() => {
    setActiveChapterIndex((current) =>
      clampChapterIndex(current, chapters.length),
    );
  }, [chapters.length]);

  const activeChapterIndexSafe = clampChapterIndex(
    activeChapterIndex,
    chapters.length,
  );
  const activePageIndexSafe = clampPageIndex(
    activePageIndex,
    measuredPageCount,
  );
  const activeChapter = chapters[activeChapterIndexSafe] ?? chapters[0];
  const activeReaderLocation = useMemo(
    () =>
      getEBookReaderLocation(
        activeChapter,
        activeChapterIndexSafe,
        activePageIndexSafe,
        measuredPageCount,
      ),
    [
      activeChapter,
      activeChapterIndexSafe,
      activePageIndexSafe,
      measuredPageCount,
    ],
  );
  // v0.34: renderEbookChapter (marked + DOMPurify) は重い同期処理なので、
  // useMemo で毎キー計算せず、下の debounce 付き useEffect で200ms間引いて
  // state に保存する。ここではレンダリング対象の章と依存キーだけを確定する。
  const activeRenderTarget = activeChapter
    ? {
        chapter: activeChapter,
        documentPath,
        workspaceRoot,
      }
    : null;
  const activeRenderKey = `${activeChapterIndexSafe}\u0000${source}\u0000${documentPath ?? ""}\u0000${workspaceRoot ?? ""}`;
  const nextChapter = chapters[activeChapterIndexSafe + 1];
  const nextRenderedChapter = useMemo<RenderedChapter | null>(() => {
    if (!readingFocusActive || !nextChapter) {
      return null;
    }

    return renderEbookChapter(nextChapter, documentPath, workspaceRoot);
  }, [documentPath, nextChapter, readingFocusActive, workspaceRoot]);

  const [activeChapterHtml, setActiveChapterHtml] =
    useState<RenderedChapter | null>(null);
  // v0.34: rAF コールバックから最新の activeChapterHtml を参照するための ref。
  const activeChapterHtmlRef = useRef(activeChapterHtml);
  activeChapterHtmlRef.current = activeChapterHtml;
  const [nextChapterHtml, setNextChapterHtml] =
    useState<RenderedChapter | null>(nextRenderedChapter);

  // v0.34: 初回レンダリングは即時に行い、2回目以降（ソース変更時）のみ
  // デバウンスする。これで e-book Mode を開いた直後の表示は速く、連続入力時
  // だけ marked + DOMPurify の重い同期処理を間引ける。
  const hasRenderedOnceRef = useRef(false);
  // v0.34: activeRenderTarget はレンダー毎に新オブジェクトになるため、
  // useEffect の依存に入れると inlineWorkspaceAssetImages の非同期処理が
  // state 更新のたびにキャンセルされ、画像が透明GIFのままになる。
  // ref で最新を参照し、依存は文字列キー(activeRenderKey)だけで制御する。
  const activeRenderTargetRef = useRef(activeRenderTarget);
  activeRenderTargetRef.current = activeRenderTarget;

  useEffect(() => {
    let cancelled = false;
    const target = activeRenderTargetRef.current;

    if (!target) {
      hasRenderedOnceRef.current = false;
      setActiveChapterHtml(null);
      return () => {
        cancelled = true;
      };
    }

    const renderChapter = () => {
      if (cancelled) {
        return;
      }

      const rendered = renderEbookChapter(
        target.chapter,
        target.documentPath,
        target.workspaceRoot,
      );
      setActiveChapterHtml(rendered);

      if (!target.workspaceRoot) {
        return;
      }

      // Inline workspace images for the visible chapter only. This keeps
      // the Preview safety boundary while avoiding the v0.21 all-chapter
      // rebuild cost.
      void inlineWorkspaceAssetImages(
        rendered.html,
        async (path) => {
          const image = await openWorkspaceImage(
            target.workspaceRoot!,
            path,
          );
          return image.dataUrl;
        },
      ).then((inlined) => {
        if (!cancelled) {
          setActiveChapterHtml({ ...rendered, html: inlined });
        }
      });
    };

    // 初回は即時、2回目以降はデバウンス。
    if (!hasRenderedOnceRef.current) {
      hasRenderedOnceRef.current = true;
      renderChapter();
      return () => {
        cancelled = true;
      };
    }

    const cancelRender = schedulePreviewRender(renderChapter);

    return () => {
      cancelled = true;
      cancelRender();
    };
    // v0.34: activeRenderTarget(レンダー毎に新オブジェクト)ではなく
    // activeRenderKey(文字列)のみに依存し、非同期画像インライン処理が
    // state 更新のたびにキャンセルされないようにする。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRenderKey]);

  useEffect(() => {
    let cancelled = false;
    setNextChapterHtml(nextRenderedChapter);

    if (!nextRenderedChapter || !workspaceRoot) {
      return () => {
        cancelled = true;
      };
    }

    void inlineWorkspaceAssetImages(
      nextRenderedChapter.html,
      async (path) => {
        const image = await openWorkspaceImage(workspaceRoot, path);
        return image.dataUrl;
      },
    ).then((inlined) => {
      if (!cancelled) {
        setNextChapterHtml({
          ...nextRenderedChapter,
          html: inlined,
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [nextRenderedChapter, workspaceRoot]);

  useLayoutEffect(() => {
    if (!activeChapterHtml || activeChapterHtml.index !== activeChapter?.index) {
      return;
    }

    const flow = flowRef.current;
    // v0.34: 初回レンダリング直後など flowRef が未設定のタイミングを弾く。
    if (!flow) {
      return;
    }
    const nextPageCount = measureRenderedChapterPageCount(
      activeChapterHtml,
      flow,
    );
    chapterPageCountsRef.current.set(
      activeChapterIndexSafe,
      normalizeEBookPageCount(nextPageCount),
    );
    setPageViewportHeight(measurePageViewportHeight(viewportRef.current));
    setVisiblePageStep(getVisiblePageStep(viewportRef.current, flow));
    setMeasuredPageCount(nextPageCount);
    setActivePageIndex((current) => {
      const pendingTarget = pendingPageTargetRef.current;
      pendingPageTargetRef.current = null;
      if (pendingTarget === "last") {
        return Math.max(nextPageCount - 1, 0);
      }
      if (pendingTarget === "first") {
        return 0;
      }
      if (typeof pendingTarget === "number") {
        return clampPageIndex(pendingTarget, nextPageCount);
      }
      return clampPageIndex(current, nextPageCount);
    });
  }, [activeChapter?.index, activeChapterHtml]);

  // v0.34: ResizeObserver / MutationObserver / 画像load からのページ再計測を
  // rAF で1フレームに1回に coalesce する。連続リサイズや画像続読み込みでの
  // 強制リフロー（全子要素 getClientRects ループ）の嵐を防ぐ。
  const scheduleRemeasure = useCallback(() => {
    if (measureFrameRef.current !== null) {
      return;
    }
    measureFrameRef.current = window.requestAnimationFrame(() => {
      measureFrameRef.current = null;
      const flow = flowRef.current;
      const chapter = activeChapterHtmlRef.current;
      if (!flow || !chapter) {
        return;
      }
      setPageViewportHeight(measurePageViewportHeight(viewportRef.current));
      setVisiblePageStep(getVisiblePageStep(viewportRef.current, flow));
      setMeasuredPageCount(measureRenderedChapterPageCount(chapter, flow));
    });
  }, []);

  // v0.34: アンマウント時に保留中の計測 rAF をキャンセルする。
  useEffect(() => {
    return () => {
      if (measureFrameRef.current !== null) {
        window.cancelAnimationFrame(measureFrameRef.current);
        measureFrameRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(scheduleRemeasure);
    observer.observe(viewport);
    return () => {
      observer.disconnect();
    };
  }, [scheduleRemeasure]);

  useEffect(() => {
    if (typeof MutationObserver === "undefined") {
      return;
    }

    const root = document.documentElement;
    const observer = new MutationObserver(scheduleRemeasure);
    observer.observe(root, {
      attributeFilter: ["data-theme", "style"],
      attributes: true,
    });
    return () => {
      observer.disconnect();
    };
  }, [scheduleRemeasure]);

  useEffect(() => {
    const flow = flowRef.current;
    if (!flow) {
      return;
    }

    const handleImageSettled = () => {
      scheduleRemeasure();
    };
    const images = Array.from(flow.querySelectorAll("img"));
    for (const image of images) {
      image.addEventListener("load", handleImageSettled);
      image.addEventListener("error", handleImageSettled);
      if (image.complete) {
        handleImageSettled();
      }
    }
    return () => {
      for (const image of images) {
        image.removeEventListener("load", handleImageSettled);
        image.removeEventListener("error", handleImageSettled);
      }
    };
  }, [activeChapterHtml]);

  useEffect(() => {
    setActivePageIndex((current) => clampPageIndex(current, measuredPageCount));
  }, [measuredPageCount]);

  useEffect(() => {
    if (!onLocationChange) {
      pendingLocationNotificationRef.current = false;
      return;
    }
    if (!pendingLocationNotificationRef.current) {
      lastNotifiedLocationRef.current = {
        documentLocationKey,
        location: activeReaderLocation,
      };
      return;
    }
    pendingLocationNotificationRef.current = false;

    const lastNotifiedLocation = lastNotifiedLocationRef.current;
    if (
      lastNotifiedLocation?.documentLocationKey === documentLocationKey &&
      readerLocationsEqual(
        lastNotifiedLocation.location,
        activeReaderLocation,
      )
    ) {
      return;
    }
    lastNotifiedLocationRef.current = {
      documentLocationKey,
      location: activeReaderLocation,
    };
    onLocationChange(activeReaderLocation);
  }, [activeReaderLocation, documentLocationKey, onLocationChange]);

  useLayoutEffect(() => {
    setPageOffset(
      measureRenderedChapterPageOffset(activePageIndexSafe, flowRef.current),
    );
  }, [activePageIndexSafe, activeChapterHtml, measuredPageCount]);

  useEffect(
    () => () => {
      if (wheelCooldownRef.current !== null) {
        window.clearTimeout(wheelCooldownRef.current);
      }
    },
    [],
  );

  const markReaderLocationIntent = () => {
    pendingLocationNotificationRef.current = true;
  };

  const rememberChapterPageCount = (chapterIndex: number, pageCount: number) => {
    if (chapterIndex < 0 || chapterIndex >= chapters.length) {
      return;
    }
    chapterPageCountsRef.current.set(
      chapterIndex,
      normalizeEBookPageCount(pageCount),
    );
  };

  const getRememberedChapterPageCount = (chapterIndex: number) =>
    chapterPageCountsRef.current.get(chapterIndex) ?? null;

  const rememberNextChapterPreviewPageCount = () => {
    if (!shouldShowNextChapterPreview || !nextChapterHtml) {
      return;
    }
    rememberChapterPageCount(
      activeChapterIndexSafe + 1,
      measureRenderedChapterPageCount(nextChapterHtml, nextPreviewFlowRef.current),
    );
  };

  const goToRelativePage = (direction: -1 | 1) => {
    const pageStep = getVisiblePageStep(viewportRef.current, flowRef.current);
    if (direction > 0) {
      rememberNextChapterPreviewPageCount();
    }
    const target = getReaderPageTargetByDelta({
      currentChapterIndex: activeChapterIndexSafe,
      currentPageCount: measuredPageCount,
      currentPageIndex: activePageIndexSafe,
      getChapterPageCount: getRememberedChapterPageCount,
      pageDelta: direction * pageStep,
      totalChapters: chapters.length,
    });
    if (
      target.chapterIndex === activeChapterIndexSafe &&
      typeof target.pageIndex === "number" &&
      target.pageIndex === activePageIndexSafe
    ) {
      return;
    }

    markReaderLocationIntent();
    setPageTransitionSuppressed(target.chapterIndex !== activeChapterIndexSafe);
    if (target.chapterIndex !== activeChapterIndexSafe) {
      pendingPageTargetRef.current = target.pageIndex;
      setActivePageIndex(
        typeof target.pageIndex === "number" ? target.pageIndex : 0,
      );
      setActiveChapterIndex(target.chapterIndex);
      return;
    }

    if (typeof target.pageIndex === "number") {
      setActivePageIndex(target.pageIndex);
    }
  };

  const goToPreviousPage = () => {
    goToRelativePage(-1);
  };

  const goToNextPage = () => {
    goToRelativePage(1);
  };

  const jumpToChapter = (chapterIndex: number) => {
    const nextChapterIndex = clampChapterIndex(chapterIndex, chapters.length);
    if (nextChapterIndex !== activeChapterIndexSafe || activePageIndexSafe !== 0) {
      markReaderLocationIntent();
    }
    pendingPageTargetRef.current = "first";
    setPageTransitionSuppressed(true);
    setActivePageIndex(0);
    setActiveChapterIndex(nextChapterIndex);
    setTableOfContentsOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goToPreviousPage();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      goToNextPage();
    } else if (event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      if (event.shiftKey) {
        goToPreviousPage();
      } else {
        goToNextPage();
      }
    }
  };

  const handleWheel = (event: WheelEvent<HTMLElement>) => {
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest("pre, .markdown-table-frame")
    ) {
      return;
    }

    if (event.deltaY === 0 || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
      return;
    }

    event.preventDefault();
    if (wheelCooldownRef.current !== null) {
      return;
    }

    wheelDeltaRef.current += event.deltaY;
    if (Math.abs(wheelDeltaRef.current) < WHEEL_PAGE_THRESHOLD) {
      return;
    }

    if (wheelDeltaRef.current > 0) {
      goToNextPage();
    } else {
      goToPreviousPage();
    }
    wheelDeltaRef.current = 0;
    wheelCooldownRef.current = window.setTimeout(() => {
      wheelCooldownRef.current = null;
      wheelDeltaRef.current = 0;
    }, WHEEL_PAGE_COOLDOWN_MS);
  };

  const handleClick = (event: MouseEvent<HTMLElement>) => {
    if (!onOpenLocalLink) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const link = target.closest("a[href]");
    if (!link || !event.currentTarget.contains(link)) {
      return;
    }

    const href = link.getAttribute("href")?.trim() ?? "";
    event.preventDefault();
    onOpenLocalLink(href);
  };

  const totalChapters = chapters.length;
  const tableOfContentsEntries = chapters.map((chapter) => ({
    chapterIndex: chapter.index,
    headingLevel: chapter.headingLevel,
    label: chapterNavigationLabel(chapter, chapter.index, totalChapters, copy),
  }));
  const chapterLabel = chapterNavigationLabel(
    activeChapter ?? null,
    activeChapterIndexSafe,
    totalChapters,
    copy,
  );
  const previousDisabled =
    activeChapterIndexSafe === 0 && activePageIndexSafe === 0;
  const nextDisabled =
    activeChapterIndexSafe >= totalChapters - 1 &&
    activePageIndexSafe >= measuredPageCount - 1;
  const focusAction = readingFocusActive
    ? onExitReadingFocus
    : onEnterReadingFocus;
  const focusActionLabel = readingFocusActive
    ? copy.exitReadingFocus
    : copy.enterReadingFocus;
  const hasSpareRightSpreadPage =
    visiblePageStep > 1 &&
    activePageIndexSafe + visiblePageStep > measuredPageCount;
  const shouldShowNextChapterPreview =
    readingFocusActive && hasSpareRightSpreadPage && nextChapterHtml !== null;
  const pageFlowStyle: EBookPageFlowStyle = {
    transform: `translateX(-${pageOffset}px)`,
  };
  if (pageViewportHeight > 0) {
    pageFlowStyle["--ebook-page-viewport-height"] = `${pageViewportHeight}px`;
  }

  return (
    <article
      aria-label={copy.readerLabel}
      className={`ebook-pane markdown-preview${readingFocusActive ? " ebook-pane-focus" : ""}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onWheel={handleWheel}
      tabIndex={0}
    >
      <header className="ebook-reader-chrome">
        <div className="ebook-reader-status">
          <div className="ebook-reader-title" title={chapterLabel}>
            {chapterLabel}
          </div>
          <div
            className="ebook-reader-progress"
            aria-label={copy.chapterProgress}
          >
            {copy.chapterProgress} {activeChapterIndexSafe + 1} /{" "}
            {totalChapters}
          </div>
          <div className="ebook-reader-progress" aria-label={copy.pageProgress}>
            {copy.pageProgress} {activePageIndexSafe + 1} / {measuredPageCount}
          </div>
        </div>
        {/* 進捗テキストの下の操作帯。e-book エリアにホバー（または子の
            キーボードフォーカス）でふわっと出る。前/次/目次/集中をまとめる。 */}
        <div className="ebook-reader-toolbar">
          <button
            className="ebook-reader-button"
            disabled={previousDisabled}
            onClick={goToPreviousPage}
            type="button"
          >
            {copy.previousPage}
          </button>
          {readingFocusActive && tableOfContentsEntries.length > 1 ? (
            <button
              aria-controls={
                tableOfContentsOpen
                  ? "ebook-reader-table-of-contents"
                  : undefined
              }
              aria-expanded={tableOfContentsOpen}
              className="ebook-reader-button ebook-reader-toc-toggle"
              onClick={() => setTableOfContentsOpen((open) => !open)}
              type="button"
            >
              {copy.tableOfContents}
            </button>
          ) : null}
          {focusAction ? (
            <button
              className="ebook-reader-button ebook-reader-floating-action"
              onClick={() => {
                if (readingFocusActive) {
                  onExitReadingFocus?.(activeReaderLocation);
                } else {
                  onEnterReadingFocus?.(activeReaderLocation);
                }
              }}
              type="button"
            >
              {focusActionLabel}
            </button>
          ) : null}
          <button
            className="ebook-reader-button"
            disabled={nextDisabled}
            onClick={goToNextPage}
            type="button"
          >
            {copy.nextPage}
          </button>
        </div>
      </header>
      {readingFocusActive && tableOfContentsOpen ? (
        <>
          <button
            aria-label={copy.closeTableOfContents}
            className="ebook-reader-toc-backdrop"
            onClick={() => setTableOfContentsOpen(false)}
            type="button"
          />
          <nav
            aria-label={copy.tableOfContents}
            className="ebook-reader-toc-panel"
            id="ebook-reader-table-of-contents"
          >
            <div className="ebook-reader-toc-header">
              <span>{copy.tableOfContents}</span>
              <button
                aria-label={copy.closeTableOfContents}
                className="ebook-reader-toc-close"
                onClick={() => setTableOfContentsOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>
            <div className="ebook-reader-toc-list">
              {tableOfContentsEntries.map((entry) => (
                <button
                  aria-current={
                    entry.chapterIndex === activeChapterIndexSafe
                      ? "location"
                      : undefined
                  }
                  className={`ebook-reader-toc-item${
                    entry.chapterIndex === activeChapterIndexSafe
                      ? " current"
                      : ""
                  }`}
                  key={`${entry.chapterIndex}-${entry.label}`}
                  onClick={() => jumpToChapter(entry.chapterIndex)}
                  style={{
                    paddingLeft: `${
                      12 + Math.max((entry.headingLevel ?? 1) - 1, 0) * 12
                    }px`,
                  }}
                  title={entry.label}
                  type="button"
                >
                  <span aria-hidden="true" className="ebook-reader-toc-index">
                    {entry.chapterIndex + 1}
                  </span>
                  <span className="ebook-reader-toc-text">{entry.label}</span>
                </button>
              ))}
            </div>
          </nav>
        </>
      ) : null}
      {activeChapterHtml ? (
        <section
          className={chapterClassName(
            activeChapterHtml,
            activeChapterIndexSafe,
          )}
        >
          <div className="ebook-page-sheet ebook-page-sheet-spread">
            <div className="ebook-page-viewport" ref={viewportRef}>
              <div
                className={
                  pageTransitionSuppressed
                    ? "ebook-page-flow ebook-page-flow-transition-suppressed"
                    : "ebook-page-flow"
                }
                dangerouslySetInnerHTML={{ __html: activeChapterHtml.html }}
                ref={flowRef}
                style={pageFlowStyle}
              />
              {shouldShowNextChapterPreview && nextChapterHtml ? (
                <div className="ebook-next-chapter-preview">
                  <div
                    className="ebook-next-chapter-preview-flow"
                    dangerouslySetInnerHTML={{
                      __html: nextChapterHtml.html,
                    }}
                    ref={nextPreviewFlowRef}
                  />
                </div>
              ) : null}
            </div>
            <footer
              className="ebook-reader-footer"
              aria-label={copy.pageProgress}
            >
              <span className="ebook-reader-footer-title" title={chapterLabel}>
                {copy.footerChapter}: {chapterLabel}
              </span>
              <span className="ebook-reader-footer-page">
                {copy.footerPageProgress} {activePageIndexSafe + 1} /{" "}
                {measuredPageCount}
              </span>
            </footer>
          </div>
        </section>
      ) : null}
    </article>
  );
}

function measureRenderedChapterPageCount(
  chapter: RenderedChapter | null,
  flow: HTMLElement | null,
): number {
  if (chapter?.isStandaloneImage) {
    return 1;
  }
  return normalizeEBookPageCount(measureEBookPageCount(flow));
}

function measureRenderedChapterPageOffset(
  pageIndex: number,
  flow: HTMLElement | null,
): number {
  // v0.34: flow が未設定（初回レンダリング直後等）の場合は安全に0を返す。
  if (!flow) {
    return 0;
  }
  const pageOffset = getEBookPageOffset(pageIndex, flow);
  return Number.isFinite(pageOffset) ? Math.max(0, pageOffset) : 0;
}

function normalizeEBookPageCount(pageCount: number): number {
  if (!Number.isFinite(pageCount)) {
    return 1;
  }
  return Math.max(1, Math.trunc(pageCount));
}

function getReaderPageTargetByDelta({
  currentChapterIndex,
  currentPageCount,
  currentPageIndex,
  getChapterPageCount,
  pageDelta,
  totalChapters,
}: {
  currentChapterIndex: number;
  currentPageCount: number;
  currentPageIndex: number;
  getChapterPageCount: (chapterIndex: number) => number | null;
  pageDelta: number;
  totalChapters: number;
}): ReaderPageTarget {
  const lastChapterIndex = Math.max(totalChapters - 1, 0);
  const direction = Math.sign(pageDelta);
  let remainingPages = Math.abs(Math.trunc(pageDelta));
  let chapterIndex = clampChapterIndex(currentChapterIndex, totalChapters);
  let pageIndex = clampPageIndex(currentPageIndex, currentPageCount);

  if (direction === 0 || remainingPages === 0) {
    return { chapterIndex, pageIndex };
  }

  if (direction > 0) {
    while (remainingPages > 0) {
      const pageCount = pageCountForNavigationTarget(
        chapterIndex,
        currentChapterIndex,
        currentPageCount,
        getChapterPageCount,
      );
      if (pageCount === null) {
        return { chapterIndex, pageIndex };
      }

      const pagesAfterCurrent = Math.max(0, pageCount - 1 - pageIndex);
      if (remainingPages <= pagesAfterCurrent) {
        return { chapterIndex, pageIndex: pageIndex + remainingPages };
      }

      remainingPages -= pagesAfterCurrent + 1;
      if (chapterIndex >= lastChapterIndex) {
        return { chapterIndex, pageIndex: Math.max(pageCount - 1, 0) };
      }

      chapterIndex += 1;
      pageIndex = 0;
    }
    return { chapterIndex, pageIndex };
  }

  while (remainingPages > 0) {
    if (remainingPages <= pageIndex) {
      return { chapterIndex, pageIndex: pageIndex - remainingPages };
    }

    remainingPages -= pageIndex + 1;
    if (chapterIndex <= 0) {
      return { chapterIndex: 0, pageIndex: 0 };
    }

    chapterIndex -= 1;
    const pageCount = pageCountForNavigationTarget(
      chapterIndex,
      currentChapterIndex,
      currentPageCount,
      getChapterPageCount,
    );
    if (pageCount === null) {
      return { chapterIndex, pageIndex: "last" };
    }
    pageIndex = Math.max(pageCount - 1, 0);
  }
  return { chapterIndex, pageIndex };
}

function pageCountForNavigationTarget(
  chapterIndex: number,
  currentChapterIndex: number,
  currentPageCount: number,
  getChapterPageCount: (chapterIndex: number) => number | null,
): number | null {
  if (chapterIndex === currentChapterIndex) {
    return normalizeEBookPageCount(currentPageCount);
  }
  const pageCount = getChapterPageCount(chapterIndex);
  return pageCount === null ? null : normalizeEBookPageCount(pageCount);
}

function measurePageViewportHeight(viewport: HTMLElement | null): number {
  if (!viewport) {
    return 0;
  }
  const style = window.getComputedStyle(viewport);
  const verticalPadding =
    parseCssPixelValue(style.paddingTop) + parseCssPixelValue(style.paddingBottom);
  return Math.max(0, Math.round(viewport.clientHeight - verticalPadding));
}

function getVisiblePageStep(
  viewport: HTMLElement | null,
  flow: HTMLElement | null,
): number {
  if (!viewport || !flow) {
    return 1;
  }

  const flowStyle = window.getComputedStyle(flow);
  const pageWidth = parseCssPixelValue(flowStyle.columnWidth);
  const pageGap = parseCssPixelValue(flowStyle.columnGap);
  if (pageWidth > 0) {
    const spreadWidth = pageWidth * 2 + pageGap;
    return viewport.clientWidth + EBOOK_SPREAD_WIDTH_TOLERANCE >= spreadWidth
      ? 2
      : 1;
  }

  const chapter = viewport.closest(".ebook-chapter");
  if (
    chapter instanceof HTMLElement &&
    chapter.clientWidth >= EBOOK_SPREAD_CONTAINER_MIN_WIDTH
  ) {
    return 2;
  }
  return 1;
}

function getEBookReaderLocation(
  chapter: EbookChapter | undefined,
  chapterIndex: number,
  pageIndex: number,
  pageCount: number,
): EBookReaderLocation {
  const location = {
    chapterIndex,
    pageIndex,
  };
  const sourceLine = chapter
    ? estimateChapterSourceLine(chapter, pageIndex, pageCount)
    : null;

  return sourceLine === null ? location : { ...location, sourceLine };
}

function readerLocationsEqual(
  first: EBookReaderLocation,
  second: EBookReaderLocation,
): boolean {
  return (
    first.chapterIndex === second.chapterIndex &&
    first.pageIndex === second.pageIndex &&
    first.sourceLine === second.sourceLine
  );
}

function estimateChapterSourceLine(
  chapter: Pick<EbookChapter, "source" | "startLine">,
  pageIndex: number,
  pageCount: number,
): number {
  const lineCount = countMarkdownSourceLines(chapter.source);
  const safePageCount = Math.max(1, Math.trunc(pageCount));
  const safePageIndex = clampPageIndex(pageIndex, safePageCount);
  if (lineCount <= 1 || safePageCount <= 1) {
    return chapter.startLine;
  }

  const pageRatio = safePageIndex / (safePageCount - 1);
  return chapter.startLine + Math.round((lineCount - 1) * pageRatio);
}

function countMarkdownSourceLines(source: string): number {
  if (source.length === 0) {
    return 1;
  }
  const lineCount = source.split(/\r\n|\n|\r/).length;
  return /(?:\r\n|\n|\r)$/.test(source)
    ? Math.max(1, lineCount - 1)
    : lineCount;
}

function parseCssPixelValue(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function renderEbookChapter(
  chapter: {
    headingLevel: number | null;
    headingText: string | null;
    index: number;
    source: string;
  },
  documentPath: string | null | undefined,
  workspaceRoot: string | null | undefined,
): RenderedChapter {
  const html = markEbookImagePages(
    renderMarkdown(applyEbookPageBreakMarkers(chapter.source), {
      documentPath,
      workspaceRoot,
    }),
  );

  return {
    index: chapter.index,
    headingLevel: chapter.headingLevel,
    headingText: chapter.headingText,
    html,
    isStandaloneImage:
      chapter.headingLevel === null && isStandaloneMarkdownImage(chapter.source),
  };
}

function isStandaloneMarkdownImage(source: string): boolean {
  return /^!\[[^\]\n]*\]\([^\n]+\)$/.test(source.trim());
}

function markEbookImagePages(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;

  for (const paragraph of Array.from(template.content.querySelectorAll("p"))) {
    const image = imageOnlyParagraphImage(paragraph);
    if (image) {
      const page = document.createElement("div");
      page.className = "ebook-image-page";
      page.append(image);
      paragraph.replaceWith(page);
    }
  }

  return template.innerHTML;
}

function imageOnlyParagraphImage(
  paragraph: HTMLParagraphElement,
): HTMLImageElement | null {
  const visibleNodes = Array.from(paragraph.childNodes).filter((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node.textContent ?? "").trim() !== "";
    }
    return true;
  });

  if (
    visibleNodes.length === 1 &&
    visibleNodes[0] instanceof HTMLImageElement
  ) {
    return visibleNodes[0];
  }
  return null;
}

function clampChapterIndex(index: number, totalChapters: number): number {
  if (totalChapters <= 0) {
    return 0;
  }
  return Math.min(Math.max(index, 0), totalChapters - 1);
}

function clampPageIndex(index: number, totalPages: number): number {
  if (totalPages <= 0) {
    return 0;
  }
  return Math.min(Math.max(index, 0), totalPages - 1);
}

function chapterClassName(
  chapter: RenderedChapter,
  position: number,
): string {
  const classes = ["ebook-chapter"];
  if (position === 0) {
    classes.push("ebook-chapter-opener");
    if (chapter.isStandaloneImage) {
      classes.push("ebook-chapter-cover-image");
    }
    if (chapter.headingLevel === 1 && chapter.headingText) {
      classes.push("ebook-chapter-cover");
    } else {
      classes.push("ebook-chapter-frontmatter");
    }
  }
  if (chapter.headingText === null) {
    classes.push("ebook-chapter-preamble");
  }
  return classes.join(" ");
}

function chapterNavigationLabel(
  chapter: Pick<RenderedChapter, "headingText"> | null,
  position: number,
  totalChapters: number,
  copy: EBookReaderCopy,
): string {
  const headingText = chapter?.headingText?.trim();
  if (headingText) {
    return headingText;
  }
  if (totalChapters === 1) {
    return copy.body;
  }
  if (position === 0) {
    return copy.frontMatter;
  }
  return `${position + 1} / ${totalChapters}`;
}

function getEBookReaderCopy(
  menuLanguage: MenuLanguage,
): EBookReaderCopy {
  if (menuLanguage === "kana") {
    return {
      body: "本文",
      chapterProgress: "章",
      closeTableOfContents: "もくじを閉じる",
      enterReadingFocus: "よむことに集中",
      exitReadingFocus: "編集にもどる",
      footerChapter: "章",
      footerPageProgress: "章内ページ",
      frontMatter: "前付",
      nextPage: "つぎのページ",
      pageProgress: "ページ",
      previousPage: "まへのページ",
      readerLabel: "本のやうに読む",
      tableOfContents: "もくじ",
    };
  }

  if (isJapaneseMenuLanguage(menuLanguage)) {
    return {
      body: "本文",
      chapterProgress: "章",
      closeTableOfContents: "目次を閉じる",
      enterReadingFocus: "集中して読む",
      exitReadingFocus: "編集に戻る",
      footerChapter: "章",
      footerPageProgress: "章内ページ",
      frontMatter: "前付",
      nextPage: "次のページ",
      pageProgress: "ページ",
      previousPage: "前のページ",
      readerLabel: "本のように読む",
      tableOfContents: "目次",
    };
  }

  return {
    body: "Body",
    chapterProgress: "Chapter",
    closeTableOfContents: "Close contents",
    enterReadingFocus: "Focus reading",
    exitReadingFocus: "Back to editor",
    footerChapter: "Chapter",
    footerPageProgress: "Chapter page",
    frontMatter: "Front matter",
    nextPage: "Next page",
    pageProgress: "Page",
    previousPage: "Previous page",
    readerLabel: "Book reader",
    tableOfContents: "Contents",
  };
}
