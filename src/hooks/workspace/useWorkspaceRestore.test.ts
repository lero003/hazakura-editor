// Tests for the App Store / App Sandbox path of
// `useWorkspaceRestore`. A persisted workspace state can
// reference file paths the OS will no longer open because the
// user moved / deleted the file or revoked the file-picker
// grant on app restart. The hook must:
//
// 1. Drop the failed paths from the restored tab list instead
//    of pretending they reopened.
// 2. Surface the skipped count in the status text so the user
//    sees a reauthorization hint instead of a silent
//    "Workspace restored" lie.
// 3. Not block tabs that did reopen — partial success must
//    still land in the tab list and active tab selection.

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readBookScope, writeBookScope } from "../../features/bookScope";
import { useWorkspaceRestore } from "./useWorkspaceRestore";

const openTextFile = vi.fn();
const listWorkspaceTree = vi.fn();
const resolveSecurityScopedBookmark = vi.fn();
const readPersistedWorkspaceState = vi.fn();
const readStoredDrafts = vi.fn();
const writePersistedFileBookmark = vi.fn();

vi.mock("../../lib/tauri", () => ({
  listWorkspaceTree: (...args: unknown[]) => listWorkspaceTree(...args),
  openTextFile: (...args: unknown[]) => openTextFile(...args),
  resolveSecurityScopedBookmark: (...args: unknown[]) =>
    resolveSecurityScopedBookmark(...args),
}));

vi.mock("../../lib/storage", () => ({
  readPersistedWorkspaceState: (...args: unknown[]) =>
    readPersistedWorkspaceState(...args),
  readStoredDrafts: (...args: unknown[]) => readStoredDrafts(...args),
  writePersistedFileBookmark: (...args: unknown[]) =>
    writePersistedFileBookmark(...args),
}));

type RestoreArgs = Parameters<typeof useWorkspaceRestore>[0];

function buildArgs(): RestoreArgs {
  return {
    onError: vi.fn(),
    onStatus: vi.fn(),
    setActiveTabId: vi.fn(),
    setPendingDrafts: vi.fn(),
    setRestoreComplete: vi.fn(),
    setTabs: vi.fn(),
    setWorkspaceRootPath: vi.fn(),
    setWorkspaceTree: vi.fn(),
  };
}

