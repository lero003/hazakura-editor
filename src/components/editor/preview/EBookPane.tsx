// v0.24 e-book Mode — display-only active chapter reader.
//
// This is still Path Y: Markdown is rendered through the existing
// `renderMarkdown()` / `inlineWorkspaceAssetImages()` safety pipeline,
// never through CodeMirror decoration. The Markdown source is never
// edited here; this pane is read-only by construction (it only sets
// `dangerouslySetInnerHTML` on sanitised HTML, with no input or
// contenteditable surface).
//
// The reader keeps one active chapter in the DOM and pages the chapter
// body with CSS Columns. Reader chrome, including the footer, stays
// outside the paginated flow so the columns never own navigation UI.

import {
  type KeyboardEvent,
  type MouseEvent,
  type WheelEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  applyEbookPageBreakMarkers,
  splitMarkdownIntoChapters,
} from "../../../features/editor/ebookChapters";
import {
  inlineWorkspaceAssetImages,
  renderMarkdown,
} from "../../../features/editor/markdown";
import { openWorkspaceImage } from "../../../lib/tauri";
import type { MenuLanguage } from "../../../types";
import { isJapaneseMenuLanguage } from "../../../types";
import {
  getEBookPageOffset,
  measureEBookPageCount,
} from "./ebookPagination";

type EBookPaneProps = {
  documentPath?: string | null;
  initialLocation?: EBookReaderLocation | null;
  menuLanguage?: MenuLanguage;
  onEnterReadingFocus?: (location: EBookReaderLocation) => void;
  onExitReadingFocus?: () => void;
  onLocationChange?: (location: EBookReaderLocation) => void;
  onOpenLocalLink?: (href: string) => void;
  readingFocusActive?: boolean;
  source: string;
  workspaceRoot?: string | null;
};

export type EBookReaderLocation = {
  chapterIndex: number;
  pageIndex: number;
};

type RenderedChapter = {
  index: number;
  headingLevel: number | null;
  headingText: string | null;
  html: string;
  isStandaloneImage: boolean;
};

type EBookReaderCopy = {
  body: string;
  chapterProgress: string;
  enterReadingFocus: string;
  exitReadingFocus: string;
  footerChapter: string;
  footerPageProgress: string;
  frontMatter: string;
  nextPage: string;
  pageProgress: string;
  previousPage: string;
  readerLabel: string;
};

const WHEEL_PAGE_THRESHOLD = 40;
const WHEEL_PAGE_COOLDOWN_MS = 220;

