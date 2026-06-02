import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WorkspaceTreeEntry } from "../../lib/tauri";
import type { MenuLanguage } from "../../types";

type QuickOpenProps = {
  tree: WorkspaceTreeEntry | null;
  onOpenFile: (path: string) => void;
  onClose: () => void;
  menuLanguage: MenuLanguage;
};

type FlatFile = {
  path: string;
  name: string;
};

/** Flatten the workspace tree into a list of file entries. */
function flattenFiles(entry: WorkspaceTreeEntry): FlatFile[] {
  const result: FlatFile[] = [];
  function walk(node: WorkspaceTreeEntry) {
    if (node.kind === "file") {
      result.push({ path: node.path, name: node.name });
    }
    for (const child of node.children ?? []) {
      walk(child);
    }
  }
  walk(entry);
  return result;
}

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

  const files = useMemo(() => (tree ? flattenFiles(tree) : []), [tree]);

  const results = useMemo(() => {
    if (!query.trim()) return files.slice(0, 100);
    const scored = files
      .map((f) => ({
        ...f,
        score: fuzzyScore(query, f.path, f.name),
      }))
      .filter((f) => f.score >= 0)
      .sort((a, b) => b.score - a.score);
    return scored.slice(0, 100);
  }, [query, files]);

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

  const placeholder =
    menuLanguage !== "en" ? "ファイル名を入力..." : "Type a file name...";
  const emptyMsg =
    menuLanguage !== "en"
      ? "一致するファイルがありません"
      : "No matching files";

  return (
    <div className="quick-open-overlay" onPointerDown={onClose}>
      <div
        className="quick-open-dialog"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="quick-open-input"
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="quick-open-results" ref={listRef}>
          {results.length === 0 ? (
            <div className="quick-open-empty">{emptyMsg}</div>
          ) : (
            results.map((file, i) => (
              <button
                key={file.path}
                className={`quick-open-item${i === activeIndex ? " active" : ""}`}
                onPointerDown={() => openSelected(i)}
                onMouseEnter={() => setActiveIndex(i)}
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
