import {
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import type { WorkspaceTreeEntry } from "../../lib/tauri";
import { isSupportedImageFile } from "../../lib/utils";
import {
  ChevronIcon,
  FolderIcon,
  FolderOpenIcon,
  ImageFileIcon,
  MarkdownFileIcon,
  TextFileIcon,
} from "../app/Icons";

function startWorkspacePathDrag(
  event: ReactDragEvent<HTMLButtonElement>,
  entry: WorkspaceTreeEntry,
) {
  event.dataTransfer.effectAllowed = "copy";
  event.dataTransfer.setData("text/plain", entry.path);
  event.dataTransfer.setData(
    "application/x-hazakura-workspace-path",
    entry.path,
  );
}

function TreeEntry({
  activePath,
  compareSourcePath,
  compareTargetPath,
  compareSelectionEnabled,
  defaultExpanded = false,
  entry,
  renamingPath,
  onClearRenaming,
  onLoadDirectory,
  onOpenContextMenu,
  onOpenFile,
  onSelectCompareFile,
  onSubmitRename,
}: {
  activePath: string | null;
  compareSourcePath: string | null;
  compareTargetPath: string | null;
  compareSelectionEnabled: boolean;
  defaultExpanded?: boolean;
  entry: WorkspaceTreeEntry;
  renamingPath: string | null;
  onClearRenaming: () => void;
  onLoadDirectory: (path: string) => Promise<void>;
  onOpenContextMenu: (
    entry: WorkspaceTreeEntry,
    event: ReactMouseEvent<HTMLButtonElement>,
    kind: "file" | "directory" | "root",
  ) => void;
  onOpenFile: (path: string) => void | Promise<void>;
  onSelectCompareFile: (entry: WorkspaceTreeEntry) => void;
  onSubmitRename: (srcPath: string, newName: string) => void;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [loading, setLoading] = useState(false);
  const [renameDraft, setRenameDraft] = useState<string | null>(null);
  const isRenaming = renamingPath === entry.path;
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isRenaming) {
      setRenameDraft(entry.name);
      // focus + select the next tick (after the input renders)
      const handle = window.setTimeout(() => {
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
      }, 0);
      return () => window.clearTimeout(handle);
    }
    setRenameDraft(null);
    return undefined;
  }, [entry.name, isRenaming]);

  const isDirectory = entry.kind === "directory";

  if (!isDirectory) {
    const isMarkdown =
      entry.name.toLowerCase().endsWith(".md") ||
      entry.name.toLowerCase().endsWith(".markdown");
    const isImage = isSupportedImageFile(entry.name);
    return (
      <button
        className={`tree-file${entry.path === activePath ? " active" : ""}${entry.path === compareSourcePath ? " compare-source" : ""}${entry.path === compareTargetPath ? " compare-target" : ""}`}
        draggable={!compareSelectionEnabled}
        onClick={() =>
          compareSelectionEnabled
            ? onSelectCompareFile(entry)
            : void onOpenFile(entry.path)
        }
        onContextMenu={(event) => onOpenContextMenu(entry, event, "file")}
        onDragStart={(event) => {
          startWorkspacePathDrag(event, entry);
        }}
        title={entry.path}
        type="button"
      >
        {isImage ? (
          <ImageFileIcon />
        ) : isMarkdown ? (
          <MarkdownFileIcon />
        ) : (
          <TextFileIcon />
        )}
        {isRenaming ? (
          <RenameInput
            draft={renameDraft}
            inputRef={renameInputRef}
            onChange={setRenameDraft}
            onCancel={onClearRenaming}
            onCommit={(value) => onSubmitRename(entry.path, value)}
          />
        ) : (
          <span className="tree-name">{entry.name}</span>
        )}
      </button>
    );
  }

  const toggleDirectory = async () => {
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
    <div className="tree-directory">
      <button
        aria-expanded={expanded}
        className="tree-directory-button"
        disabled={loading}
        onClick={() => void toggleDirectory()}
        onContextMenu={(event) => onOpenContextMenu(entry, event, "directory")}
        title={entry.path}
        type="button"
      >
        <ChevronIcon expanded={expanded} />
        {expanded ? <FolderOpenIcon /> : <FolderIcon />}
        {isRenaming ? (
          <RenameInput
            draft={renameDraft}
            inputRef={renameInputRef}
            onChange={setRenameDraft}
            onCancel={onClearRenaming}
            onCommit={(value) => onSubmitRename(entry.path, value)}
          />
        ) : (
          <span className="tree-name">{entry.name}</span>
        )}
        {loading ? <span className="tree-meta">Loading...</span> : null}
      </button>
      {expanded ? (
        <div className="tree-children">
          {entry.children.map((child) => (
            <TreeEntry
              activePath={activePath}
              compareSourcePath={compareSourcePath}
              compareTargetPath={compareTargetPath}
              compareSelectionEnabled={compareSelectionEnabled}
              entry={child}
              key={child.path}
              renamingPath={renamingPath}
              onClearRenaming={onClearRenaming}
              onLoadDirectory={onLoadDirectory}
              onOpenContextMenu={onOpenContextMenu}
              onOpenFile={onOpenFile}
              onSelectCompareFile={onSelectCompareFile}
              onSubmitRename={onSubmitRename}
            />
          ))}
          {entry.children_truncated ? (
            <div className="tree-partial" role="note">
              Some entries are hidden by the per-folder limit.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function RenameInput({
  draft,
  inputRef,
  onCancel,
  onChange,
  onCommit,
}: {
  draft: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onCancel: () => void;
  onChange: (value: string) => void;
  onCommit: (value: string) => void;
}) {
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const value = (draft ?? "").trim();
      if (!value) {
        onCancel();
        return;
      }
      onCommit(value);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }
    // Stop propagation so the keyboard shortcut handlers (e.g.
    // Cmd+N, Cmd+O) don't fire while the user is typing.
    event.stopPropagation();
  };

  // Clicking inside the input would normally bubble up to the
  // parent <button> and trigger its onClick — prevent that.
  const handleClick = (event: ReactMouseEvent<HTMLInputElement>) => {
    event.stopPropagation();
  };

  return (
    <input
      autoComplete="off"
      className="tree-rename-input"
      onChange={(event) => onChange(event.target.value)}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      ref={inputRef}
      spellCheck={false}
      type="text"
      value={draft ?? ""}
    />
  );
}

export function WorkspaceTree({
  activePath,
  compareSourcePath,
  compareTargetPath,
  compareSelectionEnabled,
  entry,
  onLoadDirectory,
  onOpenContextMenu,
  onOpenFile,
  onSelectCompareFile,
  onSubmitRename,
  renamingPath,
  requestRename,
}: {
  activePath: string | null;
  compareSourcePath: string | null;
  compareTargetPath: string | null;
  compareSelectionEnabled: boolean;
  entry: WorkspaceTreeEntry;
  onLoadDirectory: (path: string) => Promise<void>;
  onOpenContextMenu: (
    entry: WorkspaceTreeEntry,
    event: ReactMouseEvent<HTMLButtonElement>,
    kind: "file" | "directory" | "root",
  ) => void;
  onOpenFile: (path: string) => void | Promise<void>;
  onSelectCompareFile: (entry: WorkspaceTreeEntry) => void;
  onSubmitRename: (srcPath: string, newName: string) => void;
  renamingPath: string | null;
  requestRename: (path: string) => void;
}) {
  // The renaming path is owned here, not by the controller, so the
  // input is local to the tree. The controller only sees the
  // committed `onSubmitRename`.
  return (
    <div
      className={`workspace-tree${compareSelectionEnabled ? " compare-selection" : ""}`}
    >
      <TreeEntry
        activePath={activePath}
        compareSourcePath={compareSourcePath}
        compareTargetPath={compareTargetPath}
        compareSelectionEnabled={compareSelectionEnabled}
        defaultExpanded
        entry={entry}
        renamingPath={renamingPath}
        onClearRenaming={() => requestRename("")}
        onLoadDirectory={onLoadDirectory}
        onOpenContextMenu={onOpenContextMenu}
        onOpenFile={onOpenFile}
        onSelectCompareFile={onSelectCompareFile}
        onSubmitRename={onSubmitRename}
      />
    </div>
  );
}
