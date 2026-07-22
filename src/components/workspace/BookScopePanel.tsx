import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type {
  BookScopeChapter,
  BookScopeUnavailableEntry,
  WorkspaceTreeEntry,
} from "../../lib/tauri";
import {
  bookScopeSiblingPosition,
  flattenBookScopeNodes,
  mergeBookScopeTreeSelection,
  moveBookScopeNode,
  removeBookScopeNodePath,
  type BookScopeNode,
} from "../../features/bookScope";
import type { BookScopeSuggestion } from "../../features/bookScope";
import type { BookScopeSuggestionOptions } from "../../features/bookScope";
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
  nodes: readonly BookScopeNode[];
  onCommit: (nodes: readonly BookScopeNode[]) => void;
  onCancelSuggest?: () => void;
  onExportRecipe?: () => void | Promise<void>;
  onImportRecipeDraft?: () => Promise<{
    nodes: readonly BookScopeNode[];
    chapterRelativePaths: readonly string[];
  } | null>;
  onLoadDirectory: (path: string) => Promise<void>;
  onOpenChapter: (path: string) => void;
  onReadBook?: () => void;
  onRevalidate: () => void;
  onSuggest?: (
    options: BookScopeSuggestionOptions,
  ) => Promise<BookScopeSuggestion | null>;
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
  nodes,
  onCommit,
  onCancelSuggest = () => {},
  onExportRecipe,
  onImportRecipeDraft,
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
  const [draftNodes, setDraftNodes] = useState<BookScopeNode[]>(() => [...nodes]);
  const [suggestion, setSuggestion] = useState<BookScopeSuggestion | null>(null);
  const [includeIndexPages, setIncludeIndexPages] = useState(true);
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
  const hasUnavailable = unavailable.length > 0;
  const displayRows = useMemo(() => bookScopeDisplayRows(nodes), [nodes]);

  const beginEditing = () => {
    restoreFocusRef.current = false;
    setSelectedPaths(new Set(chapterRelativePaths));
    setDraftNodes([...nodes]);
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
    const retained = flattenBookScopeNodes(draftNodes).filter((path) =>
      selectedPaths.has(path),
    );
    onCommit(
      mergeBookScopeTreeSelection(draftNodes, [...retained, ...treeOrder]),
    );
    restoreFocusRef.current = true;
    setEditing(false);
  };
  const createSuggestion = async () => {
    if (!onSuggest || suggesting) return;
    const next = await onSuggest({ includeIndexPages });
    if (!next) return;
    setSelectedPaths(new Set(next.chapterRelativePaths));
    setDraftNodes(next.nodes);
    setSuggestion(next);
    setEditing(true);
  };
  const importRecipeDraft = async () => {
    if (!onImportRecipeDraft) return;
    const next = await onImportRecipeDraft();
    if (!next) return;
    restoreFocusRef.current = false;
    setSelectedPaths(new Set(next.chapterRelativePaths));
    setDraftNodes([...next.nodes]);
    setSuggestion({
      nodes: [...next.nodes],
      chapterRelativePaths: [...next.chapterRelativePaths],
      linkedChapterCount: next.chapterRelativePaths.length,
      includedIndexPageCount: 0,
      excludedSupportFileCount: 0,
      unreadableFileCount: 0,
      candidateLimitReached: false,
      scanIncomplete: false,
    });
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
              suggestion.includedIndexPageCount,
            )}
            {suggestion.scanIncomplete || suggestion.candidateLimitReached
              ? ` ${copy.suggestionIncomplete}`
              : ""}
          </p>
        ) : null}
        {suggestionError ? (
          <p className="book-scope-inline-error" role="alert">
            {suggestionError}
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
          {onSuggest ? (
            <label className="book-scope-index-option">
              <input
                checked={includeIndexPages}
                disabled={suggesting}
                onChange={(event) => setIncludeIndexPages(event.currentTarget.checked)}
                type="checkbox"
              />
              {copy.includeIndexPages}
            </label>
          ) : null}
          {suggesting ? (
            <button onClick={onCancelSuggest} type="button">
              {copy.stopSuggestion}
            </button>
          ) : onSuggest ? (
            <button onClick={() => void createSuggestion()} type="button">
              {copy.suggest}
            </button>
          ) : null}
          {onImportRecipeDraft ? (
            <button onClick={() => void importRecipeDraft()} type="button">
              {copy.importRecipe}
            </button>
          ) : null}
          <span className="book-scope-edit-actions-spacer" />
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
        <p className="book-scope-storage-note">{copy.storageNote}</p>
        {suggestionError ? (
          <p className="book-scope-inline-error" role="alert">
            {suggestionError}
          </p>
        ) : null}
        <div className="book-scope-empty-actions">
          {onSuggest ? (
            <label className="book-scope-index-option">
              <input
                checked={includeIndexPages}
                disabled={suggesting}
                onChange={(event) => setIncludeIndexPages(event.currentTarget.checked)}
                type="checkbox"
              />
              {copy.includeIndexPages}
            </label>
          ) : null}
          <button
            className="primary"
            onClick={beginEditing}
            ref={editTriggerRef}
            type="button"
          >
            {copy.choose}
          </button>
          {suggesting ? (
            <button onClick={onCancelSuggest} type="button">
              {copy.stopSuggestion}
            </button>
          ) : onSuggest ? (
            <button onClick={() => void createSuggestion()} type="button">
              {copy.suggest}
            </button>
          ) : null}
          {onImportRecipeDraft ? (
            <button onClick={() => void importRecipeDraft()} type="button">
              {copy.importRecipe}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="book-scope-panel">
      <div className="book-scope-toolbar">
        <div className="book-scope-toolbar-meta">
          <span>{copy.chapterCount(chapterRelativePaths.length)}</span>
          {hasUnavailable ? (
            <span className="book-scope-toolbar-warning" role="status">
              {copy.unavailableCount(unavailable.length)}
            </span>
          ) : null}
        </div>
        <div className="book-scope-toolbar-actions">
          {onReadBook ? (
            <button
              className="primary"
              disabled={readerLoading}
              onClick={onReadBook}
              type="button"
            >
              {readerLoading ? copy.loadingReader : copy.readBook}
            </button>
          ) : null}
          <button onClick={beginEditing} ref={editTriggerRef} type="button">
            {copy.edit}
          </button>
          {onExportRecipe ? (
            <button onClick={() => void onExportRecipe()} type="button">
              {copy.exportRecipe}
            </button>
          ) : null}
          {onImportRecipeDraft ? (
            <button onClick={() => void importRecipeDraft()} type="button">
              {copy.importRecipe}
            </button>
          ) : null}
          {hasUnavailable ? (
            <button disabled={resolving} onClick={onRevalidate} type="button">
              {copy.recheck}
            </button>
          ) : null}
        </div>
      </div>
      <ol className="book-scope-list">
        {displayRows.map((row) => {
          if (row.node.kind === "group") {
            return (
              <li
                className="book-scope-group"
                key={row.key}
                style={{ "--book-scope-depth": row.depth } as CSSProperties}
              >
                <span>{row.node.title}</span>
              </li>
            );
          }
          const relativePath = row.node.relativePath;
          const index = row.chapterIndex;
          const chapter = chapterByPath.get(relativePath);
          const unavailableEntry = unavailableByPath.get(relativePath);
          const displayName =
            chapter?.name ?? relativePath.split("/").at(-1) ?? relativePath;
          const showPathHint = shouldShowChapterPathHint(relativePath);
          return (
            <li
              className={`${chapter?.path === activePath ? "active" : ""}${unavailableEntry ? " unavailable" : ""}`}
              key={relativePath}
              style={{ "--book-scope-depth": row.depth } as CSSProperties}
            >
              <button
                aria-label={displayName}
                aria-current={chapter?.path === activePath ? "page" : undefined}
                className="book-scope-chapter-open"
                disabled={!chapter}
                onClick={() => chapter && onOpenChapter(chapter.path)}
                title={relativePath}
                type="button"
              >
                <span className="book-scope-chapter-index">{index + 1}</span>
                <span className="book-scope-chapter-label">
                  {displayName}
                  {showPathHint ? <small>{relativePath}</small> : null}
                  {unavailableEntry ? (
                    <em>{copy.unavailable(unavailableEntry.reason)}</em>
                  ) : null}
                </span>
              </button>
              <div className="book-scope-row-actions">
                <button
                  aria-label={copy.moveUp(relativePath)}
                  disabled={
                    (bookScopeSiblingPosition(nodes, relativePath)?.index ?? 0) === 0
                  }
                  onClick={() =>
                    onCommit(moveBookScopeNode(nodes, relativePath, -1))
                  }
                  type="button"
                >
                  ↑
                </button>
                <button
                  aria-label={copy.moveDown(relativePath)}
                  disabled={(() => {
                    const position = bookScopeSiblingPosition(nodes, relativePath);
                    return !position || position.index === position.count - 1;
                  })()}
                  onClick={() =>
                    onCommit(moveBookScopeNode(nodes, relativePath, 1))
                  }
                  type="button"
                >
                  ↓
                </button>
                <button
                  aria-label={copy.remove(relativePath)}
                  onClick={() =>
                    onCommit(removeBookScopeNodePath(nodes, relativePath))
                  }
                  type="button"
                >
                  ×
                </button>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

type BookScopeDisplayRow = {
  chapterIndex: number;
  depth: number;
  key: string;
  node: BookScopeNode;
};

function bookScopeDisplayRows(nodes: readonly BookScopeNode[]): BookScopeDisplayRow[] {
  const rows: BookScopeDisplayRow[] = [];
  let chapterIndex = 0;
  const visit = (
    entries: readonly BookScopeNode[],
    depth: number,
    prefix: string,
  ): void => {
    entries.forEach((node, index) => {
      const key =
        node.kind === "document"
          ? node.relativePath
          : `${prefix}/group-${index}-${node.title}`;
      const currentChapterIndex = chapterIndex;
      if (node.kind === "document") chapterIndex += 1;
      rows.push({ chapterIndex: currentChapterIndex, depth, key, node });
      visit(node.children, depth + 1, key);
    });
  };
  visit(nodes, 0, "root");
  return rows;
}

/** Nested paths keep a path subtitle; root-level names stay one line. */
export function shouldShowChapterPathHint(relativePath: string): boolean {
  return relativePath.includes("/");
}

function bookScopeCopy(language: MenuLanguage) {
  if (language === "en") {
    return {
      cancel: "Cancel",
      choose: "Choose chapters",
      edit: "Edit",
      empty: "Choose Markdown files to treat as one book.",
      storageNote:
        "Chapter order is saved on this Mac with the app. It is not written into the folder, and it is not OKF book order.",
      recheck: "Recheck",
      save: "Save",
      loadingReader: "Loading…",
      readBook: "Read all",
      stopSuggestion: "Stop scan",
      suggest: "Suggest from workspace",
      exportRecipe: "Export recipe",
      importRecipe: "Import recipe",
      includeIndexPages: "Include index.md as cover / contents pages",
      suggestionIncomplete: "Partial scan — review before saving.",
      suggestionSummary: (count: number, linked: number, indexes: number) =>
        `${count} item(s) suggested (${linked} body / note item(s), ${indexes} cover / contents page(s)).`,
      selectionPurpose: "Check the Markdown chapters to include.",
      selectionLabel: "Choose book chapters",
      chapterCount: (count: number) => `${count} items`,
      unavailableCount: (count: number) =>
        count === 1 ? "1 unavailable" : `${count} unavailable`,
      moveUp: (path: string) => `Move ${path} up`,
      moveDown: (path: string) => `Move ${path} down`,
      remove: (path: string) => `Remove ${path} from book`,
      unavailable: (reason: string) =>
        `Unavailable: ${bookScopeReason(reason, "en")}`,
    };
  }
  return {
    cancel: "キャンセル",
    choose: "章を選ぶ",
    edit: "編集",
    empty: "Markdownを選び、一冊として扱います。",
    storageNote:
      "章の順序はこの Mac のアプリ内に保存します。フォルダ内の並びや OKF の順序ではありません。",
    recheck: "再確認",
    save: "保存",
    loadingReader: "読み込み中…",
    readBook: "本全体を読む",
    stopSuggestion: "走査を停止",
    suggest: "候補を作る",
    exportRecipe: "章立てを書き出す",
    importRecipe: "章立てを取り込む",
    includeIndexPages: "index.mdを扉・目次として含める",
    suggestionIncomplete: "走査は一部です。保存前に確認してください。",
    suggestionSummary: (count: number, linked: number, indexes: number) =>
      `${count}件を候補にしました（本文・資料${linked}・扉/目次${indexes}）`,
    selectionPurpose: "含めるMarkdownにチェックを入れます。",
    selectionLabel: "本の章を選択",
    chapterCount: (count: number) => `${count}項目`,
    unavailableCount: (count: number) => `利用不可 ${count}`,
    moveUp: (path: string) => `${path}を上へ移動`,
    moveDown: (path: string) => `${path}を下へ移動`,
    remove: (path: string) => `${path}を本から外す`,
    unavailable: (reason: string) =>
      `利用できません: ${bookScopeReason(reason, "ja")}`,
  };
}

function bookScopeReason(reason: string, language: "en" | "ja"): string {
  const reasons =
    language === "en"
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
  return (
    reasons[reason as keyof typeof reasons] ??
    (language === "en" ? "recheck required" : "再確認が必要です")
  );
}
