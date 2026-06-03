import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import type { WorkspaceTreeEntry } from "../../lib/tauri";
import type { SafeEditorCopy, WorkspaceFileOpsCopy } from "../../lib/locale";
import { PlusIcon } from "../app/Icons";
import { WorkspaceTree } from "./WorkspaceTree";

type WorkspaceSidebarProps = {
  activePath: string | null;
  compareSelectionEnabled: boolean;
  compareSourcePath: string | null;
  compareTargetPath: string | null;
  copy: SafeEditorCopy;
  fileOpsCopy: WorkspaceFileOpsCopy;
  onCreateFile: () => void;
  onCreateFolder: () => void;
  onLoadDirectory: (path: string) => Promise<void>;
  onOpenContextMenu: (
    entry: WorkspaceTreeEntry,
    event: ReactMouseEvent<HTMLButtonElement>,
    kind: "file" | "directory" | "root",
  ) => void;
  onOpenRootContextMenu: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onOpenFile: (path: string) => void | Promise<void>;
  onOpenWorkspace: () => void;
  onSelectCompareFile: (entry: WorkspaceTreeEntry) => void;
  workspaceRootPath: string | null;
  workspaceTree: WorkspaceTreeEntry | null;
};

export function WorkspaceSidebar({
  activePath,
  compareSelectionEnabled,
  compareSourcePath,
  compareTargetPath,
  copy,
  fileOpsCopy,
  onCreateFile,
  onCreateFolder,
  onLoadDirectory,
  onOpenContextMenu,
  onOpenRootContextMenu,
  onOpenFile,
  onOpenWorkspace,
  onSelectCompareFile,
  workspaceRootPath,
  workspaceTree,
}: WorkspaceSidebarProps) {
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const newMenuRef = useRef<HTMLDivElement | null>(null);

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
      }
    };
    window.addEventListener("mousedown", closeOnOutside);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("mousedown", closeOnOutside);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [newMenuOpen]);

  const handleNewFile = () => {
    setNewMenuOpen(false);
    onCreateFile();
  };

  const handleNewFolder = () => {
    setNewMenuOpen(false);
    onCreateFolder();
  };

  return (
    <aside className="file-tree-pane" aria-label={copy.workspaceFileTree}>
      <div
        className="workspace-header"
        onContextMenu={onOpenRootContextMenu}
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
                  aria-haspopup="menu"
                  aria-label={fileOpsCopy.sidebarNewButton}
                  className="workspace-new-button"
                  onClick={() => setNewMenuOpen((open) => !open)}
                  title={fileOpsCopy.sidebarNewButton}
                  type="button"
                >
                  <PlusIcon />
                </button>
                {newMenuOpen ? (
                  <div className="workspace-new-menu-popover" role="menu">
                    <button type="button" role="menuitem" onClick={handleNewFile}>
                      {fileOpsCopy.newFileRoot}
                    </button>
                    <button type="button" role="menuitem" onClick={handleNewFolder}>
                      {fileOpsCopy.newFolderRoot}
                    </button>
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
              <PlusIcon />
            </button>
          </div>
        </div>
      </div>
      {workspaceTree ? (
        <WorkspaceTree
          activePath={activePath}
          compareSourcePath={compareSourcePath}
          compareTargetPath={compareTargetPath}
          entry={workspaceTree}
          compareSelectionEnabled={compareSelectionEnabled}
          onLoadDirectory={onLoadDirectory}
          onOpenContextMenu={onOpenContextMenu}
          onOpenFile={onOpenFile}
          onSelectCompareFile={onSelectCompareFile}
        />
      ) : (
        <div className="workspace-empty">
          <span>{copy.noFolderOpen}</span>
          <button type="button" onClick={onOpenWorkspace}>
            {copy.openFolder}
          </button>
        </div>
      )}
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
