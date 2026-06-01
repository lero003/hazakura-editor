import { useFileOpening } from "./useFileOpening";
import { useWorkspaceOpening } from "./useWorkspaceOpening";
import { useWorkspaceTreeLoader } from "./useWorkspaceTreeLoader";

type UseWorkspaceFileOpeningOptions = {
} & Omit<Parameters<typeof useFileOpening>[0], "refreshWorkspaceTree">
  & Parameters<typeof useWorkspaceOpening>[0]
  & Omit<Parameters<typeof useWorkspaceTreeLoader>[0], "onError" | "onStatus">;

export function useWorkspaceFileOpening(options: UseWorkspaceFileOpeningOptions) {
  const treeActions = useWorkspaceTreeLoader({
    onError: options.setGlobalError,
    onStatus: options.setStatus,
    setWorkspaceTree: options.setWorkspaceTree,
    workspaceRootPath: options.workspaceRootPath,
  });
  const workspaceActions = useWorkspaceOpening(options);
  const fileActions = useFileOpening({
    ...options,
    refreshWorkspaceTree: treeActions.refreshWorkspaceTree,
  });

  return {
    ...treeActions,
    ...workspaceActions,
    ...fileActions,
  };
}
