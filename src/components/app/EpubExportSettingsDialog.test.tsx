import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import { EpubExportSettingsDialog } from "./EpubExportSettingsDialog";

afterEach(cleanup);

describe("EpubExportSettingsDialog", () => {
  it("submits dialog-scoped EPUB metadata settings", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    render(
      <EpubExportSettingsDialog
        cancelButtonRef={createRef()}
        dialogRef={createRef()}
        documentName="book.md"
        initialSettings={{
          author: "",
          language: "ja",
          title: "Initial Title",
        }}
        menuLanguage="en"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Edited Title" },
    });
    fireEvent.change(screen.getByLabelText("Author"), {
      target: { value: "Kaguya" },
    });
    fireEvent.change(screen.getByLabelText("Language"), {
      target: { value: "en" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Export" }));

    expect(onConfirm).toHaveBeenCalledWith({
      author: "Kaguya",
      language: "en",
      title: "Edited Title",
    });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("disables Export while the title is blank", () => {
    render(
      <EpubExportSettingsDialog
        cancelButtonRef={createRef()}
        dialogRef={createRef()}
        documentName="book.md"
        initialSettings={{
          author: "",
          language: "ja",
          title: "Initial Title",
        }}
        menuLanguage="en"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "   " },
    });

    expect(screen.getByRole("button", { name: "Export" })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("exposes dialog and cancel button refs to the modal keyboard guard", () => {
    const cancelButtonRef = createRef<HTMLButtonElement | null>();
    const dialogRef = createRef<HTMLElement | null>();

    render(
      <EpubExportSettingsDialog
        cancelButtonRef={cancelButtonRef}
        dialogRef={dialogRef}
        documentName="book.md"
        initialSettings={{
          author: "",
          language: "ja",
          title: "Initial Title",
        }}
        menuLanguage="en"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(dialogRef.current).toBe(screen.getByRole("dialog"));
    expect(cancelButtonRef.current).toBe(
      screen.getByRole("button", { name: "Cancel" }),
    );
  });
});
