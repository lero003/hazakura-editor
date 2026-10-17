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

vi.mock("../../lib/tauri/files", () => ({
  createTextFile: workspaceApi.createTextFile,
  openTextFile: workspaceApi.openTextFile,
}));
vi.mock("../../lib/tauri/workspace", () => ({
  createTextFolder: workspaceApi.createTextFolder,
  listWorkspaceDirectory: workspaceApi.listWorkspaceDirectory,
  moveWorkspaceEntry: workspaceApi.moveWorkspaceEntry,
  moveWorkspaceEntryToTrash: workspaceApi.moveWorkspaceEntryToTrash,
  renameWorkspaceEntry: workspaceApi.renameWorkspaceEntry,
}))

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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("useWorkspaceFileOps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["file", "folder", "scaffold"])("does not create a %s after switching workspace during name lookup", async (kind) => {
    const listing = deferred<{ children: [] }>();
    workspaceApi.listWorkspaceDirectory.mockReturnValue(listing.promise);
    const options = makeOptions({ workspaceRootPath: "/work" });
    const { result, rerender } = renderHook(({ root }) => useWorkspaceFileOps({ ...options, workspaceRootPath: root }), { initialProps: { root: "/work" } });
    let operation!: Promise<void>;
    act(() => { operation = kind === "file" ? result.current.createFile("/work") : kind === "folder" ? result.current.createFolder("/work") : result.current.createOkfScaffoldAt("/work", "minimal"); });
    rerender({ root: "/other" });
    // Returning to the same path is a new workspace session.
    rerender({ root: "/work" });
    await act(async () => { listing.resolve({ children: [] }); await operation; });
    expect(workspaceApi.createTextFile).not.toHaveBeenCalled();
    expect(workspaceApi.createTextFolder).not.toHaveBeenCalled();
    expect(okfApi.createOkfScaffold).not.toHaveBeenCalled();
    expect(options.setActiveTabId).not.toHaveBeenCalled();
    expect(options.reloadWorkspaceParent).not.toHaveBeenCalled();
  });

  it("cancels pending rename, trash, and inline rename when the workspace changes", async () => {
    const options = makeOptions({ tabs: [{ ...makeTab("/work/a.md"), contents: "dirty" }] });
    const { result, rerender } = renderHook(({ root }) => useWorkspaceFileOps({ ...options, workspaceRootPath: root }), { initialProps: { root: "/work" } });
    await act(async () => {
      result.current.requestRename("/work/a.md");
      await result.current.renameWorkspacePath("/work/a.md", "b.md");
      result.current.requestTrashWorkspacePath("/work/a.md", "a.md", false);
    });
    const oldConfirmRename = result.current.confirmPendingRename;
    const oldConfirmTrash = result.current.confirmPendingTrash;
    rerender({ root: "/other" });
    rerender({ root: "/work" });
    expect(result.current.pendingRename).toBeNull();
    expect(result.current.pendingTrash).toBeNull();
    expect(result.current.renamingPath).toBeNull();
    await act(async () => { await oldConfirmRename(); await oldConfirmTrash(); });
    expect(workspaceApi.renameWorkspaceEntry).not.toHaveBeenCalled();
    expect(workspaceApi.moveWorkspaceEntryToTrash).not.toHaveBeenCalled();
  });

  it("does not activate an old workspace file when its creation finishes late", async () => {
    const creation = deferred<ReturnType<typeof makeTab>>();
    workspaceApi.listWorkspaceDirectory.mockResolvedValue({ children: [] });
    workspaceApi.createTextFile.mockReturnValue(creation.promise);
    const options = makeOptions();
    const { result, rerender } = renderHook(({ root }) => useWorkspaceFileOps({ ...options, workspaceRootPath: root }), { initialProps: { root: "/work" } });
    let operation!: Promise<void>;
    await act(async () => { operation = result.current.createFile("/work"); await Promise.resolve(); });
    rerender({ root: "/other" });
    vi.mocked(options.setStatus).mockClear();
    await act(async () => { creation.resolve(makeTab("/work/untitled.md")); await operation; });
    expect(options.setTabs).not.toHaveBeenCalled();
    expect(options.setActiveTabId).not.toHaveBeenCalled();
    expect(options.reloadWorkspaceParent).not.toHaveBeenCalled();
    expect(options.setStatus).not.toHaveBeenCalled();
  });

  it("keeps a completed rename reflected in retained tabs without refreshing the new workspace", async () => {
    const rename = deferred<undefined>();
    workspaceApi.renameWorkspaceEntry.mockReturnValue(rename.promise);
    let tabs = [makeTab("/work/a.md")];
    const options = makeOptions({ tabs, setTabs: vi.fn(next => { tabs = typeof next === "function" ? next(tabs) : next; }), onWorkspaceEntryRekey: vi.fn() });
    const { result, rerender } = renderHook(({ root }) => useWorkspaceFileOps({ ...options, workspaceRootPath: root }), { initialProps: { root: "/work" } });
    let operation!: Promise<void>;
    act(() => { operation = result.current.renameWorkspacePath("/work/a.md", "b.md"); });
    rerender({ root: "/other" });
    vi.mocked(options.setStatus).mockClear();
    await act(async () => { rename.resolve(undefined); await operation; });
    expect(tabs[0].path).toBe("/work/b.md");
    expect(options.onWorkspaceEntryRekey).not.toHaveBeenCalled();
    expect(options.reloadWorkspaceParent).not.toHaveBeenCalled();
    expect(options.setStatus).not.toHaveBeenCalled();
  });

  it("removes trashed old-workspace tabs without clearing the new selection or Book scope", async () => {
    const trash = deferred<undefined>();
    workspaceApi.moveWorkspaceEntryToTrash.mockReturnValue(trash.promise);
    let tabs = [makeTab("/work/a.md"), makeTab("/other/b.md")];
    let activeTabId: string | null = "/other/b.md";
    const options = makeOptions({
      tabs,
      setTabs: vi.fn(next => { tabs = typeof next === "function" ? next(tabs) : next; }),
      setActiveTabId: vi.fn(next => { activeTabId = typeof next === "function" ? next(activeTabId) : next; }),
      onWorkspaceEntryRemoved: vi.fn(),
    });
    const { result, rerender } = renderHook(({ root }) => useWorkspaceFileOps({ ...options, workspaceRootPath: root }), { initialProps: { root: "/work" } });
    act(() => result.current.requestTrashWorkspacePath("/work/a.md", "a.md", false));
    let operation!: Promise<void>;
    act(() => { operation = result.current.confirmPendingTrash(); });
    rerender({ root: "/other" });
    vi.mocked(options.setStatus).mockClear();
    await act(async () => { trash.resolve(undefined); await operation; });
    expect(tabs.map(tab => tab.path)).toEqual(["/other/b.md"]);
    expect(activeTabId).toBe("/other/b.md");
    expect(options.onWorkspaceEntryRemoved).not.toHaveBeenCalled();
    expect(options.reloadWorkspaceParent).not.toHaveBeenCalled();
    expect(options.setStatus).not.toHaveBeenCalled();
  });

  it("does not publish a rename completion after unmount", async () => {
    const rename = deferred<undefined>();
    workspaceApi.renameWorkspaceEntry.mockReturnValue(rename.promise);
    const options = makeOptions({ workspaceRootPath: "/work" });
    const { result, unmount } = renderHook(() => useWorkspaceFileOps(options));
    let operation!: Promise<void>;
    act(() => { operation = result.current.renameWorkspacePath("/work/a.md", "b.md"); });
    unmount();
    vi.mocked(options.setStatus).mockClear();
    await act(async () => { rename.resolve(undefined); await operation; });
    expect(options.setTabs).not.toHaveBeenCalled();
    expect(options.setActiveTabId).not.toHaveBeenCalled();
    expect(options.setStatus).not.toHaveBeenCalled();
  });

  it("ignores an old workspace mutation failure after switching away and back", async () => {
    const creation = deferred<void>();
    workspaceApi.listWorkspaceDirectory.mockResolvedValue({ children: [] });
    workspaceApi.createTextFolder.mockReturnValue(creation.promise);
    const options = makeOptions();
    const { result, rerender } = renderHook(({ root }) => useWorkspaceFileOps({ ...options, workspaceRootPath: root }), { initialProps: { root: "/work" } });
    let operation!: Promise<void>;
    await act(async () => { operation = result.current.createFolder("/work"); await Promise.resolve(); });
    rerender({ root: "/other" });
    rerender({ root: "/work" });
    vi.mocked(options.setStatus).mockClear();
    vi.mocked(options.setGlobalError).mockClear();
    await act(async () => { creation.reject(new Error("old failure")); await operation; });
    expect(options.setGlobalError).not.toHaveBeenCalled();
    expect(options.setStatus).not.toHaveBeenCalled();
  });

  it.each(["rename", "move", "trash"])("blocks %s for a folder containing an Assist-locked tab", async (kind) => {
    const lockedTab = makeTab("/work/notes/a.md");
    const rejectIfLocked = vi.fn(() => true);
    const options = makeOptions({ workspaceRootPath: "/work", tabs: [lockedTab], rejectIfLocked });
    const { result } = renderHook(() => useWorkspaceFileOps(options));
    await act(async () => {
      if (kind === "rename") await result.current.renameWorkspacePath("/work/notes", "renamed");
      if (kind === "move") await result.current.moveWorkspacePath("/work/notes", "/work/elsewhere");
      if (kind === "trash") result.current.requestTrashWorkspacePath("/work/notes", "notes", true);
    });
    if (kind === "trash") await act(async () => { await result.current.confirmPendingTrash(); });
    expect(rejectIfLocked).toHaveBeenCalledWith(lockedTab);
    expect(workspaceApi.renameWorkspaceEntry).not.toHaveBeenCalled();
    expect(workspaceApi.moveWorkspaceEntry).not.toHaveBeenCalled();
    expect(workspaceApi.moveWorkspaceEntryToTrash).not.toHaveBeenCalled();
  });

  it.each(["rename", "trash"])("rechecks the latest Assist lock when confirming a pending %s", async (kind) => {
    const tab = { ...makeTab("/work/a.md"), contents: "dirty writing" };
    const options = makeOptions({ workspaceRootPath: "/work", tabs: [tab] });
    const unlocked = vi.fn(() => false);
    const locked = vi.fn(() => true);
    const { result, rerender } = renderHook(({ reject }) => useWorkspaceFileOps({ ...options, rejectIfLocked: reject }), { initialProps: { reject: unlocked } });
    await act(async () => {
      if (kind === "rename") await result.current.renameWorkspacePath(tab.path, "b.md");
      else result.current.requestTrashWorkspacePath(tab.path, tab.name, false);
    });
    const confirm = kind === "rename" ? result.current.confirmPendingRename : result.current.confirmPendingTrash;
    rerender({ reject: locked });
    await act(async () => { await confirm(); });
    expect(locked).toHaveBeenCalledWith(tab);
    expect(workspaceApi.renameWorkspaceEntry).not.toHaveBeenCalled();
    expect(workspaceApi.moveWorkspaceEntryToTrash).not.toHaveBeenCalled();
  });

  it("clears a registered UUID Diff for a trashed folder descendant without relying on anchor setter order", async () => {
    workspaceApi.moveWorkspaceEntryToTrash.mockResolvedValue(undefined);
    let compareView: CompareViewState | null = { additions: 1, removals: 0, lines: [], caseKey: "uuid-case" };
    const options = makeOptions({
      workspaceRootPath: "/work",
      getCompareCaseByKey: vi.fn(() => ({ kind: "changes" as const, key: "uuid-case", scope: "buffer-vs-disk" as const, documentPath: "/work/notes/a.md", documentLabel: "a.md", leftColumnLabel: "before", rightColumnLabel: "after" })),
      setCompareView: vi.fn(next => { compareView = typeof next === "function" ? next(compareView) : next; }),
    });
    const { result } = renderHook(() => useWorkspaceFileOps(options));
    act(() => result.current.requestTrashWorkspacePath("/work/notes", "notes", true));
    await act(async () => { await result.current.confirmPendingTrash(); });
    expect(compareView).toBeNull();
  });

  it("preserves an unrelated UUID Diff and ignores locked sibling names sharing a folder prefix", async () => {
    workspaceApi.moveWorkspaceEntryToTrash.mockResolvedValue(undefined);
    let compareView: CompareViewState | null = { additions: 1, removals: 0, lines: [], caseKey: "uuid-case" };
    const rejectIfLocked = vi.fn(() => true);
    const options = makeOptions({
      workspaceRootPath: "/work",
      tabs: [makeTab("/work/notes-old/a.md")],
      rejectIfLocked,
      getCompareCaseByKey: vi.fn(() => ({ kind: "changes" as const, key: "uuid-case", scope: "buffer-vs-disk" as const, documentPath: "/work/notes-old/a.md", documentLabel: "a.md", leftColumnLabel: "before", rightColumnLabel: "after" })),
      setCompareView: vi.fn(next => { compareView = typeof next === "function" ? next(compareView) : next; }),
    });
    const { result } = renderHook(() => useWorkspaceFileOps(options));
    act(() => result.current.requestTrashWorkspacePath("/work/notes", "notes", true));
    await act(async () => { await result.current.confirmPendingTrash(); });
    expect(rejectIfLocked).not.toHaveBeenCalled();
    expect(workspaceApi.moveWorkspaceEntryToTrash).toHaveBeenCalledWith("/work/notes", "/work");
    expect(compareView?.caseKey).toBe("uuid-case");
  });

  it("checks newly opened descendant tabs before confirming a folder Trash", async () => {
    const rejectIfLocked = vi.fn(() => true);
    const options = makeOptions({ workspaceRootPath: "/work", rejectIfLocked });
    const { result, rerender } = renderHook(({ currentTabs }: { currentTabs: EditorTab[] }) => useWorkspaceFileOps({ ...options, tabs: currentTabs }), { initialProps: { currentTabs: [] as EditorTab[] } });
    act(() => result.current.requestTrashWorkspacePath("/work/notes", "notes", true));
    const confirm = result.current.confirmPendingTrash;
    const lockedTab = makeTab("/work/notes/a.md");
    rerender({ currentTabs: [lockedTab] });
    await act(async () => { await confirm(); });
    expect(rejectIfLocked).toHaveBeenCalledWith(lockedTab);
    expect(workspaceApi.moveWorkspaceEntryToTrash).not.toHaveBeenCalled();
  });

  it("rekeys a dirty tab after rename even when backup maintenance warns", async () => {
    workspaceApi.renameWorkspaceEntry.mockResolvedValue({ backupWarning: "backup occupied" });
    let tabs = [{ ...makeTab("/work/a.md"), contents: "unsaved writing" }];
    const options = makeOptions({ workspaceRootPath: "/work", tabs, setTabs: vi.fn(next => { tabs = typeof next === "function" ? next(tabs) : next; }) });
    const { result } = renderHook(() => useWorkspaceFileOps(options));
    await act(async () => { await result.current.renameWorkspacePath("/work/a.md", "b.md"); });
    await act(async () => { await result.current.confirmPendingRename(); });
    expect(tabs[0]).toMatchObject({ path: "/work/b.md", contents: "unsaved writing" });
    expect(options.setGlobalError).toHaveBeenCalledWith(expect.stringContaining("改名は完了"));
    expect(options.setStatus).not.toHaveBeenCalledWith("Rename failed");
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
          getCompareCaseByKey: vi.fn(() => ({ kind: "file" as const, key: "random-case-key", leftPath: "/workspace/notes/a.md", rightPath: "/workspace/keep.md", anchor: { path: "/workspace/notes/a.md", name: "a.md", label: "a" }, target: { path: "/workspace/keep.md", name: "keep.md", label: "keep" } })),
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
