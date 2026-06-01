import type { Dispatch, SetStateAction } from "react";
import type { WorkspaceTreeEntry } from "../tauri";
import type { DraftRecord, EditorTab } from "../types";
import { useOpenedFilesListener } from "./useOpenedFilesListener";
import { useWindowDragDrop } from "./useWindowDragDrop";
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
}
