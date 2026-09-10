import { HtmlExportSettingsDialog } from "./HtmlExportSettingsDialog";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EpubExportSettingsDialog } from "./EpubExportSettingsDialog";
import { PdfExportSettingsDialog } from "./PdfExportSettingsDialog";
afterEach(cleanup);
it.each(["EPUB", "PDF"])("%s keeps cancel reachable and refuses submission after the book becomes unavailable", (format) => {
  const confirm = vi.fn(), cancel = vi.fn();
  const props = { cancelButtonRef: { current: null }, dialogRef: { current: null }, documentName: "single.md", hasUnsavedChanges: true,
    initialScope: "book" as const, menuLanguage: "en" as const, onConfirm: confirm, onCancel: cancel };
  const view = (available: boolean) => format === "EPUB"
    ? <EpubExportSettingsDialog {...props} bookAvailable={available} initialSettings={{ title: "Title", author: "", language: "en" }} />
    : <PdfExportSettingsDialog {...props} bookAvailable={available} initialPreset="standard" />;
  const { container, rerender } = render(view(true));
  expect(container.querySelector(".export-settings-header p")?.textContent).toBe("Whole book");
  expect(screen.queryByText("single.md")).toBeNull();
  rerender(view(false));
  expect(screen.getByRole("button", { name: "Export" })).toHaveProperty("disabled", true);
  fireEvent.submit(container.querySelector("form")!);
  expect(confirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(cancel).toHaveBeenCalledOnce();
});

it.each(["en", "ja", "kana"] as const)("HTML offers only the current document and starts on Cancel (%s)", (menuLanguage) => {
  const confirm = vi.fn(), cancel = vi.fn();
  const cancelButtonRef = { current: null as HTMLButtonElement | null };
  const { container } = render(<HtmlExportSettingsDialog menuLanguage={menuLanguage}
    dialogRef={{ current: null }} cancelButtonRef={cancelButtonRef}
    request={{ documentName: "draft.md", hasUnsavedChanges: true, tabId: "a", sessionId: "s", workspaceRootPath: null }}
    onConfirm={confirm} onCancel={cancel} />);
  expect(document.activeElement).toBe(cancelButtonRef.current);
  expect(container.textContent).toContain("draft.md");
  expect(container.textContent).toContain("10 MiB");
  expect(screen.queryByRole("combobox")).toBeNull();
  fireEvent.click(cancelButtonRef.current!);
  expect(cancel).toHaveBeenCalledOnce();
  expect(confirm).not.toHaveBeenCalled();
});
