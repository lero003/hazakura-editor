// Unit tests for `writePersistedWorkspaceState` and the
// helpers around it. These tests pin the bookmark-preservation
// contract that `useWorkspaceStatePersistence` relies on:
//
// 1. Same workspaceRootPath: bookmark is preserved.
// 2. Different workspaceRootPath: bookmark is not dragged
//    across workspaces.
// 3. Empty incoming state with empty existing state:
//    bookmark is null.
// 4. workspaceRootPath goes from non-null to null but at
//    least one tab path still references the old workspace:
//    bookmark is preserved (this is the derived partial-restore
//    case the empty-restore guard alone does not cover).
// 5. workspaceRootPath goes from non-null to null and no
//    tab path references the old workspace: bookmark is
//    not preserved (the user has moved off the old folder).
// 6. Explicit `workspaceRootBookmark: null` on the incoming
//    state always wins (the caller is asserting "I want this
//    cleared").

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DRAFT_STATE_STORAGE_KEY,
  RECENT_FILES_STORAGE_KEY,
  RECENT_FOLDERS_STORAGE_KEY,
  WORKSPACE_STATE_STORAGE_KEY,
  type PersistedWorkspaceState,
} from "../types";
import {
  readStoredDrafts,
  readStoredRecentFiles,
  readStoredRecentFolders,
  readPersistedWorkspaceState,
  removeStoredDraft,
  removeStoredDrafts,
  writePersistedFileBookmark,
  writeStoredRecentFiles,
  writeStoredRecentFolders,
  writePersistedWorkspaceState,
} from "./storage";

describe("recent workspace bookmarks", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("preserves a security-scoped bookmark with each recent folder", () => {
    writeStoredRecentFolders([
      {
        path: "/workspace/book",
        label: "book",
        openedAt: 10,
        pinnedAt: null,
        workspaceBookmark: [1, 2, 255],
      },
    ]);

    expect(readStoredRecentFolders()).toEqual([
      {
        path: "/workspace/book",
        label: "book",
        openedAt: 10,
        pinnedAt: null,
        workspaceBookmark: [1, 2, 255],
      },
    ]);
    expect(window.localStorage.getItem(RECENT_FOLDERS_STORAGE_KEY)).toContain(
      '"workspaceBookmark":[1,2,255]',
    );
  });
});

function seedPersistedState(value: PersistedWorkspaceState) {
  window.localStorage.setItem(
    WORKSPACE_STATE_STORAGE_KEY,
    JSON.stringify(value),
  );
}

function readStored(): PersistedWorkspaceState | null {
  return readPersistedWorkspaceState();
}

