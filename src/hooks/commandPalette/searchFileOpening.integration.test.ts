import { useState } from "react";
import { act, renderHook, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useCommandPaletteController } from "./useCommandPaletteController";
import { useFileOpening } from "../document/useFileOpening";
import { openTextFile, type TextFileDocument } from "../../lib/tauri";
import { getLModeCopy } from "../../lib/locale";
import type { EditorTab } from "../../types";
import type { EditorPaneHandle } from "../../components/editor/EditorPane";
vi.mock("../../lib/tauri", () => ({ openTextFile: vi.fn() }));
vi.mock("../../lib/storage", () => ({ readStoredDrafts: () => [], upsertDraftRecord: vi.fn() }));
afterEach(() => { cleanup(); vi.useRealTimers(); vi.resetAllMocks(); });
const file = (path: string): TextFileDocument => ({ path, name: path.split("/").at(-1)!, contents: "line\n".repeat(30), encoding: "utf-8", line_ending: "lf", size: 150, modified_ms: null, fingerprint: path, large_file_warning: false });
const row = (path: string, line: number) => ({ fileIndex: 0, matchIndex: 0, file: { path, relativePath: path.slice(6), matches: [], truncated: false }, match: { line, column: 1, text: "line" } });
function deferred() {
 let resolve!: (file: TextFileDocument) => void;
 const promise = new Promise<TextFileDocument>(r => { resolve = r; });
 return { promise, resolve };
}
function setup() {
 const goToLine = vi.fn(), setStatus = vi.fn(), clearImagePreview = vi.fn(), setCompareView = vi.fn();
 const hook = renderHook(() => {
   const [tabs, setTabs] = useState<EditorTab[]>([]);
   const [activeTabId, setActiveTabId] = useState<string | null>(null);
   const activeTab = tabs.find(t => t.id === activeTabId) ?? null;
   const opening = useFileOpening({ activeTab, tabs, setTabs, setActiveTabId, setCompareView,
     setStatus, clearImagePreview, setGlobalError: vi.fn(), setPendingDrafts: vi.fn(), rememberRecentFile: vi.fn(),
     openImagePreview: vi.fn(), refreshWorkspaceTree: vi.fn(), menuLanguage: "en", workspaceRootPath: "/book" });
   const controller = useCommandPaletteController({
        actions: {
          applyActiveMarkdownFormat: vi.fn(),
          createNewFile: vi.fn(),
          importSourceAsMarkdownDraft: vi.fn(),
          openReferenceFile: vi.fn(),
          exportEpubBeta: vi.fn(),
          exportHtml: vi.fn(),
          exportPdf: vi.fn(),
      pinExternalImages: vi.fn(),
          focusAdjacentTab: vi.fn(),
          handleSendSelectionToAgent: vi.fn(),
          insertTable: vi.fn(),
          openAgentWindow: vi.fn(),
          openAppleAssistWindow: vi.fn(),
          openFile: vi.fn(),
          openWorkspace: vi.fn(),
          openOkfReview: vi.fn(),
          createOkfScaffold: vi.fn(),
          openWorkspaceFile: opening.openWorkspaceFile,
          requestCloseTab: vi.fn(),
          requestRestoreFromBackup: vi.fn(),
          requestReviewTabAgainstDisk: vi.fn(),
          requestWindowClose: vi.fn(),
          saveActiveTab: vi.fn(),
          saveActiveTabAs: vi.fn(),
          setEditorSettings: vi.fn(),
          setFindVisible: vi.fn(),
          setPreferencesDialogMode: vi.fn(),
          togglePreviewSurface: vi.fn(),
          toggleDiffPane: vi.fn(),
          toggleLMode: vi.fn(),
          toggleOutlinePane: vi.fn(),
          toggleQuickOpen: vi.fn(),
        },
     activeTab, activeTabId, appleLocalAssistAllowed: true, assistSurfaceActive: "none",
     editorPaneRef: { current: { goToLine } as unknown as EditorPaneHandle }, lModeCopy: getLModeCopy("en"),
     menuLanguage: "en", setStatus, themePreference: "light", workspaceRootPath: "/book",
   });
   return { controller, opening, tabs, activeTab };
 });
 return { ...hook, goToLine, setStatus, clearImagePreview, setCompareView };
}
it("keeps B active when A's real open finishes last", async () => {
 vi.useFakeTimers();
 const a = deferred(), b = deferred();
 vi.mocked(openTextFile).mockImplementation(path => path.endsWith("a.md") ? a.promise : b.promise);
 const { result, goToLine, clearImagePreview, setStatus } = setup();
 act(() => { result.current.controller.runGlobalSearchMatch(row("/book/a.md", 10)); result.current.controller.runGlobalSearchMatch(row("/book/b.md", 20)); });
 await act(async () => b.resolve(file("/book/b.md")));
 await act(async () => { await vi.advanceTimersByTimeAsync(50); });
 await act(async () => a.resolve(file("/book/a.md")));
 await act(async () => { await vi.advanceTimersByTimeAsync(50); });
 expect(result.current.activeTab?.path).toBe("/book/b.md");
 expect(goToLine).toHaveBeenCalledExactlyOnceWith(20, { focus: false });
 expect(clearImagePreview).toHaveBeenCalledTimes(1);
 expect(setStatus).toHaveBeenLastCalledWith("Opened b.md:20");
});
it("opens one real session and navigates to the last match in the same unopened file", async () => {
 vi.useFakeTimers();
 const read = deferred(); vi.mocked(openTextFile).mockReturnValue(read.promise);
 const { result, goToLine } = setup();
 act(() => { result.current.controller.runGlobalSearchMatch(row("/book/a.md", 10)); result.current.controller.runGlobalSearchMatch(row("/book/a.md", 20)); });
 await act(async () => read.resolve(file("/book/a.md")));
 await act(async () => { await vi.advanceTimersByTimeAsync(50); });
 expect(result.current.tabs).toHaveLength(1);
 expect(goToLine).toHaveBeenCalledExactlyOnceWith(20, { focus: false });
});
it("returns the registered session to both unguarded concurrent opens", async () => {
 const read = deferred(); vi.mocked(openTextFile).mockReturnValue(read.promise);
 const { result } = setup();
 let first!: ReturnType<typeof result.current.opening.openWorkspaceFile>, second!: typeof first;
 act(() => { first = result.current.opening.openWorkspaceFile("/book/a.md"); second = result.current.opening.openWorkspaceFile("/book/a.md"); });
 await act(async () => read.resolve(file("/book/a.md")));
 expect(await first).toEqual(result.current.tabs[0]);
 expect(await second).toEqual(result.current.tabs[0]);
});
it.each(["close", "query"])("does not publish a pending open after search %s", async (ending) => {
 const read = deferred(); vi.mocked(openTextFile).mockReturnValue(read.promise);
 const { result, clearImagePreview, goToLine } = setup();
 act(() => result.current.controller.openGlobalSearch());
 act(() => result.current.controller.runGlobalSearchMatch(row("/book/a.md", 10)));
 act(() => {
   if (ending === "close") result.current.controller.closeGlobalSearch();
   else result.current.controller.setGlobalSearchQuery("different");
 });
 await act(async () => read.resolve(file("/book/a.md")));
 expect(result.current.activeTab).toBeNull();
 expect(result.current.tabs).toHaveLength(0);
 expect(clearImagePreview).not.toHaveBeenCalled();
 expect(goToLine).not.toHaveBeenCalled();
});
