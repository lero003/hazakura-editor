// Regression tests for the `useWorkspaceStatePersistence`
// latch. The hook is responsible for mirroring the live
// `tabs` / `workspaceRootPath` / `activeTab` state into
// `localStorage`, but it must NOT treat the
// "restore produced nothing" case the same as "the user
// intentionally closed everything". The previous behavior
// overwrote the user's last good persisted state — including
// the security-scoped bookmark — with an empty record on
// the first render where `restoreComplete` flipped to true,
// so a sandbox loss / moved-folder / missing-file restore
// failure effectively reset the workspace session for the
// next launch. These tests pin the new contract: when the
// restore produced an empty live state but a non-empty
// persisted state is still in storage, the hook must leave
// the persisted state (and its bookmark) untouched.

import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readPersistedWorkspaceState } from "../../lib/storage";
import { WORKSPACE_STATE_STORAGE_KEY, type EditorTab } from "../../types";
import { useWorkspaceStatePersistence } from "./useWorkspaceStatePersistence";

function makeTab(overrides: Partial<EditorTab> = {}): EditorTab {
  return {
    contents: "body",
    encoding: "utf-8",
    error: null,
    externalFingerprint: null,
    fingerprint: "fp",
    id: "/old/root/note.md",
    ignoredExternalFingerprint: null,
    large_file_warning: false,
    lastSavedContents: "body",
    lastSavedEncoding: "utf-8",
    lastSavedLineEnding: "lf",
    line_ending: "lf",
    modified_ms: 1,
    name: "note.md",
    path: "/old/root/note.md",
    saveStatus: "idle",
    size: 4,
    ...overrides,
  };
}

function seedPersistedState(value: unknown) {
  window.localStorage.setItem(
    WORKSPACE_STATE_STORAGE_KEY,
    JSON.stringify(value),
  );
}

