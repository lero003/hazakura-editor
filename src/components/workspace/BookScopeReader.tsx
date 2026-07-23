import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  createBookScopeReaderSearchCorpus,
  resolveReaderDocumentIndex,
  searchBookScopeReaderCorpus,
  type BookScopeReaderLoadResult,
} from "../../features/bookScope";
import type { MediaImageAccessOptions } from "../../features/editor/imagePolicy";
import { stripYamlFrontmatter } from "../../features/editor/markdownFrontmatter";
import type { MenuLanguage } from "../../types";

const PreviewPane = lazy(() => import("../editor/preview/PreviewPane"));

type Props = Pick<
  BookScopeReaderLoadResult,
  "documents" | "failures" | "skippedForBudget"
> & {
  /** App-private resume target from a previous Reader session. */
  initialRelativePath?: string | null;
  /** 0–1 scroll progress inside the manuscript container. */
  initialScrollRatio?: number;
  mediaAccess?: MediaImageAccessOptions | null;
  menuLanguage: MenuLanguage;
  onApproveLocalImageParent?: (resolvedPath: string) => void;
  onClose: () => void;
  onEditChapter: (path: string) => void;
  onOpenLink: (documentPath: string, href: string) => void;
  /** Persist current chapter + scroll ratio (app-private; never writes Markdown). */
  onReadingPositionChange?: (
    relativePath: string,
    scrollRatio: number,
  ) => void;
  workspaceRoot: string;
};

