import { HtmlExportSettingsDialog } from "./HtmlExportSettingsDialog";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EpubExportSettingsDialog } from "./EpubExportSettingsDialog";
import { PdfExportSettingsDialog } from "./PdfExportSettingsDialog";
import { ExportFormatNav } from "./ExportFormatNav";
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
  expect(screen.getByRole("button", { name: "Choose destination…" })).toHaveProperty("disabled", true);
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

it("shows the format nav inside the shared frame and reuses the same dialog (画面11)", () => {
  const onSelectFormat = vi.fn();
  const nav = (
    <ExportFormatNav
      format="pdf"
      menuLanguage="ja"
      onSelectFormat={onSelectFormat}
    />
  );
  const { container } = render(
    <PdfExportSettingsDialog
      bookAvailable={false}
      cancelButtonRef={{ current: null }}
      dialogRef={{ current: null }}
      documentName="draft.md"
      formatNav={nav}
      hasUnsavedChanges={false}
      initialPreset="standard"
      menuLanguage="ja"
      onCancel={() => {}}
      onConfirm={() => {}}
    />,
  );

  // 形式ナビは共通の枠（dialog）の中にあり、対象（文書／本全体）と同居する。
  const group = screen.getByRole("group", { name: "書き出す形式" });
  expect(group.closest("div[role='dialog']")).toBe(container.querySelector("div[role='dialog']"));
  expect(container.querySelector(".export-settings-header p")?.textContent).toBe("draft.md");

  // 別形式を選ぶと、既存の準備処理へ切り替えを委ねる（新しい経路は作らない）。
  fireEvent.click(screen.getByRole("button", { name: "HTML" }));
  expect(onSelectFormat).toHaveBeenCalledExactlyOnceWith("html");
});

it("shows the format nav inside the shared frame and reuses the same dialog (画面11)", () => {
  const onSelectFormat = vi.fn();
  const nav = (
    <ExportFormatNav
      format="pdf"
      menuLanguage="ja"
      onSelectFormat={onSelectFormat}
    />
  );
  const { container } = render(
    <PdfExportSettingsDialog
      bookAvailable={false}
      cancelButtonRef={{ current: null }}
      dialogRef={{ current: null }}
      documentName="draft.md"
      formatNav={nav}
      hasUnsavedChanges={false}
      initialPreset="standard"
      menuLanguage="ja"
      onCancel={() => {}}
      onConfirm={() => {}}
    />,
  );

  // 形式ナビは共通の枠（dialog）の中にあり、対象（文書／本全体）と同居する。
  const group = screen.getByRole("group", { name: "書き出す形式" });
  expect(
    group.closest("div[role='dialog']"),
  ).toBe(container.querySelector("div[role='dialog']"));
  expect(container.querySelector(".export-settings-header p")?.textContent).toBe(
    "draft.md",
  );

  // 別形式を選ぶと、既存の準備処理へ切り替えを委ねる（新しい経路は作らない）。
  fireEvent.click(screen.getByRole("button", { name: "HTML" }));
  expect(onSelectFormat).toHaveBeenCalledExactlyOnceWith("html");
});
