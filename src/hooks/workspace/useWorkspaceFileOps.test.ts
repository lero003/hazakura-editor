import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useWorkspaceFileOps } from "./useWorkspaceFileOps";

function makeOptions(overrides: Partial<Parameters<typeof useWorkspaceFileOps>[0]> = {}) {
  return {
    clearImagePreview: vi.fn(),
    reloadWorkspaceParent: vi.fn(async () => undefined),
    rememberRecentFile: vi.fn(),
    setActiveTabId: vi.fn(),
    setCompareAnchor: vi.fn(),
    setCompareTarget: vi.fn(),
    setCompareView: vi.fn(),
    setGlobalError: vi.fn(),
    setPendingDrafts: vi.fn(),
    setRecentFiles: vi.fn(),
    setStatus: vi.fn(),
    setTabs: vi.fn(),
    tabs: [],
    workspaceRootPath: null,
    ...overrides,
  };
}

describe("useWorkspaceFileOps", () => {
  it("returns the workspace file op action surface", () => {
    const { result } = renderHook(() => useWorkspaceFileOps(makeOptions()));

    expect(result.current).toHaveProperty("createFile");
    expect(result.current).toHaveProperty("createFolder");
    expect(result.current).toHaveProperty("focusIfAlreadyOpen");
    expect(result.current).toHaveProperty("renameWorkspacePath");
    expect(result.current).toHaveProperty("requestRename");
    expect(result.current).toHaveProperty("pendingRenameWarning");
  });

  it("createFile is a no-op when no workspace is open", async () => {
    const setStatus = vi.fn();
    const { result } = renderHook(() =>
      useWorkspaceFileOps(makeOptions({ setStatus })),
    );

    await result.current.createFile("/some/parent");

    expect(setStatus).toHaveBeenCalledWith("No workspace open");
  });

  it("createFolder is a no-op when no workspace is open", async () => {
    const setStatus = vi.fn();
    const { result } = renderHook(() =>
      useWorkspaceFileOps(makeOptions({ setStatus })),
    );

    await result.current.createFolder("/some/parent");

    expect(setStatus).toHaveBeenCalledWith("No workspace open");
  });

  it("renameWorkspacePath is a no-op for an empty name", async () => {
    const setStatus = vi.fn();
    const { result } = renderHook(() =>
      useWorkspaceFileOps(makeOptions({ setStatus })),
    );

    await result.current.renameWorkspacePath("/path/to/file.md", "");

    expect(setStatus).toHaveBeenCalledWith("Rename cancelled");
  });

  it("renameWorkspacePath is a no-op when the name is unchanged", async () => {
    const setStatus = vi.fn();
    const { result } = renderHook(() =>
      useWorkspaceFileOps(makeOptions({ setStatus })),
    );

    await result.current.renameWorkspacePath("/path/to/file.md", "file.md");

    expect(setStatus).toHaveBeenCalledWith("Rename cancelled");
  });
});
