import { useEffect, type Dispatch, type SetStateAction } from "react";
import { setMainActiveWorkspace, type WorkspaceTreeEntry } from "../../lib/tauri";
import type { DraftRecord, EditorTab } from "../../types";
import { useOpenedFilesListener } from "../app/useOpenedFilesListener";
import { useWindowDragDrop } from "../app/useWindowDragDrop";
import { useWorkspaceContextMenuDismissal } from "./useWorkspaceContextMenuDismissal";
import { useWorkspaceRestore } from "./useWorkspaceRestore";

type UseWorkspaceRuntimeEffectsOptions = {
  activeTabPath: string | null;
  closeWorkspaceContextMenu: () => void;
  insertMarkdownAtCursor: (markdown: string) => void;
  openExternalFilePaths: (paths: string[]) => Promise<void>;
  restoreComplete: boolean;
  setActiveTabId: Dispatch<SetStateAction<string | null>>;
  setGlobalError: Dispatch<SetStateAction<string | null>>;
  setPendingDrafts: Dispatch<SetStateAction<DraftRecord[]>>;
  setRestoreComplete: Dispatch<SetStateAction<boolean>>;
  setStatus: Dispatch<SetStateAction<string>>;
  setTabs: Dispatch<SetStateAction<EditorTab[]>>;
  setWorkspaceRootPath: Dispatch<SetStateAction<string | null>>;
  setWorkspaceTree: Dispatch<SetStateAction<WorkspaceTreeEntry | null>>;
  workspaceContextMenuOpen: boolean;
  workspaceRootPath: string | null;
};

export function useWorkspaceRuntimeEffects({
  activeTabPath,
  closeWorkspaceContextMenu,
  insertMarkdownAtCursor,
  openExternalFilePaths,
  restoreComplete,
  setActiveTabId,
  setGlobalError,
  setPendingDrafts,
  setRestoreComplete,
  setStatus,
  setTabs,
  setWorkspaceRootPath,
  setWorkspaceTree,
  workspaceContextMenuOpen,
  workspaceRootPath,
}: UseWorkspaceRuntimeEffectsOptions) {
  useWorkspaceContextMenuDismissal({
    enabled: workspaceContextMenuOpen,
    onClose: closeWorkspaceContextMenu,
  });

  useWorkspaceRestore({
    onError: setGlobalError,
    onStatus: setStatus,
    setActiveTabId,
    setPendingDrafts,
    setRestoreComplete,
    setTabs,
    setWorkspaceRootPath,
    setWorkspaceTree,
  });

  useOpenedFilesListener({
    enabled: restoreComplete,
    onError: setGlobalError,
    onOpenFiles: openExternalFilePaths,
    onStatus: setStatus,
  });

  useWindowDragDrop({
    activeTabPath,
    onInsertMarkdown: insertMarkdownAtCursor,
    onOpenTextFiles: openExternalFilePaths,
    onStatus: setStatus,
    workspaceRootPath,
  });

  // Mirror the active workspace path into the Rust-side
  // MainWorkspaceCache so the detached Agent window's
  // getMainActiveWorkspace + MAIN_WORKSPACE_CHANGED_EVENT listener
  // stay in sync with the main window's open / close / restore
  // cycle. Fire-and-forget — the agent window's "no workspace —
  // open one in the main window" guard is a friendly affordance,
  // not a hard correctness gate, and a transient cache failure
  // must not block the user's main-window flow. The Rust side
  // dedupes the emit against the cached value, so this effect
  // does not churn the agent window on every render.
  useEffect(() => {
    void setMainActiveWorkspace(workspaceRootPath);
  }, [workspaceRootPath]);
}