describe("useWorkspaceRestore", () => {
  beforeEach(() => {
    window.localStorage.clear();
    openTextFile.mockReset();
    listWorkspaceTree.mockReset();
    resolveSecurityScopedBookmark.mockReset();
    readPersistedWorkspaceState.mockReset();
    readStoredDrafts.mockReset();
    writePersistedFileBookmark.mockReset();
  });

  it("finishes immediately with restore complete when no state was persisted", async () => {
    readPersistedWorkspaceState.mockReturnValue(null);
    readStoredDrafts.mockReturnValue([]);
    const args = buildArgs();

    renderHook(() => useWorkspaceRestore(args));

    await waitFor(() => {
      expect(args.setRestoreComplete).toHaveBeenCalledWith(true);
    });
    expect(openTextFile).not.toHaveBeenCalled();
    expect(args.onStatus).not.toHaveBeenCalled();
  });

  it("surfaces the skipped restore count when some persisted paths fail to reopen", async () => {
    readPersistedWorkspaceState.mockReturnValue({
      workspaceRootPath: null,
      tabPaths: ["/keep.md", "/moved.md", "/deleted.md"],
      activeTabPath: "/keep.md",
    });
    readStoredDrafts.mockReturnValue([]);
    openTextFile.mockImplementation(async (path: string) => {
      if (path === "/keep.md") {
        return {
          path,
          name: "keep.md",
          contents: "kept",
          line_ending: "lf",
          encoding: "utf-8",
          size: 4,
          modified_ms: 1,
          fingerprint: "fp-keep",
          large_file_warning: false,
        };
      }
      throw new Error("Cannot read file: sandbox access lost");
    });
    const args = buildArgs();

    renderHook(() => useWorkspaceRestore(args));

    await waitFor(() => {
      expect(args.onStatus).toHaveBeenCalledWith(
        "Workspace restored: 1 tab reopened, 2 paths skipped (use Open or Open Folder to reauthorize)",
      );
    });
  });

  it("uses the singular wording when exactly one path is skipped", async () => {
    readPersistedWorkspaceState.mockReturnValue({
      workspaceRootPath: null,
      tabPaths: ["/keep.md", "/moved.md"],
      activeTabPath: "/keep.md",
    });
    readStoredDrafts.mockReturnValue([]);
    openTextFile.mockImplementation(async (path: string) => {
      if (path === "/keep.md") {
        return {
          path,
          name: "keep.md",
          contents: "kept",
          line_ending: "lf",
          encoding: "utf-8",
          size: 4,
          modified_ms: 1,
          fingerprint: "fp-keep",
          large_file_warning: false,
        };
      }
      throw new Error("Cannot read file: missing");
    });
    const args = buildArgs();

    renderHook(() => useWorkspaceRestore(args));

    await waitFor(() => {
      expect(args.onStatus).toHaveBeenCalledWith(
        "Workspace restored: 1 tab reopened, 1 path skipped (use Open or Open Folder to reauthorize)",
      );
    });
  });

  it("keeps the success status when every persisted path reopens", async () => {
    readPersistedWorkspaceState.mockReturnValue({
      workspaceRootPath: null,
      tabPaths: ["/a.md", "/b.md"],
      activeTabPath: "/a.md",
    });
    readStoredDrafts.mockReturnValue([]);
    openTextFile.mockImplementation(async (path: string) => ({
      path,
      name: path.split("/").at(-1) ?? "x",
      contents: `body of ${path}`,
      line_ending: "lf",
      encoding: "utf-8",
      size: 10,
      modified_ms: 1,
      fingerprint: `fp-${path}`,
      large_file_warning: false,
    }));
    const args = buildArgs();

    renderHook(() => useWorkspaceRestore(args));

    await waitFor(() => {
      expect(args.onStatus).toHaveBeenCalledWith("Workspace restored");
    });
    expect(args.onStatus).not.toHaveBeenCalledWith(
      expect.stringContaining("skipped"),
    );
  });

  it("still lands the recovered tabs in the tab list when other paths fail", async () => {
    readPersistedWorkspaceState.mockReturnValue({
      workspaceRootPath: null,
      tabPaths: ["/a.md", "/moved.md"],
      activeTabPath: "/a.md",
    });
    readStoredDrafts.mockReturnValue([]);
    openTextFile.mockImplementation(async (path: string) => {
      if (path === "/a.md") {
        return {
          path,
          name: "a.md",
          contents: "a body",
          line_ending: "lf",
          encoding: "utf-8",
          size: 6,
          modified_ms: 1,
          fingerprint: "fp-a",
          large_file_warning: false,
        };
      }
      throw new Error("Cannot read file: moved");
    });
    const setTabs = vi.fn();
    const args: RestoreArgs = { ...buildArgs(), setTabs };

    renderHook(() => useWorkspaceRestore(args));

    await waitFor(() => {
      expect(args.onStatus).toHaveBeenCalledWith(
        expect.stringContaining("1 path skipped"),
      );
    });

    // The setTabs updater must have been called with a single
    // tab for /a.md, not the empty list, not the failed
    // /moved.md path.
    const setTabsCallArg = setTabs.mock.calls
      .map((call) => call[0])
      .find(
        (updater) =>
          typeof updater === "function" || Array.isArray(updater),
      );
    expect(setTabsCallArg).toBeDefined();
    const resolvedTabs =
      typeof setTabsCallArg === "function"
        ? setTabsCallArg([])
        : setTabsCallArg;
    expect(resolvedTabs).toHaveLength(1);
    expect(resolvedTabs[0].path).toBe("/a.md");
  });

  it("restores an outside-workspace tab through its persisted file bookmark", async () => {
    readPersistedWorkspaceState.mockReturnValue({
      workspaceRootPath: "/workspace",
      workspaceRootBookmark: [1, 2, 3],
      tabPaths: ["/workspace/a.md", "/outside/note.md"],
      tabFileBookmarks: {
        "/outside/note.md": [7, 8, 9],
      },
      activeTabPath: "/outside/note.md",
    });
    readStoredDrafts.mockReturnValue([]);
    listWorkspaceTree.mockResolvedValue({
      name: "workspace",
      path: "/workspace",
      kind: "directory",
      children: [],
      children_loaded: true,
      children_truncated: false,
    });
    resolveSecurityScopedBookmark.mockResolvedValue("/outside/note.md");
    openTextFile.mockImplementation(async (path: string) => {
      if (path === "/workspace/a.md") {
        return {
          path,
          name: "a.md",
          contents: "workspace",
          line_ending: "lf",
          encoding: "utf-8",
          size: 9,
          modified_ms: 1,
          fingerprint: "fp-workspace",
          large_file_warning: false,
        };
      }
      if (path === "/outside/note.md" && openTextFile.mock.calls.length > 2) {
        return {
          path,
          name: "note.md",
          contents: "outside",
          line_ending: "lf",
          encoding: "utf-8",
          size: 7,
          modified_ms: 1,
          fingerprint: "fp-outside",
          large_file_warning: false,
        };
      }
      throw new Error("Cannot read file: sandbox access lost");
    });
    const setTabs = vi.fn();
    const args = { ...buildArgs(), setTabs };

    renderHook(() => useWorkspaceRestore(args));

    await waitFor(() => {
      expect(args.onStatus).toHaveBeenCalledWith("Workspace restored");
    });

    expect(resolveSecurityScopedBookmark).toHaveBeenCalledWith([7, 8, 9]);
    expect(args.setActiveTabId).toHaveBeenCalledWith("/outside/note.md");
    const restoredTabs = setTabs.mock.calls.at(-1)?.[0];
    expect(restoredTabs).toHaveLength(2);
    expect(restoredTabs.map((tab: { path: string }) => tab.path)).toEqual([
      "/workspace/a.md",
      "/outside/note.md",
    ]);
  });

  it("migrates an outside file bookmark when bookmark resolution returns a different path", async () => {
    readPersistedWorkspaceState.mockReturnValue({
      workspaceRootPath: "/workspace",
      workspaceRootBookmark: [1, 2, 3],
      tabPaths: ["/workspace/a.md", "/outside/original.md"],
      tabFileBookmarks: {
        "/outside/original.md": [7, 8, 9],
      },
      activeTabPath: "/outside/original.md",
    });
    readStoredDrafts.mockReturnValue([]);
    listWorkspaceTree.mockResolvedValue({
      name: "workspace",
      path: "/workspace",
      kind: "directory",
      children: [],
      children_loaded: true,
      children_truncated: false,
    });
    resolveSecurityScopedBookmark.mockResolvedValue("/resolved/outside.md");
    openTextFile.mockImplementation(async (path: string) => {
      if (path === "/workspace/a.md") {
        return {
          path,
          name: "a.md",
          contents: "workspace",
          line_ending: "lf",
          encoding: "utf-8",
          size: 9,
          modified_ms: 1,
          fingerprint: "fp-workspace",
          large_file_warning: false,
        };
      }
      if (path === "/resolved/outside.md") {
        return {
          path,
          name: "outside.md",
          contents: "outside",
          line_ending: "lf",
          encoding: "utf-8",
          size: 7,
          modified_ms: 1,
          fingerprint: "fp-outside",
          large_file_warning: false,
        };
      }
      throw new Error("Cannot read file: sandbox access lost");
    });
    const setTabs = vi.fn();
    const args = { ...buildArgs(), setTabs };

    renderHook(() => useWorkspaceRestore(args));

    await waitFor(() => {
      expect(args.onStatus).toHaveBeenCalledWith("Workspace restored");
    });

    expect(writePersistedFileBookmark).toHaveBeenCalledWith(
      "/resolved/outside.md",
      [7, 8, 9],
    );
    expect(args.setActiveTabId).toHaveBeenCalledWith("/resolved/outside.md");
    const restoredTabs = setTabs.mock.calls.at(-1)?.[0];
    expect(restoredTabs.map((tab: { path: string }) => tab.path)).toEqual([
      "/workspace/a.md",
      "/resolved/outside.md",
    ]);
  });

  it("skips a lost workspace-tree grant without showing a global error", async () => {
    readPersistedWorkspaceState.mockReturnValue({
      workspaceRootPath: "/old/root",
      tabPaths: ["/old/root/note.md"],
      activeTabPath: null,
    });
    readStoredDrafts.mockReturnValue([]);
    listWorkspaceTree.mockRejectedValue(new Error("Cannot read folder: forbidden"));
    openTextFile.mockResolvedValue({
      path: "/old/root/note.md",
      name: "note.md",
      contents: "body",
      line_ending: "lf",
      encoding: "utf-8",
      size: 4,
      modified_ms: 1,
      fingerprint: "fp",
      large_file_warning: false,
    });
    const onError = vi.fn();
    const args = { ...buildArgs(), onError };

    renderHook(() => useWorkspaceRestore(args));

    await waitFor(() => {
      expect(args.setRestoreComplete).toHaveBeenCalledWith(true);
    });
    expect(onError).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(args.onStatus).toHaveBeenCalledWith(
        "Workspace restored: 1 tab reopened, 1 path skipped (use Open or Open Folder to reauthorize)",
      );
    });
    // The workspace tree failure must not leave the active
    // workspaceRootPath poisoned; the user is asked to pick
    // the folder again through the start panel.
    expect(args.setWorkspaceRootPath).not.toHaveBeenCalled();
    expect(args.setWorkspaceTree).not.toHaveBeenCalled();
  });

  it("restores a sandboxed workspace through its security-scoped bookmark", async () => {
    const tree = {
      name: "root",
      path: "/old/root",
      kind: "directory",
      children: [],
      children_loaded: true,
      children_truncated: false,
    };
    readPersistedWorkspaceState.mockReturnValue({
      workspaceRootPath: "/old/root",
      workspaceRootBookmark: [1, 2, 3],
      tabPaths: ["/old/root/note.md"],
      activeTabPath: "/old/root/note.md",
    });
    readStoredDrafts.mockReturnValue([]);
    listWorkspaceTree
      .mockRejectedValueOnce(new Error("Cannot read folder: forbidden"))
      .mockResolvedValueOnce(tree);
    resolveSecurityScopedBookmark.mockResolvedValue("/old/root");
    openTextFile.mockResolvedValue({
      path: "/old/root/note.md",
      name: "note.md",
      contents: "body",
      line_ending: "lf",
      encoding: "utf-8",
      size: 4,
      modified_ms: 1,
      fingerprint: "fp",
      large_file_warning: false,
    });
    const args = buildArgs();

    renderHook(() => useWorkspaceRestore(args));

    await waitFor(() => {
      expect(args.onStatus).toHaveBeenCalledWith("Workspace restored");
    });
    expect(resolveSecurityScopedBookmark).toHaveBeenCalledWith([1, 2, 3]);
    expect(listWorkspaceTree).toHaveBeenNthCalledWith(1, "/old/root");
    expect(listWorkspaceTree).toHaveBeenNthCalledWith(2, "/old/root");
    expect(args.setWorkspaceRootPath).toHaveBeenCalledWith("/old/root");
    expect(args.setWorkspaceTree).toHaveBeenCalledWith(tree);
    expect(args.onError).not.toHaveBeenCalled();
    expect(args.onStatus).not.toHaveBeenCalledWith(
      expect.stringContaining("skipped"),
    );
  });

  it("migrates Book Scope when bookmark resolution changes the workspace root", async () => {
    const tree = {
      name: "renamed-root",
      path: "/new/root",
      kind: "directory" as const,
      children: [],
      children_loaded: true,
      children_truncated: false,
    };
    writeBookScope("/old/root", ["chapters/one.md"], 10);
    readPersistedWorkspaceState.mockReturnValue({
      workspaceRootPath: "/old/root",
      workspaceRootBookmark: [9, 8, 7],
      tabPaths: [],
      activeTabPath: null,
    });
    readStoredDrafts.mockReturnValue([]);
    listWorkspaceTree
      .mockRejectedValueOnce(new Error("Cannot read folder: moved"))
      .mockResolvedValueOnce(tree);
    resolveSecurityScopedBookmark.mockResolvedValue("/new/root");
    const args = buildArgs();

    renderHook(() => useWorkspaceRestore(args));

    await waitFor(() => {
      expect(args.setWorkspaceRootPath).toHaveBeenCalledWith("/new/root");
    });
    expect(readBookScope("/old/root")).toBeNull();
    expect(readBookScope("/new/root")?.chapterRelativePaths).toEqual([
      "chapters/one.md",
    ]);
  });

  it("fires the restore-complete latch exactly once across the restore", async () => {
    readPersistedWorkspaceState.mockReturnValue({
      workspaceRootPath: null,
      tabPaths: ["/a.md", "/b.md"],
      activeTabPath: "/a.md",
    });
    readStoredDrafts.mockReturnValue([]);
    openTextFile.mockResolvedValue({
      path: "/a.md",
      name: "a.md",
      contents: "a",
      line_ending: "lf",
      encoding: "utf-8",
      size: 1,
      modified_ms: 1,
      fingerprint: "fp",
      large_file_warning: false,
    });
    const args = buildArgs();

    renderHook(() => useWorkspaceRestore(args));

    await act(async () => {
      await waitFor(() => {
        expect(args.setRestoreComplete).toHaveBeenCalledWith(true);
      });
    });
    expect(args.setRestoreComplete).toHaveBeenCalledTimes(1);
  });

  it("consumes a partial-restore-shaped persisted state via the bookmark resolution path on the next launch", async () => {
    // The partial-restore slice of
    // `useWorkspaceStatePersistence` writes a persisted
    // state that still carries `workspaceRootPath` and
    // `workspaceRootBookmark` (only `workspaceRootPath`
    // was reachable as a string in the live render; the
    // storage layer promotes it back from the previous
    // write). On the next launch, this state must reach
    // the bookmark-resolution branch — a persisted state
    // that lost `workspaceRootPath` would skip that
    // branch entirely (`if (persistedState.workspaceRootPath)`)
    // and the security-scoped bookmark would never be
    // consumed.
    const tree = {
      name: "root",
      path: "/old/root",
      kind: "directory",
      children: [],
      children_loaded: true,
      children_truncated: false,
    };
    // Shape produced by the partial-restore slice:
    // workspaceRootPath + bookmark preserved, tab list
    // reflects the live session that was partially
    // restored.
    readPersistedWorkspaceState.mockReturnValue({
      workspaceRootPath: "/old/root",
      workspaceRootBookmark: [4, 5, 6],
      tabPaths: ["/old/root/note.md"],
      activeTabPath: "/old/root/note.md",
    });
    readStoredDrafts.mockReturnValue([]);
    listWorkspaceTree
      // First attempt with the persisted path fails —
      // same sandbox-loss shape that triggered the
      // partial-restore write in the first place.
      .mockRejectedValueOnce(new Error("Cannot read folder: forbidden"))
      .mockResolvedValueOnce(tree);
    resolveSecurityScopedBookmark.mockResolvedValue("/old/root");
    openTextFile.mockResolvedValue({
      path: "/old/root/note.md",
      name: "note.md",
      contents: "body",
      line_ending: "lf",
      encoding: "utf-8",
      size: 4,
      modified_ms: 1,
      fingerprint: "fp",
      large_file_warning: false,
    });
    const args = buildArgs();

    renderHook(() => useWorkspaceRestore(args));

    await waitFor(() => {
      expect(args.onStatus).toHaveBeenCalledWith("Workspace restored");
    });

    // The first listWorkspaceTree call must use the
    // persisted path (not fall through silently to
    // "no workspaceRootPath, skip"), and the bookmark
    // resolution must be attempted with the persisted
    // bytes. Together those two assertions pin the
    // contract that the partial-restore persisted state
    // is actually consumable by the next launch.
    expect(listWorkspaceTree).toHaveBeenNthCalledWith(1, "/old/root");
    expect(resolveSecurityScopedBookmark).toHaveBeenCalledWith([4, 5, 6]);
    expect(listWorkspaceTree).toHaveBeenNthCalledWith(2, "/old/root");
    expect(args.setWorkspaceRootPath).toHaveBeenCalledWith("/old/root");
    expect(args.setWorkspaceTree).toHaveBeenCalledWith(tree);
    expect(args.onError).not.toHaveBeenCalled();
  });
});