export function BookScopeReader({
  documents,
  failures,
  skippedForBudget,
  initialRelativePath = null,
  initialScrollRatio = 0,
  mediaAccess = null,
  menuLanguage,
  onApproveLocalImageParent,
  onClose,
  onEditChapter,
  onOpenLink,
  onReadingPositionChange,
  workspaceRoot,
}: Props) {
  const copy = readerCopy(menuLanguage);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const manuscriptRef = useRef<HTMLElement | null>(null);
  const suppressObserverUntilRef = useRef(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [showResumeNote, setShowResumeNote] = useState(
    () => Boolean(initialRelativePath),
  );
  const [activeChapterIndex, setActiveChapterIndex] = useState(() =>
    resolveReaderDocumentIndex(documents, initialRelativePath),
  );
  const normalizedSearchQuery = searchQuery.trim();
  const searchCorpus = useMemo(
    () => createBookScopeReaderSearchCorpus(documents),
    [documents],
  );
  const searchMatches = useMemo(
    () => searchBookScopeReaderCorpus(searchCorpus, searchQuery),
    [searchCorpus, searchQuery],
  );
  const visibleContents = normalizedSearchQuery
    ? searchMatches.map((match) => ({
        ...match,
        document: documents[match.documentIndex],
      }))
    : documents.map((document, documentIndex) => ({
        document,
        documentIndex,
        occurrenceCount: 0,
      }));
  const totalSearchOccurrences = searchMatches.reduce(
    (total, match) => total + match.occurrenceCount,
    0,
  );
  const clampedActiveIndex =
    documents.length === 0
      ? 0
      : Math.min(Math.max(activeChapterIndex, 0), documents.length - 1);
  const activeDocument = documents[clampedActiveIndex] ?? null;
  const canGoPrevious = clampedActiveIndex > 0;
  const canGoNext = clampedActiveIndex < documents.length - 1;

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  // Restore app-private reading position once per document load.
  // Re-apply scroll ratio while lazy Preview panes settle (height grows).
  useEffect(() => {
    const index = resolveReaderDocumentIndex(documents, initialRelativePath);
    setActiveChapterIndex(index);
    setShowResumeNote(Boolean(initialRelativePath));
    const root = manuscriptRef.current;
    if (!root || documents.length === 0) return;

    const applyResume = (behavior: ScrollBehavior) => {
      suppressObserverUntilRef.current = performance.now() + 700;
      const chapter = globalThis.document.getElementById(
        bookReaderChapterId(index),
      );
      if (chapter && typeof chapter.scrollIntoView === "function") {
        chapter.scrollIntoView({ behavior, block: "start" });
      }
      if (initialScrollRatio > 0.01) {
        const maxScroll = Math.max(0, root.scrollHeight - root.clientHeight);
        root.scrollTop =
          maxScroll * Math.min(1, Math.max(0, initialScrollRatio));
      }
    };

    applyResume("auto");
    // Preview panes load asynchronously; re-apply after layout settles.
    const retryIds = [120, 400, 900, 1600].map((delay) =>
      window.setTimeout(() => applyResume("auto"), delay),
    );
    const hide = initialRelativePath
      ? window.setTimeout(() => setShowResumeNote(false), 4000)
      : null;
    return () => {
      for (const id of retryIds) window.clearTimeout(id);
      if (hide !== null) window.clearTimeout(hide);
    };
  }, [documents, initialRelativePath, initialScrollRatio]);

  useEffect(() => {
    const root = manuscriptRef.current;
    if (!root || documents.length === 0) return;
    if (typeof IntersectionObserver === "undefined") return;

    const chapterElements = documents
      .map((_, index) =>
        globalThis.document.getElementById(bookReaderChapterId(index)),
      )
      .filter((element): element is HTMLElement => element !== null);
    if (chapterElements.length === 0) return;

    const ratios = new Map<number, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        if (performance.now() < suppressObserverUntilRef.current) return;
        for (const entry of entries) {
          const index = Number(entry.target.getAttribute("data-chapter-index"));
          if (!Number.isFinite(index)) continue;
          ratios.set(index, entry.isIntersecting ? entry.intersectionRatio : 0);
        }
        let bestIndex = 0;
        let bestRatio = -1;
        for (const [index, ratio] of ratios) {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestIndex = index;
          }
        }
        if (bestRatio > 0) {
          setActiveChapterIndex(bestIndex);
        }
      },
      {
        root,
        // Prefer the chapter occupying the upper half of the manuscript.
        rootMargin: "0px 0px -45% 0px",
        threshold: [0, 0.15, 0.35, 0.55, 0.75, 1],
      },
    );

    for (const element of chapterElements) {
      observer.observe(element);
    }
    return () => observer.disconnect();
  }, [documents]);

  // Persist scroll + chapter while reading (debounced).
  useEffect(() => {
    const root = manuscriptRef.current;
    if (!root || !onReadingPositionChange || documents.length === 0) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const report = () => {
      const document = documents[clampedActiveIndex];
      if (!document) return;
      const maxScroll = Math.max(0, root.scrollHeight - root.clientHeight);
      const scrollRatio =
        maxScroll <= 0 ? 0 : Math.min(1, Math.max(0, root.scrollTop / maxScroll));
      onReadingPositionChange(document.relativePath, scrollRatio);
    };
    const onScroll = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(report, 250);
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      root.removeEventListener("scroll", onScroll);
      if (timer) clearTimeout(timer);
      // Flush latest position when leaving the reader.
      report();
    };
  }, [clampedActiveIndex, documents, onReadingPositionChange]);

  const scrollToChapter = (index: number) => {
    if (index < 0 || index >= documents.length) return;
    suppressObserverUntilRef.current = performance.now() + 500;
    setActiveChapterIndex(index);
    const target = globalThis.document.getElementById(
      bookReaderChapterId(index),
    );
    if (target && typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    const document = documents[index];
    if (document && onReadingPositionChange) {
      onReadingPositionChange(document.relativePath, 0);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      if (
        searchQuery &&
        event.target instanceof HTMLInputElement &&
        event.target.type === "search"
      ) {
        event.preventDefault();
        event.stopPropagation();
        setSearchQuery("");
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      surfaceRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])",
      ) ?? [],
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  return (
    <div
      aria-label={copy.title}
      aria-modal="true"
      className="book-reader-surface"
      onKeyDown={handleKeyDown}
      ref={surfaceRef}
      role="dialog"
    >
      <header className="book-reader-header">
        <div>
          <span>{copy.kicker}</span>
          <h1>{copy.title}</h1>
          <p>{copy.count(documents.length)}</p>
        </div>
        <button onClick={onClose} ref={closeButtonRef} type="button">
          {copy.close}
        </button>
      </header>

      {failures.length > 0 || skippedForBudget.length > 0 ? (
        <aside className="book-reader-notice" role="status">
          <strong>{copy.partial}</strong>
          {failures.map((failure) => (
            <span key={`failure:${failure.relativePath}`}>
              {failure.relativePath}: {failure.reason}
            </span>
          ))}
          {skippedForBudget.map((path) => (
            <span key={`budget:${path}`}>{path}: {copy.overBudget}</span>
          ))}
        </aside>
      ) : null}

      <div className="book-reader-layout">
        <nav aria-label={copy.contents} className="book-reader-contents">
          <strong>{copy.contents}</strong>
          <label className="book-reader-search">
            <span>{copy.search}</span>
            <input
              aria-label={copy.search}
              data-book-reader-search="true"
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                const match = event.shiftKey
                  ? [...searchMatches]
                      .reverse()
                      .find(
                        (candidate) =>
                          candidate.documentIndex < clampedActiveIndex,
                      ) ?? searchMatches.at(-1)
                  : searchMatches.find(
                      (candidate) =>
                        candidate.documentIndex > clampedActiveIndex,
                    ) ?? searchMatches[0];
                if (!match) return;
                event.preventDefault();
                event.stopPropagation();
                scrollToChapter(match.documentIndex);
              }}
              placeholder={copy.searchPlaceholder}
              type="search"
              value={searchQuery}
            />
          </label>
          {normalizedSearchQuery ? (
            <p aria-live="polite" className="book-reader-search-status" role="status">
              {copy.searchSummary(searchMatches.length, totalSearchOccurrences)}
            </p>
          ) : null}
          {visibleContents.map(({ document, documentIndex, occurrenceCount }) => (
            <button
              key={document.path}
              aria-current={documentIndex === clampedActiveIndex ? "true" : undefined}
              aria-label={copy.goToLabel(document.name, occurrenceCount)}
              className={
                documentIndex === clampedActiveIndex
                  ? "book-reader-contents-active"
                  : undefined
              }
              onClick={() => scrollToChapter(documentIndex)}
              type="button"
            >
              <span>{documentIndex + 1}</span>
              <span className="book-reader-contents-name">{document.name}</span>
              {normalizedSearchQuery ? (
                <small>{copy.matchCount(occurrenceCount)}</small>
              ) : null}
            </button>
          ))}
        </nav>

        <div className="book-reader-manuscript-shell">
          {activeDocument ? (
            <div
              aria-label={copy.chapterNav}
              className="book-reader-chapter-bar"
              role="navigation"
            >
              <button
                aria-label={copy.previousChapter}
                disabled={!canGoPrevious}
                onClick={() => scrollToChapter(clampedActiveIndex - 1)}
                type="button"
              >
                {copy.previous}
              </button>
              <p className="book-reader-chapter-bar-label">
                <span>{copy.nowReading}</span>
                <strong>
                  {clampedActiveIndex + 1}. {activeDocument.name}
                </strong>
                {showResumeNote ? (
                  <small className="book-reader-resume-note">{copy.resumed}</small>
                ) : null}
              </p>
              <button
                aria-label={copy.nextChapter}
                disabled={!canGoNext}
                onClick={() => scrollToChapter(clampedActiveIndex + 1)}
                type="button"
              >
                {copy.next}
              </button>
            </div>
          ) : null}
          <main className="book-reader-manuscript" ref={manuscriptRef}>
            {documents.length === 0 ? (
              <p className="book-reader-empty">{copy.empty}</p>
            ) : null}
            {documents.map((document, index) => (
              <section
                className="book-reader-chapter"
                data-chapter-index={index}
                id={bookReaderChapterId(index)}
                key={document.path}
              >
                <header>
                  <h2>
                    <span>{index + 1}.</span> {document.name}
                    {document.usesLiveBuffer ? <small>{copy.liveBuffer}</small> : null}
                  </h2>
                  <button
                    aria-label={copy.editLabel(document.name)}
                    onClick={() => onEditChapter(document.path)}
                    type="button"
                  >
                    {copy.edit}
                  </button>
                </header>
                <Suspense fallback={<p>{copy.loading}</p>}>
                  <PreviewPane
                    documentKey={`book-reader:${document.path}`}
                    documentPath={document.path}
                    mediaAccess={mediaAccess}
                    onApproveLocalImageParent={onApproveLocalImageParent}
                    onOpenLocalLink={(href) => onOpenLink(document.path, href)}
                    source={stripYamlFrontmatter(document.source)}
                    workspaceRoot={workspaceRoot}
                  />
                </Suspense>
              </section>
            ))}
          </main>
        </div>
      </div>
    </div>
  );
}

