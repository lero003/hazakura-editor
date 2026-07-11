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
  dirtyFilePaths,
  entry,
  onLoadDirectory,
  onMoveEntry,
  onOpenContextMenu,
  onOpenFile,
  onSelectCompareFile,
  onSubmitRename,
  openFilePaths,
  renamingPath,
  requestRename,
  onClearRenaming,
}: {
  activePath: string | null;
  compareSourcePath: string | null;
  compareTargetPath: string | null;
  compareSelectionEnabled: boolean;
  defaultExpanded?: boolean;
  dirtyFilePaths: ReadonlySet<string>;
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
  openFilePaths: ReadonlySet<string>;
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
    const isOpen = openFilePaths.has(entry.path);
    const isDirtyOpen = dirtyFilePaths.has(entry.path);
    const fileStateLabel = isDirtyOpen
      ? `${entry.name}, open, unsaved`
      : isOpen
        ? `${entry.name}, open`
        : entry.name;
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
    // Rename state is rendered as a non-button row so the
    // rename <input> is not nested inside a row <button>.
    // Nested interactive controls are a VoiceOver / focus /
    // click / blur risk; the v0.17 accessibility decision kept
    // the button-based model for normal rows but flagged this
    // rename case as a v0.18 cleanup. The replaceable row
    // intentionally drops `draggable` and the click / context
    // menu / double-click handlers — a user editing a name
    // should not be opening the file, dragging it, or seeing a
    // context menu for the row underneath the input.
    if (isRenaming) {
      return (
        <div
          aria-label={fileStateLabel}
          className={`tree-file tree-file-rename${entry.path === activePath ? " active" : ""}${isOpen ? " open" : ""}${isDirtyOpen ? " dirty" : ""}${entry.path === compareSourcePath ? " compare-source" : ""}${entry.path === compareTargetPath ? " compare-target" : ""}`}
          title={entry.path}
        >
          {isImage ? (
            <ImageFileIcon />
          ) : isMarkdown ? (
            <MarkdownFileIcon />
          ) : (
            <TextFileIcon />
          )}
          <RenameInput
            ariaLabel={`Rename ${entry.name}`}
            draft={renameDraft}
            inputRef={renameInputRef}
            onChange={setRenameDraft}
            onCancel={onClearRenaming}
            onCommit={(value) => onSubmitRename(entry.path, value)}
          />
        </div>
      );
    }
    return (
      <button
        aria-label={fileStateLabel}
        className={`tree-file${entry.path === activePath ? " active" : ""}${isOpen ? " open" : ""}${isDirtyOpen ? " dirty" : ""}${entry.path === compareSourcePath ? " compare-source" : ""}${entry.path === compareTargetPath ? " compare-target" : ""}`}
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
        <span className="tree-name">{entry.name}</span>
        {isOpen ? (
          <span
            aria-hidden="true"
            className="tree-open-marker"
            title="Open file"
          />
        ) : null}
        {isDirtyOpen ? (
          <span
            aria-hidden="true"
            className="tree-dirty-marker"
            title="Unsaved open file"
          />
        ) : null}
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

  // Drop-only — no hover visual. The browser still requires
  // preventDefault() on dragover for the drop event to fire.
  // The directory self-check happens in handleDrop because the
  // HTML5 spec only exposes dataTransfer.getData() on `drop`.
  const handleDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!isInternalMoveDrag(event)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!isInternalMoveDrag(event)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const srcPath = readInternalMovePayload(event);
    if (!srcPath || srcPath === entry.path) {
      return;
    }
    onMoveEntry(srcPath, entry.path);
  };

  // Rename state is rendered as a non-button row so the
  // rename <input> is not nested inside a row <button> (see
  // the matching comment in the file-row branch above). The
  // directory button still owns the click-debounce, the
  // context menu, the `aria-expanded` disclosure, and the
  // loading disabled state. Drop handling stays on the outer
  // `.tree-directory` <div>, so a rename row is not needed on
  // the drop target itself.
  const directoryButton = isRenaming ? (
    <div
      className="tree-directory-button tree-directory-rename"
      title={entry.path}
    >
      <ChevronIcon expanded={expanded} />
      {expanded ? <FolderOpenIcon /> : <FolderIcon />}
      <RenameInput
        ariaLabel={`Rename ${entry.name}`}
        draft={renameDraft}
        inputRef={renameInputRef}
        onChange={setRenameDraft}
        onCancel={onClearRenaming}
        onCommit={(value) => onSubmitRename(entry.path, value)}
      />
    </div>
  ) : (
    <button
      aria-expanded={expanded}
      className="tree-directory-button"
      disabled={loading}
      onClick={handleDirectoryClick}
      onContextMenu={(event) => onOpenContextMenu(entry, event, "directory")}
      onDoubleClick={handleDirectoryDoubleClick}
      title={entry.path}
      type="button"
    >
      <ChevronIcon expanded={expanded} />
      {expanded ? <FolderOpenIcon /> : <FolderIcon />}
      <span className="tree-name">{entry.name}</span>
      {loading ? <span className="tree-meta">Loading...</span> : null}
    </button>
  );

  return (
    <div
      className="tree-directory"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {directoryButton}
      {expanded ? (
        <div className="tree-children">
          {entry.children.map((child) => (
            <TreeEntry
              activePath={activePath}
              compareSourcePath={compareSourcePath}
              compareTargetPath={compareTargetPath}
              compareSelectionEnabled={compareSelectionEnabled}
              dirtyFilePaths={dirtyFilePaths}
              entry={child}
              key={child.path}
              onLoadDirectory={onLoadDirectory}
              onMoveEntry={onMoveEntry}
              onOpenContextMenu={onOpenContextMenu}
              onOpenFile={onOpenFile}
              onSelectCompareFile={onSelectCompareFile}
              onSubmitRename={onSubmitRename}
              openFilePaths={openFilePaths}
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
  ariaLabel,
  draft,
  inputRef,
  onCancel,
  onChange,
  onCommit,
}: {
  ariaLabel: string;
  draft: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onCancel: () => void;
  onChange: (value: string) => void;
  onCommit: (value: string) => void;
}) {
  // Blur cancels so clicking outside the input always exits
  // rename mode immediately, even if the user did not type
  // anything (the input shouldn't stay focused on an unedited
  // name). Enter is the only path that commits.
  const handleBlur = () => {
    onCancel();
  };

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

  // The rename row is a plain <div> (not a <button>), so a
  // click inside the input no longer has a row-level click
  // handler to bubble to. The propagation stop is no longer
  // needed and was intentionally removed when rename rows
  // stopped being <button> children.

  return (
    <input
      aria-label={ariaLabel}
      autoComplete="off"
      className="tree-rename-input"
      onBlur={handleBlur}
      onChange={(event) => onChange(event.target.value)}
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
  dirtyFilePaths,
  entry,
  onClearCompareSelection,
  onLoadDirectory,
  onMoveEntry,
  onOpenContextMenu,
  onOpenFile,
  onSelectCompareFile,
  onSubmitRename,
  openFilePaths,
  renamingPath,
  requestRename,
}: {
  activePath: string | null;
  compareSourcePath: string | null;
  compareTargetPath: string | null;
  compareSelectionEnabled: boolean;
  dirtyFilePaths: readonly string[];
  entry: WorkspaceTreeEntry;
  onClearCompareSelection: () => void;
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
  openFilePaths: readonly string[];
  renamingPath: string | null;
  requestRename: (path: string) => void;
}) {
  // The renaming path is owned here, not by the controller, so the
  // input is local to the tree. The controller only sees the
  // committed `onSubmitRename`.
  const hasCompareSelection =
    compareSourcePath !== null || compareTargetPath !== null;
  const openPathSet = new Set(openFilePaths);
  const dirtyPathSet = new Set(dirtyFilePaths);
  return (
    <div
      className={`workspace-tree${compareSelectionEnabled ? " compare-selection" : ""}`}
      // Click on the empty area inside the tree (the padding
      // below the last entry, or any margin not occupied by a
      // row) clears the compare selection. Without this, a
      // compare-mode session that picked a source and a target
      // has no way to reset short of re-picking both files —
      // a third click in the tree just overwrites the target
      // silently.
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          if (hasCompareSelection) {
            onClearCompareSelection();
          }
        }
      }}
      onKeyDown={(event: ReactKeyboardEvent<HTMLDivElement>) => {
        // Escape clears the compare selection, matching the
        // click-on-empty-space behavior above. Only when the
        // user is NOT editing a name — Escape is also the
        // cancel key for the rename input, and that handler
        // runs first because the input is the event target.
        if (event.key === "Escape" && hasCompareSelection && renamingPath === null) {
          event.preventDefault();
          onClearCompareSelection();
        }
      }}
    >
      <TreeEntry
        activePath={activePath}
        compareSourcePath={compareSourcePath}
        compareTargetPath={compareTargetPath}
        compareSelectionEnabled={compareSelectionEnabled}
        defaultExpanded
        dirtyFilePaths={dirtyPathSet}
        entry={entry}
        onLoadDirectory={onLoadDirectory}
        onMoveEntry={onMoveEntry}
        onOpenContextMenu={onOpenContextMenu}
        onOpenFile={onOpenFile}
        onSelectCompareFile={onSelectCompareFile}
        onSubmitRename={onSubmitRename}
        openFilePaths={openPathSet}
        renamingPath={renamingPath}
        requestRename={requestRename}
        onClearRenaming={() => requestRename("")}
      />
    </div>
  );
}
