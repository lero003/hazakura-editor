import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

describe("EBookPane chapter rendering", () => {
  it("renders one chapter section per ATX heading", () => {
    render(
      <EBookPane
        source={"# Chapter One\n\nbody one\n\n# Chapter Two\n\nbody two"}
      />,
    );

    const chapters = screen
      .getByRole("article")
      .querySelectorAll(".ebook-chapter");

    // Document starts with a heading, so the empty preamble is dropped
    // and two chapter sections remain.
    expect(chapters).toHaveLength(2);
    expect(chapters[0].textContent).toContain("Chapter One");
    expect(chapters[0].textContent).toContain("body one");
    expect(chapters[1].textContent).toContain("Chapter Two");
    expect(chapters[1].textContent).toContain("body two");
  });

  it("keeps a non-empty preamble as a front-matter chapter", () => {
    render(
      <EBookPane
        source={"Front matter text.\n\n# Chapter One\n\nbody"}
      />,
    );

    const chapters = screen
      .getByRole("article")
      .querySelectorAll(".ebook-chapter");

    expect(chapters).toHaveLength(2);
    expect(chapters[0].classList.contains("ebook-chapter-preamble")).toBe(true);
    expect(chapters[0].textContent).toContain("Front matter text.");
    expect(chapters[1].textContent).toContain("Chapter One");
  });

  it("marks the opening H1 chapter as a cover page", () => {
    // A document that starts with an H1 reads as a title page: the
    // first visible chapter carries the cover treatment, subsequent
    // chapters are plain page sheets.
    render(
      <EBookPane
        source={"# Title\n\nintro\n\n## Chapter\n\nbody"}
      />,
    );

    const chapters = screen
      .getByRole("article")
      .querySelectorAll(".ebook-chapter");

    expect(chapters[0].classList.contains("ebook-chapter-cover")).toBe(true);
    expect(chapters[0].classList.contains("ebook-chapter-opener")).toBe(true);
    // The H1 chapter is not a preamble.
    expect(chapters[0].classList.contains("ebook-chapter-preamble")).toBe(false);
    // A following non-opening chapter is a plain sheet.
    expect(chapters[1].classList.contains("ebook-chapter-opener")).toBe(false);
    expect(chapters[1].classList.contains("ebook-chapter-cover")).toBe(false);
  });

  it("marks the opening preamble as front matter", () => {
    render(
      <EBookPane source={"preface text\n\n# Chapter\n\nbody"} />,
    );

    const chapters = screen
      .getByRole("article")
      .querySelectorAll(".ebook-chapter");

    expect(chapters[0].classList.contains("ebook-chapter-frontmatter")).toBe(true);
    expect(chapters[0].classList.contains("ebook-chapter-cover")).toBe(false);
    // The following H1 is not the opener (the preamble is), so it is a
    // plain chapter sheet.
    expect(chapters[1].classList.contains("ebook-chapter-opener")).toBe(false);
  });

  it("renders a thin chapter navigation for preamble, headings, and heading-less documents", () => {
    const { rerender } = render(
      <EBookPane
        source={"preface text\n\n# Title\n\nintro\n\n## Chapter\n\nbody"}
      />,
    );

    const nav = screen.getByRole("navigation", { name: "章" });
    expect(nav.querySelectorAll(".ebook-nav-item")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "前付" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Title" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Chapter" })).toBeTruthy();

    rerender(<EBookPane source={"plain body without headings"} />);

    expect(screen.getByRole("button", { name: "本文" })).toBeTruthy();
  });

  it("scrolls the matching chapter into view from the chapter navigation", () => {
    const scrollIntoView = vi.fn();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    try {
      render(
        <EBookPane
          source={"# Title\n\nintro\n\n## Chapter One\n\nbody\n\n## Chapter Two\n\nmore"}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Chapter Two" }));

      expect(scrollIntoView).toHaveBeenCalledWith({
        block: "start",
        behavior: "smooth",
      });
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    }
  });
});

describe("EBookPane safety boundary (renderMarkdown reuse)", () => {
  it("strips a raw <script> tag across all chapters", () => {
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
  });

  it("blocks external image sources and keeps the workspace boundary intact", () => {
    // Without a workspaceRoot, both a workspace-relative image and an
    // external image must be replaced by a blocked-image note — the
    // renderMarkdown policy must never fetch either.
    const source =
      "# Chapter\n\n![remote](https://evil.example/cat.png)\n\n![local](./local.png)";

    render(<EBookPane source={source} />);

    const article = screen.getByRole("article");
    expect(article.querySelectorAll("img")).toHaveLength(0);
    expect(article.textContent).toContain("Image blocked");
  });

  it("resolves a workspace-relative image through inlineWorkspaceAssetImages", async () => {
    // Regression for the v0.21 Slice 1 image bug: a workspace image in a
    // chapter must be inlined into an <img> once openWorkspaceImage
    // resolves. This mirrors what PreviewPane does.
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

    // The async resolution lands after the first paint. Re-query the img
    // inside waitFor so we read the live DOM attribute after React
    // applies the inlined HTML, not a stale element reference.
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
    // If the workspace image cannot be read (missing file, outside the
    // workspace, decode error), the image becomes a blocked note rather
    // than a broken <img> — matching the Preview behaviour.
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
    // The dangerous href is stripped; either no link remains or the
    // href is neutralised. Either way it cannot be a javascript: URL.
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
