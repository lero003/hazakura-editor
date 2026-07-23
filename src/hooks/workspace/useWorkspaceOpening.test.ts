import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSecurityScopedBookmark,
  listWorkspaceTree,
  pickWorkspaceFolder,
  resolveSecurityScopedBookmark,
  setMainActiveWorkspace,
} from "../../lib/tauri";
import {
  readPersistedWorkspaceState,
  readStoredRecentFolders,
  writeWorkspaceRootBookmark,
} from "../../lib/storage";
import { useWorkspaceOpening } from "./useWorkspaceOpening";

vi.mock("../../lib/tauri", () => ({
  createSecurityScopedBookmark: vi.fn(),
  listWorkspaceTree: vi.fn(),
  pickWorkspaceFolder: vi.fn(),
  resolveSecurityScopedBookmark: vi.fn(),
  setMainActiveWorkspace: vi.fn(),
}));

vi.mock("../../lib/storage", () => ({
  readPersistedWorkspaceState: vi.fn(),
  readStoredRecentFolders: vi.fn(),
  writeWorkspaceRootBookmark: vi.fn(),
}));

function setup() {
  const options: Parameters<typeof useWorkspaceOpening>[0] = {
    clearImagePreview: vi.fn(),
    rememberRecentFolder: vi.fn(),
    setCompareAnchor: vi.fn(),
    setCompareTarget: vi.fn(),
    setCompareView: vi.fn(),
    setGlobalError: vi.fn(),
    setStatus: vi.fn(),
    setWorkspaceRootPath: vi.fn(),
    setWorkspaceTree: vi.fn(),
  };

  return {
    options,
    result: renderHook(() => useWorkspaceOpening(options)).result,
  };
}

describe("useWorkspaceOpening recent folders", () => {
  beforeEach(() => {
    vi.mocked(createSecurityScopedBookmark).mockReset();
    vi.mocked(listWorkspaceTree).mockReset();
    vi.mocked(pickWorkspaceFolder).mockReset();
    vi.mocked(resolveSecurityScopedBookmark).mockReset();
    vi.mocked(setMainActiveWorkspace).mockReset();
    vi.mocked(readPersistedWorkspaceState).mockReset();
    vi.mocked(readStoredRecentFolders).mockReset();
    vi.mocked(writeWorkspaceRootBookmark).mockReset();
  });

  it("reopens a sandboxed recent folder through its own bookmark", async () => {
    const tree = {
      path: "/resolved/book",
      name: "book",
      kind: "directory" as const,
      children: [],
      children_loaded: true,
      children_truncated: false,
    };
    vi.mocked(readStoredRecentFolders).mockReturnValue([
      {
        path: "/stored/book",
        label: "book",
        openedAt: 1,
        pinnedAt: null,
        workspaceBookmark: [7, 8, 9],
      },
    ]);
    vi.mocked(listWorkspaceTree)
      .mockRejectedValueOnce(new Error("Operation not permitted"))
      .mockResolvedValueOnce(tree);
    vi.mocked(resolveSecurityScopedBookmark).mockResolvedValue(
      "/resolved/book",
    );
    vi.mocked(createSecurityScopedBookmark).mockResolvedValue([4, 5, 6]);
    const { options, result } = setup();

    await act(async () => {
      await result.current.reopenRecentWorkspace("/stored/book");
    });

    expect(resolveSecurityScopedBookmark).toHaveBeenCalledWith([7, 8, 9]);
    expect(listWorkspaceTree).toHaveBeenNthCalledWith(2, "/resolved/book");
    expect(options.setWorkspaceRootPath).toHaveBeenCalledWith("/resolved/book");
    expect(options.rememberRecentFolder).toHaveBeenCalledWith(
      "/resolved/book",
      [4, 5, 6],
      "/stored/book",
    );
    expect(pickWorkspaceFolder).not.toHaveBeenCalled();
  });

  it("reauthorizes a legacy recent folder once and saves its fresh bookmark", async () => {
    const tree = {
      path: "/picked/book",
      name: "book",
      kind: "directory" as const,
      children: [],
      children_loaded: true,
      children_truncated: false,
    };
    vi.mocked(readStoredRecentFolders).mockReturnValue([
      {
        path: "/legacy/book",
        label: "book",
        openedAt: 1,
        pinnedAt: null,
      },
    ]);
    vi.mocked(listWorkspaceTree)
      .mockRejectedValueOnce(new Error("Operation not permitted"))
      .mockResolvedValueOnce(tree);
    vi.mocked(pickWorkspaceFolder).mockResolvedValue("/picked/book");
    vi.mocked(createSecurityScopedBookmark).mockResolvedValue([10, 11, 12]);
    const { options, result } = setup();

    await act(async () => {
      await result.current.reopenRecentWorkspace("/legacy/book");
    });

    expect(resolveSecurityScopedBookmark).not.toHaveBeenCalled();
    expect(pickWorkspaceFolder).toHaveBeenCalledTimes(1);
    expect(options.rememberRecentFolder).toHaveBeenCalledWith(
      "/picked/book",
      [10, 11, 12],
      "/legacy/book",
    );
    expect(options.setGlobalError).toHaveBeenLastCalledWith(null);
    expect(options.setStatus).toHaveBeenLastCalledWith("Folder opened");
  });
});
