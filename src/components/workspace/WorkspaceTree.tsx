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

// The export-to-Finder drag uses `application/x-hazakura-workspace-path`
// (also exposed as text/plain so other apps accept the drop). The
// internal move drag uses `application/x-hazakura-workspace-move`
// — a distinct MIME key so the tree's own drop targets can
// recognize an in-app move without colliding with the export
// effect. `effectAllowed = "copyMove"` lets the OS treat external
// drops as a copy while in-app drops act on the same payload.
const INTERNAL_MOVE_MIME = "application/x-hazakura-workspace-move";

function startWorkspacePathDrag(
  event: ReactDragEvent<HTMLButtonElement>,
  entry: WorkspaceTreeEntry,
) {
  event.dataTransfer.effectAllowed = "copyMove";
  event.dataTransfer.setData("text/plain", entry.path);
  event.dataTransfer.setData(
    "application/x-hazakura-workspace-path",
    entry.path,
  );
  event.dataTransfer.setData(INTERNAL_MOVE_MIME, entry.path);
}

function readInternalMovePayload(
  event: ReactDragEvent<HTMLElement>,
): string | null {
  return event.dataTransfer.getData(INTERNAL_MOVE_MIME) || null;
}

function isInternalMoveDrag(event: ReactDragEvent<HTMLElement>): boolean {
  return Array.from(event.dataTransfer.types).includes(INTERNAL_MOVE_MIME);
}

function TreeEntry({
  activePath,
  compareSourcePath,
  compareTargetPath,
  compareSelectionEnabled,
  defaultExpanded = false,
  entry,
  onLoadDirectory,
  onMoveEntry,
  onOpenContextMenu,
  onOpenFile,
  onSelectCompareFile,
  onSubmitRename,
  renamingPath,
  requestRename,
  onClearRenaming,
}: {
  activePath: string | null;
  compareSourcePath: string | null;
  compareTargetPath: string | null;
  compareSelectionEnabled: boolean;
  defaultExpanded?: boolean;
  entry: WorkspaceTreeEntry;
  renamingPath: string | null;
  requestRename: (path: string) => void;
  onClearRenaming: () => void;
  onLoadDirectory: (path: string) => Promise<void>;
  onMoveEntry: (srcPath: string, dstParentPath: string) => void;
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
  const [isDragOver, setIsDragOver] = useState(false);
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

  // Defer a single click by a short window so a double click can
  // cancel the open and enter rename instead. Without this, the
  // browser fires two `click` events before `dblclick`, so a
  // double-click on a file would open it AND enter rename.
  const singleClickTimeoutRef = useRef<number | null>(null);
  const cancelPendingSingleClick = () => {
    if (singleClickTimeoutRef.current !== null) {
      window.clearTimeout(singleClickTimeoutRef.current);
      singleClickTimeoutRef.current = null;
    }
  };
  useEffect(() => {
    return () => cancelPendingSingleClick();
  }, []);

  if (!isDirectory) {
    const isMarkdown =
      entry.name.toLowerCase().endsWith(".md") ||
      entry.name.toLowerCase().endsWith(".markdown");
    const isImage = isSupportedImageFile(entry.name);
    const handleFileClick = () => {
      cancelPendingSingleClick();
      singleClickTimeoutRef.current = window.setTimeout(() => {
        singleClickTimeoutRef.current = null;
        if (compareSelectionEnabled) {
          onSelectCompareFile(entry);
        } else {
          void onOpenFile(entry.path);
        }
      }, 250);
    };
    const handleFileDoubleClick = () => {
      cancelPendingSingleClick();
      requestRename(entry.path);
    };
    return (
      <button
        className={`tree-file${entry.path === activePath ? " active" : ""}${entry.path === compareSourcePath ? " compare-source" : ""}${entry.path === compareTargetPath ? " compare-target" : ""}`}
        draggable={!compareSelectionEnabled}
        onClick={handleFileClick}
        onContextMenu={(event) => onOpenContextMenu(entry, event, "file")}
        onDoubleClick={handleFileDoubleClick}
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

  const handleDirectoryClick = () => {
    cancelPendingSingleClick();
    singleClickTimeoutRef.current = window.setTimeout(() => {
      singleClickTimeoutRef.current = null;
      void toggleDirectory();
    }, 250);
  };

  const handleDirectoryDoubleClick = () => {
    cancelPendingSingleClick();
    requestRename(entry.path);
  };

  const handleDragOver = (event: ReactDragEvent<HTMLButtonElement>) => {
    if (!isInternalMoveDrag(event)) {
      return;
    }
    // The HTML5 spec only exposes dataTransfer.getData() on `drop`
    // events; during dragover/dragenter the payload is protected
    // and returns the empty string. The directory self-check has
    // to happen in handleDrop instead — opting in to the drop
    // here is enough to make the browser fire a drop event.
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleDragEnter = (event: ReactDragEvent<HTMLButtonElement>) => {
    if (!isInternalMoveDrag(event)) {
      return;
    }
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: ReactDragEvent<HTMLButtonElement>) => {
    // Only clear on leave that escapes the row — nested children
    // fire dragleave as the cursor crosses their borders.
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }
    setIsDragOver(false);
  };

  const handleDrop = (event: ReactDragEvent<HTMLButtonElement>) => {
    if (!isInternalMoveDrag(event)) {
      return;
    }
    event.preventDefault();
    setIsDragOver(false);
    const srcPath = readInternalMovePayload(event);
    if (!srcPath || srcPath === entry.path) {
      return;
    }
    onMoveEntry(srcPath, entry.path);
  };

  return (
    <div className="tree-directory">
      <button
        aria-expanded={expanded}
        className={`tree-directory-button${isDragOver ? " drag-over" : ""}`}
        disabled={loading}
        onClick={handleDirectoryClick}
        onContextMenu={(event) => onOpenContextMenu(entry, event, "directory")}
        onDoubleClick={handleDirectoryDoubleClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
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
              onLoadDirectory={onLoadDirectory}
              onMoveEntry={onMoveEntry}
              onOpenContextMenu={onOpenContextMenu}
              onOpenFile={onOpenFile}
              onSelectCompareFile={onSelectCompareFile}
              onSubmitRename={onSubmitRename}
              renamingPath={renamingPath}
              requestRename={requestRename}
              onClearRenaming={onClearRenaming}
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
  // Blur commits a non-empty trimmed name, otherwise cancels.
  // Without this, clicking elsewhere keeps the input focused
  // and the row never returns to its non-editing state.
  const commitOrCancel = () => {
    const value = (draft ?? "").trim();
    if (!value) {
      onCancel();
      return;
    }
    onCommit(value);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitOrCancel();
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
      onBlur={commitOrCancel}
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
  onMoveEntry,
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
  onMoveEntry: (srcPath: string, dstParentPath: string) => void;
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
        onLoadDirectory={onLoadDirectory}
        onMoveEntry={onMoveEntry}
        onOpenContextMenu={onOpenContextMenu}
        onOpenFile={onOpenFile}
        onSelectCompareFile={onSelectCompareFile}
        onSubmitRename={onSubmitRename}
        renamingPath={renamingPath}
        requestRename={requestRename}
        onClearRenaming={() => requestRename("")}
      />
    </div>
  );
}
