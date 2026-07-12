import { useEffect, useRef } from "react";
import { isImeComposing } from "../../lib/keyboard";
import { useLatestValueRef } from "../../hooks/app/useLatestValueRef";
import type { MenuLanguage } from "../../types";
import type {
  GlobalSearchRow,
  GlobalSearchSummary,
} from "../../hooks/globalSearch/useGlobalSearch";

// `GlobalSearch` is the v0.8 "Find in Files" modal. It mirrors
// the shape of `CommandPalette` and `QuickOpen` — same flat-panel
// chrome, same flat list, same keyboard nav — but the rows
// carry the matching line text instead of a label/category pair.
//
// Each row is a (file, match) tuple: clicking a row opens the
// file at the match's line, which the parent (AppOverlays)
// achieves by calling `openWorkspaceFile` and then asking
// `EditorPane` to `goToLine`. The modal does not own the open
// path; it only signals which row was selected.

type GlobalSearchProps = {
  activeIndex: number;
  menuLanguage: MenuLanguage;
  onClose: () => void;
  onRun: (row: GlobalSearchRow) => void;
  onSetActiveIndex: (index: number) => void;
  onSetQuery: (query: string) => void;
  query: string;
  rows: GlobalSearchRow[];
  searchError: string | null;
  searching: boolean;
  summary: GlobalSearchSummary | null;
  workspaceOpen: boolean;
};

const MAX_VISIBLE_LINE_CHARS = 240;

function clipLineText(text: string): string {
  if (text.length <= MAX_VISIBLE_LINE_CHARS) {
    return text;
  }
  return `${text.slice(0, MAX_VISIBLE_LINE_CHARS)}…`;
}

function fileGroupKey(row: GlobalSearchRow): string {
  return row.file.path;
}

function placeholderText(menuLanguage: MenuLanguage): string {
  if (menuLanguage === "kana") return "ふみのなかをさがす...";
  if (menuLanguage === "ja") return "検索文字列を入力...";
  return "Find in files…";
}

function dialogLabelText(menuLanguage: MenuLanguage): string {
  if (menuLanguage === "kana") return "ふみのなかを さがす";
  if (menuLanguage === "ja") return "ファイル内検索";
  return "Find in files";
}

function emptyText(menuLanguage: MenuLanguage): string {
  if (menuLanguage === "kana") return "ぴったりのふみはありません";
  if (menuLanguage === "ja") return "一致するファイルがありません";
  return "No matching files";
}

function truncatedHintText(menuLanguage: MenuLanguage): string {
  if (menuLanguage === "kana") {
    return "かぎりをこえました。せまいことばでさがしてください。";
  }
  if (menuLanguage === "ja") {
    return "結果は上限に達しました。検索文字列を絞り込んでください。";
  }
  return "Results were truncated. Narrow the query to see more.";
}

function workspaceHintText(menuLanguage: MenuLanguage): string {
  if (menuLanguage === "kana") return "ところをひらいてから さがしてください";
  if (menuLanguage === "ja") return "ワークスペースを開いてから検索してください";
  return "Open a workspace to search its files";
}

function searchErrorText(
  error: string,
  menuLanguage: MenuLanguage,
): string {
  if (menuLanguage === "kana") {
    return `さがせませんでした。${error}`;
  }
  if (menuLanguage === "ja") {
    return `検索に失敗しました。${error}`;
  }
  return error;
}

function searchingText(menuLanguage: MenuLanguage): string {
  if (menuLanguage === "kana") return "さがしもの…";
  if (menuLanguage === "ja") return "検索中…";
  return "Searching…";
}

function summaryText(
  summary: GlobalSearchSummary,
  menuLanguage: MenuLanguage,
): string {
  if (menuLanguage === "kana") {
    return `${summary.totalMatches} けん ${summary.totalFilesScanned} ふみのなかにあり`;
  }
  if (menuLanguage === "ja") {
    return `${summary.totalFilesScanned} ファイル 中 ${summary.totalMatches} 件の一致`;
  }
  const matchLabel = summary.totalMatches === 1 ? "match" : "matches";
  return `${summary.totalMatches} ${matchLabel} in ${summary.totalFilesScanned} files`;
}

