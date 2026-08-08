import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  MAX_WORKSPACE_SIDEBAR_WIDTH,
  MIN_WORKSPACE_SIDEBAR_WIDTH,
  readWorkspacePaneLayout,
  resizeWorkspaceSidebarWidth,
  updateStoredWorkspacePaneLayout,
  WORKSPACE_SIDEBAR_KEYBOARD_STEP,
} from "../../features/workspace/paneLayout";
import { clampNumber } from "../../lib/utils";

export function useWorkspaceSidebarResize() {
  const workspaceRef = useRef<HTMLElement | null>(null);
  const [workspaceSidebarWidth, setWorkspaceSidebarWidth] = useState(
    () => readWorkspacePaneLayout().workspaceSidebarWidth,
  );

  useEffect(() => {
    updateStoredWorkspacePaneLayout({ workspaceSidebarWidth });
  }, [workspaceSidebarWidth]);

  const workspaceGridStyle = useMemo<CSSProperties>(
    () => ({
      gridTemplateColumns: `${workspaceSidebarWidth}px 6px minmax(0, 1fr)`,
    }),
    [workspaceSidebarWidth],
  );

  const resizeWorkspaceSidebar = useCallback((clientX: number) => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const rect = workspace.getBoundingClientRect();
    setWorkspaceSidebarWidth(resizeWorkspaceSidebarWidth(rect.left, clientX));
  }, []);

  const handleWorkspaceResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      resizeWorkspaceSidebar(event.clientX);
    },
    [resizeWorkspaceSidebar],
  );

  const handleWorkspaceResizePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
      resizeWorkspaceSidebar(event.clientX);
    },
    [resizeWorkspaceSidebar],
  );

  const handleWorkspaceResizeKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      setWorkspaceSidebarWidth((current) =>
        clampNumber(
          current +
            (event.key === "ArrowRight"
              ? WORKSPACE_SIDEBAR_KEYBOARD_STEP
              : -WORKSPACE_SIDEBAR_KEYBOARD_STEP),
          MIN_WORKSPACE_SIDEBAR_WIDTH,
          MAX_WORKSPACE_SIDEBAR_WIDTH,
          current,
        ),
      );
    },
    [],
  );

  return {
    handleWorkspaceResizeKeyDown,
    handleWorkspaceResizePointerDown,
    handleWorkspaceResizePointerMove,
    workspaceGridStyle,
    workspaceRef,
    workspaceSidebarWidth,
  };
}
