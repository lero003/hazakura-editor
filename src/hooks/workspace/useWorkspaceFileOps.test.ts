import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useWorkspaceFileOps } from "./useWorkspaceFileOps";
import type {
  CompareAnchor,
  CompareViewState,
  DraftRecord,
  EditorTab,
  RecentEntry,
} from "../../types";

const workspaceApi = vi.hoisted(() => ({
  createTextFile: vi.fn(),
  createTextFolder: vi.fn(),
  listWorkspaceDirectory: vi.fn(),
  moveWorkspaceEntry: vi.fn(),
  moveWorkspaceEntryToTrash: vi.fn(),
  openTextFile: vi.fn(),
  renameWorkspaceEntry: vi.fn(),
}));

const okfApi = vi.hoisted(() => ({
  createOkfScaffold: vi.fn(),
}));

vi.mock("../../lib/tauri", () => ({
  createTextFile: workspaceApi.createTextFile,
  createTextFolder: workspaceApi.createTextFolder,
  listWorkspaceDirectory: workspaceApi.listWorkspaceDirectory,
  moveWorkspaceEntry: workspaceApi.moveWorkspaceEntry,
  moveWorkspaceEntryToTrash: workspaceApi.moveWorkspaceEntryToTrash,
  openTextFile: workspaceApi.openTextFile,
  renameWorkspaceEntry: workspaceApi.renameWorkspaceEntry,
}));

vi.mock("../../lib/tauri/okf", () => ({
  createOkfScaffold: okfApi.createOkfScaffold,
}));

function makeTab(path: string): EditorTab {
  return {
    contents: "# note",
    encoding: "utf-8",
    error: null,
    externalFingerprint: null,
    fingerprint: "fingerprint",
    id: path,
    sessionId: path,
    ignoredExternalFingerprint: null,
    large_file_warning: false,
    lastSavedContents: "# note",
    lastSavedEncoding: "utf-8",
    lastSavedLineEnding: "lf",
    line_ending: "lf",
    modified_ms: null,
    name: path.split("/").pop() ?? path,
    path,
    saveStatus: "idle",
    size: 6,
  };
}

