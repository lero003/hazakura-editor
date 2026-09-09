import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { RestoreFromBackupDialog } from "./RestoreFromBackupDialog";
import { getAutoBackupRestoreCopy } from "../../lib/locale/autoBackup";
const entry = { name: "backup.md", path: "/workspace/backup.md", modifiedAtMs: 1000, size: 2048 };
const props = { copy: getAutoBackupRestoreCopy("ja"), entries: [entry], error: null, fileLabel: "draft.md", loading: false, onClose: vi.fn(), onSelect: vi.fn() };
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); });
it("selects only on an explicit compare action and preserves real metadata", () => {
  render(<RestoreFromBackupDialog {...props} />);
  expect(props.onSelect).not.toHaveBeenCalled();
  expect(screen.getByText(props.copy.selectionHint)).toBeTruthy();
  expect(screen.queryByRole("listbox")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /backup.md.*現在の編集と比較/ }));
  expect(props.onSelect).toHaveBeenCalledExactlyOnceWith(entry);
  expect(screen.getByText(/2.0 KB/)).toBeTruthy();
});
it("traps Tab, ignores composing Escape, and restores focus on close", () => {
  const opener = document.createElement("button"); document.body.append(opener); opener.focus();
  // jsdom has no layout; visibility of these real controls is supplied by this test.
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  const view = render(<RestoreFromBackupDialog {...props} />);
  const first = screen.getByRole("button", { name: /backup.md/ });
  const close = screen.getByRole("button", { name: "閉じる" });
  expect(document.activeElement).toBe(first);
  fireEvent.keyDown(first, { key: "Tab", shiftKey: true }); expect(document.activeElement).toBe(close);
  fireEvent.keyDown(close, { key: "Tab" }); expect(document.activeElement).toBe(first);
  fireEvent.keyDown(first, { key: "Escape", isComposing: true }); expect(props.onClose).not.toHaveBeenCalled();
  fireEvent.keyDown(first, { key: "Escape" }); expect(props.onClose).toHaveBeenCalledOnce();
  view.unmount(); expect(document.activeElement).toBe(opener); opener.remove();
});
it.each(["loading", "empty", "error"])("keeps a close action available for %s", (state) => {
  render(<RestoreFromBackupDialog {...props} entries={[]} loading={state === "loading"} error={state === "error" ? "missing" : null} />);
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "閉じる" }));
  expect(props.onSelect).not.toHaveBeenCalled();
});
