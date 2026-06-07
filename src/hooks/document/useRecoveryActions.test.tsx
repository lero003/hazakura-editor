import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRecoveryActions } from "./useRecoveryActions";
import type { TextFileDocument } from "../../lib/tauri";
import type { EditorTab } from "../../types";

const tauriApi = vi.hoisted(() => ({
  openTextFile: vi.fn(),
}));

vi.mock("../../lib/tauri", () => ({
  openTextFile: tauriApi.openTextFile,
}));

const storage = vi.hoisted(() => ({
  removeStoredDraft: vi.fn(),
}));

vi.mock("../../lib/storage", () => ({
  removeStoredDraft: storage.removeStoredDraft,
}));

function makeTab(overrides: Partial<EditorTab> = {}): EditorTab {
  return {
    contents: "draft",
    encoding: "utf-8",
    error: null,
    externalFingerprint: null,
    fingerprint: "fingerprint",
    id: "/workspace/a.md",
    ignoredExternalFingerprint: null,
    large_file_warning: false,
    lastSavedContents: "saved",
    lastSavedEncoding: "utf-8",
    lastSavedLineEnding: "lf",
    line_ending: "lf",
    modified_ms: null,
    name: "a.md",
    path: "/workspace/a.md",
    saveStatus: "conflict",
    size: 5,
    ...overrides,
  };
}

function makeTextFileDocument(
  overrides: Partial<TextFileDocument> = {},
): TextFileDocument {
  return {
    contents: "disk contents",
    encoding: "utf-8",
    fingerprint: "disk-fingerprint",
    large_file_warning: false,
    line_ending: "lf",
    modified_ms: 123,
    name: "a.md",
    path: "/workspace/a.md",
    size: 13,
    ...overrides,
  };
}

function makeOptions(
  initialTabs: EditorTab[],
  overrides: Partial<Parameters<typeof useRecoveryActions>[0]> = {},
) {
  let tabsState = initialTabs;
  const tabsRef = { current: tabsState };
  const setTabs = vi.fn(
    (next: EditorTab[] | ((current: EditorTab[]) => EditorTab[])) => {
      tabsState = typeof next === "function" ? next(tabsState) : next;
      tabsRef.current = tabsState;
    },
  );

  return {
    getTabs: () => tabsState,
    options: {
      focusEditorSoon: vi.fn(),
      setActiveTabId: vi.fn(),
      setPendingDrafts: vi.fn(),
      setStatus: vi.fn(),
      setTabs,
      tabs: tabsState,
      tabsRef,
      ...overrides,
    } satisfies Parameters<typeof useRecoveryActions>[0],
    replaceTabs: (nextTabs: EditorTab[]) => {
      tabsState = nextTabs;
      tabsRef.current = tabsState;
    },
    setTabs,
    tabsRef,
  };
}

describe("useRecoveryActions", () => {
  beforeEach(() => {
    tauriApi.openTextFile.mockReset();
    storage.removeStoredDraft.mockReset();
  });

  it("reopens from disk when the tab still points at the same path", async () => {
    const tab = makeTab();
    tauriApi.openTextFile.mockResolvedValueOnce(makeTextFileDocument());
    const { getTabs, options } = makeOptions([tab]);
    const { result } = renderHook(() => useRecoveryActions(options));

    await act(async () => {
      await result.current.reopenTabFromDisk(tab.id);
    });

    expect(getTabs()[0]).toMatchObject({
      contents: "disk contents",
      fingerprint: "disk-fingerprint",
      saveStatus: "idle",
    });
    expect(options.setActiveTabId).toHaveBeenCalledWith("/workspace/a.md");
    expect(options.setStatus).toHaveBeenLastCalledWith("Reopened from disk");
  });

  it("does not apply a stale reopen result after the tab is closed", async () => {
    const tab = makeTab();
    let resolveOpen: (value: TextFileDocument) => void = () => {};
    tauriApi.openTextFile.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveOpen = resolve;
        }),
    );
    const { getTabs, options, replaceTabs } = makeOptions([tab]);
    const { result } = renderHook(() => useRecoveryActions(options));

    let reopen: Promise<void> = Promise.resolve();
    act(() => {
      reopen = result.current.reopenTabFromDisk(tab.id);
    });
    replaceTabs([]);

    await act(async () => {
      resolveOpen(makeTextFileDocument());
      await reopen;
    });

    expect(getTabs()).toEqual([]);
    expect(options.setActiveTabId).not.toHaveBeenCalled();
    expect(options.setStatus).toHaveBeenLastCalledWith(
      "Reopen skipped; document changed",
    );
  });

  it("does not attach a reopen failure to a renamed tab", async () => {
    const tab = makeTab();
    let rejectOpen: (reason: unknown) => void = () => {};
    tauriApi.openTextFile.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectOpen = reject;
        }),
    );
    const { getTabs, options, replaceTabs } = makeOptions([tab]);
    const { result } = renderHook(() => useRecoveryActions(options));

    let reopen: Promise<void> = Promise.resolve();
    act(() => {
      reopen = result.current.reopenTabFromDisk(tab.id);
    });
    replaceTabs([
      makeTab({
        id: tab.id,
        name: "renamed.md",
        path: "/workspace/renamed.md",
      }),
    ]);

    await act(async () => {
      rejectOpen(new Error("disk failed"));
      await reopen;
    });

    expect(getTabs()[0]).toMatchObject({
      error: null,
      path: "/workspace/renamed.md",
    });
    expect(options.setStatus).toHaveBeenLastCalledWith(
      "Reopen skipped; document changed",
    );
  });
});