describe("writePersistedWorkspaceState", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("preserves the bookmark when the same workspace is written again", () => {
    seedPersistedState({
      workspaceRootPath: "/old/root",
      workspaceRootBookmark: [1, 2, 3],
      tabPaths: ["/old/root/note.md"],
      activeTabPath: "/old/root/note.md",
    });

    writePersistedWorkspaceState({
      workspaceRootPath: "/old/root",
      tabPaths: ["/old/root/note.md", "/old/root/other.md"],
      activeTabPath: "/old/root/other.md",
    });

    expect(readStored()).toEqual({
      workspaceRootPath: "/old/root",
      workspaceRootBookmark: [1, 2, 3],
      tabPaths: ["/old/root/note.md", "/old/root/other.md"],
      activeTabPath: "/old/root/other.md",
    });
  });

  it("does not drag the old bookmark when a different workspace is written", () => {
    seedPersistedState({
      workspaceRootPath: "/old/root",
      workspaceRootBookmark: [1, 2, 3],
      tabPaths: ["/old/root/note.md"],
      activeTabPath: "/old/root/note.md",
    });

    writePersistedWorkspaceState({
      workspaceRootPath: "/new/root",
      workspaceRootBookmark: [9, 9, 9],
      tabPaths: ["/new/root/other.md"],
      activeTabPath: "/new/root/other.md",
    });

    expect(readStored()).toEqual({
      workspaceRootPath: "/new/root",
      workspaceRootBookmark: [9, 9, 9],
      tabPaths: ["/new/root/other.md"],
      activeTabPath: "/new/root/other.md",
    });
  });

  it("preserves the bookmark when the new state has no workspaceRootPath but a tab still references the existing workspace", () => {
    // Derived partial-restore case: the workspace tree
    // grant was lost on relaunch, but the tab file is still
    // reachable. The user is still working in the same
    // folder, so the bookmark is the only thing that lets
    // the next launch re-authorize that folder.
    seedPersistedState({
      workspaceRootPath: "/old/root",
      workspaceRootBookmark: [1, 2, 3],
      tabPaths: ["/old/root/note.md"],
      activeTabPath: "/old/root/note.md",
    });

    writePersistedWorkspaceState({
      workspaceRootPath: null,
      tabPaths: ["/old/root/note.md"],
      activeTabPath: "/old/root/note.md",
    });

    expect(readStored()).toEqual({
      workspaceRootPath: "/old/root",
      workspaceRootBookmark: [1, 2, 3],
      tabPaths: ["/old/root/note.md"],
      activeTabPath: "/old/root/note.md",
    });
  });

  it("preserves the workspaceRootPath and bookmark even when only one of several tab paths references the existing workspace", () => {
    // A mixed tab list (some inside, some outside) still
    // implies the user has not left the old workspace for
    // good; one in-workspace tab is enough to keep both
    // the workspaceRootPath and the bookmark alive. Keeping
    // the path is what makes the bookmark useful on the
    // next launch — `useWorkspaceRestore` only consults
    // the bookmark when workspaceRootPath is truthy.
    seedPersistedState({
      workspaceRootPath: "/old/root",
      workspaceRootBookmark: [1, 2, 3],
      tabPaths: ["/old/root/note.md"],
      activeTabPath: "/old/root/note.md",
    });

    writePersistedWorkspaceState({
      workspaceRootPath: null,
      tabPaths: ["/old/root/note.md", "/elsewhere/scratch.md"],
      activeTabPath: "/old/root/note.md",
    });

    const stored = readStored();
    expect(stored?.workspaceRootPath).toBe("/old/root");
    expect(stored?.workspaceRootBookmark).toEqual([1, 2, 3]);
  });

  it("drops the bookmark when the new state has no workspaceRootPath and no tab path references the existing workspace", () => {
    // The user closed the workspace and kept working on a
    // tab from a different folder; the old bookmark is no
    // longer relevant and would only confuse the next
    // re-authorization attempt.
    seedPersistedState({
      workspaceRootPath: "/old/root",
      workspaceRootBookmark: [1, 2, 3],
      tabPaths: ["/old/root/note.md"],
      activeTabPath: "/old/root/note.md",
    });

    writePersistedWorkspaceState({
      workspaceRootPath: null,
      tabPaths: ["/elsewhere/scratch.md"],
      activeTabPath: "/elsewhere/scratch.md",
    });

    expect(readStored()).toEqual({
      workspaceRootPath: null,
      workspaceRootBookmark: null,
      tabPaths: ["/elsewhere/scratch.md"],
      activeTabPath: "/elsewhere/scratch.md",
    });
  });

  it("drops the bookmark when the new state has no workspaceRootPath and an empty tab list", () => {
    // The user closed the workspace and every tab; nothing
    // left points at the old folder, so the bookmark
    // is dropped.
    seedPersistedState({
      workspaceRootPath: "/old/root",
      workspaceRootBookmark: [1, 2, 3],
      tabPaths: ["/old/root/note.md"],
      activeTabPath: "/old/root/note.md",
    });

    writePersistedWorkspaceState({
      workspaceRootPath: null,
      tabPaths: [],
      activeTabPath: null,
    });

    expect(readStored()).toEqual({
      workspaceRootPath: null,
      workspaceRootBookmark: null,
      tabPaths: [],
      activeTabPath: null,
    });
  });

  it("writes the empty state cleanly when the existing state was already empty", () => {
    seedPersistedState({
      workspaceRootPath: null,
      workspaceRootBookmark: null,
      tabPaths: [],
      activeTabPath: null,
    });

    writePersistedWorkspaceState({
      workspaceRootPath: null,
      tabPaths: [],
      activeTabPath: null,
    });

    expect(readStored()).toEqual({
      workspaceRootPath: null,
      workspaceRootBookmark: null,
      tabPaths: [],
      activeTabPath: null,
    });
  });

  it("honors an explicit `workspaceRootBookmark: null` on the incoming state", () => {
    // Callers that want to clear the bookmark for any
    // reason (e.g. tests, future "forget this workspace"
    // affordance) must be able to do so without falling
    // back to the preservation heuristic.
    seedPersistedState({
      workspaceRootPath: "/old/root",
      workspaceRootBookmark: [1, 2, 3],
      tabPaths: ["/old/root/note.md"],
      activeTabPath: "/old/root/note.md",
    });

    writePersistedWorkspaceState({
      workspaceRootPath: "/old/root",
      workspaceRootBookmark: null,
      tabPaths: ["/old/root/note.md"],
      activeTabPath: "/old/root/note.md",
    });

    expect(readStored()?.workspaceRootBookmark).toBeNull();
  });

  it("writes a fresh bookmark when the incoming state supplies one for a brand new workspace", () => {
    // No prior state, the caller already has a fresh
    // bookmark ready for the brand new workspace. The
    // heuristic must not interfere with this path.
    writePersistedWorkspaceState({
      workspaceRootPath: "/brand/new",
      workspaceRootBookmark: [42, 42, 42],
      tabPaths: [],
      activeTabPath: null,
    });

    expect(readStored()).toEqual({
      workspaceRootPath: "/brand/new",
      workspaceRootBookmark: [42, 42, 42],
      tabPaths: [],
      activeTabPath: null,
    });
  });

  it("does not crash when existing state is malformed JSON", () => {
    // Defensive: a corrupted entry must not throw and
    // must not block the write.
    window.localStorage.setItem(WORKSPACE_STATE_STORAGE_KEY, "{not json");

    writePersistedWorkspaceState({
      workspaceRootPath: "/new",
      tabPaths: [],
      activeTabPath: null,
    });

    expect(readStored()?.workspaceRootPath).toBe("/new");
    expect(readStored()?.workspaceRootBookmark).toBeNull();
  });

  it("preserves file bookmarks only for tabs that remain open", () => {
    seedPersistedState({
      workspaceRootPath: "/workspace",
      workspaceRootBookmark: [1, 2, 3],
      tabPaths: ["/workspace/a.md", "/outside/keep.md", "/outside/closed.md"],
      tabFileBookmarks: {
        "/outside/keep.md": [7, 8, 9],
        "/outside/closed.md": [4, 5, 6],
      },
      activeTabPath: "/outside/keep.md",
    });

    writePersistedWorkspaceState({
      workspaceRootPath: "/workspace",
      tabPaths: ["/workspace/a.md", "/outside/keep.md"],
      activeTabPath: "/outside/keep.md",
    });

    expect(readStored()).toEqual({
      workspaceRootPath: "/workspace",
      workspaceRootBookmark: [1, 2, 3],
      tabPaths: ["/workspace/a.md", "/outside/keep.md"],
      tabFileBookmarks: {
        "/outside/keep.md": [7, 8, 9],
      },
      activeTabPath: "/outside/keep.md",
    });
  });

  it("preserves an outside file bookmark when the restored path gains the macOS /private prefix", () => {
    seedPersistedState({
      workspaceRootPath: "/workspace",
      workspaceRootBookmark: [1, 2, 3],
      tabPaths: ["/workspace/a.md", "/tmp/outside/keep.md"],
      tabFileBookmarks: {
        "/tmp/outside/keep.md": [7, 8, 9],
      },
      activeTabPath: "/tmp/outside/keep.md",
    });

    writePersistedWorkspaceState({
      workspaceRootPath: "/workspace",
      tabPaths: ["/workspace/a.md", "/private/tmp/outside/keep.md"],
      activeTabPath: "/private/tmp/outside/keep.md",
    });

    expect(readStored()).toEqual({
      workspaceRootPath: "/workspace",
      workspaceRootBookmark: [1, 2, 3],
      tabPaths: ["/workspace/a.md", "/private/tmp/outside/keep.md"],
      tabFileBookmarks: {
        "/private/tmp/outside/keep.md": [7, 8, 9],
      },
      activeTabPath: "/private/tmp/outside/keep.md",
    });
  });

  it("stores a direct file bookmark without inventing an open tab path", () => {
    seedPersistedState({
      workspaceRootPath: "/workspace",
      workspaceRootBookmark: [1, 2, 3],
      tabPaths: ["/workspace/a.md"],
      activeTabPath: "/workspace/a.md",
    });

    writePersistedFileBookmark("/outside/note.md", [7, 8, 9]);

    expect(readStored()).toEqual({
      workspaceRootPath: "/workspace",
      workspaceRootBookmark: [1, 2, 3],
      tabPaths: ["/workspace/a.md"],
      tabFileBookmarks: {
        "/outside/note.md": [7, 8, 9],
      },
      activeTabPath: "/workspace/a.md",
    });
  });
});

