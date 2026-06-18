import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openWorkspaceImage } from "../../../lib/tauri";
import EBookPane from "./EBookPane";

vi.mock("../../../lib/tauri", () => ({
  openWorkspaceImage: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.mocked(openWorkspaceImage).mockReset();
});

describe("EBookPane chapter reader", () => {
  it("renders only the active chapter and switches with reader controls", () => {
    render(
      <EBookPane
        menuLanguage="ja"
        source={"# Chapter One\n\nbody one\n\n# Chapter Two\n\nbody two"}
      />,
    );

    const article = screen.getByRole("article", { name: "章送り" });
    expect(article.querySelectorAll(".ebook-chapter")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Chapter One" })).toBeTruthy();
    expect(screen.getByText("body one")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Chapter Two" })).toBeNull();
    expect(screen.getByText("1 / 2")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "次の章" }));

    expect(article.querySelectorAll(".ebook-chapter")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Chapter Two" })).toBeTruthy();
    expect(screen.getByText("body two")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Chapter One" })).toBeNull();
    expect(screen.getByText("2 / 2")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "前の章" }));

    expect(screen.getByRole("heading", { name: "Chapter One" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Chapter Two" })).toBeNull();
  });

  it("disables reader controls at the document edges", () => {
    render(
      <EBookPane
        menuLanguage="ja"
        source={"# Chapter One\n\nbody one\n\n# Chapter Two\n\nbody two"}
      />,
    );

    const previous = screen.getByRole("button", { name: "前の章" });
    const next = screen.getByRole("button", { name: "次の章" });

    expect((previous as HTMLButtonElement).disabled).toBe(true);
    expect((next as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(next);

    expect((previous as HTMLButtonElement).disabled).toBe(false);
    expect((next as HTMLButtonElement).disabled).toBe(true);
  });

  it("handles ArrowLeft and ArrowRight only from the focused reader root", () => {
    render(
      <EBookPane
        menuLanguage="en"
        source={"# Chapter One\n\n[open](./other.md)\n\n# Chapter Two\n\nbody two"}
      />,
    );

    const article = screen.getByRole("article", { name: "Chapter reader" });
    const link = screen.getByRole("link", { name: "open" });

    fireEvent.keyDown(link, { key: "ArrowRight" });

    expect(screen.getByRole("heading", { name: "Chapter One" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Chapter Two" })).toBeNull();

    article.focus();
    fireEvent.keyDown(article, { key: "ArrowRight" });

    expect(screen.getByRole("heading", { name: "Chapter Two" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Chapter One" })).toBeNull();

    fireEvent.keyDown(article, { key: "ArrowLeft" });

    expect(screen.getByRole("heading", { name: "Chapter One" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Chapter Two" })).toBeNull();
  });

  it("resets to the first chapter when the document path changes", () => {
    const { rerender } = render(
      <EBookPane
        documentPath="/workspace/one.md"
        menuLanguage="en"
        source={"# Chapter One\n\nbody one\n\n# Chapter Two\n\nbody two"}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Next chapter" }));
    expect(screen.getByRole("heading", { name: "Chapter Two" })).toBeTruthy();

    rerender(
      <EBookPane
        documentPath="/workspace/two.md"
        menuLanguage="en"
        source={"# Chapter One\n\nbody one\n\n# Chapter Two\n\nbody two"}
      />,
    );

    expect(screen.getByRole("heading", { name: "Chapter One" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Chapter Two" })).toBeNull();
  });

  it("clamps the active chapter when source edits reduce the chapter count", () => {
    const { rerender } = render(
      <EBookPane
        menuLanguage="en"
        source={
          "# Chapter One\n\nbody one\n\n# Chapter Two\n\nbody two\n\n# Chapter Three\n\nbody three"
        }
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Next chapter" }));
    fireEvent.click(screen.getByRole("button", { name: "Next chapter" }));
    expect(screen.getByRole("heading", { name: "Chapter Three" })).toBeTruthy();

    rerender(
      <EBookPane
        menuLanguage="en"
        source={"# Chapter One\n\nbody one"}
      />,
    );

    expect(screen.getByRole("heading", { name: "Chapter One" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Chapter Three" })).toBeNull();
    expect(screen.getByText("1 / 1")).toBeTruthy();
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

    expect(screen.getByRole("button", { name: "前の章" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "次の章" })).toBeTruthy();

    rerender(
      <EBookPane
        menuLanguage="en"
        source={"# One\n\nbody\n\n# Two\n\nmore"}
      />,
    );

    expect(screen.getByRole("button", { name: "Previous chapter" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next chapter" })).toBeTruthy();

    rerender(
      <EBookPane
        menuLanguage="kana"
        source={"# 一\n\n本文\n\n# 二\n\n続き"}
      />,
    );

    expect(screen.getByRole("button", { name: "まへの章" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "つぎの章" })).toBeTruthy();
  });

  it("marks the opening H1 chapter as a cover-style opener", () => {
    render(
      <EBookPane
        menuLanguage="en"
        source={"# Title\n\nintro\n\n## Chapter\n\nbody"}
      />,
    );

    const chapter = screen
      .getByRole("article", { name: "Chapter reader" })
      .querySelector(".ebook-chapter");

    expect(chapter?.classList.contains("ebook-chapter-cover")).toBe(true);
    expect(chapter?.classList.contains("ebook-chapter-opener")).toBe(true);
    expect(chapter?.classList.contains("ebook-chapter-preamble")).toBe(false);
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

    fireEvent.click(screen.getByRole("button", { name: "Next chapter" }));

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
