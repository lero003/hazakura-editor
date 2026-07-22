import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import { EpubExportSettingsDialog } from "./EpubExportSettingsDialog";

const dialogApi = vi.hoisted(() => ({
  pickEpubCoverImage: vi.fn(),
}));

vi.mock("../../lib/tauri/dialog", () => ({
  pickEpubCoverImage: dialogApi.pickEpubCoverImage,
}));

afterEach(cleanup);

describe("EpubExportSettingsDialog", () => {
  it("adds an optional explicitly selected cover image", async () => {
    const onConfirm = vi.fn();
    dialogApi.pickEpubCoverImage.mockResolvedValue(
      "/workspace/book/images/title-cover.png",
    );
    render(
      <EpubExportSettingsDialog
        cancelButtonRef={createRef()}
        dialogRef={createRef()}
        documentName="book.md"
        hasUnsavedChanges={false}
        initialSettings={{ author: "", language: "ja", title: "Book" }}
        menuLanguage="ja"
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "表紙画像を選ぶ" }));

    expect(dialogApi.pickEpubCoverImage).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("title-cover.png")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "書き出す" }));
    expect(onConfirm).toHaveBeenCalledWith(
      {
        author: "",
        coverImagePath: "/workspace/book/images/title-cover.png",
        language: "ja",
        title: "Book",
      },
      "document",
    );
  });

  it("switches the visible preflight with the selected export scope", () => {
    render(
      <EpubExportSettingsDialog
        bookAvailable
        cancelButtonRef={{ current: null }}
        dialogRef={{ current: null }}
        documentName="chapter.md"
        hasUnsavedChanges={false}
        initialSettings={{ author: "", language: "ja", title: "Book" }}
        menuLanguage="ja"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        preflightByScope={{
          document: { chapterCount: 1, checkedImageCount: 0, issues: [] },
          book: {
            chapterCount: 2,
            checkedImageCount: 1,
            issues: [
              { kind: "heading-missing", severity: "warning", subject: "two.md" },
              { kind: "image-unavailable", severity: "warning", subject: "/workspace/lost.png" },
            ],
          },
        }}
      />,
    );

    expect(screen.getByText(/1章を確認/)).toBeTruthy();
    expect(screen.getByText("著者名が未入力です。")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "本全体" }));
    expect(screen.getByText(/見出しがない章: two.md/)).toBeTruthy();
    expect(screen.getByText(/読み込めない画像: \/workspace\/lost.png/)).toBeTruthy();
  });

  it("requires an explicit current-file or whole-book choice when a book exists", () => {
    const onConfirm = vi.fn();
    render(
      <EpubExportSettingsDialog
        bookAvailable
        cancelButtonRef={{ current: null }}
        dialogRef={{ current: null }}
        documentName="chapter.md"
        hasUnsavedChanges={false}
        initialScope="document"
        initialSettings={{ author: "", language: "ja", title: "Book" }}
        menuLanguage="ja"
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "本全体" }));
    fireEvent.click(screen.getByRole("button", { name: "書き出す" }));
    expect(onConfirm).toHaveBeenCalledWith(
      { author: "", language: "ja", title: "Book" },
      "book",
    );
  });

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

    expect(onConfirm).toHaveBeenCalledWith(
      {
        author: "Kaguya",
        language: "en",
        title: "Edited Title",
      },
      "document",
    );
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
