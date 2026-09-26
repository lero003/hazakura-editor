import { act, renderHook } from "@testing-library/react";
import { StrictMode, useState, type PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyLiveEditorContentsById, createEditorTab, isDirty } from "../../features/editor/editorTabs";
import type { SavedFileState, TextFileDocument } from "../../lib/tauri";
import { useLatestValueRef } from "../app/useLatestValueRef";
import { useExternalChangeActions } from "./useExternalChangeActions";
import { useRecoveryActions } from "./useRecoveryActions";
import { useSaveActions } from "./useSaveActions";

const api = vi.hoisted(() => ({
  getFileMetadata: vi.fn(), openTextFile: vi.fn(), saveTextFile: vi.fn(),
  saveTextFileAs: vi.fn(), pickSaveAsTextFilePath: vi.fn(),
  createSecurityScopedBookmark: vi.fn(),
}));
vi.mock("../../lib/tauri", () => api);

const original: TextFileDocument = {
  path: "/work/a.md", name: "a.md", contents: "original", fingerprint: "original",
  encoding: "utf-8", line_ending: "lf", size: 8, modified_ms: 1, large_file_warning: false,
};
const external: TextFileDocument = { ...original, contents: "external", fingerprint: "external" };
const noop = () => {};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(res => { resolve = res; });
  return { promise, resolve };
}
function useHarness() {
  const [tabs, setTabs] = useState(() => [createEditorTab(original)]);
  const [activeTabId, setActiveTabId] = useState<string | null>(original.path);
  const [status, setStatus] = useState("");
  const tabsRef = useLatestValueRef(tabs);
  const common = { tabs, tabsRef, setTabs, setStatus, setActiveTabId };
  const externalChange = useExternalChangeActions(common);
  const recovery = useRecoveryActions({ ...common, focusEditorSoon: noop, setPendingDrafts: noop });
  const save = useSaveActions({ ...common, activeTabId, activeTab: tabs[0], setGlobalError: noop,
    refreshWorkspaceTree: async () => {}, rememberRecentFile: noop, workspaceRootPath: null });
  return { tabs, setTabs, status, ...externalChange, ...recovery, ...save };
}
function wrapper({ children }: PropsWithChildren) { return <StrictMode>{children}</StrictMode>; }

describe("disk I/O ordering with React state and StrictMode", () => {
  beforeEach(() => { vi.resetAllMocks(); localStorage.clear(); });

  it.each(["metadata-first", "save-first"])("preserves a save and later typing when responses finish %s", async order => {
    const metadata = deferred<TextFileDocument>();
    const save = deferred<SavedFileState>();
    api.getFileMetadata.mockReturnValue(metadata.promise);
    api.openTextFile.mockResolvedValue(external);
    api.saveTextFile.mockReturnValue(save.promise);
    const { result } = renderHook(useHarness, { wrapper });
    let checking!: Promise<void>;
    act(() => { checking = result.current.checkTabForExternalChange(original.path); });
    act(() => result.current.setTabs(tabs => applyLiveEditorContentsById(tabs, original.path, "saved draft")));
    let saving!: Promise<boolean>;
    act(() => { saving = result.current.saveTabById(original.path); });
    act(() => result.current.setTabs(tabs => applyLiveEditorContentsById(tabs, original.path, "later draft")));
    const finishSave = async () => {
      await act(async () => { save.resolve({ ...original, fingerprint: "saved" }); await saving; });
    };
    const finishCheck = async () => {
      await act(async () => { metadata.resolve(external); await checking; });
    };
    if (order === "metadata-first") { await finishCheck(); await finishSave(); }
    else { await finishSave(); await finishCheck(); }
    expect(result.current.tabs[0]).toMatchObject({ contents: "later draft", lastSavedContents: "saved draft", fingerprint: "saved", saveStatus: "idle" });
    expect(isDirty(result.current.tabs[0])).toBe(true);
    expect(api.openTextFile).not.toHaveBeenCalled();
  });

  it("protects typing queued in the same React batch as an automatic refresh", async () => {
    const read = deferred<TextFileDocument>();
    api.getFileMetadata.mockResolvedValue(external);
    api.openTextFile.mockReturnValue(read.promise);
    const { result } = renderHook(useHarness, { wrapper });
    let checking!: Promise<void>;
    await act(async () => { checking = result.current.checkTabForExternalChange(original.path); });
    await act(async () => {
      result.current.setTabs(tabs => applyLiveEditorContentsById(tabs, original.path, "queued draft"));
      read.resolve(external);
      await checking;
    });
    expect(result.current.tabs[0]).toMatchObject({ contents: "queued draft", lastSavedContents: "original", saveStatus: "conflict" });
    expect(result.current.status).toBe("External change detected");
  });

  it("protects typing queued in the same React batch as an explicit reopen", async () => {
    const read = deferred<TextFileDocument>();
    api.openTextFile.mockReturnValue(read.promise);
    const { result } = renderHook(useHarness, { wrapper });
    let reopening!: Promise<void>;
    act(() => { reopening = result.current.reopenTabFromDisk(original.path); });
    await act(async () => {
      result.current.setTabs(tabs => applyLiveEditorContentsById(tabs, original.path, "queued draft"));
      read.resolve(external);
      await reopening;
    });
    expect(result.current.tabs[0]).toMatchObject({ contents: "queued draft", lastSavedContents: "original" });
    expect(result.current.status).toBe("Reopen skipped; document changed");
  });

  it("does not replace a session reopened in the same batch as a refresh", async () => {
    const read = deferred<TextFileDocument>();
    api.getFileMetadata.mockResolvedValue(external);
    api.openTextFile.mockReturnValue(read.promise);
    const { result } = renderHook(useHarness, { wrapper });
    let checking!: Promise<void>;
    await act(async () => { checking = result.current.checkTabForExternalChange(original.path); });
    const reopened = createEditorTab({ ...original, contents: "reopened" });
    await act(async () => {
      result.current.setTabs([reopened]);
      read.resolve(external);
      await checking;
    });
    expect(result.current.tabs).toEqual([reopened]);
    expect(result.current.status).not.toBe("External change refreshed");
  });
});
