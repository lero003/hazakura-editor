import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openWorkspaceImage } from "../../../lib/tauri";
import {
  getEBookPageOffset,
  measureEBookPageCount,
} from "./ebookPagination";
import EBookPane from "./EBookPane";

vi.mock("../../../lib/tauri", () => ({
  openWorkspaceImage: vi.fn(),
}));

vi.mock("./ebookPagination", () => ({
  getEBookPageOffset: vi.fn((pageIndex: number) => pageIndex * 320),
  measureEBookPageCount: vi.fn(() => 1),
}));

class TestResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", TestResizeObserver);
});

afterEach(() => {
  cleanup();
  vi.mocked(openWorkspaceImage).mockReset();
  vi.mocked(getEBookPageOffset).mockClear();
  vi.mocked(measureEBookPageCount).mockReset();
  vi.mocked(measureEBookPageCount).mockReturnValue(1);
  vi.unstubAllGlobals();
});

describe("EBookPane chapter reader", () => {
  it("opens as a paginated book reader without a Preview-like Flow toggle", () => {
    render(
      <EBookPane
        menuLanguage="en"
        source={"# Chapter One\n\nbody one\n\n# Chapter Two\n\nbody two"}
      />,
    );

    const article = screen.getByRole("article", { name: "Book reader" });
    expect(article.querySelector(".ebook-page-sheet")).toBeTruthy();
    expect(article.querySelector(".ebook-flow-document")).toBeNull();
    expect(article.querySelector(".ebook-reader-mode-toggle")).toBeNull();
    expect(article.querySelectorAll(".ebook-chapter")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Chapter One" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Chapter Two" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Flow" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Page" })).toBeNull();
    expect(screen.getByText("Page 1 / 1")).toBeTruthy();
  });

  it("keeps the book page sheet spread-capable without rendering extra chapters", () => {
    render(
      <EBookPane
        menuLanguage="en"
        source={"# Chapter One\n\nbody one\n\n# Chapter Two\n\nbody two"}
      />,
    );

    const article = screen.getByRole("article", { name: "Book reader" });
    const sheet = article.querySelector(".ebook-page-sheet");

    expect(sheet?.classList.contains("ebook-page-sheet-spread")).toBe(true);
    expect(article.querySelector(".ebook-page-viewport")).toBeTruthy();
    expect(article.querySelectorAll(".ebook-chapter")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Chapter One" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Chapter Two" })).toBeNull();
  });

  it("previews the next chapter on the spare right spread page while keeping location anchored to the left page", async () => {
    vi.mocked(measureEBookPageCount).mockReturnValue(1);
    const onExitReadingFocus = vi.fn();
    const clientWidthGetter = vi
      .spyOn(HTMLElement.prototype, "clientWidth", "get")
      .mockImplementation(function getClientWidth(this: HTMLElement) {
        return this.classList.contains("ebook-page-viewport") ? 884 : 0;
      });
    const getComputedStyleSpy = vi
      .spyOn(window, "getComputedStyle")
      .mockImplementation((element) => {
        const isFlow =
          element instanceof HTMLElement &&
          element.classList.contains("ebook-page-flow");
        return {
          columnGap: isFlow ? "44px" : "normal",
          columnWidth: isFlow ? "420px" : "auto",
          display: "block",
          getPropertyValue: () => "0px",
          paddingBottom: "0px",
          paddingTop: "0px",
          visibility: "visible",
        } as unknown as CSSStyleDeclaration;
      });

    try {
      render(
        <EBookPane
          menuLanguage="ja"
          onExitReadingFocus={onExitReadingFocus}
          readingFocusActive
          source={"# Chapter One\n\nbody one\n\n# Chapter Two\n\nbody two"}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("ページ 1 / 1")).toBeTruthy();
      });

      const article = screen.getByRole("article", { name: "本のように読む" });
      const nextPreview = article.querySelector(".ebook-next-chapter-preview");

      expect(nextPreview).toBeTruthy();
      expect(nextPreview?.textContent).toContain("Chapter Two");
      expect(nextPreview?.textContent).toContain("body two");
      expect(screen.getByText("章 1 / 2")).toBeTruthy();
      expect(article.querySelector(".ebook-reader-footer")?.textContent).toContain(
        "章: Chapter One",
      );

      fireEvent.click(screen.getByRole("button", { name: "編集に戻る" }));

      expect(onExitReadingFocus).toHaveBeenCalledWith(
        expect.objectContaining({
          chapterIndex: 0,
          pageIndex: 0,
        }),
      );
    } finally {
      getComputedStyleSpy.mockRestore();
      clientWidthGetter.mockRestore();
    }
  });

  it("offers a Japanese Reading Focus entry and reports the current reader location", async () => {
    vi.mocked(measureEBookPageCount).mockReturnValue(3);
    const onEnterReadingFocus = vi.fn();

    render(
      <EBookPane
        menuLanguage="ja"
        onEnterReadingFocus={onEnterReadingFocus}
        source={"# Chapter One\n\nbody one"}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("ページ 1 / 3")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "次のページ" }));
    const focusButton = screen.getByRole("button", { name: "集中して読む" });
    fireEvent.click(focusButton);

    expect(onEnterReadingFocus).toHaveBeenCalledWith(
      expect.objectContaining({
        chapterIndex: 0,
        pageIndex: 1,
      }),
    );
    expect(focusButton.classList.contains("ebook-reader-floating-action")).toBe(
      true,
    );
    expect(focusButton.closest(".ebook-reader-chrome")).toBeNull();
  });

  it("uses a focused reader variant with a return action", () => {
    const onExitReadingFocus = vi.fn();

    render(
      <EBookPane
        menuLanguage="ja"
        onExitReadingFocus={onExitReadingFocus}
        readingFocusActive
        source={"# Chapter One\n\nbody one"}
      />,
    );

    const article = screen.getByRole("article", { name: "本のように読む" });
    expect(article.classList.contains("ebook-pane-focus")).toBe(true);

    const exitButton = screen.getByRole("button", { name: "編集に戻る" });
    fireEvent.click(exitButton);

    expect(onExitReadingFocus).toHaveBeenCalledTimes(1);
    expect(exitButton.classList.contains("ebook-reader-floating-action")).toBe(
      true,
    );
    expect(exitButton.closest(".ebook-reader-chrome")).toBeNull();
  });

  it("shows a Reading Focus table of contents drawer and jumps to a chapter", async () => {
    const onLocationChange = vi.fn();

    render(
      <EBookPane
        menuLanguage="ja"
        onLocationChange={onLocationChange}
        readingFocusActive
        source={"# Chapter One\n\nbody one\n\n## Chapter Two\n\nbody two"}
      />,
    );

    const tocButton = screen.getByRole("button", { name: "目次" });
    expect(tocButton.classList.contains("ebook-reader-toc-toggle")).toBe(true);

    fireEvent.click(tocButton);

    const drawer = screen.getByRole("navigation", { name: "目次" });
    expect(drawer.classList.contains("ebook-reader-toc-panel")).toBe(true);
    expect(screen.getByRole("button", { name: "Chapter One" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Chapter Two" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Chapter Two" })).toBeTruthy();
    });
    expect(screen.queryByRole("heading", { name: "Chapter One" })).toBeNull();
    expect(screen.queryByRole("navigation", { name: "目次" })).toBeNull();
    expect(screen.getByText("章 2 / 2")).toBeTruthy();
    expect(screen.getByText("ページ 1 / 1")).toBeTruthy();
    expect(onLocationChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        chapterIndex: 1,
        pageIndex: 0,
      }),
    );
  });

  it("includes a source-line estimate with reader location updates", async () => {
    vi.mocked(measureEBookPageCount).mockReturnValue(3);
    const onEnterReadingFocus = vi.fn();

    render(
      <EBookPane
        menuLanguage="ja"
        onEnterReadingFocus={onEnterReadingFocus}
        source={[
          "# Chapter One",
          "",
          "line three",
          "line four",
          "line five",
          "line six",
        ].join("\n")}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("ページ 1 / 3")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "次のページ" }));
    fireEvent.click(screen.getByRole("button", { name: "集中して読む" }));

    expect(onEnterReadingFocus).toHaveBeenCalledWith(
      expect.objectContaining({
        chapterIndex: 0,
        pageIndex: 1,
        sourceLine: 4,
      }),
    );
  });

  it("keeps a source-line estimate inside the active chapter before the next heading", async () => {
    vi.mocked(measureEBookPageCount).mockReturnValue(3);
    const onEnterReadingFocus = vi.fn();

    render(
      <EBookPane
        menuLanguage="ja"
        onEnterReadingFocus={onEnterReadingFocus}
        source={[
          "# Chapter One",
          "",
          "body",
          "",
          "# Chapter Two",
          "",
          "next",
        ].join("\n")}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("ページ 1 / 3")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "次のページ" }));
    fireEvent.click(screen.getByRole("button", { name: "次のページ" }));
    fireEvent.click(screen.getByRole("button", { name: "集中して読む" }));

    expect(onEnterReadingFocus).toHaveBeenCalledWith(
      expect.objectContaining({
        chapterIndex: 0,
        pageIndex: 2,
        sourceLine: 4,
      }),
    );
  });

  it("resets to the next pathless document location when the document key changes", async () => {
    const { rerender } = render(
      <EBookPane
        documentKey="untitled-1"
        documentPath=""
        initialLocation={{ chapterIndex: 0, pageIndex: 0 }}
        menuLanguage="ja"
        source={"# One\n\nbody\n\n# Two\n\nbody"}
      />,
    );

    expect(screen.getByText("章 1 / 2")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "One" })).toBeTruthy();

    rerender(
      <EBookPane
        documentKey="untitled-2"
        documentPath=""
        initialLocation={{ chapterIndex: 1, pageIndex: 0 }}
        menuLanguage="ja"
        source={"# Alpha\n\nbody\n\n# Beta\n\nbody"}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("章 2 / 2")).toBeTruthy();
    });
    expect(screen.getByRole("heading", { name: "Beta" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Alpha" })).toBeNull();
  });

  it("syncs to a newer reader location for the same document key", async () => {
    vi.mocked(measureEBookPageCount).mockReturnValue(5);
    const { rerender } = render(
      <EBookPane
        documentKey="book"
        initialLocation={{ chapterIndex: 0, pageIndex: 0 }}
        menuLanguage="ja"
        source={"# Chapter One\n\nbody one"}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("ページ 1 / 5")).toBeTruthy();
    });

    rerender(
      <EBookPane
        documentKey="book"
        initialLocation={{ chapterIndex: 0, pageIndex: 2 }}
        menuLanguage="ja"
        source={"# Chapter One\n\nbody one"}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("ページ 3 / 5")).toBeTruthy();
    });
  });

  it("keeps the table of contents drawer exclusive to Reading Focus", () => {
    render(
      <EBookPane
        menuLanguage="ja"
        source={"# Chapter One\n\nbody one\n\n# Chapter Two\n\nbody two"}
      />,
    );

    expect(screen.queryByRole("button", { name: "目次" })).toBeNull();
    expect(screen.queryByRole("navigation", { name: "目次" })).toBeNull();
  });

  it("treats a leading image before the first heading as a standalone cover image page", async () => {
    vi.mocked(measureEBookPageCount).mockReturnValue(2);
    vi.mocked(openWorkspaceImage).mockResolvedValue({
      dataUrl: "data:image/jpeg;base64,COVER",
    } as Awaited<ReturnType<typeof openWorkspaceImage>>);

    render(
      <EBookPane
        documentPath="/workspace/ebook_chika_dokuhaku/book.md"
        menuLanguage="ja"
        source={
          "![](../assets/cover.jpg)\n\n\n# 重さのないノート\n\n本文です。"
        }
        workspaceRoot="/workspace"
      />,
    );

    const article = screen.getByRole("article", { name: "本のように読む" });
    const chapter = article.querySelector(".ebook-chapter");
    const image = article.querySelector(".ebook-page-flow .ebook-image-page > img");

    expect(chapter?.classList.contains("ebook-chapter-cover-image")).toBe(true);
    expect(chapter?.classList.contains("ebook-chapter-frontmatter")).toBe(true);
    expect(image).toBeTruthy();
    expect(image?.closest("p")).toBeNull();
    expect(screen.getByText("ページ 1 / 1")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "重さのないノート" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "次のページ" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "重さのないノート" }),
      ).toBeTruthy();
    });
  });

  it("turns half-scroll vertical wheel gestures into page navigation while keeping the page frame", async () => {
    vi.mocked(measureEBookPageCount).mockReturnValue(3);

    render(
      <EBookPane
        menuLanguage="en"
        source={"# Chapter One\n\nbody one\n\n# Chapter Two\n\nbody two"}
      />,
    );

    const article = screen.getByRole("article", { name: "Book reader" });
    await waitFor(() => {
      expect(screen.getByText("Page 1 / 3")).toBeTruthy();
    });

    fireEvent.wheel(article, { deltaY: 40 });

    expect(article.querySelector(".ebook-page-sheet")).toBeTruthy();
    expect(article.querySelector(".ebook-flow-document")).toBeNull();
    expect(screen.getByRole("heading", { name: "Chapter One" })).toBeTruthy();
    expect(screen.getByText("Page 2 / 3")).toBeTruthy();
  });

  it("renders only the active chapter and scopes pagination DOM to the chapter body", async () => {
    render(
      <EBookPane
        menuLanguage="ja"
        source={"# Chapter One\n\nbody one\n\n# Chapter Two\n\nbody two"}
      />,
    );

    const article = screen.getByRole("article", { name: "本のように読む" });
    expect(article.querySelectorAll(".ebook-chapter")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Chapter One" })).toBeTruthy();
    expect(screen.getByText("body one")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Chapter Two" })).toBeNull();
    expect(screen.getByText("章 1 / 2")).toBeTruthy();
    expect(screen.getByText("ページ 1 / 1")).toBeTruthy();
    expect(article.querySelector(".ebook-page-viewport")).toBeTruthy();
    expect(article.querySelector(".ebook-page-flow")).toBeTruthy();
    expect(
      article.querySelector(".ebook-reader-chrome .ebook-page-flow"),
    ).toBeNull();
    expect(article.querySelector(".ebook-page-sheet")).toBeTruthy();
    const footer = article.querySelector(".ebook-reader-footer");
    expect(footer).toBeTruthy();
    expect(footer?.closest(".ebook-page-flow")).toBeNull();
    expect(footer?.textContent).toContain("章: Chapter One");
    expect(footer?.textContent).toContain("章内ページ 1 / 1");

    fireEvent.click(screen.getByRole("button", { name: "次のページ" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Chapter Two" })).toBeTruthy();
    });
    expect(article.querySelectorAll(".ebook-chapter")).toHaveLength(1);
    expect(screen.getByText("body two")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Chapter One" })).toBeNull();
    expect(screen.getByText("章 2 / 2")).toBeTruthy();
    expect(article.querySelector(".ebook-reader-footer")?.textContent).toContain(
      "章: Chapter Two",
    );

    fireEvent.click(screen.getByRole("button", { name: "前のページ" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Chapter One" })).toBeTruthy();
    });
    expect(screen.queryByRole("heading", { name: "Chapter Two" })).toBeNull();
  });

  it("keeps the reader footer outside the paginated columns with chapter-local page numbers", async () => {
    vi.mocked(measureEBookPageCount).mockReturnValue(4);

    render(
      <EBookPane
        menuLanguage="en"
        source={"# Chapter One\n\nbody one"}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Page 1 / 4")).toBeTruthy();
    });

    const article = screen.getByRole("article", { name: "Book reader" });
    const sheet = article.querySelector(".ebook-page-sheet");
    const viewport = article.querySelector(".ebook-page-viewport");
    const flow = article.querySelector(".ebook-page-flow");
    const footer = article.querySelector(".ebook-reader-footer");

    expect(sheet).toBeTruthy();
    expect(sheet?.contains(viewport)).toBe(true);
    expect(sheet?.contains(footer)).toBe(true);
    expect(flow?.contains(footer)).toBe(false);
    expect(footer?.textContent).toContain("Chapter: Chapter One");
    expect(footer?.textContent).toContain("Chapter page 1 / 4");
    expect(footer?.textContent).not.toContain("Chapter 1 / 1");

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));

    expect(footer?.textContent).toContain("Chapter page 2 / 4");
  });

  it("disables reader controls at the document edges", () => {
    render(
      <EBookPane
        menuLanguage="ja"
        source={"# Chapter One\n\nbody one\n\n# Chapter Two\n\nbody two"}
      />,
    );

    const previous = screen.getByRole("button", { name: "前のページ" });
    const next = screen.getByRole("button", { name: "次のページ" });

    expect((previous as HTMLButtonElement).disabled).toBe(true);
    expect((next as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(next);

    expect((previous as HTMLButtonElement).disabled).toBe(false);
    expect((next as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows measured pages and moves within the active chapter before changing chapters", async () => {
    vi.mocked(measureEBookPageCount).mockReturnValue(3);

    render(
      <EBookPane
        menuLanguage="ja"
        source={"# Chapter One\n\nbody one\n\n# Chapter Two\n\nbody two"}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("ページ 1 / 3")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "次のページ" }));

    expect(screen.getByRole("heading", { name: "Chapter One" })).toBeTruthy();
    expect(screen.getByText("ページ 2 / 3")).toBeTruthy();
    expect(getEBookPageOffset).toHaveBeenCalledWith(
      1,
      expect.any(HTMLElement),
    );
    expect(
      vi.mocked(getEBookPageOffset).mock.calls.some(([, element]) => element === null),
    ).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "次のページ" }));
    fireEvent.click(screen.getByRole("button", { name: "次のページ" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Chapter Two" })).toBeTruthy();
    });
    expect(screen.getByText("章 2 / 2")).toBeTruthy();
    expect(screen.getByText("ページ 1 / 3")).toBeTruthy();
  });

  it("moves by the visible spread width when the viewport can show two pages", async () => {
    vi.mocked(measureEBookPageCount).mockReturnValue(5);
    const clientWidthGetter = vi
      .spyOn(HTMLElement.prototype, "clientWidth", "get")
      .mockImplementation(function getClientWidth(this: HTMLElement) {
        return this.classList.contains("ebook-page-viewport") ? 884 : 0;
      });
    const getComputedStyleSpy = vi
      .spyOn(window, "getComputedStyle")
      .mockImplementation((element) => {
        const isFlow =
          element instanceof HTMLElement &&
          element.classList.contains("ebook-page-flow");
        return {
          columnGap: isFlow ? "44px" : "normal",
          columnWidth: isFlow ? "420px" : "auto",
          display: "block",
          getPropertyValue: () => "0px",
          paddingBottom: "0px",
          paddingTop: "0px",
          visibility: "visible",
        } as unknown as CSSStyleDeclaration;
      });

    try {
      render(
        <EBookPane
          menuLanguage="ja"
          source={"# Chapter One\n\nbody one"}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("ページ 1 / 5")).toBeTruthy();
      });

      fireEvent.click(screen.getByRole("button", { name: "次のページ" }));
      expect(screen.getByText("ページ 3 / 5")).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "前のページ" }));
      expect(screen.getByText("ページ 1 / 5")).toBeTruthy();
    } finally {
      getComputedStyleSpy.mockRestore();
      clientWidthGetter.mockRestore();
    }
  });

  it("keeps one-page navigation when the viewport cannot show a spread", async () => {
    vi.mocked(measureEBookPageCount).mockReturnValue(5);
    const clientWidthGetter = vi
      .spyOn(HTMLElement.prototype, "clientWidth", "get")
      .mockImplementation(function getClientWidth(this: HTMLElement) {
        return this.classList.contains("ebook-page-viewport") ? 420 : 0;
      });
    const getComputedStyleSpy = vi
      .spyOn(window, "getComputedStyle")
      .mockImplementation((element) => {
        const isFlow =
          element instanceof HTMLElement &&
          element.classList.contains("ebook-page-flow");
        return {
          columnGap: isFlow ? "44px" : "normal",
          columnWidth: isFlow ? "420px" : "auto",
          display: "block",
          getPropertyValue: () => "0px",
          paddingBottom: "0px",
          paddingTop: "0px",
          visibility: "visible",
        } as unknown as CSSStyleDeclaration;
      });

    try {
      render(
        <EBookPane
          menuLanguage="ja"
          source={"# Chapter One\n\nbody one"}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("ページ 1 / 5")).toBeTruthy();
      });

      fireEvent.click(screen.getByRole("button", { name: "次のページ" }));
      expect(screen.getByText("ページ 2 / 5")).toBeTruthy();
    } finally {
      getComputedStyleSpy.mockRestore();
      clientWidthGetter.mockRestore();
    }
  });

  it("suppresses page-flow transition while resetting to the next chapter", async () => {
    vi.mocked(measureEBookPageCount).mockReturnValue(3);

    render(
      <EBookPane
        menuLanguage="en"
        source={"# Chapter One\n\nbody one\n\n# Chapter Two\n\nbody two"}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Page 1 / 3")).toBeTruthy();
    });

    const nextPage = screen.getByRole("button", { name: "Next page" });
    fireEvent.click(nextPage);
    expect(
      screen
        .getByRole("article", { name: "Book reader" })
        .querySelector(".ebook-page-flow-transition-suppressed"),
    ).toBeNull();

    fireEvent.click(nextPage);
    fireEvent.click(nextPage);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Chapter Two" })).toBeTruthy();
    });
    expect(
      screen
        .getByRole("article", { name: "Book reader" })
        .querySelector(".ebook-page-flow-transition-suppressed"),
    ).toBeTruthy();
  });

  it("connects one-page chapters to the next chapter from the next-page action", async () => {
    vi.mocked(measureEBookPageCount).mockReturnValue(1);

    render(
      <EBookPane
        menuLanguage="en"
        source={"# Chapter One\n\nbody one\n\n# Chapter Two\n\nbody two"}
      />,
    );

    expect(screen.getByText("Page 1 / 1")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Chapter Two" })).toBeTruthy();
    });
    expect(screen.getByText("Chapter 2 / 2")).toBeTruthy();
    expect(screen.getByText("Page 1 / 1")).toBeTruthy();
  });

  it("returns to the previous chapter's last measured page from the first page", async () => {
    vi.mocked(measureEBookPageCount).mockImplementation((element) =>
      element?.textContent?.includes("body one") ? 3 : 1,
    );

    render(
      <EBookPane
        menuLanguage="en"
        source={"# Chapter One\n\nbody one\n\n# Chapter Two\n\nbody two"}
      />,
    );

    const nextPage = screen.getByRole("button", { name: "Next page" });
    fireEvent.click(nextPage);
    fireEvent.click(nextPage);
    fireEvent.click(nextPage);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Chapter Two" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Chapter One" })).toBeTruthy();
      expect(screen.getByText("Page 3 / 3")).toBeTruthy();
    });
  });

  it("handles ArrowLeft and ArrowRight only from the focused reader root", async () => {
    render(
      <EBookPane
        menuLanguage="en"
        source={"# Chapter One\n\n[open](./other.md)\n\n# Chapter Two\n\nbody two"}
      />,
    );

    const article = screen.getByRole("article", { name: "Book reader" });
    const link = screen.getByRole("link", { name: "open" });

    fireEvent.keyDown(link, { key: "ArrowRight" });

    expect(screen.getByRole("heading", { name: "Chapter One" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Chapter Two" })).toBeNull();

    article.focus();
    fireEvent.keyDown(article, { key: "ArrowRight" });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Chapter Two" })).toBeTruthy();
    });
    expect(screen.queryByRole("heading", { name: "Chapter One" })).toBeNull();

    fireEvent.keyDown(article, { key: "ArrowLeft" });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Chapter One" })).toBeTruthy();
    });
    expect(screen.queryByRole("heading", { name: "Chapter Two" })).toBeNull();
  });

  it("handles Space and Shift+Space only from the focused reader root", async () => {
    vi.mocked(measureEBookPageCount).mockReturnValue(3);

    render(
      <EBookPane
        menuLanguage="en"
        source={"# Chapter One\n\n[open](./other.md)\n\nbody one"}
      />,
    );

    const article = screen.getByRole("article", { name: "Book reader" });
    const link = screen.getByRole("link", { name: "open" });

    await waitFor(() => {
      expect(screen.getByText("Page 1 / 3")).toBeTruthy();
    });

    fireEvent.keyDown(link, { key: " " });
    expect(screen.getByText("Page 1 / 3")).toBeTruthy();

    article.focus();
    fireEvent.keyDown(article, { key: " " });
    expect(screen.getByText("Page 2 / 3")).toBeTruthy();

    fireEvent.keyDown(article, { key: " ", shiftKey: true });
    expect(screen.getByText("Page 1 / 3")).toBeTruthy();
  });

  it("resets to the first chapter and first page when the document path changes", async () => {
    vi.mocked(measureEBookPageCount).mockReturnValue(3);
    const { rerender } = render(
      <EBookPane
        documentPath="/workspace/one.md"
        menuLanguage="en"
        source={"# Chapter One\n\nbody one\n\n# Chapter Two\n\nbody two"}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Page 2 / 3")).toBeTruthy();

    rerender(
      <EBookPane
        documentPath="/workspace/two.md"
        menuLanguage="en"
        source={"# Chapter One\n\nbody one\n\n# Chapter Two\n\nbody two"}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Chapter One" })).toBeTruthy();
      expect(screen.getByText("Page 1 / 3")).toBeTruthy();
    });
    expect(screen.queryByRole("heading", { name: "Chapter Two" })).toBeNull();
  });

  it("clamps the active chapter and page when source edits reduce available content", async () => {
    vi.mocked(measureEBookPageCount).mockReturnValue(3);
    const { rerender } = render(
      <EBookPane
        menuLanguage="en"
        source={
          "# Chapter One\n\nbody one\n\n# Chapter Two\n\nbody two\n\n# Chapter Three\n\nbody three"
        }
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Page 1 / 3")).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Page 3 / 3")).toBeTruthy();

    vi.mocked(measureEBookPageCount).mockReturnValue(1);
    rerender(
      <EBookPane
        menuLanguage="en"
        source={"# Chapter One\n\nbody one"}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Chapter One" })).toBeTruthy();
      expect(screen.getByText("Page 1 / 1")).toBeTruthy();
    });
    expect(screen.queryByRole("heading", { name: "Chapter Three" })).toBeNull();
    expect(screen.getByText("Chapter 1 / 1")).toBeTruthy();
  });

  it("labels preamble and heading-less documents without breaking display", () => {
    const { rerender } = render(
      <EBookPane
        menuLanguage="ja"
        source={"front matter\n\n# Chapter\n\nbody"}
      />,
    );

    expect(screen.getByText("前付")).toBeTruthy();
    expect(screen.getByText("front matter")).toBeTruthy();

    rerender(
      <EBookPane
        menuLanguage="en"
        source={"plain body without headings"}
      />,
    );

    expect(screen.getByText("Body")).toBeTruthy();
    expect(screen.getByText("plain body without headings")).toBeTruthy();
  });

  it("localizes the minimal reader chrome for ja, en, and kana", () => {
    const { rerender } = render(
      <EBookPane
        menuLanguage="ja"
        source={"# 一\n\n本文\n\n# 二\n\n続き"}
      />,
    );

    expect(screen.getByRole("button", { name: "前のページ" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "次のページ" })).toBeTruthy();

    rerender(
      <EBookPane
        menuLanguage="en"
        source={"# One\n\nbody\n\n# Two\n\nmore"}
      />,
    );

    expect(screen.getByRole("button", { name: "Previous page" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next page" })).toBeTruthy();

    rerender(
      <EBookPane
        menuLanguage="kana"
        source={"# 一\n\n本文\n\n# 二\n\n続き"}
      />,
    );

    expect(screen.getByRole("button", { name: "まへのページ" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "つぎのページ" })).toBeTruthy();
  });

  it("marks the opening H1 chapter as a cover-style opener", () => {
    render(
      <EBookPane
        menuLanguage="en"
        source={"# Title\n\nintro\n\n## Chapter\n\nbody"}
      />,
    );

    const chapter = screen
      .getByRole("article", { name: "Book reader" })
      .querySelector(".ebook-chapter");

    expect(chapter?.classList.contains("ebook-chapter-cover")).toBe(true);
    expect(chapter?.classList.contains("ebook-chapter-opener")).toBe(true);
    expect(chapter?.classList.contains("ebook-chapter-preamble")).toBe(false);
  });

  it("renders standalone page-break markers with the shared e-book helper", () => {
    render(
      <EBookPane
        menuLanguage="en"
        source={["# Chapter", "", "Before.", "", "---", "", "After."].join(
          "\n",
        )}
      />,
    );

    const article = screen.getByRole("article", { name: "Book reader" });
    expect(article.querySelectorAll(".page-break")).toHaveLength(1);
    expect(screen.queryByRole("separator", { name: "Page break" })).toBeTruthy();
  });
});

describe("EBookPane pagination measurement", () => {
  it("remeasures after workspace images are inlined", async () => {
    vi.mocked(openWorkspaceImage).mockResolvedValue({
      dataUrl: "data:image/png;base64,RESOLVED",
    } as Awaited<ReturnType<typeof openWorkspaceImage>>);

    render(
      <EBookPane
        documentPath="/workspace/note.md"
        source={"# Chapter\n\n![cat](./assets/cat.png)"}
        workspaceRoot="/workspace"
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("img")).toBeTruthy();
    });
    expect(
      vi.mocked(measureEBookPageCount).mock.calls.length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("promotes image-only paragraphs to atomic page units and remeasures already loaded images", async () => {
    const completeGetter = vi
      .spyOn(HTMLImageElement.prototype, "complete", "get")
      .mockReturnValue(true);
    vi.mocked(openWorkspaceImage).mockResolvedValue({
      dataUrl: "data:image/jpeg;base64,COVER",
    } as Awaited<ReturnType<typeof openWorkspaceImage>>);

    try {
      render(
        <EBookPane
          documentPath="/workspace/book.md"
          menuLanguage="ja"
          source={"# はじめに\n\n![cover](./assets/cover.jpg)\n\n本文です。"}
          workspaceRoot="/workspace"
        />,
      );

      await waitFor(() => {
        const image = screen.getByRole("img", { name: "cover" });
        const imagePage = image.closest(".ebook-image-page");
        expect(imagePage).toBeTruthy();
        expect(imagePage?.tagName).toBe("DIV");
        expect(image.closest("p")).toBeNull();
        expect(image.getAttribute("src")).toBe("data:image/jpeg;base64,COVER");
      });
      await waitFor(() => {
        expect(
          vi.mocked(measureEBookPageCount).mock.calls.length,
        ).toBeGreaterThanOrEqual(3);
      });
    } finally {
      completeGetter.mockRestore();
    }
  });

  it("passes the measured page content height to image page layout", () => {
    const clientHeightGetter = vi
      .spyOn(HTMLElement.prototype, "clientHeight", "get")
      .mockImplementation(function getClientHeight(this: HTMLElement) {
        return this.classList.contains("ebook-page-viewport") ? 700 : 0;
      });
    const getComputedStyleSpy = vi
      .spyOn(window, "getComputedStyle")
      .mockImplementation((element) => {
        const paddingBottom =
          element instanceof HTMLElement &&
          element.classList.contains("ebook-page-viewport")
            ? "24px"
            : "0px";
        return {
          display: "block",
          getPropertyValue: (property: string) =>
            property === "padding-bottom" ? paddingBottom : "0px",
          paddingBottom,
          paddingTop: "0px",
          visibility: "visible",
        } as CSSStyleDeclaration;
      });

    try {
      render(
        <EBookPane
          menuLanguage="ja"
          source={"# はじめに\n\n![cover](./assets/cover.jpg)\n\n本文です。"}
        />,
      );

      const flow = screen
        .getByRole("article", { name: "本のように読む" })
        .querySelector<HTMLElement>(".ebook-page-flow");

      expect(flow?.style.getPropertyValue("--ebook-page-viewport-height")).toBe(
        "676px",
      );
    } finally {
      getComputedStyleSpy.mockRestore();
      clientHeightGetter.mockRestore();
    }
  });
});

describe("EBookPane safety boundary (renderMarkdown reuse)", () => {
  it("strips raw <script> tags from the active chapter", () => {
    const source = [
      "# Chapter One",
      "",
      "<script>alert('xss')</script>",
      "",
      "safe text",
      "",
      "# Chapter Two",
      "",
      "<script>alert('xss2')</script>",
    ].join("\n");

    render(<EBookPane source={source} />);

    const article = screen.getByRole("article");
    expect(article.querySelectorAll("script")).toHaveLength(0);
    expect(article.textContent).not.toContain("alert('xss')");
    expect(article.textContent).not.toContain("alert('xss2')");

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));

    expect(article.querySelectorAll("script")).toHaveLength(0);
    expect(article.textContent).not.toContain("alert('xss')");
    expect(article.textContent).not.toContain("alert('xss2')");
  });

  it("blocks external image sources and keeps the workspace boundary intact", () => {
    const source =
      "# Chapter\n\n![remote](https://evil.example/cat.png)\n\n![local](./local.png)";

    render(<EBookPane source={source} />);

    const article = screen.getByRole("article");
    expect(article.querySelectorAll("img")).toHaveLength(0);
    expect(article.textContent).toContain("Image blocked");
  });

  it("resolves a workspace-relative image through inlineWorkspaceAssetImages", async () => {
    vi.mocked(openWorkspaceImage).mockResolvedValue({
      dataUrl: "data:image/png;base64,RESOLVED",
    } as Awaited<ReturnType<typeof openWorkspaceImage>>);

    render(
      <EBookPane
        documentPath="/workspace/note.md"
        source={"# Chapter\n\n![cat](./assets/cat.png)"}
        workspaceRoot="/workspace"
      />,
    );

    await waitFor(() => {
      const img = screen.getByRole("img");
      expect(img.getAttribute("src")).toBe("data:image/png;base64,RESOLVED");
      expect(img.hasAttribute("data-hazakura-image-path")).toBe(false);
    });
    expect(openWorkspaceImage).toHaveBeenCalledWith(
      "/workspace",
      "/workspace/assets/cat.png",
    );
  });

  it("shows a blocked-image note when openWorkspaceImage rejects", async () => {
    vi.mocked(openWorkspaceImage).mockRejectedValue(
      new Error("not found"),
    );

    render(
      <EBookPane
        documentPath="/workspace/note.md"
        source={"# Chapter\n\n![cat](./assets/cat.png)"}
        workspaceRoot="/workspace"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Image blocked/)).toBeTruthy();
    });
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("does not let a javascript: link survive sanitisation", () => {
    render(
      <EBookPane source={"# Chapter\n\n[trap](javascript:alert(1))"} />,
    );

    const article = screen.getByRole("article");
    const links = article.querySelectorAll("a[href]");
    for (const link of Array.from(links)) {
      expect(link.getAttribute("href")).not.toMatch(/^javascript:/i);
    }
  });
});

describe("EBookPane link routing", () => {
  it("prevents in-pane navigation and forwards the clicked href", () => {
    const onOpenLocalLink = vi.fn();
    render(
      <EBookPane
        onOpenLocalLink={onOpenLocalLink}
        source={"# Chapter\n\n[note](./other.md)"}
      />,
    );

    const link = screen.getByRole("link", { name: "note" });
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });

    const clickResult = link.dispatchEvent(event);

    expect(clickResult).toBe(false);
    expect(event.defaultPrevented).toBe(true);
    expect(onOpenLocalLink).toHaveBeenCalledWith("./other.md");
  });

  it("does not route clicks outside links", () => {
    const onOpenLocalLink = vi.fn();
    render(
      <EBookPane
        onOpenLocalLink={onOpenLocalLink}
        source={"# Chapter\n\nplain paragraph"}
      />,
    );

    fireEvent.click(screen.getByText("plain paragraph"));

    expect(onOpenLocalLink).not.toHaveBeenCalled();
  });
});
