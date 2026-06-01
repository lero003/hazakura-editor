import type { MouseEvent as ReactMouseEvent } from "react";
import type { WorkspaceTreeEntry } from "../tauri";
import type { SafeEditorCopy } from "../locale";
import { PlusIcon } from "./Icons";
import { WorkspaceTree } from "./WorkspaceTree";

type WorkspaceSidebarProps = {
  activePath: string | null;
  compareSelectionEnabled: boolean;
  compareSourcePath: string | null;
  compareTargetPath: string | null;
  copy: SafeEditorCopy;
  onLoadDirectory: (path: string) => Promise<void>;
  onOpenContextMenu: (
    entry: WorkspaceTreeEntry,
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => void;
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
  onLoadDirectory,
  onOpenContextMenu,
  onOpenFile,
  onOpenWorkspace,
  onSelectCompareFile,
  workspaceRootPath,
  workspaceTree,
}: WorkspaceSidebarProps) {
  return (
    <aside className="file-tree-pane" aria-label={copy.workspaceFileTree}>
      <div className="workspace-header">
        <div className="workspace-heading">
          <div className="workspace-labels">
            <span className="workspace-kicker">{copy.workspace}</span>
            <span className="workspace-title" title={workspaceRootPath ?? ""}>
              {workspaceRootPath
                ? folderLabelFromPath(workspaceRootPath)
                : copy.noFolderOpen}
            </span>
          </div>
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
