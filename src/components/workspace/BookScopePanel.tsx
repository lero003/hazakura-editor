import { useEffect, useMemo, useRef, useState } from "react";
import type {
  BookScopeChapter,
  BookScopeUnavailableEntry,
  WorkspaceTreeEntry,
} from "../../lib/tauri";
import {
  mergeBookScopeSelection,
  moveBookScopeChapter,
  removeBookScopePath,
} from "../../features/bookScope";
import type { BookScopeSuggestion } from "../../features/bookScope";
import type { MenuLanguage } from "../../types";
import {
  BookScopeSelectorTree,
  collectSelectedBookScopePaths,
} from "./BookScopeSelectorTree";

type Props = {
  activePath: string | null;
  chapterRelativePaths: readonly string[];
  chapters: readonly BookScopeChapter[];
  menuLanguage: MenuLanguage;
  onCommit: (paths: readonly string[]) => void;
  onCancelSuggest?: () => void;
  onLoadDirectory: (path: string) => Promise<void>;
  onOpenChapter: (path: string) => void;
  onReadBook?: () => void;
  onRevalidate: () => void;
  onSuggest?: () => Promise<BookScopeSuggestion | null>;
  resolving: boolean;
  readerLoading?: boolean;
  suggesting?: boolean;
  suggestionError?: string | null;
  unavailable: readonly BookScopeUnavailableEntry[];
  workspaceRootPath: string;
  workspaceTree: WorkspaceTreeEntry;
};

