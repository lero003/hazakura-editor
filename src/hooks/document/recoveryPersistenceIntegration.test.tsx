import { act, renderHook, waitFor } from "@testing-library/react";
import { useRef, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceRestore } from "../workspace/useWorkspaceRestore";
import { useRecoveryActions } from "./useRecoveryActions";
import { useDraftPersistence } from "./useDraftPersistence";
import { readStoredDrafts, removeStoredDraft, writePersistedWorkspaceState, writeStoredDrafts } from "../../lib/storage";
import type { DraftRecord, EditorTab } from "../../types";
const api = vi.hoisted(() => ({ openTextFile: vi.fn(), resolveSecurityScopedBookmark: vi.fn(), listWorkspaceTree: vi.fn() }));
vi.mock("../../lib/tauri", () => api);
const noop = () => {};
const discardRef = { current: false };
function useHarness() {
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [pendingDrafts, setPendingDrafts] = useState<DraftRecord[]>([]);
  const [restoreComplete, setRestoreComplete] = useState(false);
  useWorkspaceRestore({ setTabs, setPendingDrafts, setRestoreComplete, setActiveTabId: noop, setWorkspaceRootPath: noop, setWorkspaceTree: noop, onError: noop, onStatus: noop });
  useDraftPersistence({ tabs, pendingDrafts, restoreComplete, discardingWindowCloseRef: discardRef });
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const recovery = useRecoveryActions({ tabs, tabsRef, setTabs, setPendingDrafts, setActiveTabId: noop, setStatus: noop, focusEditorSoon: noop });
  return { pendingDrafts, tabs, setTabs, restoreComplete, ...recovery };
}
describe("startup recovery through persistence", () => {
  beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
  it.each(["changed", "missing", "moved", "permission", "no-session"])("keeps the independent snapshot after %s and subsequent persistence", async scenario => {
    writeStoredDrafts([{ path: "/work/a.md", contents: "irreplaceable", line_ending: "lf", savedFingerprint: "old", updatedAt: Date.now() }]);
    if (scenario !== "no-session") writePersistedWorkspaceState({ workspaceRootPath: null, tabPaths: ["/work/a.md"], tabFileBookmarks: scenario === "moved" ? { "/work/a.md": [1] } : {}, activeTabPath: "/work/a.md" });
    api.resolveSecurityScopedBookmark.mockResolvedValue("/work/renamed.md");
    api.openTextFile.mockImplementation(async path => {
      if (["missing", "permission"].includes(scenario) || (scenario === "moved" && path === "/work/a.md")) throw new Error("unavailable");
      return { path, name: "a.md", contents: "external", fingerprint: "new", encoding: "utf-8", line_ending: "lf", size: 8, modified_ms: 1 };
    });
    const { result } = renderHook(useHarness);
    await waitFor(() => expect(result.current.restoreComplete).toBe(true));
    expect(result.current.pendingDrafts[0]).toMatchObject({ detached: true, contents: "irreplaceable" });
    act(() => result.current.setTabs(tabs => tabs.map(tab => ({ ...tab, contents: "new unsaved edits" }))));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 450)); });
    expect(readStoredDrafts().some(draft => draft.detached)).toBe(true);
    if (result.current.tabs.length) expect(readStoredDrafts().some(draft => draft.contents === "new unsaved edits")).toBe(true);
    removeStoredDraft("/work/a.md");
    expect(readStoredDrafts().find(draft => draft.detached)?.contents).toBe("irreplaceable");
  });
});

describe("empty recovered drafts", () => {
  it.each(["lf", "crlf"] as const)("keeps %s deletion after extraction, persistence and restart", async line_ending => {
    localStorage.clear();
    writeStoredDrafts([{ path: "/work/deleted.md", contents: "", line_ending, savedFingerprint: "old", updatedAt: Date.now() }]);
    const first = renderHook(useHarness);
    await waitFor(() => expect(first.result.current.restoreComplete).toBe(true));
    act(() => first.result.current.restoreDraft(first.result.current.pendingDrafts[0]));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 450)); });
    expect(readStoredDrafts()).toEqual(expect.arrayContaining([expect.objectContaining({ contents: "", line_ending })]));
    first.unmount();
    const restarted = renderHook(useHarness);
    await waitFor(() => expect(restarted.result.current.restoreComplete).toBe(true));
    expect(restarted.result.current.pendingDrafts).toEqual(expect.arrayContaining([expect.objectContaining({ contents: "", line_ending })]));
    restarted.unmount();
  });
});
