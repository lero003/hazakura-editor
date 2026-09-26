import { renderHook, act } from "@testing-library/react";
import {
  type Dispatch,
  type SetStateAction,
} from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useExternalChangeActions } from "./useExternalChangeActions";
import { getFileMetadata, openTextFile, type TextFileDocument } from "../../lib/tauri";
import { createEditorTab } from "../../features/editor/editorTabs";
import type { EditorTab } from "../../types";

vi.mock("../../lib/tauri", () => ({
  getFileMetadata: vi.fn(),
  openTextFile: vi.fn(),
}));

function makeUntitledImportTab(): EditorTab {
  return {
    id: "untitled:1",
    sessionId: "session:1",
    path: "",
    name: "scan-import.md",
    contents: "# draft",
    lastSavedContents: "",
    line_ending: "lf",
    lastSavedLineEnding: "lf",
    encoding: "utf-8",
    lastSavedEncoding: "utf-8",
    size: 0,
    modified_ms: null,
    fingerprint: "",
    large_file_warning: false,
    ignoredExternalFingerprint: null,
    externalFingerprint: null,
    saveStatus: "idle",
    error: null,
  };
}

describe("useExternalChangeActions pathless import drafts", () => {
  beforeEach(() => {
    vi.mocked(getFileMetadata).mockReset();
  });

  it("does not mark pathless tabs as save-failed after import", async () => {
    const tabs = [makeUntitledImportTab()];
    const tabsRef = { current: tabs };
    const setTabs = vi.fn<Dispatch<SetStateAction<EditorTab[]>>>((value) => {
      tabsRef.current =
        typeof value === "function" ? value(tabsRef.current) : value;
    });
    const setStatus = vi.fn();

    const { result } = renderHook(() =>
      useExternalChangeActions({
        setStatus,
        setTabs,
        tabsRef,
      }),
    );

    await act(async () => {
      await result.current.checkTabForExternalChange("untitled:1");
    });

    expect(getFileMetadata).not.toHaveBeenCalled();
    expect(setTabs).not.toHaveBeenCalled();
    expect(tabsRef.current[0]?.saveStatus).toBe("idle");
    expect(tabsRef.current[0]?.error).toBeNull();
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function diskFile(fingerprint = "original"): TextFileDocument {
  return {
    path: "/workspace/a.md", name: "a.md", contents: fingerprint,
    fingerprint, encoding: "utf-8", line_ending: "lf", size: 10,
    modified_ms: 1, large_file_warning: false,
  };
}

function setup(tab = createEditorTab(diskFile())) {
  const tabsRef = { current: [tab] };
  const setTabs = vi.fn<Dispatch<SetStateAction<EditorTab[]>>>((value) => {
    tabsRef.current = typeof value === "function" ? value(tabsRef.current) : value;
  });
  const setStatus = vi.fn();
  const hook = renderHook(() => useExternalChangeActions({ tabsRef, setTabs, setStatus }));
  return { ...hook, tab, tabsRef, setTabs, setStatus,
    check: () => hook.result.current.checkTabForExternalChange(tab.id) };
}

describe("external change I/O ordering", () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it("refreshes an unchanged clean buffer and warns for a dirty buffer", async () => {
    vi.mocked(getFileMetadata).mockResolvedValue(diskFile("external"));
    vi.mocked(openTextFile).mockResolvedValue(diskFile("external"));
    const clean = setup();
    await act(async () => { await clean.check(); });
    expect(clean.tabsRef.current[0].contents).toBe("external");
    const dirty = setup({ ...createEditorTab(diskFile()), contents: "local edits" });
    await act(async () => { await dirty.check(); });
    expect(dirty.tabsRef.current[0]).toMatchObject({ contents: "local edits", saveStatus: "conflict", externalFingerprint: "external" });
  });

  it.each(["metadata", "read"])("ignores an old %s response after closing and reopening the same path", async (phase) => {
    const pending = deferred<TextFileDocument>();
    vi.mocked(getFileMetadata).mockReturnValue(phase === "metadata" ? pending.promise : Promise.resolve(diskFile("external")));
    vi.mocked(openTextFile).mockReturnValue(phase === "read" ? pending.promise : Promise.resolve(diskFile("external")));
    const h = setup();
    let check!: Promise<void>;
    await act(async () => { check = h.check(); });
    const reopened = createEditorTab(diskFile("reopened"));
    h.tabsRef.current = [reopened];
    await act(async () => { pending.resolve(diskFile("external")); await check; });
    expect(h.tabsRef.current).toEqual([reopened]);
    expect(h.setStatus).not.toHaveBeenCalled();
  });

  it.each(["metadata", "read"])("ignores an old %s failure after reopening the same path", async (phase) => {
    const pending = deferred<TextFileDocument>();
    vi.mocked(getFileMetadata).mockReturnValue(phase === "metadata" ? pending.promise : Promise.resolve(diskFile("external")));
    vi.mocked(openTextFile).mockReturnValue(pending.promise);
    const h = setup();
    let check!: Promise<void>;
    await act(async () => { check = h.check(); });
    const reopened = createEditorTab(diskFile("reopened"));
    h.tabsRef.current = [reopened];
    await act(async () => { pending.reject(new Error("old failure")); await check; });
    expect(h.tabsRef.current).toEqual([reopened]);
    expect(h.setStatus).not.toHaveBeenCalled();
  });

  it.each(["metadata", "read"])("does not roll back a completed save during %s I/O", async (phase) => {
    const pending = deferred<TextFileDocument>();
    vi.mocked(getFileMetadata).mockReturnValue(phase === "metadata" ? pending.promise : Promise.resolve(diskFile("external")));
    vi.mocked(openTextFile).mockReturnValue(phase === "read" ? pending.promise : Promise.resolve(diskFile("external")));
    const h = setup();
    let check!: Promise<void>;
    await act(async () => { check = h.check(); });
    const saved: EditorTab = { ...h.tab, contents: "saved now", lastSavedContents: "saved now", fingerprint: "new save", saveStatus: "saved" };
    h.tabsRef.current = [saved];
    await act(async () => { pending.resolve(diskFile("external")); await check; });
    expect(h.tabsRef.current).toEqual([saved]);
  });

  it("does not inspect a tab while a save is running", async () => {
    const h = setup({ ...createEditorTab(diskFile()), saveStatus: "saving" });
    await act(async () => { await h.check(); });
    expect(getFileMetadata).not.toHaveBeenCalled();
  });

  it("preserves a save started while metadata was pending", async () => {
    const pending = deferred<TextFileDocument>();
    vi.mocked(getFileMetadata).mockReturnValue(pending.promise);
    const h = setup();
    const check = h.check();
    const saving: EditorTab = { ...h.tab, contents: "local", saveStatus: "saving" };
    h.tabsRef.current = [saving];
    await act(async () => { pending.resolve(diskFile("external")); await check; });
    expect(h.tabsRef.current).toEqual([saving]);
    expect(openTextFile).not.toHaveBeenCalled();
  });

  it.each(["metadata", "read"])("protects edits made during %s I/O", async (phase) => {
    const pending = deferred<TextFileDocument>();
    vi.mocked(getFileMetadata).mockReturnValue(phase === "metadata" ? pending.promise : Promise.resolve(diskFile("external")));
    vi.mocked(openTextFile).mockReturnValue(phase === "read" ? pending.promise : Promise.resolve(diskFile("external")));
    const h = setup();
    let check!: Promise<void>;
    await act(async () => { check = h.check(); });
    h.tabsRef.current = [{ ...h.tab, contents: "typed meanwhile" }];
    await act(async () => { pending.resolve(diskFile("external")); await check; });
    expect(h.tabsRef.current[0]).toMatchObject({ contents: "typed meanwhile", saveStatus: "conflict", externalFingerprint: "external" });
  });

  it("does not let an older check overwrite a newer conflict", async () => {
    const pending = deferred<TextFileDocument>();
    vi.mocked(getFileMetadata).mockReturnValueOnce(pending.promise).mockResolvedValueOnce(diskFile("new external"));
    const h = setup({ ...createEditorTab(diskFile()), contents: "local edits" });
    const oldCheck = h.check();
    await act(async () => { await h.check(); });
    await act(async () => { pending.resolve(diskFile("original")); await oldCheck; });
    expect(h.tabsRef.current[0]).toMatchObject({ contents: "local edits", saveStatus: "conflict", externalFingerprint: "new external" });
  });

  it("still warns when typing clears a previous saved indicator during the check", async () => {
    const pending = deferred<TextFileDocument>();
    vi.mocked(getFileMetadata).mockReturnValue(pending.promise);
    const h = setup({ ...createEditorTab(diskFile()), saveStatus: "saved" });
    const check = h.check();
    h.tabsRef.current = [{ ...h.tab, contents: "typed after save", saveStatus: "idle" }];
    await act(async () => { pending.resolve(diskFile("external")); await check; });
    expect(h.tabsRef.current[0]).toMatchObject({ contents: "typed after save", saveStatus: "conflict", externalFingerprint: "external" });
  });

  it.each([
    { encoding: "shift-jis" as const },
    { line_ending: "crlf" as const },
  ])("preserves unsaved format changes during a disk read: %j", async change => {
    const read = deferred<TextFileDocument>();
    vi.mocked(getFileMetadata).mockResolvedValue(diskFile("external"));
    vi.mocked(openTextFile).mockReturnValue(read.promise);
    const h = setup();
    let check!: Promise<void>;
    await act(async () => { check = h.check(); });
    h.tabsRef.current = [{ ...h.tab, ...change }];
    await act(async () => { read.resolve(diskFile("external")); await check; });
    expect(h.tabsRef.current[0]).toMatchObject({ ...change, contents: "original", saveStatus: "conflict" });
  });

  it("respects Keep Editing chosen while a check was pending", async () => {
    const pending = deferred<TextFileDocument>();
    vi.mocked(getFileMetadata).mockReturnValue(pending.promise);
    const h = setup({ ...createEditorTab(diskFile()), contents: "local", saveStatus: "conflict", externalFingerprint: "external" });
    const check = h.check();
    const acknowledged: EditorTab = { ...h.tab, ignoredExternalFingerprint: "external", saveStatus: "idle", error: null };
    h.tabsRef.current = [acknowledged];
    await act(async () => { pending.resolve(diskFile("other external")); await check; });
    expect(h.tabsRef.current).toEqual([acknowledged]);
  });

  it("drops pending results on unmount", async () => {
    const pending = deferred<TextFileDocument>();
    vi.mocked(getFileMetadata).mockReturnValue(pending.promise);
    const h = setup();
    const check = h.check();
    h.unmount();
    await act(async () => { pending.reject(new Error("late")); await check; });
    expect(h.setTabs).not.toHaveBeenCalled();
    expect(h.setStatus).not.toHaveBeenCalled();
  });
});
