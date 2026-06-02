import {
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useState,
} from "react";
import type {
  WorkspaceContextMenuState,
} from "../../types";
import type { WorkspaceTreeEntry } from "../../tauri";
import { isComparableTextFile } from "../../diff";

export function useWorkspaceContextMenu() {
  const [workspaceContextMenu, setWorkspaceContextMenu] =
    useState<WorkspaceContextMenuState | null>(null);

  const closeWorkspaceContextMenu = useCallback(() => {
    setWorkspaceContextMenu(null);
  }, []);

  const openWorkspaceContextMenu = useCallback(
    (
      entry: WorkspaceTreeEntry,
      event: ReactMouseEvent<HTMLButtonElement>,
    ) => {
      event.preventDefault();
      event.stopPropagation();

      setWorkspaceContextMenu({
        path: entry.path,
        name: entry.name,
        x: event.clientX,
        y: event.clientY,
        canCompare: isComparableTextFile(entry.name),
      });
    },
    [],
  );

  return {
    closeWorkspaceContextMenu,
    openWorkspaceContextMenu,
    workspaceContextMenu,
  };
}
