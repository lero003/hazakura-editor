import {
  type Dispatch,
  type SetStateAction,
  useCallback,
} from "react";
import {
  createSecurityScopedBookmark,
  listWorkspaceTree,
  pickWorkspaceFolder,
  setMainActiveWorkspace,
  type WorkspaceTreeEntry,
} from "../../lib/tauri";
import { writeWorkspaceRootBookmark } from "../../lib/storage";
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
        const bookmark = await createSecurityScopedBookmark(path).catch(
          () => null,
        );
        writeWorkspaceRootBookmark(path, bookmark);
        setWorkspaceTree(tree);
        setWorkspaceRootPath(path);
        // Push the active workspace to the Rust-side cache so the
        // detached Agent window can read it via
        // getMainActiveWorkspace + MAIN_WORKSPACE_CHANGED_EVENT.
        // Fire-and-forget — the agent window's "no workspace — open
        // one in the main window" guard is a friendly affordance,
        // not a hard correctness gate, and a transient cache
        // failure must not block the user's folder-open action.
        void setMainActiveWorkspace(path);
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
