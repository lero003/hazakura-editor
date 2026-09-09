import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useBackupReviewActions } from "./useBackupReviewActions";
import { captureChangeReviewSnapshot } from "../../features/diff/changeReviewStale";
import type { EditorTab } from "../../types";
import type { EditorPaneHandle } from "../../components/editor/EditorPane";
const tab = { id: "doc", sessionId: "session", path: "/workspace/doc.md", name: "doc.md", contents: "reviewed",
  line_ending: "lf", encoding: "utf-8", lastSavedContents: "saved" } as EditorTab;
const claim = { documentPath: tab.path, backupContents: "backup", capturedSnapshot: captureChangeReviewSnapshot(tab) };
function setup() {
  const editor = { getActiveDocument: vi.fn(() => ({ text: tab.contents, from: 0, to: 0 })), replaceDocumentContents: vi.fn(() => true) };
  const options = { activeTab: tab as EditorTab | null, workspaceRootPath: "/workspace", menuLanguage: "ja" as const,
    imageVisible: false, editorPaneRef: { current: editor as unknown as EditorPaneHandle }, readBackup: vi.fn(async () => "backup"),
    closePicker: vi.fn(), leaveLMode: vi.fn(), review: vi.fn(), closeComparison: vi.fn(), setStatus: vi.fn(), rejectIfLocked: vi.fn(() => false) };
  return { editor, options };
}
afterEach(cleanup);
it.each(["buffer", "tab", "session", "closed", "encoding", "line-ending", "path", "live-editor"])("refuses Apply after %s changes", state => {
  const { options, editor } = setup();
  if (state === "closed") options.activeTab = null;
  else if (state === "buffer") options.activeTab = { ...tab, contents: "new work" };
  else if (state === "tab") options.activeTab = { ...tab, id: "other" };
  else if (state === "session") options.activeTab = { ...tab, sessionId: "reopened" };
  else if (state === "path") options.activeTab = { ...tab, path: "/workspace/renamed.md" };
  else if (state === "encoding") options.activeTab = { ...tab, encoding: "utf-8-bom" };
  else if (state === "line-ending") options.activeTab = { ...tab, line_ending: "crlf" };
  else editor.getActiveDocument.mockReturnValue({ text: "pending edit", from: 0, to: 0 });
  const { result } = renderHook(() => useBackupReviewActions(options));
  act(() => result.current.apply(claim));
  expect(editor.replaceDocumentContents).not.toHaveBeenCalled();
  expect(options.closeComparison).not.toHaveBeenCalled();
  expect(options.setStatus).toHaveBeenCalledWith(expect.stringContaining("もう一度比較"));
});
it.each(["buffer", "tab", "closed", "workspace"])("aborts a backup read when %s changes before completion", async state => {
  const { options } = setup();
  let complete!: (text: string) => void;
  options.readBackup.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  const { result, rerender } = renderHook(props => useBackupReviewActions(props), { initialProps: options });
  let pending!: Promise<void>;
  act(() => { pending = result.current.select({ name: "backup.md", path: "backup-path" }); });
  rerender({ ...options, activeTab: state === "closed" ? null : state === "tab" ? { ...tab, sessionId: "other" } : state === "buffer" ? { ...tab, contents: "new" } : tab,
    workspaceRootPath: state === "workspace" ? "/other" : "/workspace" });
  await act(async () => { complete("backup"); await pending; });
  expect(options.review).not.toHaveBeenCalled();
  expect(options.setStatus).toHaveBeenCalledWith(expect.stringContaining("もう一度比較"));
});
it("opens comparison only after a valid read and never applies while selecting", async () => {
  const { options, editor } = setup(); const { result } = renderHook(() => useBackupReviewActions(options));
  await act(async () => result.current.select({ name: "backup.md", path: "path" }));
  expect(options.review).toHaveBeenCalledWith(tab, "backup.md", "backup");
  expect(editor.replaceDocumentContents).not.toHaveBeenCalled();
  act(() => result.current.apply(claim));
  expect(editor.replaceDocumentContents).toHaveBeenCalledExactlyOnceWith("backup");
  expect(options.closeComparison).toHaveBeenCalledOnce();
});
it("keeps the comparison on lock, missing snapshot or editor refusal", () => {
  const { options, editor } = setup(); const { result } = renderHook(() => useBackupReviewActions(options));
  act(() => result.current.apply({ ...claim, capturedSnapshot: undefined }));
  options.rejectIfLocked.mockReturnValue(true);
  act(() => result.current.apply(claim));
  expect(editor.replaceDocumentContents).not.toHaveBeenCalled();
  options.rejectIfLocked.mockReturnValue(false); editor.replaceDocumentContents.mockReturnValue(false);
  act(() => result.current.apply(claim));
  expect(options.closeComparison).not.toHaveBeenCalled();
});
