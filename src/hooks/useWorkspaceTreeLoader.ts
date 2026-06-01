import { type Dispatch, type SetStateAction, useCallback } from "react";
import { listWorkspaceDirectory, listWorkspaceTree } from "../tauri";
import type { WorkspaceTreeEntry } from "../tauri";
import { replaceWorkspaceTreeEntry } from "../workspaceTree";

type UseWorkspaceTreeLoaderOptions = {
  onError: (message: string | null) => void;
  onStatus: (message: string) => void;
  setWorkspaceTree: Dispatch<SetStateAction<WorkspaceTreeEntry | null>>;
  workspaceRootPath: string | null;
};

export function useWorkspaceTreeLoader({
  onError,
  onStatus,
  setWorkspaceTree,
  workspaceRootPath,
}: UseWorkspaceTreeLoaderOptions) {
  const refreshWorkspaceTree = useCallback(async () => {
    if (!workspaceRootPath) {
      return;
    }

    const tree = await listWorkspaceTree(workspaceRootPath);
    setWorkspaceTree(tree);
  }, [setWorkspaceTree, workspaceRootPath]);

  const loadWorkspaceDirectory = useCallback(
    async (directoryPath: string) => {
      if (!workspaceRootPath) {
        return;
      }

      onError(null);
      onStatus("Reading folder...");

      try {
        const directory = await listWorkspaceDirectory(
          workspaceRootPath,
          directoryPath,
        );

        setWorkspaceTree((currentTree) =>
          currentTree
            ? replaceWorkspaceTreeEntry(currentTree, directory)
            : currentTree,
        );
        onStatus(
          directory.children_truncated
            ? "Folder partially loaded"
            : "Folder loaded",
        );
      } catch (err) {
        onError(String(err));
        onStatus("Folder load failed");
        throw err;
      }
    },
    [onError, onStatus, setWorkspaceTree, workspaceRootPath],
  );

  return {
    loadWorkspaceDirectory,
    refreshWorkspaceTree,
  };
}
