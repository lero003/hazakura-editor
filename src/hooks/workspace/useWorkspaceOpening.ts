import {
  type Dispatch,
  type SetStateAction,
  useCallback,
} from "react";
import {
  listWorkspaceTree,
  pickWorkspaceFolder,
  type WorkspaceTreeEntry,
} from "../../tauri";
import type { CompareAnchor, CompareViewState } from "../../types";

type UseWorkspaceOpeningOptions = {
  clearImagePreview: () => void;
  rememberRecentFolder: (path: string) => void;
  setCompareAnchor: Dispatch<SetStateAction<CompareAnchor | null>>;
  setCompareTarget: Dispatch<SetStateAction<CompareAnchor | null>>;
  setCompareView: Dispatch<SetStateAction<CompareViewState | null>>;
  setGlobalError: Dispatch<SetStateAction<string | null>>;
  setStatus: Dispatch<SetStateAction<string>>;
  setWorkspaceRootPath: Dispatch<SetStateAction<string | null>>;
  setWorkspaceTree: Dispatch<SetStateAction<WorkspaceTreeEntry | null>>;
};

export function useWorkspaceOpening({
  clearImagePreview,
  rememberRecentFolder,
  setCompareAnchor,
  setCompareTarget,
  setCompareView,
  setGlobalError,
  setStatus,
  setWorkspaceRootPath,
  setWorkspaceTree,
}: UseWorkspaceOpeningOptions) {
  const openWorkspacePath = useCallback(
    async (path: string) => {
      setGlobalError(null);
      setStatus("Reading folder...");

      try {
        const tree = await listWorkspaceTree(path);
        setWorkspaceTree(tree);
        setWorkspaceRootPath(path);
        clearImagePreview();
        setCompareView(null);
        setCompareAnchor(null);
        setCompareTarget(null);
        rememberRecentFolder(path);
        setStatus("Folder opened");
      } catch (err) {
        setGlobalError(String(err));
        setStatus("Folder open failed");
      }
    },
    [
      clearImagePreview,
      rememberRecentFolder,
      setCompareAnchor,
      setCompareTarget,
      setCompareView,
      setGlobalError,
      setStatus,
      setWorkspaceRootPath,
      setWorkspaceTree,
    ],
  );

  const openWorkspace = useCallback(async () => {
    setGlobalError(null);
    setStatus("Choosing folder...");

    try {
      const path = await pickWorkspaceFolder();

      if (!path) {
        setStatus("Folder open cancelled");
        return;
      }

      await openWorkspacePath(path);
    } catch (err) {
      setGlobalError(String(err));
      setStatus("Folder open failed");
    }
  }, [openWorkspacePath, setGlobalError, setStatus]);

  return {
    openWorkspace,
    openWorkspacePath,
  };
}
