import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { listWorkspaceDirectory, listWorkspaceTree } from "../../lib/tauri";
import type { WorkspaceTreeEntry } from "../../lib/tauri";
import {
  displayedWorkspaceDirectories,
  replaceWorkspaceTreeEntry,
} from "../../features/workspace/workspaceTree";

type UseWorkspaceTreeLoaderOptions = {
  onError: (message: string | null) => void;
  onStatus: (message: string) => void;
  setWorkspaceTree: Dispatch<SetStateAction<WorkspaceTreeEntry | null>>;
  workspaceRootPath: string | null;
  workspaceTree?: WorkspaceTreeEntry | null;
};

export function useWorkspaceTreeLoader({
  onError,
  onStatus,
  setWorkspaceTree,
  workspaceRootPath,
  workspaceTree,
}: UseWorkspaceTreeLoaderOptions) {
  const treeRef = useRef(workspaceTree);
  treeRef.current = workspaceTree;
  const rootRef = useRef(workspaceRootPath);
  rootRef.current = workspaceRootPath;
  const sessionRef = useRef(0);
  const mountedRef = useRef(false);
  const requestsRef = useRef(new Map<string, number>());
  const manualRequestsRef = useRef(new Set<object>());
  const expandedRef = useRef(new Set<string>());
  const autoGenerationRef = useRef(0);
  const autoInFlightRef = useRef(false);
  const [isWorkspaceTreeVisible, setWorkspaceTreeVisible] = useState(true);

  useLayoutEffect(() => {
    mountedRef.current = true;
    sessionRef.current += 1;
    expandedRef.current.clear();
    requestsRef.current.clear();
    manualRequestsRef.current.clear();
    autoInFlightRef.current = false;
    return () => {
      mountedRef.current = false;
      sessionRef.current += 1;
      autoGenerationRef.current += 1;
    };
  }, [workspaceRootPath]);

  const cancelAutomaticWorkspaceRefresh = useCallback(() => {
    autoGenerationRef.current += 1;
  }, []);

  const onWorkspaceTreeVisibilityChange = useCallback((visible: boolean) => {
    if (!visible) cancelAutomaticWorkspaceRefresh();
    setWorkspaceTreeVisible(visible);
  }, [cancelAutomaticWorkspaceRefresh]);

  const onWorkspaceDirectoryExpanded = useCallback((path: string, expanded: boolean) => {
    if (expanded) expandedRef.current.add(path);
    else expandedRef.current.delete(path);
  }, []);

  const requestDirectory = useCallback(async (directoryPath: string, automatic = false, rootListing = false) => {
    const root = workspaceRootPath;
    if (!root || !mountedRef.current || rootRef.current !== root) return false;
    const session = sessionRef.current;
    const automaticGeneration = autoGenerationRef.current;
    const request = (requestsRef.current.get(directoryPath) ?? 0) + 1;
    requestsRef.current.set(directoryPath, request);
    const manualRequest = {};
    if (!automatic) manualRequestsRef.current.add(manualRequest);
    const isCurrent = () => mountedRef.current && rootRef.current === root &&
      sessionRef.current === session && requestsRef.current.get(directoryPath) === request &&
      (!automatic || autoGenerationRef.current === automaticGeneration);
    try {
      const directory = directoryPath === root && rootListing
        ? await listWorkspaceTree(root)
        : await listWorkspaceDirectory(root, directoryPath);
      if (!isCurrent()) return false;
      setWorkspaceTree((currentTree) => {
        if (!isCurrent() || currentTree?.path !== root) return currentTree;
        return replaceWorkspaceTreeEntry(currentTree, directory);
      });
      return directory.children_truncated ? "partial" : true;
    } catch (err) {
      if (isCurrent()) throw err;
      return false;
    } finally {
      manualRequestsRef.current.delete(manualRequest);
    }
  }, [setWorkspaceTree, workspaceRootPath]);

  const refreshDisplayedDirectories = useCallback(async (automatic: boolean) => {
    const root = workspaceRootPath;
    if (!root || !mountedRef.current || rootRef.current !== root) return;
    const current = treeRef.current;
    const paths = current?.path === root
      ? displayedWorkspaceDirectories(current, expandedRef.current)
      : [root];
    // Keep automatic failures out of global dialogs. The next visible check can
    // retry; no listing failure is authority to erase an existing snapshot.
    if (automatic) {
      await Promise.all(paths.map((path) => requestDirectory(path, true, true).catch(() => false)));
    } else {
      await Promise.all(paths.map((path) => requestDirectory(path, false, true)));
    }
  }, [requestDirectory, workspaceRootPath]);

  const refreshWorkspaceTree = useCallback(async () => {
    cancelAutomaticWorkspaceRefresh();
    await refreshDisplayedDirectories(false);
  }, [cancelAutomaticWorkspaceRefresh, refreshDisplayedDirectories]);

  const refreshWorkspaceTreeAutomatically = useCallback(async () => {
    if (autoInFlightRef.current || manualRequestsRef.current.size > 0 || !isWorkspaceTreeVisible) return;
    const session = sessionRef.current;
    autoInFlightRef.current = true;
    try {
      await refreshDisplayedDirectories(true);
    } finally {
      if (sessionRef.current === session) autoInFlightRef.current = false;
    }
  }, [isWorkspaceTreeVisible, refreshDisplayedDirectories]);

  const loadWorkspaceDirectory = useCallback(async (directoryPath: string) => {
    if (!workspaceRootPath) return;
    cancelAutomaticWorkspaceRefresh();
    onError(null);
    onStatus("Reading folder...");
    try {
      const loaded = await requestDirectory(directoryPath);
      if (loaded) onStatus(loaded === "partial" ? "Folder partially loaded" : "Folder loaded");
    } catch (err) {
      onError(String(err));
      onStatus("Folder load failed");
      throw err;
    }
  }, [cancelAutomaticWorkspaceRefresh, onError, onStatus, requestDirectory, workspaceRootPath]);

  const reloadWorkspaceParent = useCallback(async (directoryPath: string) => {
    cancelAutomaticWorkspaceRefresh();
    try {
      await requestDirectory(directoryPath);
    } catch (err) {
      onError(String(err));
      throw err;
    }
  }, [cancelAutomaticWorkspaceRefresh, onError, requestDirectory]);

  return {
    loadWorkspaceDirectory,
    refreshWorkspaceTree,
    reloadWorkspaceParent,
    onWorkspaceDirectoryExpanded,
    onWorkspaceTreeVisibilityChange,
    isWorkspaceTreeVisible,
    refreshWorkspaceTreeAutomatically,
    cancelAutomaticWorkspaceRefresh,
  };
}
