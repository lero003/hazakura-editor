import {
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type { WorkspaceTreeEntry } from "../../lib/tauri";
import type { SafeEditorCopy, WorkspaceFileOpsCopy } from "../../lib/locale";
import {
  OpenFolderIcon,
  PanelLeftCloseIcon,
  PlusIcon,
  TrashIcon,
} from "../app/Icons";
import { WorkspaceTree } from "./WorkspaceTree";

const INTERNAL_MOVE_MIME = "application/x-hazakura-workspace-move";

type WorkspaceSidebarProps = {
  activePath: string | null;
  compareSelectionEnabled: boolean;
  compareSourcePath: string | null;
  compareTargetPath: string | null;
  copy: SafeEditorCopy;
  dirtyFilePaths: readonly string[];
  fileOpsCopy: WorkspaceFileOpsCopy;
  onCreateFile: () => void;
  onCreateFolder: () => void;
  onCreateOkfScaffoldMinimal: () => void;
  onCreateOkfScaffoldBookLike: () => void;
  onCollapse?: () => void;
  onLoadDirectory: (path: string) => Promise<void>;
  onMoveEntry: (srcPath: string, dstParentPath: string) => void;
  onMoveToTrash: (path: string, name: string, isDirectory: boolean) => void;
  onOpenContextMenu: (
    entry: WorkspaceTreeEntry,
    event: ReactMouseEvent<HTMLButtonElement>,
    kind: "file" | "directory" | "root",
  ) => void;
  onOpenRootContextMenu: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onOpenFile: (path: string) => void | Promise<void>;
  onOpenWorkspace: () => void;
  openFilePaths: readonly string[];
  onClearCompareSelection: () => void;
  onSelectCompareFile: (entry: WorkspaceTreeEntry) => void;
  onSubmitRename: (srcPath: string, newName: string) => void;
  requestRename: (path: string) => void;
  renamingPath: string | null;
  workspaceRootPath: string | null;
  workspaceTree: WorkspaceTreeEntry | null;
};

export function WorkspaceSidebar({
  activePath,
  compareSelectionEnabled,
  compareSourcePath,
  compareTargetPath,
  copy,
  dirtyFilePaths,
  fileOpsCopy,
  onCreateFile,
  onCreateFolder,
  onCreateOkfScaffoldMinimal,
  onCreateOkfScaffoldBookLike,
  onCollapse,
  onLoadDirectory,
  onMoveEntry,
  onMoveToTrash,
  onOpenContextMenu,
  onOpenRootContextMenu,
  onOpenFile,
  onOpenWorkspace,
  openFilePaths,
  onClearCompareSelection,
  onSelectCompareFile,
  onSubmitRename,
  requestRename,
  renamingPath,
  workspaceRootPath,
  workspaceTree,
}: WorkspaceSidebarProps) {
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const newMenuRef = useRef<HTMLDivElement | null>(null);
  const newMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const newMenuId = useId();

  // Dismiss the popover on outside click / Esc. Mirrors the
  // useWorkspaceContextMenuDismissal pattern.
  useEffect(() => {
    if (!newMenuOpen) {
      return;
    }
    const closeOnOutside = (event: MouseEvent) => {
      if (newMenuRef.current && !newMenuRef.current.contains(event.target as Node)) {
        setNewMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNewMenuOpen(false);
        newMenuButtonRef.current?.focus();
      }
    };
    window.addEventListener("mousedown", closeOnOutside);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("mousedown", closeOnOutside);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [newMenuOpen]);

  useEffect(() => {
    if (!newMenuOpen) return;
    newMenuRef.current
      ?.querySelector<HTMLButtonElement>("[role='menuitem']")
      ?.focus();
  }, [newMenuOpen]);

  const handleNewMenuKeyDown = (
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) => {
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(
        "[role='menuitem']",
      ),
    );
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setNewMenuOpen(false);
      newMenuButtonRef.current?.focus();
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      items[event.key === "Home" ? 0 : items.length - 1]?.focus();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const offset = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex =
      currentIndex < 0
        ? 0
        : (currentIndex + offset + items.length) % items.length;
    items[nextIndex]?.focus();
  };

  const handleNewFile = () => {
    setNewMenuOpen(false);
    onCreateFile();
  };

  const handleNewFolder = () => {
    setNewMenuOpen(false);
    onCreateFolder();
  };

  const handleOkfScaffoldMinimal = () => {
    setNewMenuOpen(false);
    onCreateOkfScaffoldMinimal();
  };

  const handleOkfScaffoldBookLike = () => {
    setNewMenuOpen(false);
    onCreateOkfScaffoldBookLike();
  };

  // The footer trash button uses the active tab's path as the
  // trashed entry. If the active file isn't loaded into the
  // tree (collapsed ancestor), the trash button is disabled
  // because we can't reliably know its display name + kind.
  const activeEntry = findEntryByPath(workspaceTree, activePath);
  const canTrashActive = activeEntry !== null;
  const trashLabel = canTrashActive
    ? fileOpsCopy.sidebarTrashTarget(activeEntry.name)
    : activePath
      ? fileOpsCopy.sidebarTrashDisabledNotInTree
      : fileOpsCopy.sidebarTrashDisabledNoActive;
  const handleTrashActive = () => {
    if (!activeEntry) return;
    onMoveToTrash(
      activeEntry.path,
      activeEntry.name,
      activeEntry.kind === "directory",
    );
  };

  const handleRootDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!workspaceRootPath) return;
    if (!Array.from(event.dataTransfer.types).includes(INTERNAL_MOVE_MIME)) {
      return;
    }
    // dragover cannot read the payload (the HTML5 spec only
    // exposes dataTransfer.getData() on `drop`); the workspace-
    // root self-check is enforced in handleRootDrop.
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleRootDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!workspaceRootPath) return;
    if (!Array.from(event.dataTransfer.types).includes(INTERNAL_MOVE_MIME)) {
      return;
    }
    event.preventDefault();
    const srcPath = event.dataTransfer.getData(INTERNAL_MOVE_MIME);
    if (!srcPath || srcPath === workspaceRootPath) {
      return;
    }
    onMoveEntry(srcPath, workspaceRootPath);
  };

  return (
    <aside className="file-tree-pane" aria-label={copy.workspaceFileTree}>
      <div
        className="workspace-header"
        onContextMenu={onOpenRootContextMenu}
        onDragOver={handleRootDragOver}
        onDrop={handleRootDrop}
      >
        <div className="workspace-heading">
          <div className="workspace-labels">
            <span className="workspace-kicker">{copy.workspace}</span>
            <span className="workspace-title" title={workspaceRootPath ?? ""}>
              {workspaceRootPath
                ? folderLabelFromPath(workspaceRootPath)
                : copy.noFolderOpen}
            </span>
          </div>
          <div className="workspace-header-actions">
            {workspaceRootPath ? (
              <div className="workspace-new-menu" ref={newMenuRef}>
                <button
                  aria-controls={newMenuId}
                  aria-expanded={newMenuOpen}
                  aria-haspopup="menu"
                  aria-label={fileOpsCopy.sidebarNewButton}
                  className="workspace-new-button"
                  onClick={() => setNewMenuOpen((open) => !open)}
                  ref={newMenuButtonRef}
                  title={fileOpsCopy.sidebarNewButton}
                  type="button"
                >
                  <PlusIcon />
                </button>
                {newMenuOpen ? (
                  <div
                    className="workspace-new-menu-popover"
                    id={newMenuId}
                    onKeyDown={handleNewMenuKeyDown}
                    role="menu"
                  >
                    <button type="button" role="menuitem" onClick={handleNewFile}>
                      {fileOpsCopy.newFileRoot}
                    </button>
                    <button type="button" role="menuitem" onClick={handleNewFolder}>
                      {fileOpsCopy.newFolderRoot}
                    </button>
                    <div
                      aria-label={fileOpsCopy.newOkfScaffoldGroup}
                      className="workspace-new-menu-group"
                      role="group"
                    >
                      <span
                        aria-hidden="true"
                        className="workspace-new-menu-group-label"
                      >
                        {fileOpsCopy.newOkfScaffoldGroup}
                      </span>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleOkfScaffoldMinimal}
                      >
                        {fileOpsCopy.newOkfScaffoldMinimalRoot}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleOkfScaffoldBookLike}
                      >
                        {fileOpsCopy.newOkfScaffoldBookLikeRoot}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            <button
              aria-label={copy.openWorkspaceFolder}
              className="workspace-open-button"
              onClick={onOpenWorkspace}
              title={copy.openWorkspaceFolder}
              type="button"
            >
              <OpenFolderIcon />
            </button>
            {onCollapse ? (
              <button
                aria-label={copy.collapseWorkspaceSidebar}
                className="workspace-collapse-button"
                onClick={onCollapse}
                title={copy.collapseWorkspaceSidebar}
                type="button"
              >
                <PanelLeftCloseIcon />
              </button>
            ) : null}
          </div>
        </div>
      </div>
      {workspaceTree ? (
        <WorkspaceTree
          activePath={activePath}
          compareSourcePath={compareSourcePath}
          compareTargetPath={compareTargetPath}
          dirtyFilePaths={dirtyFilePaths}
          entry={workspaceTree}
          compareSelectionEnabled={compareSelectionEnabled}
          onClearCompareSelection={onClearCompareSelection}
          onLoadDirectory={onLoadDirectory}
          onMoveEntry={onMoveEntry}
          onOpenContextMenu={onOpenContextMenu}
          onOpenFile={onOpenFile}
          onSelectCompareFile={onSelectCompareFile}
          onSubmitRename={onSubmitRename}
          loadingLabel={fileOpsCopy.loading}
          openFileStateLabel={fileOpsCopy.openFileState}
          openFilePaths={openFilePaths}
          renameLabel={fileOpsCopy.rename}
          renamingPath={renamingPath}
          requestRename={requestRename}
          partialEntriesLabel={fileOpsCopy.partialEntries}
          unsavedOpenFileStateLabel={fileOpsCopy.unsavedOpenFileState}
        />
      ) : (
        <div className="workspace-empty">
          <span>{copy.noFolderOpen}</span>
          <button type="button" onClick={onOpenWorkspace}>
            {copy.openFolder}
          </button>
        </div>
      )}
      {workspaceTree ? (
        <div className="workspace-footer">
          <button
            aria-label={trashLabel}
            className="workspace-trash-button"
            disabled={!canTrashActive}
            onClick={handleTrashActive}
            title={trashLabel}
            type="button"
          >
            <TrashIcon />
          </button>
        </div>
      ) : null}
    </aside>
  );
}

function folderLabelFromPath(path: string): string {
  const normalizedPath = path.endsWith("/") ? path.slice(0, -1) : path;
  const slashIndex = normalizedPath.lastIndexOf("/");
  const folderName =
    slashIndex === -1 ? normalizedPath : normalizedPath.slice(slashIndex + 1);

  return folderName || normalizedPath || path;
}

// Recursively walk the workspace tree (only the loaded subset)
// to find the entry whose `path` matches. Used to look up the
// focused entry for the sidebar trash button — when the user
// has an open tab whose file is loaded in the tree (root +
// ancestors expanded), the trash button uses that file's name
// and `kind` in the confirm dialog.
function findEntryByPath(
  entry: WorkspaceTreeEntry | null,
  path: string | null,
): WorkspaceTreeEntry | null {
  if (!entry || !path) return null;
  if (entry.path === path) return entry;
  for (const child of entry.children) {
    const found = findEntryByPath(child, path);
    if (found) return found;
  }
  return null;
}
