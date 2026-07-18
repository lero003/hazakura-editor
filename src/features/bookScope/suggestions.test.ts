import { describe, expect, it } from "vitest";
import { suggestBookScopeFromDiscovery } from "./suggestions";

function discovery(
  files: Array<{ relativePath: string; content: string | null }>,
  options: { cancelled?: boolean; truncated?: boolean } = {},
) {
  return {
    bundleRoot: "/workspace",
    files: files.map((file) => ({
      ...file,
      byteLength: file.content?.length ?? 0,
      unreadableReason: file.content === null ? "io-error" : null,
    })),
    scannedEntries: files.length,
    scannedMarkdownFiles: files.length,
    totalBytesRead: files.reduce(
      (total, file) => total + (file.content?.length ?? 0),
      0,
    ),
    truncated: options.truncated ?? false,
    truncationReason: options.truncated ? "markdown-files" : null,
    cancelled: options.cancelled ?? false,
  };
}

describe("Book Scope chapter suggestions", () => {
  it("prioritizes readable chapter links from the root index", () => {
    const result = suggestBookScopeFromDiscovery(
      discovery([
        {
          relativePath: "index.md",
          content: "# Book\n\n[Second](chapters/02.md)\n[First](chapters/01)\n",
        },
        { relativePath: "chapters/01.md", content: "# First\n" },
        { relativePath: "chapters/02.md", content: "# Second\n" },
        { relativePath: "appendix.md", content: "# Appendix\n" },
      ]),
      { includeIndexPages: false },
    );

    expect(result.chapterRelativePaths).toEqual([
      "chapters/02.md",
      "chapters/01.md",
      "appendix.md",
    ]);
    expect(result.linkedChapterCount).toBe(2);
  });

  it("follows linked nested indexes to preserve multi-book chapter order", () => {
    const result = suggestBookScopeFromDiscovery(
      discovery([
        {
          relativePath: "index.md",
          content:
            "# Collection\n\n[Book two](books/02/index.md)\n[Book one](books/01/index.md)\n[Afterword](notes/afterword.md)\n",
        },
        {
          relativePath: "books/01/index.md",
          content:
            "# Book one\n\n[First](chapters/01.md)\n[Second](chapters/02.md)\n[Self](index.md)\n[Back](../../index.md)\n[Shared afterword](../../notes/afterword.md)\n",
        },
        {
          relativePath: "books/02/index.md",
          content:
            "# Book two\n\n[Opening](chapters/00.md)\n[Ending](chapters/09.md)\n[Shared afterword](../../notes/afterword.md)\n",
        },
        { relativePath: "books/01/chapters/01.md", content: "# First\n" },
        { relativePath: "books/01/chapters/02.md", content: "# Second\n" },
        { relativePath: "books/02/chapters/00.md", content: "# Opening\n" },
        { relativePath: "books/02/chapters/09.md", content: "# Ending\n" },
        { relativePath: "notes/afterword.md", content: "# Afterword\n" },
      ]),
      { includeIndexPages: true },
    );

    expect(result.chapterRelativePaths).toEqual([
      "index.md",
      "books/02/index.md",
      "books/02/chapters/00.md",
      "books/02/chapters/09.md",
      "books/01/index.md",
      "books/01/chapters/01.md",
      "books/01/chapters/02.md",
      "notes/afterword.md",
    ]);
    expect(result.linkedChapterCount).toBe(5);
    expect(result.includedIndexPageCount).toBe(3);
    expect(result.excludedSupportFileCount).toBe(0);
  });

  it("excludes OKF support files, unreadable files, duplicate and external links", () => {
    const result = suggestBookScopeFromDiscovery(
      discovery([
        {
          relativePath: "index.md",
          content:
            "[One](one.md) [Again](one.md) [Web](https://example.com) [Log](log.md)",
        },
        { relativePath: "one.md", content: "# One\n" },
        { relativePath: "log.md", content: "# Log\n" },
        { relativePath: "nested/index.md", content: "# Nested index\n" },
        { relativePath: "broken.md", content: null },
      ]),
      { includeIndexPages: false },
    );

    expect(result.chapterRelativePaths).toEqual(["one.md"]);
    expect(result.excludedSupportFileCount).toBe(3);
    expect(result.unreadableFileCount).toBe(1);
  });

  it("caps the draft at the Book Scope limit and reports incomplete scans", () => {
    const result = suggestBookScopeFromDiscovery(
      discovery(
        Array.from({ length: 105 }, (_, index) => ({
          relativePath: `chapters/${String(index).padStart(3, "0")}.md`,
          content: `# ${index}\n`,
        })),
        { truncated: true },
      ),
      { includeIndexPages: true },
    );

    expect(result.chapterRelativePaths).toHaveLength(100);
    expect(result.candidateLimitReached).toBe(true);
    expect(result.scanIncomplete).toBe(true);
  });

  it("reports linked and index counts only for items inside the capped draft", () => {
    const chapterFiles = Array.from({ length: 105 }, (_, index) => ({
      relativePath: `chapters/${String(index).padStart(3, "0")}.md`,
      content: `# ${index}\n`,
    }));
    const links = chapterFiles
      .map((file) => `[${file.relativePath}](${file.relativePath})`)
      .join("\n");
    const result = suggestBookScopeFromDiscovery(
      discovery([
        { relativePath: "index.md", content: links },
        ...chapterFiles,
      ]),
      { includeIndexPages: true },
    );

    expect(result.chapterRelativePaths).toHaveLength(100);
    expect(result.chapterRelativePaths[0]).toBe("index.md");
    expect(result.includedIndexPageCount).toBe(1);
    expect(result.linkedChapterCount).toBe(99);
    expect(result.candidateLimitReached).toBe(true);
  });
});
