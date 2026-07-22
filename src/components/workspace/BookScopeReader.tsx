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
  mediaAccess?: MediaImageAccessOptions | null;
  menuLanguage: MenuLanguage;
  onApproveLocalImageParent?: (resolvedPath: string) => void;
  onClose: () => void;
  onEditChapter: (path: string) => void;
  onOpenLink: (documentPath: string, href: string) => void;
  workspaceRoot: string;
};

export function BookScopeReader({
  documents,
  failures,
  skippedForBudget,
  mediaAccess = null,
  menuLanguage,
  onApproveLocalImageParent,
  onClose,
  onEditChapter,
  onOpenLink,
  workspaceRoot,
}: Props) {
  const copy = readerCopy(menuLanguage);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const manuscriptRef = useRef<HTMLElement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
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

  useEffect(() => {
    setActiveChapterIndex(0);
  }, [documents]);

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

  const scrollToChapter = (index: number) => {
    if (index < 0 || index >= documents.length) return;
    setActiveChapterIndex(index);
    globalThis.document
      .getElementById(bookReaderChapterId(index))
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
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
              onChange={(event) => setSearchQuery(event.target.value)}
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
  };
}
