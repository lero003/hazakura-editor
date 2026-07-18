import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  type KeyboardEvent,
} from "react";
import type { BookScopeReaderLoadResult } from "../../features/bookScope";
import type { MediaImageAccessOptions } from "../../features/editor/imagePolicy";
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

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      surfaceRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])",
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
          {documents.map((document, index) => (
            <button
              key={document.path}
              onClick={() =>
                globalThis.document
                  .getElementById(bookReaderChapterId(index))
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              type="button"
            >
              <span>{index + 1}</span>
              {document.name}
            </button>
          ))}
        </nav>

        <main className="book-reader-manuscript">
          {documents.length === 0 ? (
            <p className="book-reader-empty">{copy.empty}</p>
          ) : null}
          {documents.map((document, index) => (
            <section
              className="book-reader-chapter"
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
                  source={document.source}
                  workspaceRoot={workspaceRoot}
                />
              </Suspense>
            </section>
          ))}
        </main>
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
      close: "Close", contents: "Contents", edit: "Edit chapter",
      editLabel: (name: string) => `Edit ${name}`,
      empty: "No available chapters could be loaded.", kicker: "BOOK SCOPE",
      liveBuffer: "Unsaved edits included", loading: "Rendering chapter…",
      overBudget: "not loaded because the reader limit was reached",
      partial: "Some chapters are not shown", title: "Read whole book",
      count: (count: number) => `${count} chapter(s) loaded`,
    };
  }
  return {
    close: "閉じる", contents: "目次", edit: "この章を編集",
    editLabel: (name: string) => `${name}を編集`,
    empty: "読み込める章がありません。", kicker: "BOOK SCOPE",
    liveBuffer: "未保存の編集を反映", loading: "章を描画しています…",
    overBudget: "読書上限に達したため読み込みませんでした",
    partial: "表示していない章があります", title: "本全体を読む",
    count: (count: number) => `${count}章を読み込み`,
  };
}
