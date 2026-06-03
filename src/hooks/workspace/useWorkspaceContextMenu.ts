import {
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useState,
} from "react";
import type {
  WorkspaceContextMenuEntryKind,
  WorkspaceContextMenuState,
} from "../../types";
import type { WorkspaceTreeEntry } from "../../lib/tauri";
import { isComparableTextFile } from "../../features/diff/diff";

export function useWorkspaceContextMenu({
  workspaceRootPath,
}: {
  workspaceRootPath: string | null;
}) {
  const [workspaceContextMenu, setWorkspaceContextMenu] =
    useState<WorkspaceContextMenuState | null>(null);

  const closeWorkspaceContextMenu = useCallback(() => {
    setWorkspaceContextMenu(null);
  }, []);

  const openWorkspaceContextMenu = useCallback(
    (
      entry: WorkspaceTreeEntry,
      event: ReactMouseEvent<HTMLButtonElement>,
      kind: WorkspaceContextMenuEntryKind,
    ) => {
      event.preventDefault();
      event.stopPropagation();

      setWorkspaceContextMenu({
        path: entry.path,
        name: entry.name,
        x: event.clientX,
        y: event.clientY,
        canCompare: isComparableTextFile(entry.name),
        kind,
      });
    },
    [],
  );

  const openRootWorkspaceContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!workspaceRootPath) return;
      event.preventDefault();
      event.stopPropagation();
      const segments = workspaceRootPath.split("/");
      const name = segments[segments.length - 1] || workspaceRootPath;
      setWorkspaceContextMenu({
        path: workspaceRootPath,
        name,
        x: event.clientX,
        y: event.clientY,
        canCompare: false,
        kind: "root",
      });
    },
    [workspaceRootPath],
  );

  return {
    closeWorkspaceContextMenu,
    openRootWorkspaceContextMenu,
    openWorkspaceContextMenu,
    workspaceContextMenu,
  };
}
