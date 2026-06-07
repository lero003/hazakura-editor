import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTabCloseFlow } from "./useTabCloseFlow";
import type { DraftRecord, EditorTab } from "../../types";

const tauriWindow = vi.hoisted(() => ({
  hideMainWindow: vi.fn(async () => {}),
}));

const storage = vi.hoisted(() => ({
  draftRecordFromTab: vi.fn(),
  readStoredDrafts: vi.fn(() => []),
  removeStoredDrafts: vi.fn(),
  upsertDraftRecord: vi.fn(
    (records: DraftRecord[], draft: DraftRecord) => [...records, draft],
  ),
  writeStoredDrafts: vi.fn(),
}));

vi.mock("../../lib/tauri", () => ({
  hideMainWindow: tauriWindow.hideMainWindow,
}));

vi.mock("../../lib/storage", () => ({
  draftRecordFromTab: storage.draftRecordFromTab,
  readStoredDrafts: storage.readStoredDrafts,
  removeStoredDrafts: storage.removeStoredDrafts,
  upsertDraftRecord: storage.upsertDraftRecord,
  writeStoredDrafts: storage.writeStoredDrafts,
}));

function makeTab(overrides: Partial<EditorTab> = {}): EditorTab {
  return {
    contents: "draft",
    encoding: "utf-8",
    error: null,
    externalFingerprint: null,
    fingerprint: "saved-fingerprint",
    id: "/tmp/a.md",
    ignoredExternalFingerprint: null,
    large_file_warning: false,
    lastSavedContents: "saved",
    lastSavedEncoding: "utf-8",
    lastSavedLineEnding: "lf",
    line_ending: "lf",
    modified_ms: null,
    name: "a.md",
    path: "/tmp/a.md",
    saveStatus: "idle",
    size: 5,
    ...overrides,
  };
}

function setup(overrides: Partial<Parameters<typeof useTabCloseFlow>[0]> = {}) {
  const dirtyTab = makeTab();
  const options: Parameters<typeof useTabCloseFlow>[0] = {
    activeTabId: dirtyTab.id,
    allowWindowCloseRef: { current: false },
    dirtyTabs: [dirtyTab],
    discardingWindowCloseRef: { current: false },
    focusEditorSoon: vi.fn(),
    pendingCloseTabId: null,
    saveTabById: vi.fn(async () => true),
    setActiveTabId: vi.fn(),
    setGlobalError: vi.fn(),
    setPendingAppClose: vi.fn(),
    setPendingCloseTabId: vi.fn(),
    setPendingDrafts: vi.fn(),
    setStatus: vi.fn(),
    setTabs: vi.fn(),
    tabs: [dirtyTab],
    tabsRef: { current: [dirtyTab] },
    ...overrides,
  };

  return {
    dirtyTab,
    options,
    result: renderHook(() => useTabCloseFlow(options)).result,
  };
}

describe("useTabCloseFlow", () => {
  beforeEach(() => {
    tauriWindow.hideMainWindow.mockClear();
    storage.draftRecordFromTab.mockClear();
    storage.readStoredDrafts.mockClear();
    storage.removeStoredDrafts.mockClear();
    storage.upsertDraftRecord.mockClear();
    storage.writeStoredDrafts.mockClear();
  });

  it("clears the app-close dialog state after saving all dirty tabs", async () => {
    const allowWindowCloseRef = { current: false };
    const setPendingAppClose = vi.fn();
    const { result } = setup({ allowWindowCloseRef, setPendingAppClose });

    await act(async () => {
      await result.current.saveAllAndCloseWindow();
    });

    expect(setPendingAppClose).toHaveBeenCalledWith(false);
    expect(tauriWindow.hideMainWindow).toHaveBeenCalledTimes(1);
    expect(allowWindowCloseRef.current).toBe(false);
  });

  it("clears the app-close dialog and resets dirty buffers after discarding all tabs", async () => {
    const allowWindowCloseRef = { current: false };
    const discardingWindowCloseRef = { current: false };
    const setPendingAppClose = vi.fn();
    const setTabs = vi.fn();
    const dirtyTab = makeTab({
      contents: "unsaved",
      error: "Save failed",
      lastSavedContents: "saved on disk",
      saveStatus: "error",
    });
    const { result } = setup({
      allowWindowCloseRef,
      dirtyTabs: [dirtyTab],
      discardingWindowCloseRef,
      setPendingAppClose,
      setTabs,
      tabs: [dirtyTab],
      tabsRef: { current: [dirtyTab] },
    });

    await act(async () => {
      await result.current.discardAllAndCloseWindow();
    });

    expect(setPendingAppClose).toHaveBeenCalledWith(false);
    expect(tauriWindow.hideMainWindow).toHaveBeenCalledTimes(1);
    expect(setTabs.mock.invocationCallOrder[0]).toBeLessThan(
      tauriWindow.hideMainWindow.mock.invocationCallOrder[0],
    );
    expect(allowWindowCloseRef.current).toBe(false);
    expect(discardingWindowCloseRef.current).toBe(false);

    const resetTabs = setTabs.mock.calls[0]?.[0];
    expect(typeof resetTabs).toBe("function");
    expect(resetTabs([dirtyTab])).toEqual([
      {
        ...dirtyTab,
        contents: "saved on disk",
        encoding: dirtyTab.lastSavedEncoding,
        error: null,
        ignoredExternalFingerprint: null,
        line_ending: dirtyTab.lastSavedLineEnding,
        saveStatus: "idle",
      },
    ]);
  });

  it("removes stored drafts when a dirty tab is discarded and closed", () => {
    const pendingDrafts: DraftRecord[] = [
      {
        contents: "draft",
        line_ending: "lf",
        path: "/tmp/a.md",
        savedFingerprint: "saved-fingerprint",
        updatedAt: 1,
      },
      {
        contents: "other draft",
        line_ending: "lf",
        path: "/tmp/other.md",
        savedFingerprint: "other-fingerprint",
        updatedAt: 2,
      },
    ];
    const setPendingDrafts = vi.fn((next) => {
      if (typeof next === "function") {
        next(pendingDrafts);
      }
    });
    const dirtyTab = makeTab();
    const setTabs = vi.fn((next) => {
      if (typeof next === "function") {
        next([dirtyTab]);
      }
    });
    const { result } = setup({
      dirtyTabs: [dirtyTab],
      setPendingDrafts,
      setTabs,
      tabs: [dirtyTab],
      tabsRef: { current: [dirtyTab] },
    });

    act(() => {
      result.current.closeTabNow(dirtyTab.id);
    });

    expect(storage.removeStoredDrafts).toHaveBeenCalledWith([dirtyTab.path]);
    expect(setPendingDrafts).toHaveBeenCalledTimes(1);

    const filterDrafts = setPendingDrafts.mock.calls[0]?.[0];
    expect(typeof filterDrafts).toBe("function");
    expect(filterDrafts(pendingDrafts)).toEqual([pendingDrafts[1]]);
  });
});
