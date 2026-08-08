import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WORKSPACE_PANE_LAYOUT_STORAGE_KEY } from "../../types";
import {
  MAX_WORKSPACE_SIDEBAR_WIDTH,
  MIN_WORKSPACE_SIDEBAR_WIDTH,
} from "../../features/workspace/paneLayout";
import { useWorkspaceSidebarResize } from "./useWorkspaceSidebarResize";

describe("useWorkspaceSidebarResize", () => {
  beforeEach(() => window.localStorage.clear());

  it("restores a saved width and exposes the three-column workspace grid", () => {
    window.localStorage.setItem(
      WORKSPACE_PANE_LAYOUT_STORAGE_KEY,
      JSON.stringify({ workspaceSidebarWidth: 344 }),
    );

    const { result } = renderHook(() => useWorkspaceSidebarResize());

    expect(result.current.workspaceSidebarWidth).toBe(344);
    expect(result.current.workspaceGridStyle.gridTemplateColumns).toBe(
      "344px 6px minmax(0, 1fr)",
    );
  });

  it("supports keyboard resizing and clamps at the accessible limits", () => {
    const { result } = renderHook(() => useWorkspaceSidebarResize());
    const preventDefault = vi.fn();

    act(() => {
      result.current.handleWorkspaceResizeKeyDown({
        key: "ArrowRight",
        preventDefault,
      } as never);
    });
    expect(result.current.workspaceSidebarWidth).toBe(296);
    expect(preventDefault).toHaveBeenCalled();

    for (let index = 0; index < 30; index += 1) {
      act(() => {
        result.current.handleWorkspaceResizeKeyDown({
          key: "ArrowRight",
          preventDefault,
        } as never);
      });
    }
    expect(result.current.workspaceSidebarWidth).toBe(
      MAX_WORKSPACE_SIDEBAR_WIDTH,
    );

    for (let index = 0; index < 30; index += 1) {
      act(() => {
        result.current.handleWorkspaceResizeKeyDown({
          key: "ArrowLeft",
          preventDefault,
        } as never);
      });
    }
    expect(result.current.workspaceSidebarWidth).toBe(
      MIN_WORKSPACE_SIDEBAR_WIDTH,
    );
  });
});
