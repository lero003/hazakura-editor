import { trapFocusInElement } from "../../lib/focusTrap";
import { useEffect, useMemo, useRef } from "react";
import { isImeComposing } from "../../lib/keyboard";
import { useLatestValueRef } from "../../hooks/app/useLatestValueRef";
import type { MenuLanguage } from "../../types";
import type { WorkspaceSearchMatch } from "../../lib/tauri/workspace";
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
  workspaceName?: string;
};

const MAX_VISIBLE_LINE_CHARS = 240;

/**
 * 行をコードポイント単位で切り詰める。UTF-16 の `length`/`slice` を使うと
 * サロゲートペア（絵文字など）の途中で切れてしまうため、`Array.from` で
 * 1文字＝1要素に開いてから数える（backend の column と同じ単位）。
 */
function toCodePoints(text: string): string[] {
  return Array.from(text);
}

/** 一致の手前に見せる量。行頭から切り詰めると後方の一致が見えなくなるため。 */
const MATCH_CONTEXT_BEFORE = 60;

/**
 * 長い行は**一致位置を中心**に窓を作る。行頭固定の切り詰めだと、行の後方で
 * 一致したとき着色部分が窓の外へ出てしまう（レビュー 09 の指摘）。
 */
function windowAroundMatch(codePoints: string[], start: number) {
  const total = codePoints.length;
  if (total <= MAX_VISIBLE_LINE_CHARS) {
    return { points: codePoints, offset: 0, headClipped: false, tailClipped: false };
  }
  const from = Math.max(
    0,
    Math.min(start - MATCH_CONTEXT_BEFORE, total - MAX_VISIBLE_LINE_CHARS),
  );
  const to = Math.min(total, from + MAX_VISIBLE_LINE_CHARS);
  return {
    points: codePoints.slice(from, to),
    offset: from,
    headClipped: from > 0,
    tailClipped: to < total,
  };
}

function fileGroupKey(row: GlobalSearchRow): string {
  return row.file.path;
}

function fileCountUnit(menuLanguage: MenuLanguage): string {
  if (menuLanguage === "kana") return "けん";
  if (menuLanguage === "ja") return "件";
  return "matches";
}

/**
 * 一致した範囲だけを着色する（モック09）。
 *
 * 契約は backend 側が持つ: `column` は**原文の行**での1始まりの文字（コードポイント）
 * 位置、`text` は**一致位置を中心に切り出した snippet**、`snippetStart` は
 * snippet の先頭が原文の何文字目か。UTF-16 の `slice()` を使うと絵文字の途中で
 * 切れて絵文字自体も分断されるため、ここでもコードポイント単位で扱う。
 */
