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
