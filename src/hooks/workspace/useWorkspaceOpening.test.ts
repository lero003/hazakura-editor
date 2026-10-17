import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSecurityScopedBookmark, listWorkspaceTree, resolveSecurityScopedBookmark } from "../../lib/tauri/workspace";
import { pickWorkspaceFolder } from "../../lib/tauri/dialog";
import { setMainActiveWorkspace } from "../../lib/tauri/agent";
import {
  readPersistedWorkspaceState,
  readStoredRecentFolders,
  writeWorkspaceRootBookmark,
} from "../../lib/storage";
import { useWorkspaceOpening } from "./useWorkspaceOpening";

vi.mock("../../lib/tauri/workspace", () => ({
  createSecurityScopedBookmark: vi.fn(),
  listWorkspaceTree: vi.fn(),
  resolveSecurityScopedBookmark: vi.fn(),
}));
vi.mock("../../lib/tauri/dialog", () => ({
  pickWorkspaceFolder: vi.fn(),
}));
vi.mock("../../lib/tauri/agent", () => ({
  setMainActiveWorkspace: vi.fn(),
}))

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

  const hook = renderHook(() => useWorkspaceOpening(options));
  return {
    options,
    ...hook,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function folderTree(path: string) {
  return { path, name: path.split("/").pop()!, kind: "directory" as const,
    children: [], children_loaded: true, children_truncated: false };
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

  it("keeps the latest workspace when earlier folder reads finish later", async () => {
    const oldRead = deferred<ReturnType<typeof folderTree>>();
    vi.mocked(listWorkspaceTree).mockImplementation(path => path === "/old"
      ? oldRead.promise : Promise.resolve(folderTree(path)));
    vi.mocked(createSecurityScopedBookmark).mockResolvedValue([1]);
    const { options, result } = setup();
    let oldOpen!: Promise<boolean>;
    await act(async () => {
      oldOpen = result.current.openWorkspacePath("/old");
      await result.current.openWorkspacePath("/new");
      oldRead.resolve(folderTree("/old"));
      await oldOpen;
    });
    expect(options.setWorkspaceRootPath).toHaveBeenCalledTimes(1);
    expect(options.setWorkspaceRootPath).toHaveBeenLastCalledWith("/new");
    expect(writeWorkspaceRootBookmark).toHaveBeenCalledTimes(1);
    expect(options.rememberRecentFolder).toHaveBeenCalledTimes(1);
    expect(options.setCompareView).toHaveBeenCalledTimes(1);
    expect(options.setStatus).toHaveBeenLastCalledWith("Folder opened");
  });

  it("rejects an earlier bookmark even when the user returns to the same path", async () => {
    const oldBookmark = deferred<number[]>();
    vi.mocked(listWorkspaceTree).mockImplementation(path => Promise.resolve(folderTree(path)));
    vi.mocked(createSecurityScopedBookmark).mockReturnValueOnce(oldBookmark.promise)
      .mockResolvedValueOnce([2]).mockResolvedValueOnce([3]);
    const { options, result } = setup();
    let oldOpen!: Promise<boolean>;
    await act(async () => {
      oldOpen = result.current.openWorkspacePath("/a");
      await Promise.resolve();
      await result.current.openWorkspacePath("/b");
      await result.current.openWorkspacePath("/a");
      oldBookmark.resolve([1]);
      expect(await oldOpen).toBe(false);
    });
    expect(writeWorkspaceRootBookmark).toHaveBeenLastCalledWith("/a", [3]);
    expect(options.setWorkspaceTree).toHaveBeenCalledTimes(2);
    expect(options.clearImagePreview).toHaveBeenCalledTimes(2);
  });

  it("does not publish a folder or bookmark after unmount", async () => {
    const bookmark = deferred<number[]>();
    vi.mocked(listWorkspaceTree).mockResolvedValue(folderTree("/a"));
    vi.mocked(createSecurityScopedBookmark).mockReturnValue(bookmark.promise);
    const { options, result, unmount } = setup();
    let opening!: Promise<boolean>;
    await act(async () => {
      opening = result.current.openWorkspacePath("/a");
      await Promise.resolve();
    });
    unmount();
    await act(async () => { bookmark.resolve([1]); expect(await opening).toBe(false); });
    expect(writeWorkspaceRootBookmark).not.toHaveBeenCalled();
    expect(options.setWorkspaceRootPath).not.toHaveBeenCalled();
    expect(options.setStatus).not.toHaveBeenCalledWith("Folder opened");
  });

  it("does not prompt for a stale failed recent workspace", async () => {
    const oldRead = deferred<ReturnType<typeof folderTree>>();
    vi.mocked(readStoredRecentFolders).mockReturnValue([]);
    vi.mocked(listWorkspaceTree).mockImplementation(path => path === "/old"
      ? oldRead.promise : Promise.resolve(folderTree(path)));
    vi.mocked(createSecurityScopedBookmark).mockResolvedValue([2]);
    const { options, result } = setup();
    await act(async () => {
      const oldOpen = result.current.reopenRecentWorkspace("/old");
      await result.current.openWorkspacePath("/new");
      oldRead.reject(new Error("old folder unavailable"));
      await oldOpen;
    });
    expect(pickWorkspaceFolder).not.toHaveBeenCalled();
    expect(options.setGlobalError).not.toHaveBeenCalledWith(expect.any(String));
    expect(options.setStatus).toHaveBeenLastCalledWith("Folder opened");
  });

  it("does not open a folder chosen by a superseded picker", async () => {
    const picker = deferred<string | null>();
    vi.mocked(pickWorkspaceFolder).mockReturnValue(picker.promise);
    vi.mocked(listWorkspaceTree).mockImplementation(path => Promise.resolve(folderTree(path)));
    vi.mocked(createSecurityScopedBookmark).mockResolvedValue([2]);
    const { options, result } = setup();
    await act(async () => {
      const picking = result.current.openWorkspace();
      await result.current.openWorkspacePath("/new");
      picker.resolve("/old");
      await picking;
    });
    expect(listWorkspaceTree).toHaveBeenCalledTimes(1);
    expect(options.setWorkspaceRootPath).toHaveBeenLastCalledWith("/new");
  });

  it("retains the persisted bookmark when fallback opens a moved folder but renewal fails", async () => {
    vi.mocked(readPersistedWorkspaceState).mockReturnValue({
      workspaceRootPath: "/old", workspaceRootBookmark: [7, 8],
      tabPaths: [], activeTabPath: null,
    });
    vi.mocked(listWorkspaceTree).mockRejectedValueOnce(new Error("moved"))
      .mockResolvedValueOnce(folderTree("/moved"));
    vi.mocked(resolveSecurityScopedBookmark).mockResolvedValue("/moved");
    vi.mocked(createSecurityScopedBookmark).mockRejectedValue(new Error("renewal unavailable"));
    const { options, result } = setup();
    await act(async () => { await result.current.reopenPersistedWorkspace(); });
    expect(writeWorkspaceRootBookmark).toHaveBeenCalledWith("/moved", [7, 8]);
    expect(options.rememberRecentFolder).toHaveBeenCalledWith("/moved", [7, 8], "/old");
    expect(pickWorkspaceFolder).not.toHaveBeenCalled();
  });

  it("abandons stale persisted bookmark resolution before another read or picker", async () => {
    const resolution = deferred<string>();
    vi.mocked(readPersistedWorkspaceState).mockReturnValue({
      workspaceRootPath: "/old", workspaceRootBookmark: [7],
      tabPaths: [], activeTabPath: null,
    });
    vi.mocked(listWorkspaceTree).mockImplementation(path => path === "/old"
      ? Promise.reject(new Error("moved")) : Promise.resolve(folderTree(path)));
    vi.mocked(resolveSecurityScopedBookmark).mockReturnValue(resolution.promise);
    vi.mocked(createSecurityScopedBookmark).mockResolvedValue([2]);
    const { options, result } = setup();
    await act(async () => {
      const restoring = result.current.reopenPersistedWorkspace();
      await Promise.resolve();
      await result.current.openWorkspacePath("/new");
      resolution.resolve("/moved");
      await restoring;
    });
    expect(listWorkspaceTree).not.toHaveBeenCalledWith("/moved");
    expect(pickWorkspaceFolder).not.toHaveBeenCalled();
    expect(options.setWorkspaceRootPath).toHaveBeenLastCalledWith("/new");
    expect(options.setStatus).toHaveBeenLastCalledWith("Folder opened");
  });
});