describe("useWorkspaceStatePersistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("does not write to storage before the restore completes", () => {
    seedPersistedState({
      workspaceRootPath: "/old/root",
      workspaceRootBookmark: [1, 2, 3],
      tabPaths: ["/old/root/note.md"],
      activeTabPath: "/old/root/note.md",
    });

    renderHook(() =>
      useWorkspaceStatePersistence({
        activeTab: null,
        restoreComplete: false,
        tabs: [],
        workspaceRootPath: null,
      }),
    );

    // The guard must hold even though the in-memory state is
    // empty — the restore latches `restoreComplete` only
    // after the first attempt, and the user must not see
    // their bookmark wiped before that latch fires.
    const stored = readPersistedWorkspaceState();
    expect(stored).not.toBeNull();
    expect(stored?.workspaceRootBookmark).toEqual([1, 2, 3]);
    expect(stored?.workspaceRootPath).toBe("/old/root");
  });

  it("preserves the existing persisted state when restore produced an empty result", async () => {
    seedPersistedState({
      workspaceRootPath: "/old/root",
      workspaceRootBookmark: [1, 2, 3],
      tabPaths: ["/old/root/note.md", "/old/root/other.md"],
      activeTabPath: "/old/root/note.md",
    });

    // Simulates the post-restore render where the
    // sandbox-loss / moved-folder restore produced no
    // tabs and never set a workspace root path.
    renderHook(() =>
      useWorkspaceStatePersistence({
        activeTab: null,
        restoreComplete: true,
        tabs: [],
        workspaceRootPath: null,
      }),
    );

    await waitFor(() => {
      const stored = readPersistedWorkspaceState();
      expect(stored?.workspaceRootPath).toBe("/old/root");
    });

    const stored = readPersistedWorkspaceState();
    expect(stored).toEqual({
      workspaceRootPath: "/old/root",
      workspaceRootBookmark: [1, 2, 3],
      tabPaths: ["/old/root/note.md", "/old/root/other.md"],
      activeTabPath: "/old/root/note.md",
    });
  });

  it("preserves a bookmark-only persisted state when restore produced an empty result", async () => {
    // Edge case: a previous session saved a workspace root
    // with a bookmark but no tabs. The restore latch flips
    // to true, no tabs come back, no workspace comes back,
    // and the user still has a bookmark they can use to
    // re-authorize via the start panel. The hook must not
    // erase that bookmark on the empty post-restore render.
    seedPersistedState({
      workspaceRootPath: "/old/root",
      workspaceRootBookmark: [9, 8, 7],
      tabPaths: [],
      activeTabPath: null,
    });

    renderHook(() =>
      useWorkspaceStatePersistence({
        activeTab: null,
        restoreComplete: true,
        tabs: [],
        workspaceRootPath: null,
      }),
    );

    await waitFor(() => {
      const stored = readPersistedWorkspaceState();
      expect(stored?.workspaceRootBookmark).toEqual([9, 8, 7]);
    });

    const stored = readPersistedWorkspaceState();
    expect(stored?.workspaceRootPath).toBe("/old/root");
    expect(stored?.workspaceRootBookmark).toEqual([9, 8, 7]);
  });

  it("writes an empty record when the persisted state was already empty", async () => {
    // The user closed the workspace and all tabs in a
    // previous session. The persisted state is already
    // empty, so the empty post-restore render is a
    // no-op write, not a destructive overwrite. This
    // confirms the guard does not block the legitimate
    // "user has nothing open" case.
    seedPersistedState({
      workspaceRootPath: null,
      tabPaths: [],
      activeTabPath: null,
    });

    renderHook(() =>
      useWorkspaceStatePersistence({
        activeTab: null,
        restoreComplete: true,
        tabs: [],
        workspaceRootPath: null,
      }),
    );

    await waitFor(() => {
      // localStorage should still hold the same empty
      // record; the guard's `readPersistedWorkspaceState`
      // call must not throw on the malformed/empty entry.
      const stored = readPersistedWorkspaceState();
      expect(stored?.workspaceRootPath).toBeNull();
      expect(stored?.tabPaths).toEqual([]);
    });
  });

  it("preserves the workspaceRootPath and bookmark on a partial restore where tabs are restored but the workspace tree grant is lost", async () => {
    // Derived regression guard: a restore attempt that
    // reopens one or more tab files but cannot re-list the
    // workspace tree leaves the live state in
    // `tabs = [tab in old workspace]`,
    // `workspaceRootPath = null`. The empty-restore guard
    // (which only fires on `tabs = []`) cannot help here,
    // so the persistence effect does reach
    // `writePersistedWorkspaceState` with
    // `workspaceRootPath = null`.
    //
    // The storage layer must preserve BOTH the previous
    // `workspaceRootPath` and the security-scoped bookmark
    // in that case. The path is what allows the next
    // launch's `useWorkspaceRestore` to even attempt the
    // bookmark-resolution branch — the restore hook
    // guards that branch with `if (persistedState.workspaceRootPath)`,
    // so a persisted state with `workspaceRootPath: null`
    // would silently skip the re-authorization attempt and
    // the bookmark would never be consumed.
    seedPersistedState({
      workspaceRootPath: "/old/root",
      workspaceRootBookmark: [1, 2, 3],
      tabPaths: ["/old/root/note.md"],
      activeTabPath: "/old/root/note.md",
    });

    const tab = makeTab();
    renderHook(() =>
      useWorkspaceStatePersistence({
        activeTab: tab,
        restoreComplete: true,
        tabs: [tab],
        workspaceRootPath: null,
      }),
    );

    await waitFor(() => {
      const stored = readPersistedWorkspaceState();
      expect(stored?.workspaceRootPath).toBe("/old/root");
    });

    const stored = readPersistedWorkspaceState();
    expect(stored).toEqual({
      workspaceRootPath: "/old/root",
      workspaceRootBookmark: [1, 2, 3],
      tabPaths: ["/old/root/note.md"],
      activeTabPath: "/old/root/note.md",
    });
  });

  it("persists the restored tabs and workspace once restore succeeds", async () => {
    seedPersistedState({
      workspaceRootPath: "/old/root",
      workspaceRootBookmark: [1, 2, 3],
      tabPaths: ["/old/root/note.md"],
      activeTabPath: "/old/root/note.md",
    });

    const tab = makeTab();
    const { rerender } = renderHook(
      ({ activeTab, tabs, workspaceRootPath }: {
        activeTab: EditorTab | null;
        tabs: EditorTab[];
        workspaceRootPath: string | null;
      }) =>
        useWorkspaceStatePersistence({
          activeTab,
          restoreComplete: true,
          tabs,
          workspaceRootPath,
        }),
      {
        initialProps: {
          activeTab: null as EditorTab | null,
          tabs: [] as EditorTab[],
          workspaceRootPath: null as string | null,
        },
      },
    );

    // First post-restore render: empty. The persisted
    // state is non-empty, so the guard must hold.
    await waitFor(() => {
      const stored = readPersistedWorkspaceState();
      expect(stored?.workspaceRootPath).toBe("/old/root");
    });

    // Next render: restore finished and populated the
    // live state. The hook must now mirror the live
    // state into storage while preserving the bookmark
    // (because the path matches).
    rerender({
      activeTab: tab,
      tabs: [tab],
      workspaceRootPath: "/old/root",
    });

    await waitFor(() => {
      const stored = readPersistedWorkspaceState();
      expect(stored?.tabPaths).toEqual(["/old/root/note.md"]);
    });

    const stored = readPersistedWorkspaceState();
    expect(stored).toEqual({
      workspaceRootPath: "/old/root",
      workspaceRootBookmark: [1, 2, 3],
      tabPaths: ["/old/root/note.md"],
      activeTabPath: "/old/root/note.md",
    });
  });
});
