import { useState } from "react";
import type { WorkspaceTreeEntry } from "../../lib/tauri";
import { isBookScopeMarkdownPath } from "../../features/bookScope";
import { workspaceRelativePath } from "../../hooks/workspace/workspaceRelativePath";

type Props = {
  entry: WorkspaceTreeEntry;
  onLoadDirectory: (path: string) => Promise<void>;
  onToggle: (relativePath: string, selected: boolean) => void;
  selectedPaths: ReadonlySet<string>;
  workspaceRootPath: string;
};

export function BookScopeSelectorTree(props: Props) {
  return (
    <div className="book-scope-selector-tree">
      <BookScopeSelectorEntry {...props} defaultExpanded />
    </div>
  );
}

function BookScopeSelectorEntry({
  defaultExpanded = false,
  entry,
  onLoadDirectory,
  onToggle,
  selectedPaths,
  workspaceRootPath,
}: Props & { defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [loading, setLoading] = useState(false);

  if (entry.kind === "file") {
    const relativePath = workspaceRelativePath({
      workspaceRoot: workspaceRootPath,
      filePath: entry.path,
    });
    if (!relativePath || !isBookScopeMarkdownPath(relativePath)) return null;
    return (
      <label className="book-scope-selector-file" title={relativePath}>
        <input
          checked={selectedPaths.has(relativePath)}
          onChange={(event) => onToggle(relativePath, event.target.checked)}
          type="checkbox"
        />
        <span>{entry.name}</span>
      </label>
    );
  }

  const toggle = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    if (!entry.children_loaded) {
      setLoading(true);
      try {
        await onLoadDirectory(entry.path);
      } finally {
        setLoading(false);
      }
    }
    setExpanded(true);
  };

  return (
    <div className="book-scope-selector-directory">
      <button
        aria-expanded={expanded}
        className="book-scope-selector-directory-button"
        disabled={loading}
        onClick={() => void toggle()}
        type="button"
      >
        <span aria-hidden="true">{expanded ? "▾" : "▸"}</span>
        <span>{entry.name}</span>
        {loading ? <small>…</small> : null}
      </button>
      {expanded ? (
        <div className="book-scope-selector-children">
          {entry.children.map((child) => (
            <BookScopeSelectorEntry
              entry={child}
              key={child.path}
              onLoadDirectory={onLoadDirectory}
              onToggle={onToggle}
              selectedPaths={selectedPaths}
              workspaceRootPath={workspaceRootPath}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function collectSelectedBookScopePaths(
  entry: WorkspaceTreeEntry,
  workspaceRootPath: string,
  selectedPaths: ReadonlySet<string>,
): string[] {
  const collected: string[] = [];
  const visit = (candidate: WorkspaceTreeEntry) => {
    if (candidate.kind === "file") {
      const relativePath = workspaceRelativePath({
        workspaceRoot: workspaceRootPath,
        filePath: candidate.path,
      });
      if (
        relativePath &&
        isBookScopeMarkdownPath(relativePath) &&
        selectedPaths.has(relativePath)
      ) {
        collected.push(relativePath);
      }
      return;
    }
    candidate.children.forEach(visit);
  };
  visit(entry);
  return collected;
}
