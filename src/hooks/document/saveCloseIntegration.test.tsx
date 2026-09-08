import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUntitledEditorTab, isDirty } from "../../features/editor/editorTabs";
import { useLatestValueRef } from "../app/useLatestValueRef";
import { useSaveActions } from "./useSaveActions";
import { useTabCloseFlow } from "../editor/useTabCloseFlow";
import type { TextFileDocument } from "../../lib/tauri";
import type { DraftRecord } from "../../types";

const api = vi.hoisted(() => ({
  pickSaveAsTextFilePath: vi.fn(async () => "/work/saved.md"),
  saveTextFileAs: vi.fn(),
  saveTextFile: vi.fn(),
  createSecurityScopedBookmark: vi.fn(async () => [1]),
}));
vi.mock("../../lib/tauri", () => api);
vi.mock("../../lib/tauri/window", () => ({ exitApp: vi.fn(), hideMainWindow: vi.fn() }));

function useHarness() {
  const [tabs, setTabs] = useState(() => [{ ...createUntitledEditorTab(), contents: "first draft" }]);
  const [activeTabId, setActiveTabId] = useState<string | null>(() => tabs[0].id);
  const [pendingCloseTabId, setPendingCloseTabId] = useState<string | null>(() => tabs[0].id);
  const [, setPendingDrafts] = useState<DraftRecord[]>([]);
  const tabsRef = useLatestValueRef(tabs);
  const common = { tabs, setTabs, tabsRef, activeTabId, setActiveTabId, setGlobalError: vi.fn(), setStatus: vi.fn() };
  const save = useSaveActions({ ...common, activeTab: tabs[0] ?? null, refreshWorkspaceTree: async () => {}, rememberRecentFile: vi.fn(), workspaceRootPath: null });
  const close = useTabCloseFlow({ ...common, pendingCloseTabId, setPendingCloseTabId, setPendingDrafts, dirtyTabs: tabs.filter(isDirty), saveTabById: save.saveTabById, allowWindowCloseRef: { current: false }, discardingWindowCloseRef: { current: false }, focusEditorSoon: vi.fn(), setPendingAppClose: vi.fn() });
  return { tabs, activeTabId, setTabs, ...close };
}

describe("real save and close integration", () => {
  beforeEach(() => { localStorage.clear(); });
  it.each([false, true])("closes the saved session only when no edits arrived during I/O: %s", async (editDuringWrite) => {
    let resolveWrite!: (file: TextFileDocument) => void;
    api.saveTextFileAs.mockImplementation(() => new Promise<TextFileDocument>(resolve => { resolveWrite = resolve; }));
    const { result } = renderHook(useHarness);
    let closing!: Promise<void>;
    await act(async () => { closing = result.current.saveAndClosePendingTab(); });
    if (editDuringWrite) act(() => result.current.setTabs(tabs => tabs.map(tab => ({ ...tab, contents: "later writing" }))));
    await act(async () => {
      resolveWrite({ path: "/work/saved.md", name: "saved.md", contents: "first draft", encoding: "utf-8", line_ending: "lf", size: 11, modified_ms: 1, fingerprint: "saved", large_file_warning: false });
      await closing;
    });
    if (editDuringWrite) {
      expect(result.current.tabs).toHaveLength(1);
      expect(result.current.tabs[0]).toMatchObject({ path: "/work/saved.md", contents: "later writing", lastSavedContents: "first draft" });
      expect(isDirty(result.current.tabs[0])).toBe(true);
    } else {
      expect(result.current.tabs).toEqual([]);
      expect(result.current.activeTabId).toBeNull();
    }
  });
});
