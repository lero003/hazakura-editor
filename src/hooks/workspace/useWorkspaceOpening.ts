import {
  type Dispatch,
  type SetStateAction,
  useCallback,
} from "react";
import {
  createSecurityScopedBookmark,
  listWorkspaceTree,
  pickWorkspaceFolder,
  resolveSecurityScopedBookmark,
  setMainActiveWorkspace,
  type WorkspaceTreeEntry,
} from "../../lib/tauri";
import {
  readPersistedWorkspaceState,
  readStoredRecentFolders,
  writeWorkspaceRootBookmark,
} from "../../lib/storage";
import type { CompareAnchor, CompareViewState } from "../../types";

type UseWorkspaceOpeningOptions = {
  clearImagePreview: () => void;
  rememberRecentFolder: (
    path: string,
    workspaceBookmark?: number[] | null,
    replacedPath?: string,
  ) => void;
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
    async (
      path: string,
      workspaceBookmark?: number[] | null,
      recentPathToReplace?: string,
    ): Promise<boolean> => {
      setGlobalError(null);
      setStatus("Reading folder...");

      try {
        let resolvedPath = path;
        let tree: WorkspaceTreeEntry;
        try {
          tree = await listWorkspaceTree(path);
        } catch (pathError) {
          if (!workspaceBookmark || workspaceBookmark.length === 0) {
            throw pathError;
          }
          resolvedPath = await resolveSecurityScopedBookmark(workspaceBookmark);
          tree = await listWorkspaceTree(resolvedPath);
        }
        const freshBookmark = await createSecurityScopedBookmark(
          resolvedPath,
        ).catch(
          () => null,
        );
        const bookmark = freshBookmark ?? workspaceBookmark ?? null;
        writeWorkspaceRootBookmark(resolvedPath, bookmark);
        setWorkspaceTree(tree);
        setWorkspaceRootPath(resolvedPath);
        // Push the active workspace to the Rust-side cache so the
        // detached Agent window can read it via
        // getMainActiveWorkspace + MAIN_WORKSPACE_CHANGED_EVENT.
        // Fire-and-forget — the agent window's "no workspace — open
        // one in the main window" guard is a friendly affordance,
        // not a hard correctness gate, and a transient cache
        // failure must not block the user's folder-open action.
        void setMainActiveWorkspace(resolvedPath);
        clearImagePreview();
        setCompareView(null);
        setCompareAnchor(null);
        setCompareTarget(null);
        rememberRecentFolder(
          resolvedPath,
          bookmark,
          recentPathToReplace ?? (resolvedPath !== path ? path : undefined),
        );
        setStatus("Folder opened");
        return true;
      } catch (err) {
        setGlobalError(String(err));
        setStatus("Folder open failed");
        return false;
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

  const openWorkspace = useCallback(async (recentPathToReplace?: string) => {
    setGlobalError(null);
    setStatus("Choosing folder...");

    try {
      const path = await pickWorkspaceFolder();

      if (!path) {
        setStatus("Folder open cancelled");
        return;
      }

      await openWorkspacePath(path, undefined, recentPathToReplace);
    } catch (err) {
      setGlobalError(String(err));
      setStatus("Folder open failed");
    }
  }, [openWorkspacePath, setGlobalError, setStatus]);

  const reopenRecentWorkspace = useCallback(
    async (path: string) => {
      const recent = readStoredRecentFolders().find(
        (entry) => entry.path === path,
      );
      if (await openWorkspacePath(path, recent?.workspaceBookmark)) {
        return;
      }

      // Old recent entries only stored a path. In App Sandbox that path is
      // useful as history but is not an authorization grant; ask once through
      // the standard picker, then persist the fresh bookmark for next time.
      setStatus("Reauthorization required");
      await openWorkspace(path);
    },
    [openWorkspace, openWorkspacePath, setStatus],
  );

  /**
   * Resume the last persisted workspace without inventing new storage.
   * Tries the stored path, then the security-scoped bookmark, then the
   * standard folder picker for reauthorization.
   */
  const reopenPersistedWorkspace = useCallback(async () => {
    const persisted = readPersistedWorkspaceState();
    const path = persisted?.workspaceRootPath;

    if (!path) {
      await openWorkspace();
      return;
    }

    setGlobalError(null);
    setStatus("Reopening folder...");

    if (await openWorkspacePath(path)) {
      return;
    }

    const bookmark = persisted.workspaceRootBookmark;
    if (bookmark && bookmark.length > 0) {
      try {
        const resolvedPath = await resolveSecurityScopedBookmark(bookmark);
        if (await openWorkspacePath(resolvedPath)) {
          return;
        }
      } catch {
        // Fall through to the explicit picker reauthorization path.
      }
    }

    setStatus("Reauthorization required");
    await openWorkspace();
  }, [openWorkspace, openWorkspacePath, setGlobalError, setStatus]);

  return {
    openWorkspace,
    openWorkspacePath,
    reopenRecentWorkspace,
    reopenPersistedWorkspace,
  };
}
