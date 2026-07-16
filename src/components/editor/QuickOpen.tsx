import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  flattenWorkspaceFiles,
  QUICK_OPEN_RESULT_LIMIT,
  workspaceTreeIsPartial,
} from "../../features/workspace/quickOpenFiles";
import { isImeComposing } from "../../lib/keyboard";
import { getQuickOpenCopy } from "../../lib/locale/quickOpen";
import type { WorkspaceTreeEntry } from "../../lib/tauri";
import type { MenuLanguage } from "../../types";

type QuickOpenProps = {
  tree: WorkspaceTreeEntry | null;
  onOpenFile: (path: string) => void;
  onClose: () => void;
  menuLanguage: MenuLanguage;
};

/** Simple fuzzy scorer: higher = better match.
 *  Checks that all query characters appear in order in the target.
 *  Basename matches get a bonus. */
function fuzzyScore(query: string, target: string, basename: string): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  const b = basename.toLowerCase();

  // Check all chars appear in order
  let ti = 0;
  for (let qi = 0; qi < q.length; qi++) {
    ti = t.indexOf(q[qi], ti);
    if (ti < 0) return -1;
    ti++;
  }

  // Score: prefer basename match, prefer shorter paths for exactness
  let score = 0;
  const bIdx = b.indexOf(q);
  const tIdx = t.indexOf(q);
  if (bIdx >= 0) {
    // Basename substring match: high score + bonus for early position
    score += 100 - bIdx;
  } else if (tIdx >= 0) {
    // Path substring match
    score += 50 - tIdx;
  } else {
    // Character-sequence match
    score += 10;
  }
  // Penalise path depth (prefer shallow files)
  score -= target.split("/").length;
  return Math.max(0, score);
}

export function QuickOpen({
  tree,
  onOpenFile,
  onClose,
  menuLanguage,
}: QuickOpenProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const copy = useMemo(() => getQuickOpenCopy(menuLanguage), [menuLanguage]);

  const files = useMemo(() => (tree ? flattenWorkspaceFiles(tree) : []), [tree]);
  const treePartial = useMemo(
    () => (tree ? workspaceTreeIsPartial(tree) : false),
    [tree],
  );

  const matchTotal = useMemo(() => {
    if (!query.trim()) {
      return files.length;
    }
    return files.filter(
      (f) => fuzzyScore(query, f.path, f.name) >= 0,
    ).length;
  }, [query, files]);

  const results = useMemo(() => {
    if (!query.trim()) {
      return files.slice(0, QUICK_OPEN_RESULT_LIMIT);
    }
    const scored = files
      .map((f) => ({
        ...f,
        score: fuzzyScore(query, f.path, f.name),
      }))
      .filter((f) => f.score >= 0)
      .sort((a, b) => b.score - a.score);
    return scored.slice(0, QUICK_OPEN_RESULT_LIMIT);
  }, [query, files]);

  const resultsCapped = matchTotal > results.length;

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(0);
  }, [results.length]);

  // Auto focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const openSelected = useCallback(
    (index: number) => {
      const file = results[index];
      if (!file) return;
      onOpenFile(file.path);
      onClose();
    },
    [results, onOpenFile, onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Same rule as `useFindReplaceActions` and the other modal
      // inputs: let IME composition have Enter / Escape / Arrow
      // keys so Japanese conversion is not mistaken for a list
      // move, a file open, or a modal close.
      if (isImeComposing(e.nativeEvent)) {
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((prev) => Math.min(prev + 1, results.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          openSelected(activeIndex);
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [activeIndex, results.length, openSelected, onClose],
  );

  // Scroll active item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[activeIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!tree) return null;

  const activeOptionId = results[activeIndex]
    ? `quick-open-option-${activeIndex}`
    : undefined;

  return (
    <div className="quick-open-overlay" onPointerDown={onClose}>
      <div
        aria-label={copy.dialogLabel}
        aria-modal="true"
        className="quick-open-dialog"
        onPointerDown={(e) => e.stopPropagation()}
        role="dialog"
      >
        <input
          ref={inputRef}
          aria-activedescendant={activeOptionId}
          aria-controls="quick-open-results"
          aria-expanded="true"
          aria-label={copy.dialogLabel}
          aria-haspopup="listbox"
          className="quick-open-input"
          type="text"
          placeholder={copy.placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          role="combobox"
        />
        <div className="quick-open-scope" role="note">
          <p className="quick-open-scope-line">{copy.scopeHint}</p>
          {treePartial ? (
            <p className="quick-open-scope-line">{copy.treePartialHint}</p>
          ) : null}
          {resultsCapped ? (
            <p className="quick-open-scope-line">
              {copy.resultCapHint(results.length, matchTotal)}
            </p>
          ) : null}
        </div>
        <div
          className="quick-open-results"
          id="quick-open-results"
          ref={listRef}
          role="listbox"
        >
          {results.length === 0 ? (
            <div className="quick-open-empty">{copy.empty}</div>
          ) : (
            results.map((file, i) => (
              <button
                key={file.path}
                aria-selected={i === activeIndex}
                className={`quick-open-item${i === activeIndex ? " active" : ""}`}
                id={`quick-open-option-${i}`}
                onPointerDown={() => openSelected(i)}
                onMouseEnter={() => setActiveIndex(i)}
                role="option"
                type="button"
              >
                <span className="quick-open-name">{file.name}</span>
                <span className="quick-open-path">{file.path}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