describe("recent file storage removal", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("drops legacy recent-file entries when reading the removed surface", () => {
    window.localStorage.setItem(
      RECENT_FILES_STORAGE_KEY,
      JSON.stringify([
        {
          path: "/outside/note.md",
          label: "note.md",
          openedAt: 123,
          pinnedAt: null,
        },
      ]),
    );

    expect(readStoredRecentFiles()).toEqual([]);
    expect(window.localStorage.getItem(RECENT_FILES_STORAGE_KEY)).toBeNull();
  });

  it("does not write file-level recents after the surface is removed", () => {
    writeStoredRecentFiles([
      {
        path: "/outside/note.md",
        label: "note.md",
        openedAt: 123,
        pinnedAt: null,
      },
    ]);

    expect(window.localStorage.getItem(RECENT_FILES_STORAGE_KEY)).toBeNull();
  });
});

describe("draft recovery storage failures", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not throw when localStorage reads are unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage unavailable", "SecurityError");
    });

    expect(readStoredDrafts()).toEqual([]);
    expect(removeStoredDraft("/workspace/note.md")).toMatchObject({
      ok: false,
      reason: "quota",
    });
  });

  it("returns a write failure when bulk removal cannot update storage", () => {
    window.localStorage.setItem(DRAFT_STATE_STORAGE_KEY, "[]");
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("Storage unavailable", "QuotaExceededError");
    });

    expect(removeStoredDrafts(["/workspace/note.md"])).toMatchObject({
      ok: false,
      reason: "quota",
    });
  });
});
