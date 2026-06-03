import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useWorkspaceFileOps } from "./useWorkspaceFileOps";

describe("useWorkspaceFileOps", () => {
  it("returns the workspace file op action surface", () => {
    const { result } = renderHook(() =>
      useWorkspaceFileOps({
        clearImagePreview: vi.fn(),
        reloadWorkspaceParent: vi.fn(async () => undefined),
        rememberRecentFile: vi.fn(),
        setActiveTabId: vi.fn(),
        setCompareView: vi.fn(),
        setGlobalError: vi.fn(),
        setStatus: vi.fn(),
        setTabs: vi.fn(),
        tabs: [],
        workspaceRootPath: null,
      }),
    );

    expect(result.current).toHaveProperty("createFile");
    expect(result.current).toHaveProperty("createFolder");
    expect(result.current).toHaveProperty("focusIfAlreadyOpen");
  });

  it("createFile is a no-op when no workspace is open", async () => {
    const setStatus = vi.fn();
    const { result } = renderHook(() =>
      useWorkspaceFileOps({
        clearImagePreview: vi.fn(),
        reloadWorkspaceParent: vi.fn(async () => undefined),
        rememberRecentFile: vi.fn(),
        setActiveTabId: vi.fn(),
        setCompareView: vi.fn(),
        setGlobalError: vi.fn(),
        setStatus,
        setTabs: vi.fn(),
        tabs: [],
        workspaceRootPath: null,
      }),
    );

    await result.current.createFile("/some/parent");

    expect(setStatus).toHaveBeenCalledWith("No workspace open");
  });

  it("createFolder is a no-op when no workspace is open", async () => {
    const setStatus = vi.fn();
    const { result } = renderHook(() =>
      useWorkspaceFileOps({
        clearImagePreview: vi.fn(),
        reloadWorkspaceParent: vi.fn(async () => undefined),
        rememberRecentFile: vi.fn(),
        setActiveTabId: vi.fn(),
        setCompareView: vi.fn(),
        setGlobalError: vi.fn(),
        setStatus,
        setTabs: vi.fn(),
        tabs: [],
        workspaceRootPath: null,
      }),
    );

    await result.current.createFolder("/some/parent");

    expect(setStatus).toHaveBeenCalledWith("No workspace open");
  });
});
