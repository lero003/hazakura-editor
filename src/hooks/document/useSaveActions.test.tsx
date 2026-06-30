import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isDirty } from "../../features/editor/editorTabs";
import type { SavedFileState, TextFileDocument } from "../../lib/tauri";
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

function makeTextFileDocument(
  overrides: Partial<TextFileDocument> = {},
): TextFileDocument {
  return {
    contents: "draft",
    encoding: "utf-8",
    fingerprint: "saved-as-fingerprint",
    large_file_warning: false,
    line_ending: "lf",
    modified_ms: 456,
    name: "copy.md",
    path: "/tmp/copy.md",
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

  it("saveActiveTabAs uses the latest buffer after the path picker completes", async () => {
    const tab = makeTab({ contents: "before dialog" });
    let resolvePath: (value: string) => void = () => {};
    fileApi.pickSaveAsTextFilePath.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolvePath = resolve;
        }),
    );
    fileApi.saveTextFileAs.mockResolvedValue(
      makeTextFileDocument({ contents: "after dialog" }),
    );
    const { replaceTabs, result } = setup([tab]);

    let saveAs: Promise<void> = Promise.resolve();
    act(() => {
      saveAs = result.current.saveActiveTabAs();
    });
    replaceTabs([{ ...tab, contents: "after dialog" }]);

    await act(async () => {
      resolvePath("/tmp/copy.md");
      await saveAs;
    });

    expect(fileApi.saveTextFileAs).toHaveBeenCalledWith(
      "/tmp/copy.md",
      "after dialog",
      tab.line_ending,
      tab.encoding,
      null,
    );
  });

  it("saveActiveTab saves a dirty standalone file when no workspace is open", async () => {
    // Regression guard: a standalone file opened via the
    // File > Open picker (i.e. `workspaceRootPath: null`)
    // must still go through the regular `save_text_file`
    // IPC. The save path does not consult
    // `workspaceRootPath`, and the Rust side does not
    // require a workspace root either, so a dirty tab
    // opened outside a workspace must clear its dirty
    // state on save and the recovery draft must be
    // removed. Pinning the post-save tab state here is
    // what catches a regression where the save path
    // silently short-circuits for non-workspace tabs.
    const tab = makeTab({
      contents: "standalone draft",
      lastSavedContents: "standalone",
      path: "/tmp/standalone.md",
    });
    fileApi.saveTextFile.mockResolvedValue(
      makeSavedFileState({ path: "/tmp/standalone.md" }),
    );
    const { getTabs, result } = setup([tab]);

    expect(isDirty(getTabs()[0])).toBe(true);

    await act(async () => {
      await result.current.saveActiveTab();
    });

    expect(fileApi.saveTextFile).toHaveBeenCalledWith(
      "/tmp/standalone.md",
      "standalone draft",
      tab.fingerprint,
      tab.line_ending,
      tab.encoding,
    );
    expect(getTabs()[0]).toMatchObject({
      contents: "standalone draft",
      fingerprint: "next-fingerprint",
      lastSavedContents: "standalone draft",
      saveStatus: "saved",
    });
    expect(isDirty(getTabs()[0])).toBe(false);
    expect(removeStoredDraft).toHaveBeenCalledWith("/tmp/standalone.md");
  });

  it("saveActiveTab routes a dirty pathless tab through Save As before writing", async () => {
    const tab = makeTab({
      contents: "# Unsaved draft",
      id: "untitled:1",
      lastSavedContents: "",
      name: "untitled.md",
      path: "",
      size: 0,
    });
    fileApi.pickSaveAsTextFilePath.mockResolvedValueOnce("/tmp/untitled.md");
    fileApi.saveTextFileAs.mockResolvedValue(
      makeTextFileDocument({
        contents: "# Unsaved draft",
        name: "untitled.md",
        path: "/tmp/untitled.md",
      }),
    );
    const { getTabs, options, result } = setup([tab]);

    await act(async () => {
      await result.current.saveActiveTab();
    });

    expect(fileApi.pickSaveAsTextFilePath).toHaveBeenCalledWith("untitled.md");
    expect(fileApi.saveTextFile).not.toHaveBeenCalled();
    expect(fileApi.saveTextFileAs).toHaveBeenCalledWith(
      "/tmp/untitled.md",
      "# Unsaved draft",
      tab.line_ending,
      tab.encoding,
      null,
    );
    expect(getTabs()[0]).toMatchObject({
      contents: "# Unsaved draft",
      id: "untitled:1",
      lastSavedContents: "# Unsaved draft",
      path: "/tmp/untitled.md",
      saveStatus: "idle",
    });
    expect(options.setActiveTabId).toHaveBeenCalledWith("untitled:1");
    expect(removeStoredDraft).not.toHaveBeenCalledWith("");
  });
});
