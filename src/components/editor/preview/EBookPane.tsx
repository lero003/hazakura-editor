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
  collectEbookChapterSubheadings,
  coalesceChaptersToTopLevel,
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
import {
  clampChapterIndex,
  clampPageIndex,
  commitPageCount,
  getReaderPageTargetByDelta,
  normalizeEBookPageCount,
  type PendingPageTarget,
  type ReaderPageTarget,
} from "./ebookPageTarget";
import {
  countMarkdownSourceLines,
  estimateChapterSourceLine,
  getEBookReaderLocation,
  readerLocationsEqual,
  type EBookReaderLocation,
} from "./ebookReaderLocation";

// Re-export the reader-location type so existing callers that imported it
// from EBookPane keep compiling. The implementation now lives in
// ./ebookReaderLocation.
export type { EBookReaderLocation };

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
  // The reader treats only H1 (`#`) and H2 (`##`) as chapter boundaries.
  // `splitMarkdownIntoChapters` still splits at every ATX heading (it is
  // shared with EPUB export, whose navigation needs every heading), so here
  // we merge the H3-and-below segments back into the preceding H1/H2
  // chapter as in-chapter subheadings. This mirrors how an EPUB reader opens
  // top-level sections one at a time and keeps subsections inline, and it
  // stops a long document with dozens of `###` entries from fragmenting
  // into one-screen chapters.
  const rawChapters = useMemo(() => splitMarkdownIntoChapters(source), [source]);
  const chapters = useMemo(
    () => coalesceChaptersToTopLevel(rawChapters),
    [rawChapters],
  );
  const chapterSubheadings = useMemo(
    () => collectEbookChapterSubheadings(rawChapters, chapters),
    [chapters, rawChapters],
  );
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
  const articleRef = useRef<HTMLElement | null>(null);
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
  // The reader pane and the editor pane are DOM siblings, so a keydown on
  // the editor's CodeMirror contentDOM never bubbles up to the reader
  // article. To keep arrow-key / space paging responsive even while the
  // editor still owns focus, the paging callbacks are also wired to a
  // document-level capture-phase listener that intercepts the key before
  // CodeMirror can consume it.
  const goNextPageRef = useRef<() => void>(() => {});
  const goPreviousPageRef = useRef<() => void>(() => {});

  useEffect(() => {
    chapterPageCountsRef.current.clear();
    // Reset the same-chapter floor tracking so the first measurement of a
    // new document is treated as a fresh chapter (no stale floor from the
    // previous document).
    measuredChapterIndexRef.current = null;
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
  // Latest committed page count, mirrored into a ref so the layout effect and
  // the remeasure callback can read the previous committed value without
  // joining the effect's dependency array (which would re-run on every page
  // count change and fight the measurement).
  const measuredPageCountRef = useRef(measuredPageCount);
  measuredPageCountRef.current = measuredPageCount;
  // Index of the chapter whose page count is currently committed to
  // `measuredPageCount`. Used to decide whether a fresh measurement is a
  // same-chapter re-measure (where the provisional-count floor applies) or a
  // chapter change (where it must not, so a short new chapter is not padded
  // to the previous chapter's page count).
  const measuredChapterIndexRef = useRef<number | null>(null);
  // Active chapter index mirrored into a ref so the rAF remeasure callback
  // reads the chapter at callback time, not at schedule time. Pair it with
  // `activeChapterHtmlRef` so both reflect the same render.
  const activeChapterIndexRef = useRef(activeChapterIndexSafe);
  activeChapterIndexRef.current = activeChapterIndexSafe;
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
    const measuredPageCount = measureRenderedChapterPageCount(
      activeChapterHtml,
      flow,
    );
    const imagesSettled = allFlowImagesComplete(flow);
    // The provisional-count floor only applies to a same-chapter re-measure.
    // Right after a chapter change the previous committed count belongs to
    // the old chapter, so using it as a floor would pad a short new chapter
    // up to the old chapter's page count and create blank pages.
    const isSameChapter =
      measuredChapterIndexRef.current === activeChapterIndexSafe;
    const nextPageCount = commitPageCount(
      measuredPageCount,
      isSameChapter ? measuredPageCountRef.current : null,
      imagesSettled,
    );
    measuredChapterIndexRef.current = activeChapterIndexSafe;
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
      if (!imagesSettled && current <= nextPageCount - 1) {
        return current;
      }
      return clampPageIndex(current, nextPageCount);
    });
    // The new chapter's HTML is now measured and the page offset is
    // settled, so the one-shot chapter-cross transition suppression can
    // be released. Without this the transition stayed off permanently
    // after the first chapter change.
    setPageTransitionSuppressed(false);
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
      const chapterIndex = activeChapterIndexRef.current;
      if (chapter.index !== chapterIndex) {
        return;
      }
      const measured = measureRenderedChapterPageCount(chapter, flow);
      const imagesSettled = allFlowImagesComplete(flow);
      // Apply the same provisional-count floor as the layout effect: within a
      // chapter, never let a settled count drop below a previously committed
      // one (image still loading → too-small provisional). Across a chapter
      // change (rAF fired after the reader already moved on) there is no
      // safe floor, so pass null.
      const isSameChapter = measuredChapterIndexRef.current === chapterIndex;
      const nextPageCount = commitPageCount(
        measured,
        isSameChapter ? measuredPageCountRef.current : null,
        imagesSettled,
      );
      measuredChapterIndexRef.current = chapterIndex;
      // Keep the chapter→pageCount map in sync. Without this, a chapter that
      // grew (e.g. 1→5 pages) as its images loaded would still be remembered
      // at its old count after the reader leaves and returns, breaking the
      // previous-chapter last-page calculation.
      chapterPageCountsRef.current.set(
        chapterIndex,
        normalizeEBookPageCount(nextPageCount),
      );
      setPageViewportHeight(measurePageViewportHeight(viewportRef.current));
      setVisiblePageStep(getVisiblePageStep(viewportRef.current, flow));
      setMeasuredPageCount(nextPageCount);
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
    setActivePageIndex((current) => {
      // Same provisional-count guard as the layout effect above: while images
      // are still decoding the measured page count is too small, so clamping
      // the active page downward against it would skip pages. Hold the
      // current page until the images settle and the count is recomputed.
      if (
        !allFlowImagesComplete(flowRef.current) &&
        current <= measuredPageCount - 1
      ) {
        return current;
      }
      return clampPageIndex(current, measuredPageCount);
    });
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
    const previewFlow = nextPreviewFlowRef.current;
    // The next chapter is rendered offscreen as a preview and its images
    // decode asynchronously. A page count measured while those images are
    // still loading is provisional (too small); remembering it would make
    // the chapter-cross continuation clamp think the next chapter is too
    // short and rewind to its opener even though its opener was already
    // previewed. Hold the previously remembered count (if any) until the
    // preview's images settle, so the clamp sees the true length.
    if (!allFlowImagesComplete(previewFlow)) {
      return;
    }
    rememberChapterPageCount(
      activeChapterIndexSafe + 1,
      measureRenderedChapterPageCount(nextChapterHtml, previewFlow),
    );
  };

  const goToRelativePage = (direction: -1 | 1) => {
    // A chapter cross arms `pendingPageTargetRef` and the next chapter's HTML
    // is rendered / measured asynchronously (debounced render + layout
    // effect). Until that settles, `measuredPageCount` still reflects the
    // previous chapter, so another turn computed now would land on a stale
    // page count and skip pages. Hold off until the pending target clears.
    if (pendingPageTargetRef.current !== null) {
      return;
    }
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
      hasVisibleNextChapterPreview: shouldShowNextChapterPreview,
    });
    if (
      target.chapterIndex === activeChapterIndexSafe &&
      typeof target.pageIndex === "number" &&
      target.pageIndex === activePageIndexSafe
    ) {
      return;
    }

    markReaderLocationIntent();
    // Suppress the transform transition only when crossing into a new
    // chapter (the content is swapped, so sliding would look wrong).
    // Within the same chapter the slide animation should stay enabled.
    // Previously this only set `true` on a chapter change and never reset
    // to `false`, so once any chapter change happened the transition
    // stayed off forever and later in-chapter flips snapped, then caught
    // the restored transition mid-flight and flickered.
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

  // Keep the paging callbacks reachable from the document-level capture
  // listener declared below without reopening it on every render. The
  // assignment happens on every render after the callbacks are defined,
  // so the listener always invokes the latest closure.
  goNextPageRef.current = goToNextPage;
  goPreviousPageRef.current = goToPreviousPage;

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
    // Ignore the OS auto-repeat so a held key does not outrun the page-state
    // update and skip pages. The document-level capture listener checks the
    // same flag; this guards the React onKeyDown path as well.
    if (event.repeat) {
      return;
    }
    // Focus can drift from the article root to a rendered child (e.g. a
    // link) or be pulled back by the editor pane after a reflow. Once it
    // leaves the article, the old `target === currentTarget` guard dropped
    // the event entirely and the reader could not page with the keyboard
    // again until the user re-clicked it. Treat any key handled here as a
    // reader intent: prevent the default, keep the focus on the article,
    // and continue paging so the reader can flip pages rapidly even on a
    // single-page chapter where the page state does not change.
    if (
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight" &&
      event.key !== " " &&
      event.key !== "Spacebar"
    ) {
      return;
    }
    event.preventDefault();

    if (event.key === "ArrowLeft") {
      goToPreviousPage();
    } else if (event.key === "ArrowRight") {
      goToNextPage();
    } else if (event.key === " " || event.key === "Spacebar") {
      if (event.shiftKey) {
        goToPreviousPage();
      } else {
        goToNextPage();
      }
    }

    const article = articleRef.current;
    if (article && document.activeElement !== article) {
      article.focus();
    }
  };

  useEffect(() => {
    const isReaderPagingKey = (
      event: globalThis.KeyboardEvent,
    ): -1 | 1 | null => {
      // Ignore the OS auto-repeat that fires while a key is held down. One
      // key press turns one page; without this the repeat outruns React's
      // state update and the next turn is computed against a stale page
      // index, which is a primary cause of skipped pages during rapid
      // flipping. The wheel path already has its own cooldown; this brings
      // the keyboard path to parity.
      if (event.repeat) {
        return null;
      }
      if (event.isComposing) {
        return null;
      }
      // Let typing happen when focus is inside a form field (search box,
      // table-of-contents filter, etc.) so reader paging does not hijack
      // text input.
      const active = document.activeElement;
      if (
        active instanceof HTMLElement &&
        (active.isContentEditable ||
          active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.tagName === "SELECT")
      ) {
        return null;
      }
      // Avoid stealing the key while the user has a text selection that
      // paging would discard.
      const selection = window.getSelection();
      if (selection && selection.toString().length > 0) {
        return null;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return null;
      }
      if (event.key === "ArrowLeft") {
        return -1;
      }
      if (event.key === "ArrowRight" || event.key === " " || event.key === "Spacebar") {
        return event.shiftKey && event.key !== "ArrowRight" ? -1 : 1;
      }
      return null;
    };

    const handleCaptureKeyDown = (event: globalThis.KeyboardEvent) => {
      // The reader article and the editor CodeMirror are DOM siblings, so
      // a keydown that starts on the editor never bubbles to the article.
      // Capture the event at the document level, before CodeMirror can
      // consume it, so arrow-key / space paging keeps working even while
      // the editor still owns focus (e.g. right after opening the e-book
      // pane, or on a single-page chapter where repeated flips must not
      // fall through to the editor).
      if (!articleRef.current) {
        return;
      }
      const direction = isReaderPagingKey(event);
      if (direction === null) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (direction > 0) {
        goNextPageRef.current();
      } else {
        goPreviousPageRef.current();
      }
      const article = articleRef.current;
      if (article && document.activeElement !== article) {
        article.focus();
      }
    };

    document.addEventListener("keydown", handleCaptureKeyDown, {
      capture: true,
    });
    return () => {
      document.removeEventListener("keydown", handleCaptureKeyDown, {
        capture: true,
      });
    };
  }, []);

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
  const tableOfContentsEntries = chapters.map((chapter) => {
    const subheadings = chapterSubheadings[chapter.index] ?? [];
    const isCurrent = chapter.index === activeChapterIndexSafe;
    // 現在の章は実測値から「ページ N / M」を、他章はキャッシュされた
    // ページ数(まだ読んでいない章は未計測なので null)から組み立てる。
    // 全章に進捗を出すことで、目次が「章番号だけのリスト」ではなく
    // 原稿の全体像をつかめる dense な案内になる。非現章は「ページ N」
    // (= N ページ構成) という簡易表示にする。
    const rememberedPageCount = isCurrent
      ? measuredPageCount
      : (getRememberedChapterPageCount(chapter.index) ?? 0);
    const pageProgress =
      rememberedPageCount > 0
        ? isCurrent
          ? `${copy.pageProgress} ${activePageIndexSafe + 1} / ${measuredPageCount}`
          : `${copy.pageProgress} ${rememberedPageCount}`
        : null;
    return {
      chapterIndex: chapter.index,
      headingLevel: chapter.headingLevel,
      label: chapterNavigationLabel(chapter, chapter.index, totalChapters, copy),
      pageProgress,
      remainingSubheadingCount: Math.max(0, subheadings.length - 4),
      subheadingPreview: subheadings.slice(0, 4),
    };
  });
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
      ref={articleRef}
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
              {tableOfContentsEntries.map((entry) => {
                const subheadingText =
                  entry.subheadingPreview.length > 0
                    ? [
                        entry.subheadingPreview.join("・"),
                        entry.remainingSubheadingCount > 0
                          ? moreSubheadingsLabel(
                              entry.remainingSubheadingCount,
                              menuLanguage,
                            )
                          : "",
                      ]
                        .filter(Boolean)
                        .join("・")
                    : "";
                return (
                  <button
                    aria-label={composeTocAccessibleName(
                      entry.label,
                      subheadingText,
                      entry.pageProgress,
                    )}
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
                    <span className="ebook-reader-toc-context">
                      <span className="ebook-reader-toc-text">
                        {entry.label}
                      </span>
                      {entry.subheadingPreview.length > 0 ? (
                        <span className="ebook-reader-toc-subheadings">
                          {entry.subheadingPreview.join("・")}
                          {entry.remainingSubheadingCount > 0
                            ? `・${moreSubheadingsLabel(entry.remainingSubheadingCount, menuLanguage)}`
                            : ""}
                        </span>
                      ) : null}
                      {entry.pageProgress ? (
                        <span className="ebook-reader-toc-progress">
                          {entry.pageProgress}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
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

// Whether every image inside the flow has settled (loaded or errored). Until
// this is true the layout is still shifting as images decode, so a page count
// measured now would be too small and would clamp the active page index
// downward — which is the primary cause of "the page jumps from one heading
// to another" in long, illustrated documents. Callers hold off committing a
// measured page count until the images settle, so the reader never sees a
// provisional (too small) page count.
function allFlowImagesComplete(flow: HTMLElement | null): boolean {
  if (!flow) {
    return true;
  }
  const images = flow.querySelectorAll("img");
  for (const image of Array.from(images)) {
    if (!image.complete) {
      return false;
    }
  }
  return true;
}

// Decide the page count to commit given a freshly measured `next` value.
// While images are still decoding, `next` is provisional and may be smaller
// than the real count (the content has not yet expanded to its final
// height). Committing a too-small count would shrink the displayed total,
// the page offset, the reader location, and the chapter-cross calculations —
// all of which can make the page jump backward from one heading to another.
// So while images are unsettled, never let the committed count drop below its
// previous value — but only within the same chapter: the previous value is
// passed as `null` right after a chapter change, so a short new chapter is
// never padded up to the old chapter's page count (which would create blank
// pages and `Page 1 / 12`-style ghost totals). Once images settle, the
// freshly measured count is trusted as final. The pure commit decision lives
// in `./ebookPageTarget` so the floor behavior gains focused coverage.

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

// epub-like page-break rule. One user action moves by one spread (pageStep
// pages, 2 in spread mode / 1 in single-page mode) and crosses at most one
// chapter boundary. The pure target computation lives in `./ebookPageTarget`
// (`getReaderPageTargetByDelta`) so the chapter-cross decisions gain focused
// coverage.

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

function moreSubheadingsLabel(count: number, menuLanguage: MenuLanguage): string {
  if (menuLanguage === "en") {
    return `${count} more`;
  }
  if (menuLanguage === "kana") {
    return `ほか${count}けん`;
  }
  return `ほか${count}件`;
}

// Compose a single accessible name for a TOC entry button. Without an
// explicit `aria-label`, the button's accessible name is derived from its
// child text, but a flat `aria-label={entry.label}` overrides that and
// hides the subheading preview and page progress from assistive tech.
// This helper combines all three into one label so a screen reader
// announces the heading, its subheading context, and the page progress
// in one pass.
function composeTocAccessibleName(
  label: string,
  subheadingText: string,
  pageProgress: string | null,
): string {
  return [label, subheadingText, pageProgress].filter(Boolean).join("、");
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