export default function EBookPane({
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
  const [pageTransitionSuppressed, setPageTransitionSuppressed] =
    useState(false);
  const pendingPageTargetRef = useRef<"first" | "last" | null>(null);
  const flowRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const wheelDeltaRef = useRef(0);
  const wheelCooldownRef = useRef<number | null>(null);

  useEffect(() => {
    pendingPageTargetRef.current = initialLocation ? null : "first";
    setActiveChapterIndex(
      clampChapterIndex(initialLocation?.chapterIndex ?? 0, chapters.length),
    );
    setActivePageIndex(Math.max(initialLocation?.pageIndex ?? 0, 0));
  }, [documentPath]);

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
  const activeRenderedChapter = useMemo<RenderedChapter | null>(() => {
    if (!activeChapter) {
      return null;
    }

    return renderEbookChapter(activeChapter, documentPath, workspaceRoot);
  }, [activeChapter, documentPath, workspaceRoot]);

  const [activeChapterHtml, setActiveChapterHtml] =
    useState<RenderedChapter | null>(activeRenderedChapter);

  useEffect(() => {
    let cancelled = false;
    setActiveChapterHtml(activeRenderedChapter);

    if (!activeRenderedChapter || !workspaceRoot) {
      return () => {
        cancelled = true;
      };
    }

    // Inline workspace images for the visible chapter only. This keeps
    // the Preview safety boundary while avoiding the v0.21 all-chapter
    // rebuild cost.
    void inlineWorkspaceAssetImages(
      activeRenderedChapter.html,
      async (path) => {
        const image = await openWorkspaceImage(workspaceRoot, path);
        return image.dataUrl;
      },
    ).then((inlined) => {
      if (!cancelled) {
        setActiveChapterHtml({
          ...activeRenderedChapter,
          html: inlined,
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeRenderedChapter, workspaceRoot]);

  useLayoutEffect(() => {
    if (!activeChapterHtml || activeChapterHtml.index !== activeChapter?.index) {
      return;
    }

    const flow = flowRef.current;
    const nextPageCount = measureRenderedChapterPageCount(
      activeChapterHtml,
      flow,
    );
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
      return clampPageIndex(current, nextPageCount);
    });
  }, [activeChapter?.index, activeChapterHtml]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      setMeasuredPageCount(
        measureRenderedChapterPageCount(activeChapterHtml, flowRef.current),
      );
    });
    observer.observe(viewport);
    return () => {
      observer.disconnect();
    };
  }, [activeChapterHtml]);

  useEffect(() => {
    if (typeof MutationObserver === "undefined") {
      return;
    }

    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setMeasuredPageCount(
        measureRenderedChapterPageCount(activeChapterHtml, flowRef.current),
      );
    });
    observer.observe(root, {
      attributeFilter: ["data-theme", "style"],
      attributes: true,
    });
    return () => {
      observer.disconnect();
    };
  }, [activeChapterHtml]);

  useEffect(() => {
    const flow = flowRef.current;
    if (!flow) {
      return;
    }

    const handleImageSettled = () => {
      setMeasuredPageCount(
        measureRenderedChapterPageCount(activeChapterHtml, flowRef.current),
      );
    };
    const images = Array.from(flow.querySelectorAll("img"));
    for (const image of images) {
      image.addEventListener("load", handleImageSettled);
      image.addEventListener("error", handleImageSettled);
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
    onLocationChange?.({
      chapterIndex: activeChapterIndexSafe,
      pageIndex: activePageIndexSafe,
    });
  }, [activeChapterIndexSafe, activePageIndexSafe, onLocationChange]);

  useLayoutEffect(() => {
    setPageOffset(getEBookPageOffset(activePageIndexSafe, flowRef.current));
  }, [activePageIndexSafe, activeChapterHtml, measuredPageCount]);

  useEffect(
    () => () => {
      if (wheelCooldownRef.current !== null) {
        window.clearTimeout(wheelCooldownRef.current);
      }
    },
    [],
  );

  const goToPreviousPage = () => {
    if (activePageIndex > 0) {
      setPageTransitionSuppressed(false);
      setActivePageIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (activeChapterIndexSafe > 0) {
      pendingPageTargetRef.current = "last";
      setPageTransitionSuppressed(true);
      setActiveChapterIndex((current) => Math.max(current - 1, 0));
    }
  };

  const goToNextPage = () => {
    if (activePageIndex < measuredPageCount - 1) {
      setPageTransitionSuppressed(false);
      setActivePageIndex((current) =>
        clampPageIndex(current + 1, measuredPageCount),
      );
      return;
    }

    if (activeChapterIndexSafe < chapters.length - 1) {
      pendingPageTargetRef.current = "first";
      setPageTransitionSuppressed(true);
      setActivePageIndex(0);
      setActiveChapterIndex((current) =>
        Math.min(current + 1, Math.max(chapters.length - 1, 0)),
      );
    }
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
  const focusAction = readingFocusActive ? onExitReadingFocus : onEnterReadingFocus;
  const focusActionLabel = readingFocusActive
    ? copy.exitReadingFocus
    : copy.enterReadingFocus;

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
        <button
          className="ebook-reader-button"
          disabled={previousDisabled}
          onClick={goToPreviousPage}
          type="button"
        >
          {copy.previousPage}
        </button>
        <div className="ebook-reader-status">
          <div className="ebook-reader-title" title={chapterLabel}>
            {chapterLabel}
          </div>
          <div className="ebook-reader-progress" aria-label={copy.chapterProgress}>
            {copy.chapterProgress} {activeChapterIndexSafe + 1} / {totalChapters}
          </div>
          <div className="ebook-reader-progress" aria-label={copy.pageProgress}>
            {copy.pageProgress} {activePageIndexSafe + 1} / {measuredPageCount}
          </div>
        </div>
        <button
          className="ebook-reader-button"
          disabled={nextDisabled}
          onClick={goToNextPage}
          type="button"
        >
          {copy.nextPage}
        </button>
      </header>
      {focusAction ? (
        <button
          className="ebook-reader-floating-action"
          onClick={() => {
            if (readingFocusActive) {
              onExitReadingFocus?.();
            } else {
              onEnterReadingFocus?.({
                chapterIndex: activeChapterIndexSafe,
                pageIndex: activePageIndexSafe,
              });
            }
          }}
          type="button"
        >
          {focusActionLabel}
        </button>
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
                style={{ transform: `translateX(-${pageOffset}px)` }}
              />
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
  return measureEBookPageCount(flow);
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
  const html = renderMarkdown(applyEbookPageBreakMarkers(chapter.source), {
    documentPath,
    workspaceRoot,
  });

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
      enterReadingFocus: "よむことに集中",
      exitReadingFocus: "編集にもどる",
      footerChapter: "章",
      footerPageProgress: "章内ページ",
      frontMatter: "前付",
      nextPage: "つぎのページ",
      pageProgress: "ページ",
      previousPage: "まへのページ",
      readerLabel: "本のやうに読む",
    };
  }

  if (isJapaneseMenuLanguage(menuLanguage)) {
    return {
      body: "本文",
      chapterProgress: "章",
      enterReadingFocus: "集中して読む",
      exitReadingFocus: "編集に戻る",
      footerChapter: "章",
      footerPageProgress: "章内ページ",
      frontMatter: "前付",
      nextPage: "次のページ",
      pageProgress: "ページ",
      previousPage: "前のページ",
      readerLabel: "本のように読む",
    };
  }

  return {
    body: "Body",
    chapterProgress: "Chapter",
    enterReadingFocus: "Focus reading",
    exitReadingFocus: "Back to editor",
    footerChapter: "Chapter",
    footerPageProgress: "Chapter page",
    frontMatter: "Front matter",
    nextPage: "Next page",
    pageProgress: "Page",
    previousPage: "Previous page",
    readerLabel: "Book reader",
  };
}
