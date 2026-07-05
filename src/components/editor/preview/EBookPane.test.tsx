import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactElement } from "react";
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

// v0.34: 本番では200msデバウンスで marked + DOMPurify を間引くが、テストでは
// マイクロタスク遅延(setTimeout 0)で実行し、renderEBookPane で settle を待つ。
vi.mock("../../../features/editor/previewRenderDebounce", () => ({
  schedulePreviewRender: (callback: () => void) => {
    const handle = setTimeout(callback, 0);
    return () => clearTimeout(handle);
  },
}));

// v0.34: render をラップし、デバウンスされた章レンダリングが settle するまで
// 待つ。これにより以降の同期クエリがレンダリング済み DOM を参照できる。
async function renderEBookPane(ui: React.ReactElement) {
  const result = render(ui);
  await waitFor(() => {
    // 章コンテンツが描画されるか、空ソースで章なしになるまで待つ。
    const flow = result.container.querySelector(".ebook-flow-document");
    if (flow && flow.innerHTML.length > 0) return;
    if (
      !result.container.querySelector(".ebook-chapter") &&
      !result.container.querySelector(".ebook-flow-document")
    ) {
      throw new Error("not settled");
    }
  }).catch(() => {
    // 空ソース等で章が描画されない場合は続行。
  });
  return result;
}

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
  it("treats only H1 and H2 as chapter boundaries, keeping H3 inline", async () => {
    // A long document with many `###` entries must not fragment into dozens
    // of one-screen chapters. H3 and below stay inside the preceding H1/H2
    // chapter as in-chapter subheadings.
    render(
      <EBookPane
        menuLanguage="en"
        source={
          "# Part One\n\nintro\n\n### Sub A\n\nbody a\n\n### Sub B\n\nbody b\n\n# Part Two\n\nbody two"
        }
      />,
    );

    expect(screen.getByRole("heading", { name: "Part One" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Sub A" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Sub B" })).toBeTruthy();
    expect(screen.getByText("Chapter 1 / 2")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));

    // The two H3 subsections stayed inside Part One, so the next chapter is
    // Part Two, not Sub A.
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Part Two" })).toBeTruthy();
    });
    expect(screen.getByText("Chapter 2 / 2")).toBeTruthy();
  });

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
    // v0.33: 集中/戻るは進捗下の操作帯（chrome 内の toolbar）
    expect(focusButton.closest(".ebook-reader-toolbar")).not.toBeNull();
    expect(focusButton.closest(".ebook-reader-chrome")).not.toBeNull();
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
    expect(exitButton.closest(".ebook-reader-toolbar")).not.toBeNull();
    expect(exitButton.closest(".ebook-reader-chrome")).not.toBeNull();
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
    // v0.33: 目次ボタンも右上の浮遊ツール群
    expect(tocButton.closest(".ebook-reader-toolbar")).not.toBeNull();
    expect(tocButton.closest(".ebook-reader-chrome")).not.toBeNull();

    fireEvent.click(tocButton);

    const drawer = screen.getByRole("navigation", { name: "目次" });
    expect(drawer.classList.contains("ebook-reader-toc-panel")).toBe(true);
    expect(screen.getByRole("button", { name: /^Chapter One/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^Chapter Two/ }));

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

  it("adds bounded subheading context and measured progress to the current TOC chapter", async () => {
    vi.mocked(measureEBookPageCount).mockReturnValue(3);
    await renderEBookPane(
      <EBookPane
        menuLanguage="ja"
        readingFocusActive
        source={[
          "# 第一章",
          "intro",
          "### 場面A",
          "A",
          "#### 場面B",
          "B",
          "### 場面C",
          "C",
          "## 第二章",
          "end",
        ].join("\n")}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "目次" }));

    const firstChapter = screen.getByRole("button", { name: /^第一章/ });
    // v1.5 dense 化: 小見出しプレビューが最大 4 件になったため、
    // 場面A/B/C はすべて表示され「ほかN件」は出ない。
    expect(
      firstChapter.querySelector(".ebook-reader-toc-subheadings")?.textContent,
    ).toContain("場面A・場面B・場面C");
    expect(
      firstChapter.querySelector(".ebook-reader-toc-subheadings")?.textContent,
    ).not.toContain("ほか");
    expect(
      firstChapter.querySelector(".ebook-reader-toc-progress")?.textContent,
    ).toBe("ページ 1 / 3");

    // 非現章はまだページ計測が走っていないため進捗は null。
    const secondChapter = screen.getByRole("button", { name: /^第二章/ });
    expect(
      secondChapter.querySelector(".ebook-reader-toc-progress"),
    ).toBeNull();
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
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Beta" })).toBeTruthy();
    });
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

  it("does not report passive reader location changes caused by source edits", async () => {
    const onLocationChange = vi.fn();
    const { rerender } = render(
      <EBookPane
        documentKey="book"
        initialLocation={{ chapterIndex: 1, pageIndex: 0 }}
        menuLanguage="ja"
        onLocationChange={onLocationChange}
        source={"# Chapter One\n\nbody one\n\n## Chapter Two\n\nbody two"}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("章 2 / 2")).toBeTruthy();
    });
    onLocationChange.mockClear();

    rerender(
      <EBookPane
        documentKey="book"
        initialLocation={{ chapterIndex: 1, pageIndex: 0 }}
        menuLanguage="ja"
        onLocationChange={onLocationChange}
        source={"# Chapter One\n\nbody one\n\nChapter Two\n\nbody two"}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("章 1 / 1")).toBeTruthy();
    });
    expect(onLocationChange).not.toHaveBeenCalled();
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

  it("opens a previewed one-page next chapter without skipping it", async () => {
    vi.mocked(measureEBookPageCount).mockImplementation((element) => {
      const text = element?.textContent ?? "";
      if (text.includes("body one")) {
        return 3;
      }
      if (text.includes("Part Two")) {
        return 1;
      }
      if (text.includes("body two")) {
        return 3;
      }
      return 1;
    });
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
          (element.classList.contains("ebook-page-flow") ||
            element.classList.contains("ebook-next-chapter-preview-flow"));
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
          menuLanguage="en"
          readingFocusActive
          source={
            "# Chapter One\n\nbody one\n\n# Part Two\n\n# Chapter Two\n\nbody two"
          }
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("Page 1 / 3")).toBeTruthy();
      });

      fireEvent.click(screen.getByRole("button", { name: "Next page" }));
      expect(screen.getByText("Page 3 / 3")).toBeTruthy();
      expect(
        screen
          .getByRole("article", { name: "Book reader" })
          .querySelector(".ebook-next-chapter-preview")?.textContent,
      ).toContain("Part Two");

      fireEvent.click(screen.getByRole("button", { name: "Next page" }));

      // The one-page Part Two was already previewed on the spare right
      // spread page, so the turn lands on Part Two itself (page 1/1) rather
      // than skipping over it to Chapter Two. Empty heading-only chapters
      // are still shown, not skipped.
      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "Part Two" })).toBeTruthy();
      });
      expect(screen.getByText("Chapter 2 / 3")).toBeTruthy();
      expect(screen.getByText("Page 1 / 1")).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "Next page" }));

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "Chapter Two" })).toBeTruthy();
      });
      expect(screen.getByText("Chapter 3 / 3")).toBeTruthy();
      // Part Two is a one-page chapter, so while it was shown its spare right
      // spread page previewed Chapter Two's opener. The turn therefore
      // continues one page past that previewed opener (Page 2 / 3) instead of
      // jumping back to Page 1 / 3 — no backwards jump, no skipped page.
      expect(screen.getByText("Page 2 / 3")).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "Previous page" }));

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "Part Two" })).toBeTruthy();
      });
      expect(screen.getByText("Chapter 2 / 3")).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "Previous page" }));

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "Chapter One" })).toBeTruthy();
      });
      expect(screen.getByText("Chapter 1 / 3")).toBeTruthy();
      expect(screen.getByText("Page 3 / 3")).toBeTruthy();
      expect(
        screen
          .getByRole("article", { name: "Book reader" })
          .querySelector(".ebook-next-chapter-preview")?.textContent,
      ).toContain("Part Two");
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

  it("suppresses page-flow transition while resetting to the next chapter then releases it", async () => {
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

    const article = screen.getByRole("article", { name: "Book reader" });
    const nextPage = screen.getByRole("button", { name: "Next page" });
    fireEvent.click(nextPage);
    // Within the same chapter the slide transition stays enabled.
    expect(
      article.querySelector(".ebook-page-flow-transition-suppressed"),
    ).toBeNull();

    fireEvent.click(nextPage);
    fireEvent.click(nextPage);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Chapter Two" })).toBeTruthy();
    });
    // Once the new chapter's HTML is measured and the page offset settled,
    // the one-shot chapter-cross suppression is released so later
    // in-chapter flips animate again. Previously it stayed on forever.
    await waitFor(() => {
      expect(
        article.querySelector(".ebook-page-flow-transition-suppressed"),
      ).toBeNull();
    });
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

  it("opens an unseen multi-page next chapter from its first page in single-page mode", async () => {
    // Without a spare right spread page there is no next-chapter preview, so
    // a chapter cross must land on the next chapter's opener (pageIndex 0)
    // even when the current chapter ends mid-step. This is the epub-like
    // rule: an unseen chapter always opens from its first page.
    vi.mocked(measureEBookPageCount).mockImplementation((element) =>
      element?.textContent?.includes("body one") ? 3 : 4,
    );

    render(
      <EBookPane
        menuLanguage="en"
        source={"# Chapter One\n\nbody one\n\n# Chapter Two\n\nbody two"}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Page 1 / 3")).toBeTruthy();
    });

    // Step through Chapter One to its last page, then cross into Chapter Two.
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Page 2 / 3")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Page 3 / 3")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Chapter Two" })).toBeTruthy();
    });
    expect(screen.getByText("Chapter 2 / 2")).toBeTruthy();
    // No preview was shown, so Chapter Two opens from Page 1 / 4, not past it.
    expect(screen.getByText("Page 1 / 4")).toBeTruthy();
  });

  it("does not advance pages while an arrow key is held (OS auto-repeat)", async () => {
    vi.mocked(measureEBookPageCount).mockReturnValue(5);

    render(
      <EBookPane
        menuLanguage="en"
        source={"# Chapter One\n\nbody one"}
      />,
    );

    const article = screen.getByRole("article", { name: "Book reader" });
    await waitFor(() => {
      expect(screen.getByText("Page 1 / 5")).toBeTruthy();
    });

    article.focus();
    // A single physical press.
    fireEvent.keyDown(article, { key: "ArrowRight" });
    expect(screen.getByText("Page 2 / 5")).toBeTruthy();

    // OS auto-repeat fires further keydowns with repeat: true while the key
    // stays held. These must be ignored so the page does not outrun the
    // state update and skip pages.
    fireEvent.keyDown(article, { key: "ArrowRight", repeat: true });
    fireEvent.keyDown(article, { key: "ArrowRight", repeat: true });
    fireEvent.keyDown(article, { key: "ArrowRight", repeat: true });

    expect(screen.getByText("Page 2 / 5")).toBeTruthy();
    expect(document.activeElement).toBe(article);
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

  it("handles ArrowLeft and ArrowRight from the reader root or a focused child", async () => {
    render(
      <EBookPane
        menuLanguage="en"
        source={"# Chapter One\n\n[open](./other.md)\n\n# Chapter Two\n\nbody two"}
      />,
    );

    const article = screen.getByRole("article", { name: "Book reader" });
    const link = screen.getByRole("link", { name: "open" });

    // Focus can drift from the article root to a rendered child (e.g. a
    // link). The reader must still page with the keyboard from there and
    // refocus the article so further flips keep working.
    link.focus();
    fireEvent.keyDown(link, { key: "ArrowRight" });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Chapter Two" })).toBeTruthy();
    });
    expect(screen.queryByRole("heading", { name: "Chapter One" })).toBeNull();
    expect(document.activeElement).toBe(article);

    fireEvent.keyDown(article, { key: "ArrowLeft" });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Chapter One" })).toBeTruthy();
    });
    expect(screen.queryByRole("heading", { name: "Chapter Two" })).toBeNull();
  });

  it("handles Space and Shift+Space from the reader root or a focused child", async () => {
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

    link.focus();
    fireEvent.keyDown(link, { key: " " });
    expect(screen.getByText("Page 2 / 3")).toBeTruthy();
    expect(document.activeElement).toBe(article);

    fireEvent.keyDown(article, { key: " ", shiftKey: true });
    expect(screen.getByText("Page 1 / 3")).toBeTruthy();
  });

  it("keeps flipping pages on repeated ArrowRight even on a single-page chapter", async () => {
    render(
      <EBookPane
        menuLanguage="en"
        source={"# Only Chapter\n\nsingle page body"}
      />,
    );

    const article = screen.getByRole("article", { name: "Book reader" });
    article.focus();

    // On a single-page chapter the page state cannot advance, but the
    // reader must stay focused so rapid key presses do not fall through
    // to the editor pane.
    fireEvent.keyDown(article, { key: "ArrowRight" });
    fireEvent.keyDown(article, { key: "ArrowRight" });
    fireEvent.keyDown(article, { key: "ArrowRight" });

    expect(document.activeElement).toBe(article);
    expect(screen.getByText("Chapter 1 / 1")).toBeTruthy();
  });

  // Regression: the reader article and the editor CodeMirror are DOM
  // siblings, so a keydown that fires while the editor (here simulated by
  // an unrelated focusable element) owns focus never reaches the article
  // via bubbling. A document-level capture-phase listener must intercept
  // arrow-key paging regardless of where focus is, so the reader can flip
  // pages without first clicking into the reader pane.
  it("pages with arrow keys even when focus is outside the reader article", async () => {
    render(
      <EBookPane
        menuLanguage="en"
        source={"# Chapter One\n\nbody one\n\n# Chapter Two\n\nbody two"}
      />,
    );

    const article = screen.getByRole("article", { name: "Book reader" });
    // Simulate the editor still holding focus (a sibling focusable node).
    const editorStandIn = document.createElement("div");
    editorStandIn.tabIndex = 0;
    document.body.append(editorStandIn);
    editorStandIn.focus();
    expect(document.activeElement).toBe(editorStandIn);

    fireEvent.keyDown(editorStandIn, { key: "ArrowRight" });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Chapter Two" })).toBeTruthy();
    });
    expect(document.activeElement).toBe(article);

    fireEvent.keyDown(article, { key: "ArrowLeft" });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Chapter One" })).toBeTruthy();
    });
  });

  it("does not hijack arrow keys while composing or inside a form field", async () => {
    render(
      <EBookPane
        menuLanguage="en"
        source={"# Chapter One\n\nbody one\n\n# Chapter Two\n\nbody two"}
      />,
    );

    const article = screen.getByRole("article", { name: "Book reader" });
    article.focus();

    // While IME is composing, the reader must not intercept the key.
    fireEvent.keyDown(article, { key: "ArrowRight", isComposing: true });
    expect(screen.queryByRole("heading", { name: "Chapter Two" })).toBeNull();

    // While a form field owns focus, the reader must defer.
    const field = document.createElement("input");
    document.body.append(field);
    field.focus();
    fireEvent.keyDown(field, { key: "ArrowRight" });
    expect(screen.queryByRole("heading", { name: "Chapter Two" })).toBeNull();
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

  it("labels preamble and heading-less documents without breaking display", async () => {
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

    // v0.34: rerender によるソース変更後はデバウンスされた再レンダリングを待つ。
    await waitFor(() => {
      expect(screen.getByText("Body")).toBeTruthy();
      expect(screen.getByText("plain body without headings")).toBeTruthy();
    });
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
    // v0.34: 画像インライン後の再計測は rAF coalesce 経由になったため、
    // rAF が発火して measureEBookPageCount が呼ばれるまで待つ。
    await waitFor(() => {
      expect(
        vi.mocked(measureEBookPageCount).mock.calls.length,
      ).toBeGreaterThanOrEqual(2);
    });
  });

  it("ignores a pending image remeasure after moving to another chapter", async () => {
    let chapterOneRemeasure = false;
    const frameCallbacks: FrameRequestCallback[] = [];
    const completeGetter = vi
      .spyOn(HTMLImageElement.prototype, "complete", "get")
      .mockReturnValue(false);
    const requestFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        frameCallbacks.push(callback);
        return frameCallbacks.length;
      });
    const cancelFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => undefined);

    vi.mocked(measureEBookPageCount).mockImplementation((element) => {
      const text = element?.textContent ?? "";
      if (text.includes("Chapter One")) {
        return chapterOneRemeasure ? 7 : 1;
      }
      return 1;
    });

    try {
      render(
        <EBookPane
          menuLanguage="en"
          source={
            "# Chapter One\n\n![cover](data:image/png;base64,iVBORw0KGgo=)\n\nbody one\n\n# Chapter Two\n\nbody two"
          }
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("Page 1 / 1")).toBeTruthy();
      });

      const image = screen.getByRole("img", { name: "cover" });
      chapterOneRemeasure = true;
      fireEvent.load(image);
      expect(frameCallbacks).toHaveLength(1);

      fireEvent.click(screen.getByRole("button", { name: "Next page" }));
      expect(screen.getByText("Chapter 2 / 2")).toBeTruthy();

      await act(async () => {
        for (const callback of frameCallbacks.splice(0)) {
          callback(0);
        }
      });

      expect(screen.getByText("Page 1 / 1")).toBeTruthy();
      expect(screen.queryByText("Page 1 / 7")).toBeNull();
    } finally {
      cancelFrameSpy.mockRestore();
      requestFrameSpy.mockRestore();
      completeGetter.mockRestore();
    }
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