function renderMatchedLine(match: WorkspaceSearchMatch, needle: string) {
  const snippetStart =
    Number.isFinite(match.snippetStart) && match.snippetStart > 0
      ? match.snippetStart
      : 1;
  const source = toCodePoints(match.text);
  const lineLength =
    match.lineLength > 0 ? match.lineLength : snippetStart - 1 + source.length;
  // snippet 内の相対位置（backend が原文上の文字位置を返す）。
  const start = match.column - snippetStart;
  const matchLength =
    match.matchLength > 0 ? match.matchLength : toCodePoints(needle).length;
  const windowed = windowAroundMatch(source, Math.max(0, start));
  const points = windowed.points;
  const localStart = start - windowed.offset;
  const headClipped = snippetStart > 1 || windowed.headClipped;
  const tailClipped =
    snippetStart - 1 + source.length < lineLength || windowed.tailClipped;
  const inWindow =
    !!needle && localStart >= 0 && localStart < points.length && matchLength > 0;
  if (!inWindow) {
    return `${headClipped ? "…" : ""}${points.join("")}${tailClipped ? "…" : ""}`;
  }
  const localEnd = Math.min(localStart + matchLength, points.length);
  return (
    <>
      {headClipped ? "…" : null}
      {points.slice(0, localStart).join("")}
      <mark className="global-search-match">
        {points.slice(localStart, localEnd).join("")}
      </mark>
      {points.slice(localEnd).join("")}
      {tailClipped ? "…" : null}
    </>
  );
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
    return `${summary.totalFilesMatched} ふみに いっち · ${summary.totalMatches} けん（${summary.totalFilesScanned} ふみを さがした）`;
  }
  if (menuLanguage === "ja") {
    // 走査したファイル数と「一致したファイル数」は別物。主役は後者。
    return `${summary.totalFilesMatched} ファイルに一致 · ${summary.totalMatches} 件（走査 ${summary.totalFilesScanned} ファイル）`;
  }
  const matchLabel = summary.totalMatches === 1 ? "match" : "matches";
  const fileLabel = summary.totalFilesMatched === 1 ? "file" : "files";
  return `${summary.totalFilesMatched} ${fileLabel} · ${summary.totalMatches} ${matchLabel} (scanned ${summary.totalFilesScanned})`;
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
  workspaceName = "",
}: GlobalSearchProps) {
  const dialogLabel = dialogLabelText(menuLanguage);
  const surfaceCopy = menuLanguage === "en"
    ? { title: "Search this folder", scope: "Search within this folder. Files are not changed.", close: "Close search" }
    : menuLanguage === "kana"
      ? { title: "フォルダの なかを さがす", scope: "このフォルダの なかだけを さがします。ふみは かへません。", close: "けんさくを とぢる" }
      : { title: "フォルダ内を検索", scope: "このフォルダ内を検索します。ファイルは変更しません。", close: "検索を閉じる" };
  const dialogRef = useRef<HTMLDivElement>(null);
  // backend は query を trim して検索する。着色の長さも同じ基準にする。
  const needle = query.trim();
  const fileMatchCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      counts.set(row.file.path, (counts.get(row.file.path) ?? 0) + 1);
    }
    return counts;
  }, [rows]);
  const canShowSearchResults = Boolean(
    query.trim() && workspaceOpen && !searchError && !searching,
  );
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const rowsRef = useLatestValueRef(canShowSearchResults ? rows : []);
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const activeOptionId = canShowSearchResults && rows[activeIndex]
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
        Math.max(0, Math.min(activeIndexRef.current + 1, rowsRef.current.length - 1)),
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
        ref={dialogRef}
        onKeyDown={event => {
          if (isImeComposing(event.nativeEvent)) return;
          trapFocusInElement(dialogRef.current, event.nativeEvent);
          if (event.key === "Escape" && event.target !== inputRef.current) { event.preventDefault(); onClose(); }
        }}
        aria-label={dialogLabel}
        aria-modal="true"
        className="global-search-dialog"
        onPointerDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="global-search-heading">
          <div><h2>{surfaceCopy.title}</h2><strong title={workspaceName}>{workspaceOpen ? workspaceName : workspaceHintText(menuLanguage)}</strong></div>
          <button type="button" onClick={onClose}>{surfaceCopy.close}</button>
        </header>
        {workspaceOpen && <p className="global-search-scope">{surfaceCopy.scope}</p>}
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
                <div
                  key={`${row.file.path}:${row.match.line}:${row.match.column}`}
                  role="presentation"
                >
                  {showFileHeader ? (
                    <div className="global-search-file-header">
                      <span className="global-search-file-name">
                        {row.file.relativePath}
                        {row.file.truncated ? "…" : null}
                      </span>
                      {/* ファイルごとの一致件数（全体の走査数とは別）。 */}
                      <span className="global-search-file-count" aria-label={`${fileMatchCounts.get(row.file.path) ?? 0} ${fileCountUnit(menuLanguage)}`}>
                        {fileMatchCounts.get(row.file.path) ?? 0}
                      </span>
                    </div>
                  ) : null}
                  <button
                    aria-selected={index === activeIndex}
                    className={`global-search-item${
                      index === activeIndex ? " active" : ""
                    }`}
                    id={`global-search-option-${index}`}
                    onMouseEnter={() => onSetActiveIndex(index)}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      onRun(row);
                    }}
                    role="option"
                    tabIndex={-1}
                    type="button"
                  >
                    <span className="global-search-line-number">
                      {row.match.line}
                    </span>
                    <span className="global-search-line-text">
                      {renderMatchedLine(row.match, needle)}
                    </span>
                  </button>
                </div>
              );
            })
          )}
        </div>
        {canShowSearchResults && summary?.truncated ? (
          <div className="global-search-truncated-hint">
            {truncatedHintText(menuLanguage)}
          </div>
        ) : null}
      </div>
    </div>
  );
}
