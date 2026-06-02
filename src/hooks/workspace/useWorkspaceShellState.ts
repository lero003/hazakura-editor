import { useState } from "react";
import type { WorkspaceTreeEntry } from "../../tauri";

export function useWorkspaceShellState() {
  const [workspaceTree, setWorkspaceTree] =
    useState<WorkspaceTreeEntry | null>(null);
  const [workspaceRootPath, setWorkspaceRootPath] = useState<string | null>(
    null,
  );
  const [restoreComplete, setRestoreComplete] = useState(false);

  return {
    restoreComplete,
    setRestoreComplete,
    setWorkspaceRootPath,
    setWorkspaceTree,
    workspaceRootPath,
    workspaceTree,
  };
}
