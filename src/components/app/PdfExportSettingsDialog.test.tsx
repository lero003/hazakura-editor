import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PdfExportSettingsDialog } from "./PdfExportSettingsDialog";

afterEach(cleanup);

describe("PdfExportSettingsDialog", () => {
  it("offers A4 narrow, standard, and wide margin presets", () => {
    const onConfirm = vi.fn();
    render(
      <PdfExportSettingsDialog
        cancelButtonRef={createRef()}
        dialogRef={createRef()}
        documentName="book.md"
        initialPreset="standard"
        menuLanguage="ja"
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByLabelText(/狭い/)).toBeTruthy();
    expect(screen.getByLabelText(/標準/)).toHaveProperty("checked", true);
    expect(screen.getByLabelText(/広い/)).toBeTruthy();

    fireEvent.click(screen.getByLabelText(/広い/));
    fireEvent.click(screen.getByRole("button", { name: "書き出す" }));
    expect(onConfirm).toHaveBeenCalledWith("wide");
  });

  it("cancels without confirming and exposes modal refs", () => {
    const cancelButtonRef = createRef<HTMLButtonElement | null>();
    const dialogRef = createRef<HTMLElement | null>();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <PdfExportSettingsDialog
        cancelButtonRef={cancelButtonRef}
        dialogRef={dialogRef}
        documentName="book.md"
        initialPreset="standard"
        menuLanguage="en"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(dialogRef.current).toBe(screen.getByRole("dialog"));
    expect(cancelButtonRef.current).toBe(
      screen.getByRole("button", { name: "Cancel" }),
    );
  });
});