export function GlobalSearch({
  activeIndex,
  menuLanguage,
  onClose,
  onRun,
  onSetActiveIndex,
  onSetQuery,
  query,
  rows,
  searchError,
  searching,
  summary,
  workspaceOpen,
}: GlobalSearchProps) {
  const dialogLabel = dialogLabelText(menuLanguage);
  const canShowSearchResults = Boolean(
    query.trim() && workspaceOpen && !searchError,
  );
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const rowsRef = useLatestValueRef(rows);
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const activeOptionId = rows[activeIndex]
    ? `global-search-option-${activeIndex}`
    : undefined;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const list = listRef.current;
    if (!list) {
      return;
    }
    const item = list.children[activeIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // Mirror the find / global-shortcut rule from
    // `useFindReplaceActions` and `useGlobalKeyboardShortcuts`:
    // Japanese / kana composition emits Enter / Escape / Arrow
    // keys while the IME is still composing, and we must let
    // those pass through to the IME instead of moving the active
    // row, running the match, or closing the modal.
    if (isImeComposing(event.nativeEvent)) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      onSetActiveIndex(
        Math.min(activeIndexRef.current + 1, rowsRef.current.length - 1),
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      onSetActiveIndex(Math.max(activeIndexRef.current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const row = rowsRef.current[activeIndexRef.current];
      if (row) {
        onRun(row);
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <div className="global-search-overlay" onPointerDown={onClose}>
      <div
        aria-label={dialogLabel}
        aria-modal="true"
        className="global-search-dialog"
        onPointerDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <input
          ref={inputRef}
          aria-activedescendant={activeOptionId}
          aria-controls="global-search-results"
          aria-expanded="true"
          aria-haspopup="listbox"
          aria-label={dialogLabel}
          aria-busy={searching}
          className="global-search-input"
          onChange={(event) => onSetQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholderText(menuLanguage)}
          role="combobox"
          type="text"
          value={query}
        />
        <div aria-live="polite" className="global-search-status" role="status">
          {!workspaceOpen ? (
            <span className="global-search-status-hint">
              {workspaceHintText(menuLanguage)}
            </span>
          ) : searchError ? (
            <span className="global-search-status-error">
              {searchErrorText(searchError, menuLanguage)}
            </span>
          ) : !query.trim() ? (
            <span className="global-search-status-hint">
              {placeholderText(menuLanguage)}
            </span>
          ) : searching ? (
            <span className="global-search-status-hint">
              {searchingText(menuLanguage)}
            </span>
          ) : summary ? (
            <span className="global-search-status-summary">
              {summaryText(summary, menuLanguage)}
            </span>
          ) : null}
        </div>
        <div
          className="global-search-results"
          id="global-search-results"
          ref={listRef}
          role="listbox"
        >
          {!canShowSearchResults ? null : rows.length === 0 && !searching ? (
            <div className="global-search-empty">{emptyText(menuLanguage)}</div>
          ) : (
            rows.map((row, index) => {
              const showFileHeader =
                index === 0 ||
                fileGroupKey(rows[index - 1]) !== fileGroupKey(row);
              return (
                <div key={`${row.file.path}:${row.match.line}:${row.match.column}`}>
                  {showFileHeader ? (
                    <div className="global-search-file-header">
                      {row.file.relativePath}
                      {row.file.truncated ? "…" : null}
                    </div>
                  ) : null}
                  <button
                    aria-selected={index === activeIndex}
                    className={`global-search-item${
                      index === activeIndex ? " active" : ""
                    }`}
                    id={`global-search-option-${index}`}
                    onMouseEnter={() => onSetActiveIndex(index)}
                    onPointerDown={() => onRun(row)}
                    role="option"
                    type="button"
                  >
                    <span className="global-search-line-number">
                      {row.match.line}
                    </span>
                    <span className="global-search-line-text">
                      {clipLineText(row.match.text)}
                    </span>
                  </button>
                </div>
              );
            })
          )}
        </div>
        {summary?.truncated ? (
          <div className="global-search-truncated-hint">
            {truncatedHintText(menuLanguage)}
          </div>
        ) : null}
      </div>
    </div>
  );
}
