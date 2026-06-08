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
import { useWorkspaceRestore } from "./useWorkspaceRestore";

const openTextFile = vi.fn();
const listWorkspaceTree = vi.fn();
const readPersistedWorkspaceState = vi.fn();
const readStoredDrafts = vi.fn();

vi.mock("../../lib/tauri", () => ({
  listWorkspaceTree: (...args: unknown[]) => listWorkspaceTree(...args),
  openTextFile: (...args: unknown[]) => openTextFile(...args),
}));

vi.mock("../../lib/storage", () => ({
  readPersistedWorkspaceState: (...args: unknown[]) =>
    readPersistedWorkspaceState(...args),
  readStoredDrafts: (...args: unknown[]) => readStoredDrafts(...args),
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
    openTextFile.mockReset();
    listWorkspaceTree.mockReset();
    readPersistedWorkspaceState.mockReset();
    readStoredDrafts.mockReset();
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

  it("records the workspace-tree error and still reports restore complete", async () => {
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
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(
        expect.stringContaining("Cannot read folder: forbidden"),
      );
    });
    await waitFor(() => {
      expect(args.onStatus).toHaveBeenCalledWith("Workspace restore skipped");
    });
    // The workspace tree failure must not leave the active
    // workspaceRootPath poisoned; the user is asked to pick
    // the folder again through the start panel.
    expect(args.setWorkspaceRootPath).not.toHaveBeenCalled();
    expect(args.setWorkspaceTree).not.toHaveBeenCalled();
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
});
