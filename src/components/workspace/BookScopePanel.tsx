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
  onLoadDirectory: (path: string) => Promise<void>;
  onOpenChapter: (path: string) => void;
  onRevalidate: () => void;
  resolving: boolean;
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
  onLoadDirectory,
  onOpenChapter,
  onRevalidate,
  resolving,
  unavailable,
  workspaceRootPath,
  workspaceTree,
}: Props) {
  const copy = bookScopeCopy(menuLanguage);
  const [editing, setEditing] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(
    () => new Set(chapterRelativePaths),
  );
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
    const retained = chapterRelativePaths.filter((path) => selectedPaths.has(path));
    onCommit(mergeBookScopeSelection(retained, [...retained, ...treeOrder]));
    setEditing(false);
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
        <button className="primary" onClick={beginEditing} ref={editTriggerRef} type="button">
          {copy.choose}
        </button>
      </div>
    );
  }

  return (
    <div className="book-scope-panel">
      <div className="book-scope-toolbar">
        <span>{copy.chapterCount(chapterRelativePaths.length)}</span>
        <button onClick={beginEditing} ref={editTriggerRef} type="button">{copy.edit}</button>
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
      selectionPurpose: "Select Markdown chapters. Expanding a folder reads only that folder.",
      selectionLabel: "Choose book chapters",
      chapterCount: (count: number) => `${count} chapters`,
      moveUp: (path: string) => `Move ${path} up`, moveDown: (path: string) => `Move ${path} down`,
      remove: (path: string) => `Remove ${path} from book`,
      unavailable: (reason: string) => `Unavailable: ${reason}`,
    };
  }
  return {
    cancel: "キャンセル", choose: "章を選ぶ", edit: "章を編集",
    empty: "Markdownを明示的に選び、一冊として扱います。",
    recheck: "再確認", save: "保存",
    selectionPurpose: "本に含めるMarkdownを選びます。フォルダは開いた時だけ読み込みます。",
    selectionLabel: "本の章を選択",
    chapterCount: (count: number) => `${count}章`,
    moveUp: (path: string) => `${path}を上へ移動`, moveDown: (path: string) => `${path}を下へ移動`,
    remove: (path: string) => `${path}を本から外す`,
    unavailable: (reason: string) => `利用できません: ${reason}`,
  };
}
