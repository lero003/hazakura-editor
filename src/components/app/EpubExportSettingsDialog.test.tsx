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
        hasUnsavedChanges
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
    expect(
      screen.getByText("Current unsaved changes are included in the export."),
    ).toBeTruthy();
    expect(
      screen.getByText("Choose the .epub destination in the next Save dialog."),
    ).toBeTruthy();
  });

  it("disables Export while the title is blank", () => {
    render(
      <EpubExportSettingsDialog
        cancelButtonRef={createRef()}
        dialogRef={createRef()}
        documentName="book.md"
        hasUnsavedChanges={false}
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

  it("keeps the EPUB dialog controls in kana mode", () => {
    render(
      <EpubExportSettingsDialog
        cancelButtonRef={createRef()}
        dialogRef={createRef()}
        documentName="book.md"
        hasUnsavedChanges={false}
        initialSettings={{
          author: "",
          language: "ja",
          title: "ほん",
        }}
        menuLanguage="kana"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog", { name: "EPUBかきだし" })).toBeTruthy();
    expect(screen.getByLabelText("しょめい")).toBeTruthy();
    expect(screen.getByRole("button", { name: "かきだす" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "やめる" })).toBeTruthy();
  });

  it("renders the e-book / EPUB scope note in Japanese and English", () => {
    const { rerender } = render(
      <EpubExportSettingsDialog
        cancelButtonRef={createRef()}
        dialogRef={createRef()}
        documentName="book.md"
        hasUnsavedChanges={false}
        initialSettings={{
          author: "",
          language: "ja",
          title: "Initial Title",
        }}
        menuLanguage="ja"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(
      screen.getByText((_, node) => {
        if (!node) {
          return false;
        }
        return node.classList.contains("epub-export-settings-note");
      }).textContent,
    ).toContain("電子書籍モードは読むためのプレビューです");

    rerender(
      <EpubExportSettingsDialog
        cancelButtonRef={createRef()}
        dialogRef={createRef()}
        documentName="book.md"
        hasUnsavedChanges={false}
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

    expect(
      screen.getByText((_, node) => {
        if (!node) {
          return false;
        }
        return node.classList.contains("epub-export-settings-note");
      }).textContent,
    ).toContain("E-book Mode is a reading preview");
  });

  it("exposes dialog and cancel button refs to the modal keyboard guard", () => {
    const cancelButtonRef = createRef<HTMLButtonElement | null>();
    const dialogRef = createRef<HTMLElement | null>();

    render(
      <EpubExportSettingsDialog
        cancelButtonRef={cancelButtonRef}
        dialogRef={dialogRef}
        documentName="book.md"
        hasUnsavedChanges={false}
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