function makeOptions(overrides: Partial<Parameters<typeof useWorkspaceFileOps>[0]> = {}) {
  return {
    clearImagePreview: vi.fn(),
    getCompareCaseByKey: vi.fn(),
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("trashing a folder clears descendant editor state", async () => {
    workspaceApi.moveWorkspaceEntryToTrash.mockResolvedValue(undefined);
    const onWorkspaceEntryRemoved = vi.fn();
    let tabs: EditorTab[] = [
      makeTab("/workspace/notes/a.md"),
      makeTab("/workspace/keep.md"),
    ];
    let activeTabId: string | null = "/workspace/notes/a.md";
    let drafts: DraftRecord[] = [
      {
        contents: "draft",
        line_ending: "lf",
        path: "/workspace/notes/a.md",
        savedFingerprint: "fingerprint",
        updatedAt: 1,
      },
      {
        contents: "keep",
        line_ending: "lf",
        path: "/workspace/keep.md",
        savedFingerprint: "fingerprint",
        updatedAt: 2,
      },
    ];
    let recentFiles: RecentEntry[] = [
      {
        label: "a.md",
        openedAt: 1,
        path: "/workspace/notes/a.md",
        pinnedAt: null,
      },
      {
        label: "keep.md",
        openedAt: 2,
        path: "/workspace/keep.md",
        pinnedAt: null,
      },
    ];
    let compareAnchor: CompareAnchor | null = {
      name: "a.md",
      path: "/workspace/notes/a.md",
    };
    let compareTarget: CompareAnchor | null = {
      name: "keep.md",
      path: "/workspace/keep.md",
    };
    let compareView: CompareViewState | null = {
      additions: 1,
      caseKey: "random-case-key",
      lines: [],
      removals: 0,
    };

    const { result } = renderHook(() =>
      useWorkspaceFileOps(
        makeOptions({
          reloadWorkspaceParent: vi.fn(async () => undefined),
          setActiveTabId: vi.fn((next) => {
            activeTabId =
              typeof next === "function" ? next(activeTabId) : next;
          }),
          setCompareAnchor: vi.fn((next) => {
            compareAnchor =
              typeof next === "function" ? next(compareAnchor) : next;
          }),
          setCompareTarget: vi.fn((next) => {
            compareTarget =
              typeof next === "function" ? next(compareTarget) : next;
          }),
          setCompareView: vi.fn((next) => {
            compareView =
              typeof next === "function" ? next(compareView) : next;
          }),
          setPendingDrafts: vi.fn((next) => {
            drafts = typeof next === "function" ? next(drafts) : next;
          }),
          setRecentFiles: vi.fn((next) => {
            recentFiles =
              typeof next === "function" ? next(recentFiles) : next;
          }),
          setTabs: vi.fn((next) => {
            tabs = typeof next === "function" ? next(tabs) : next;
          }),
          tabs,
          workspaceRootPath: "/workspace",
          onWorkspaceEntryRemoved,
        }),
      ),
    );

    act(() => {
      result.current.requestTrashWorkspacePath(
        "/workspace/notes",
        "notes",
        true,
      );
    });
    await act(async () => {
      await result.current.confirmPendingTrash();
    });

    expect(workspaceApi.moveWorkspaceEntryToTrash).toHaveBeenCalledWith(
      "/workspace/notes",
      "/workspace",
    );
    expect(onWorkspaceEntryRemoved).toHaveBeenCalledWith(
      "/workspace/notes",
      true,
    );
    expect(tabs.map((tab) => tab.path)).toEqual(["/workspace/keep.md"]);
    expect(activeTabId).toBeNull();
    expect(drafts.map((draft) => draft.path)).toEqual(["/workspace/keep.md"]);
    expect(recentFiles.map((entry) => entry.path)).toEqual([
      "/workspace/keep.md",
    ]);
    expect(compareAnchor).toBeNull();
    expect(compareTarget?.path).toBe("/workspace/keep.md");
    expect(compareView).toBeNull();
  });

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

  it("creates an OKF scaffold, refreshes the tree, and opens its index", async () => {
    const reloadWorkspaceParent = vi.fn(async () => undefined);
    const rememberRecentFile = vi.fn();
    const setActiveTabId = vi.fn();
    const setStatus = vi.fn();
    let tabs: EditorTab[] = [];
    workspaceApi.listWorkspaceDirectory.mockResolvedValue({
      children: [{ name: "知識フォルダ" }],
    });
    okfApi.createOkfScaffold.mockResolvedValue({
      createdFiles: ["/workspace/知識フォルダ-2/index.md"],
      openPath: "/workspace/知識フォルダ-2/index.md",
      rootPath: "/workspace/知識フォルダ-2",
    });
    workspaceApi.openTextFile.mockResolvedValue({
      contents: "# 知識フォルダ\n",
      encoding: "utf-8",
      fingerprint: "okf-index",
      large_file_warning: false,
      line_ending: "lf",
      modified_ms: 1,
      name: "index.md",
      path: "/workspace/知識フォルダ-2/index.md",
      size: 10,
    });

    const { result } = renderHook(() =>
      useWorkspaceFileOps(
        makeOptions({
          reloadWorkspaceParent,
          rememberRecentFile,
          setActiveTabId,
          setStatus,
          setTabs: vi.fn((next) => {
            tabs = typeof next === "function" ? next(tabs) : next;
          }),
          workspaceRootPath: "/workspace",
        }),
      ),
    );

    await act(async () => {
      await result.current.createOkfScaffoldAt("/workspace", "minimal");
    });

    expect(okfApi.createOkfScaffold).toHaveBeenCalledWith(
      expect.objectContaining({
        folderName: "知識フォルダ-2",
        openRelativePath: "index.md",
        parentPath: "/workspace",
        workspaceRoot: "/workspace",
      }),
    );
    expect(reloadWorkspaceParent).toHaveBeenCalledWith("/workspace");
    expect(workspaceApi.openTextFile).toHaveBeenCalledWith(
      "/workspace/知識フォルダ-2/index.md",
    );
    expect(tabs.map((tab) => tab.path)).toEqual([
      "/workspace/知識フォルダ-2/index.md",
    ]);
    expect(setActiveTabId).toHaveBeenCalledWith(
      "/workspace/知識フォルダ-2/index.md",
    );
    expect(rememberRecentFile).toHaveBeenCalledWith(
      "/workspace/知識フォルダ-2/index.md",
    );
    expect(setStatus).toHaveBeenLastCalledWith(
      "OKF scaffold created: 知識フォルダ-2. Review with knowledge folder (OKF) when ready.",
    );
  });

  it("keeps post-create refresh and index-open failures visible", async () => {
    const setStatus = vi.fn();
    workspaceApi.listWorkspaceDirectory.mockResolvedValue({ children: [] });
    okfApi.createOkfScaffold.mockResolvedValue({
      createdFiles: ["/workspace/知識フォルダ/index.md"],
      openPath: "/workspace/知識フォルダ/index.md",
      rootPath: "/workspace/知識フォルダ",
    });
    workspaceApi.openTextFile.mockRejectedValue(new Error("open failed"));

    const { result } = renderHook(() =>
      useWorkspaceFileOps(
        makeOptions({
          reloadWorkspaceParent: vi.fn(async () => {
            throw new Error("refresh failed");
          }),
          setStatus,
          workspaceRootPath: "/workspace",
        }),
      ),
    );

    await act(async () => {
      await result.current.createOkfScaffoldAt("/workspace", "minimal");
    });

    expect(setStatus).toHaveBeenLastCalledWith(
      "OKF scaffold created; folder refresh and index open failed",
    );
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
