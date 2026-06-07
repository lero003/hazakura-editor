import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isDirty } from "../../features/editor/editorTabs";
import type { SavedFileState } from "../../lib/tauri";
import { removeStoredDraft } from "../../lib/storage";
import type { EditorTab } from "../../types";
import { useSaveActions } from "./useSaveActions";

const fileApi = vi.hoisted(() => ({
  pickSaveAsTextFilePath: vi.fn(),
  saveTextFile: vi.fn(),
  saveTextFileAs: vi.fn(),
}));

vi.mock("../../lib/tauri", () => ({
  pickSaveAsTextFilePath: fileApi.pickSaveAsTextFilePath,
  saveTextFile: fileApi.saveTextFile,
  saveTextFileAs: fileApi.saveTextFileAs,
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

function makeSavedFileState(overrides: Partial<SavedFileState> = {}): SavedFileState {
  return {
    encoding: "utf-8",
    fingerprint: "next-fingerprint",
    line_ending: "lf",
    modified_ms: 123,
    path: "/tmp/a.md",
    size: 5,
    ...overrides,
  };
}

function setup(initialTabs: EditorTab[]) {
  let tabsState = initialTabs;
  const tabsRef = { current: tabsState };
  const setTabs = vi.fn((next: EditorTab[] | ((tabs: EditorTab[]) => EditorTab[])) => {
    tabsState = typeof next === "function" ? next(tabsState) : next;
    tabsRef.current = tabsState;
  });
  const options: Parameters<typeof useSaveActions>[0] = {
    activeTab: initialTabs[0] ?? null,
    activeTabId: initialTabs[0]?.id ?? null,
    refreshWorkspaceTree: vi.fn(async () => {}),
    rememberRecentFile: vi.fn(),
    setActiveTabId: vi.fn(),
    setGlobalError: vi.fn(),
    setStatus: vi.fn(),
    setTabs,
    tabs: tabsState,
    tabsRef,
    workspaceRootPath: null,
  };

  return {
    getTabs: () => tabsState,
    options,
    replaceTabs: (nextTabs: EditorTab[]) => {
      tabsState = nextTabs;
      tabsRef.current = tabsState;
    },
    result: renderHook(() => useSaveActions(options)).result,
    setTabs,
    tabsRef,
  };
}

describe("useSaveActions", () => {
  beforeEach(() => {
    fileApi.pickSaveAsTextFilePath.mockReset();
    fileApi.saveTextFile.mockReset();
    fileApi.saveTextFileAs.mockReset();
    storage.removeStoredDraft.mockReset();
  });

  it("marks a clean successful save as saved and removes its recovery draft", async () => {
    const tab = makeTab({ contents: "draft", lastSavedContents: "saved" });
    fileApi.saveTextFile.mockResolvedValue(makeSavedFileState());
    const { getTabs, result } = setup([tab]);

    await act(async () => {
      await result.current.saveTabById(tab.id);
    });

    expect(fileApi.saveTextFile).toHaveBeenCalledWith(
      tab.path,
      "draft",
      tab.fingerprint,
      tab.line_ending,
      tab.encoding,
    );
    expect(getTabs()[0]).toMatchObject({
      contents: "draft",
      fingerprint: "next-fingerprint",
      lastSavedContents: "draft",
      saveStatus: "saved",
    });
    expect(isDirty(getTabs()[0])).toBe(false);
    expect(removeStoredDraft).toHaveBeenCalledWith(tab.path);
  });

  it("keeps the tab dirty and preserves its draft when the buffer changes during save", async () => {
    const tab = makeTab({ contents: "draft", lastSavedContents: "saved" });
    let resolveSave: (value: SavedFileState) => void = () => {};
    fileApi.saveTextFile.mockImplementation(
      () =>
        new Promise<SavedFileState>((resolve) => {
          resolveSave = resolve;
        }),
    );
    const { getTabs, replaceTabs, result } = setup([tab]);

    let inFlight: Promise<boolean> = Promise.resolve(false);
    act(() => {
      inFlight = result.current.saveTabById(tab.id);
    });

    replaceTabs([
      {
        ...getTabs()[0],
        contents: "draft\nmore writing",
        saveStatus: "idle",
      },
    ]);

    let saved = false;
    await act(async () => {
      resolveSave(makeSavedFileState());
      saved = await inFlight;
    });

    expect(saved).toBe(true);
    expect(getTabs()[0]).toMatchObject({
      contents: "draft\nmore writing",
      fingerprint: "next-fingerprint",
      lastSavedContents: "draft",
      saveStatus: "idle",
    });
    expect(isDirty(getTabs()[0])).toBe(true);
    expect(removeStoredDraft).not.toHaveBeenCalled();
  });
});
