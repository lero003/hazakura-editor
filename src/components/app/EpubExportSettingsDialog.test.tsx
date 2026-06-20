import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EpubExportSettingsDialog } from "./EpubExportSettingsDialog";

afterEach(cleanup);

describe("EpubExportSettingsDialog", () => {
  it("submits dialog-scoped EPUB metadata settings", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    render(
      <EpubExportSettingsDialog
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
});
