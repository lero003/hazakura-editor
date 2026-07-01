import { describe, expect, it, vi } from "vitest";
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
  renameWorkspaceEntry: vi.fn(),
}));

vi.mock("../../lib/tauri", () => ({
  createTextFile: workspaceApi.createTextFile,
  createTextFolder: workspaceApi.createTextFolder,
  listWorkspaceDirectory: workspaceApi.listWorkspaceDirectory,
  moveWorkspaceEntry: workspaceApi.moveWorkspaceEntry,
  moveWorkspaceEntryToTrash: workspaceApi.moveWorkspaceEntryToTrash,
  renameWorkspaceEntry: workspaceApi.renameWorkspaceEntry,
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
  it("trashing a folder clears descendant editor state", async () => {
    workspaceApi.moveWorkspaceEntryToTrash.mockResolvedValue(undefined);
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