export function BookScopePanel({
  activePath,
  chapterRelativePaths,
  chapters,
  menuLanguage,
  onCommit,
  onCancelSuggest = () => {},
  onLoadDirectory,
  onOpenChapter,
  onReadBook,
  onRevalidate,
  onSuggest,
  resolving,
  readerLoading = false,
  suggesting = false,
  suggestionError = null,
  unavailable,
  workspaceRootPath,
  workspaceTree,
}: Props) {
  const copy = bookScopeCopy(menuLanguage);
  const [editing, setEditing] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(
    () => new Set(chapterRelativePaths),
  );
  const [draftOrder, setDraftOrder] = useState<string[]>(
    () => [...chapterRelativePaths],
  );
  const [suggestion, setSuggestion] = useState<BookScopeSuggestion | null>(null);
  const editTriggerRef = useRef<HTMLButtonElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = useRef(false);

  useEffect(() => {
    if (!editing) setSelectedPaths(new Set(chapterRelativePaths));
  }, [chapterRelativePaths, editing]);

  useEffect(() => {
    if (editing) {
      editorRef.current
        ?.querySelector<HTMLElement>("input:not([disabled]), button:not([disabled])")
        ?.focus();
      return;
    }
    if (restoreFocusRef.current) {
      restoreFocusRef.current = false;
      editTriggerRef.current?.focus();
    }
  }, [editing]);

  const chapterByPath = useMemo(
    () => new Map(chapters.map((chapter) => [chapter.relativePath, chapter])),
    [chapters],
  );
  const unavailableByPath = useMemo(
    () => new Map(unavailable.map((entry) => [entry.relativePath, entry])),
    [unavailable],
  );

  const beginEditing = () => {
    restoreFocusRef.current = false;
    setSelectedPaths(new Set(chapterRelativePaths));
    setDraftOrder([...chapterRelativePaths]);
    setSuggestion(null);
    setEditing(true);
  };
  const cancelEditing = () => {
    restoreFocusRef.current = true;
    setEditing(false);
  };
  const saveSelection = () => {
    const treeOrder = collectSelectedBookScopePaths(
      workspaceTree,
      workspaceRootPath,
      selectedPaths,
    );
    const retained = draftOrder.filter((path) => selectedPaths.has(path));
    onCommit(mergeBookScopeSelection(draftOrder, [...retained, ...treeOrder]));
    setEditing(false);
  };
  const createSuggestion = async () => {
    if (!onSuggest || suggesting) return;
    const next = await onSuggest();
    if (!next) return;
    setSelectedPaths(new Set(next.chapterRelativePaths));
    setDraftOrder([...next.chapterRelativePaths]);
    setSuggestion(next);
    setEditing(true);
  };

  if (editing) {
    return (
      <div
        aria-label={copy.selectionLabel}
        className="book-scope-panel book-scope-editing"
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          event.stopPropagation();
          cancelEditing();
        }}
        ref={editorRef}
        role="group"
      >
        <p className="book-scope-purpose">{copy.selectionPurpose}</p>
        {suggestion ? (
          <p className="book-scope-suggestion-summary" role="status">
            {copy.suggestionSummary(
              suggestion.chapterRelativePaths.length,
              suggestion.linkedChapterCount,
            )}
            {suggestion.scanIncomplete || suggestion.candidateLimitReached
              ? ` ${copy.suggestionIncomplete}`
              : ""}
          </p>
        ) : null}
        <BookScopeSelectorTree
          entry={workspaceTree}
          onLoadDirectory={onLoadDirectory}
          onToggle={(path, selected) => {
            setSelectedPaths((current) => {
              const next = new Set(current);
              if (selected) next.add(path);
              else next.delete(path);
              return next;
            });
          }}
          selectedPaths={selectedPaths}
          workspaceRootPath={workspaceRootPath}
        />
        <div className="book-scope-edit-actions">
          <button onClick={cancelEditing} type="button">
            {copy.cancel}
          </button>
          <button className="primary" onClick={saveSelection} type="button">
            {copy.save} ({selectedPaths.size})
          </button>
        </div>
      </div>
    );
  }

  if (chapterRelativePaths.length === 0) {
    return (
      <div className="book-scope-panel book-scope-empty">
        <p>{copy.empty}</p>
        {suggestionError ? <p className="book-scope-inline-error" role="alert">{suggestionError}</p> : null}
        <div className="book-scope-empty-actions">
          <button className="primary" onClick={beginEditing} ref={editTriggerRef} type="button">
            {copy.choose}
          </button>
          {suggesting ? (
            <button onClick={onCancelSuggest} type="button">{copy.stopSuggestion}</button>
          ) : onSuggest ? (
            <button onClick={() => void createSuggestion()} type="button">{copy.suggest}</button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="book-scope-panel">
      <div className="book-scope-toolbar">
        <span>{copy.chapterCount(chapterRelativePaths.length)}</span>
        {onReadBook ? (
          <button disabled={readerLoading} onClick={onReadBook} type="button">
            {readerLoading ? copy.loadingReader : copy.readBook}
          </button>
        ) : null}
        <button onClick={beginEditing} ref={editTriggerRef} type="button">{copy.edit}</button>
        {suggesting ? (
          <button onClick={onCancelSuggest} type="button">{copy.stopSuggestion}</button>
        ) : onSuggest ? (
          <button onClick={() => void createSuggestion()} type="button">{copy.suggestShort}</button>
        ) : null}
        <button disabled={resolving} onClick={onRevalidate} type="button">
          {copy.recheck}
        </button>
      </div>
      <ol className="book-scope-list">
        {chapterRelativePaths.map((relativePath, index) => {
          const chapter = chapterByPath.get(relativePath);
          const unavailableEntry = unavailableByPath.get(relativePath);
          return (
            <li
              className={`${chapter?.path === activePath ? "active" : ""}${unavailableEntry ? " unavailable" : ""}`}
              key={relativePath}
            >
              <button
                aria-label={chapter?.name ?? relativePath}
                aria-current={chapter?.path === activePath ? "page" : undefined}
                className="book-scope-chapter-open"
                disabled={!chapter}
                onClick={() => chapter && onOpenChapter(chapter.path)}
                title={relativePath}
                type="button"
              >
                <span className="book-scope-chapter-index">{index + 1}</span>
                <span className="book-scope-chapter-label">
                  {chapter?.name ?? relativePath.split("/").at(-1)}
                  <small>{relativePath}</small>
                  {unavailableEntry ? (
                    <em>{copy.unavailable(unavailableEntry.reason)}</em>
                  ) : null}
                </span>
              </button>
              <div className="book-scope-row-actions">
                <button
                  aria-label={copy.moveUp(relativePath)}
                  disabled={index === 0}
                  onClick={() => onCommit(moveBookScopeChapter(chapterRelativePaths, index, -1))}
                  type="button"
                >↑</button>
                <button
                  aria-label={copy.moveDown(relativePath)}
                  disabled={index === chapterRelativePaths.length - 1}
                  onClick={() => onCommit(moveBookScopeChapter(chapterRelativePaths, index, 1))}
                  type="button"
                >↓</button>
                <button
                  aria-label={copy.remove(relativePath)}
                  onClick={() => onCommit(removeBookScopePath(chapterRelativePaths, relativePath))}
                  type="button"
                >×</button>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function bookScopeCopy(language: MenuLanguage) {
  if (language === "en") {
    return {
      cancel: "Cancel", choose: "Choose chapters", edit: "Edit chapters",
      empty: "Choose Markdown files explicitly and treat them as one book.",
      recheck: "Recheck", save: "Save",
      loadingReader: "Loading…", readBook: "Read all",
      stopSuggestion: "Stop scan", suggest: "Suggest from workspace", suggestShort: "Suggest",
      suggestionIncomplete: "The scan was partial; review the draft before saving.",
      suggestionSummary: (count: number, linked: number) =>
        `${count} chapter(s) suggested (${linked} ordered from index.md).`,
      selectionPurpose: "Select Markdown chapters. Expanding a folder reads only that folder.",
      selectionLabel: "Choose book chapters",
      chapterCount: (count: number) => `${count} chapters`,
      moveUp: (path: string) => `Move ${path} up`, moveDown: (path: string) => `Move ${path} down`,
      remove: (path: string) => `Remove ${path} from book`,
      unavailable: (reason: string) => `Unavailable: ${bookScopeReason(reason, "en")}`,
    };
  }
  return {
    cancel: "キャンセル", choose: "章を選ぶ", edit: "章を編集",
    empty: "Markdownを明示的に選び、一冊として扱います。",
    recheck: "再確認", save: "保存",
    loadingReader: "読み込み中…", readBook: "本全体を読む",
    stopSuggestion: "走査を停止", suggest: "ワークスペースから候補を作る", suggestShort: "候補を作る",
    suggestionIncomplete: "走査結果は一部です。保存前に候補を確認してください。",
    suggestionSummary: (count: number, linked: number) =>
      `${count}章を候補にしました（index.mdの順序: ${linked}章）`,
    selectionPurpose: "本に含めるMarkdownを選びます。フォルダは開いた時だけ読み込みます。",
    selectionLabel: "本の章を選択",
    chapterCount: (count: number) => `${count}章`,
    moveUp: (path: string) => `${path}を上へ移動`, moveDown: (path: string) => `${path}を下へ移動`,
    remove: (path: string) => `${path}を本から外す`,
    unavailable: (reason: string) => `利用できません: ${bookScopeReason(reason, "ja")}`,
  };
}

function bookScopeReason(reason: string, language: "en" | "ja"): string {
  const reasons = language === "en"
    ? {
        duplicate: "duplicate entry",
        "invalid-path": "invalid path",
        missing: "file not found",
        "not-file": "not a file",
        "outside-workspace": "outside the workspace",
        symlink: "symbolic links are not allowed",
        unreadable: "file cannot be read",
        "unsupported-extension": "not a Markdown file",
      }
    : {
        duplicate: "章が重複しています",
        "invalid-path": "安全でないパスです",
        missing: "ファイルが見つかりません",
        "not-file": "ファイルではありません",
        "outside-workspace": "ワークスペース外です",
        symlink: "シンボリックリンクは使えません",
        unreadable: "ファイルを読み込めません",
        "unsupported-extension": "Markdownファイルではありません",
      };
  return reasons[reason as keyof typeof reasons]
    ?? (language === "en" ? "recheck required" : "再確認が必要です");
}
