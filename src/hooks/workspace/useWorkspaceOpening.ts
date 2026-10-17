import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useLayoutEffect,
  useRef,
} from "react";
import { createSecurityScopedBookmark, listWorkspaceTree, resolveSecurityScopedBookmark, type WorkspaceTreeEntry } from "../../lib/tauri/workspace";
import { pickWorkspaceFolder } from "../../lib/tauri/dialog";
import { setMainActiveWorkspace } from "../../lib/tauri/agent";
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
  const operationRef = useRef(0);
  const mountedRef = useRef(false);
  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      operationRef.current += 1;
    };
  }, []);
  const beginOperation = useCallback(() => {
    const operation = ++operationRef.current;
    return () => mountedRef.current && operationRef.current === operation;
  }, []);

  // A picker, bookmark fallback, and reauthorization belong to one user action.
  // Checking only the path would let an earlier A result publish after A → B → A.
  const openWorkspacePathForOperation = useCallback(
    async (
      path: string,
      workspaceBookmark: number[] | null | undefined,
      recentPathToReplace: string | undefined,
      isCurrent: () => boolean,
    ): Promise<boolean> => {
      if (!isCurrent()) return false;
      setGlobalError(null);
      setStatus("Reading folder...");

      try {
        let resolvedPath = path;
        let tree: WorkspaceTreeEntry;
        try {
          tree = await listWorkspaceTree(path);
        } catch (pathError) {
          if (!isCurrent()) return false;
          if (!workspaceBookmark || workspaceBookmark.length === 0) {
            throw pathError;
          }
          resolvedPath = await resolveSecurityScopedBookmark(workspaceBookmark);
          if (!isCurrent()) return false;
          tree = await listWorkspaceTree(resolvedPath);
        }
        if (!isCurrent()) return false;
        const freshBookmark = await createSecurityScopedBookmark(
          resolvedPath,
        ).catch(
          () => null,
        );
        if (!isCurrent()) return false;
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
        if (!isCurrent()) return false;
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

  const openWorkspacePath = useCallback((
    path: string,
    workspaceBookmark?: number[] | null,
    recentPathToReplace?: string,
  ) => openWorkspacePathForOperation(path, workspaceBookmark, recentPathToReplace, beginOperation()),
  [beginOperation, openWorkspacePathForOperation]);

  const openWorkspaceForOperation = useCallback(async (
    recentPathToReplace: string | undefined,
    isCurrent: () => boolean,
  ) => {
    if (!isCurrent()) return;
    setGlobalError(null);
    setStatus("Choosing folder...");

    try {
      const path = await pickWorkspaceFolder();
      if (!isCurrent()) return;

      if (!path) {
        setStatus("Folder open cancelled");
        return;
      }

      await openWorkspacePathForOperation(path, undefined, recentPathToReplace, isCurrent);
    } catch (err) {
      if (!isCurrent()) return;
      setGlobalError(String(err));
      setStatus("Folder open failed");
    }
  }, [openWorkspacePathForOperation, setGlobalError, setStatus]);

  const openWorkspace = useCallback((recentPathToReplace?: string) =>
    openWorkspaceForOperation(recentPathToReplace, beginOperation()),
  [beginOperation, openWorkspaceForOperation]);

  const reopenRecentWorkspace = useCallback(
    async (path: string) => {
      const isCurrent = beginOperation();
      if (!isCurrent()) return;
      const recent = readStoredRecentFolders().find(
        (entry) => entry.path === path,
      );
      if (await openWorkspacePathForOperation(path, recent?.workspaceBookmark, undefined, isCurrent)) {
        return;
      }
      if (!isCurrent()) return;

      // Old recent entries only stored a path. In App Sandbox that path is
      // useful as history but is not an authorization grant; ask once through
      // the standard picker, then persist the fresh bookmark for next time.
      setStatus("Reauthorization required");
      await openWorkspaceForOperation(path, isCurrent);
    },
    [beginOperation, openWorkspaceForOperation, openWorkspacePathForOperation, setStatus],
  );

  /**
   * Resume the last persisted workspace without inventing new storage.
   * Tries the stored path, then the security-scoped bookmark, then the
   * standard folder picker for reauthorization.
   */
  const reopenPersistedWorkspace = useCallback(async () => {
    const isCurrent = beginOperation();
    if (!isCurrent()) return;
    const persisted = readPersistedWorkspaceState();
    const path = persisted?.workspaceRootPath;

    if (!path) {
      await openWorkspaceForOperation(undefined, isCurrent);
      return;
    }

    setGlobalError(null);
    setStatus("Reopening folder...");

    if (await openWorkspacePathForOperation(path, persisted.workspaceRootBookmark, undefined, isCurrent)) {
      return;
    }
    if (!isCurrent()) return;

    setStatus("Reauthorization required");
    await openWorkspaceForOperation(undefined, isCurrent);
  }, [beginOperation, openWorkspaceForOperation, openWorkspacePathForOperation, setGlobalError, setStatus]);

  return {
    openWorkspace,
    openWorkspacePath,
    reopenRecentWorkspace,
    reopenPersistedWorkspace,
  };
}