function bookReaderChapterId(index: number): string {
  return `book-reader-chapter-${index + 1}`;
}

function readerCopy(language: MenuLanguage) {
  if (language === "en") {
    return {
      close: "Close", contents: "Contents", edit: "Edit Markdown",
      editLabel: (name: string) => `Edit ${name}`,
      goToLabel: (name: string, count: number) => count > 0
        ? `Go to ${name}, ${count} matches`
        : `Go to ${name}`,
      empty: "No available Markdown could be loaded.", kicker: "BOOK",
      liveBuffer: "Unsaved edits included", loading: "Rendering Markdown…",
      matchCount: (count: number) => `${count}`,
      overBudget: "not loaded because the reader limit was reached",
      partial: "Some items are not shown", title: "Read whole book",
      search: "Search this book", searchPlaceholder: "Words in loaded chapters",
      searchSummary: (chapters: number, occurrences: number) =>
        `${chapters} chapter(s), ${occurrences} match(es)`,
      count: (count: number) => `${count} item(s) loaded`,
      chapterNav: "Chapter navigation",
      nowReading: "Now reading",
      previous: "Previous",
      next: "Next",
      previousChapter: "Previous chapter",
      nextChapter: "Next chapter",
      resumed: "Resumed",
    };
  }
  return {
    close: "閉じる", contents: "目次", edit: "このMarkdownを編集",
    editLabel: (name: string) => `${name}を編集`,
    goToLabel: (name: string, count: number) => count > 0
      ? `${name}へ移動、${count}件一致`
      : `${name}へ移動`,
    empty: "読み込めるMarkdownがありません。", kicker: "本",
    liveBuffer: "未保存の編集を反映", loading: "Markdownを描画しています…",
    matchCount: (count: number) => `${count}件`,
    overBudget: "読書上限に達したため読み込みませんでした",
    partial: "表示していない項目があります", title: "本全体を読む",
    search: "本の中を検索", searchPlaceholder: "読み込んだ章の言葉",
    searchSummary: (chapters: number, occurrences: number) =>
      `${chapters}章・${occurrences}件一致`,
    count: (count: number) => `${count}件を読み込み`,
    chapterNav: "章の移動",
    nowReading: "いま読んでいる章",
    previous: "前の章",
    next: "次の章",
    previousChapter: "前の章へ",
    nextChapter: "次の章へ",
    resumed: "続きから",
  };
}
