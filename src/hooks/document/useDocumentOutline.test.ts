import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  MARKDOWN_OUTLINE_MAX_HEADINGS,
  type MarkdownHeading,
} from "../../types";
import {
  clampScrollRatio,
  useDocumentOutline,
  useMarkdownHeadingContext,
} from "./useDocumentOutline";

describe("useDocumentOutline", () => {
  it("returns a null outline and no headings when no document is active", () => {
    const { result } = renderHook(() =>
      useDocumentOutline({
        activeContents: "# Should Be Ignored",
        hasActiveDocument: false,
        selectionLine: 0,
      }),
    );

    expect(result.current.documentOutline).toBeNull();
    expect(result.current.documentHeadings).toEqual([]);
    expect(result.current.currentMarkdownHeading).toBeNull();
  });

  it("parses a simple top-level heading", () => {
    const { result } = renderHook(() =>
      useDocumentOutline({
        activeContents: "# Title\n",
        hasActiveDocument: true,
        selectionLine: 0,
      }),
    );

    expect(result.current.documentOutline).toEqual({
      headings: [{ level: 1, line: 1, text: "Title" }],
      truncated: false,
    });
  });

  it("parses headings at every level and reports the current one for the selection", () => {
    const source = [
      "# H1",
      "## H2",
      "### H3",
      "body",
      "#### H4",
    ].join("\n");

    const { result } = renderHook(() =>
      useDocumentOutline({
        activeContents: source,
        hasActiveDocument: true,
        selectionLine: 4,
      }),
    );

    expect(result.current.documentHeadings.map((h) => h.text)).toEqual([
      "H1",
      "H2",
      "H3",
      "H4",
    ]);
    expect(result.current.currentMarkdownHeading).toEqual({
      level: 3,
      line: 3,
      text: "H3",
    });
  });

  it("skips headings inside fenced code blocks", () => {
    const source = [
      "# Real Heading",
      "```",
      "# Not A Heading",
      "## Also Not A Heading",
      "```",
      "## Second Real Heading",
    ].join("\n");

    const { result } = renderHook(() =>
      useDocumentOutline({
        activeContents: source,
        hasActiveDocument: true,
        selectionLine: 0,
      }),
    );

    expect(result.current.documentHeadings.map((h) => h.text)).toEqual([
      "Real Heading",
      "Second Real Heading",
    ]);
  });

  it("skips heading-like lines inside YAML frontmatter", () => {
    const source = [
      "---",
      "title: # Metadata Title",
      "# internal note",
      "---",
      "# Real Heading",
    ].join("\n");

    const { result } = renderHook(() =>
      useDocumentOutline({
        activeContents: source,
        hasActiveDocument: true,
        selectionLine: 0,
      }),
    );

    expect(result.current.documentHeadings).toEqual([
      { level: 1, line: 5, text: "Real Heading" },
    ]);
  });

  it("supports CRLF frontmatter and keeps an unclosed opener as Markdown", () => {
    const closed = "---\r\n# internal note\r\n---\r\n## Real Heading";
    const unclosed = "---\r\n# Real Heading";

    const { result: closedResult } = renderHook(() =>
      useDocumentOutline({
        activeContents: closed,
        hasActiveDocument: true,
        selectionLine: 0,
      }),
    );
    const { result: unclosedResult } = renderHook(() =>
      useDocumentOutline({
        activeContents: unclosed,
        hasActiveDocument: true,
        selectionLine: 0,
      }),
    );

    expect(closedResult.current.documentHeadings).toEqual([
      { level: 2, line: 4, text: "Real Heading" },
    ]);
    expect(unclosedResult.current.documentHeadings).toEqual([
      { level: 1, line: 2, text: "Real Heading" },
    ]);
  });

  it("skips headings inside tilde-fenced blocks", () => {
    const source = [
      "# Real Heading",
      "~~~",
      "## Inside Tilde Fence",
      "~~~",
      "## After",
    ].join("\n");

    const { result } = renderHook(() =>
      useDocumentOutline({
        activeContents: source,
        hasActiveDocument: true,
        selectionLine: 0,
      }),
    );

    expect(result.current.documentHeadings.map((h) => h.text)).toEqual([
      "Real Heading",
      "After",
    ]);
  });

  it("truncates the outline past MARKDOWN_OUTLINE_MAX_HEADINGS and flags truncation", () => {
    const lines: string[] = [];
    for (let i = 1; i <= MARKDOWN_OUTLINE_MAX_HEADINGS + 5; i += 1) {
      lines.push(`# Heading ${i}`);
    }
    const source = lines.join("\n");

    const { result } = renderHook(() =>
      useDocumentOutline({
        activeContents: source,
        hasActiveDocument: true,
        selectionLine: 0,
      }),
    );

    expect(result.current.documentHeadings.length).toBe(
      MARKDOWN_OUTLINE_MAX_HEADINGS,
    );
    expect(result.current.documentOutline?.truncated).toBe(true);
  });

  it("returns no headings for contents with no headings", () => {
    const { result } = renderHook(() =>
      useDocumentOutline({
        activeContents: "just some plain text\nno headings here\n",
        hasActiveDocument: true,
        selectionLine: 0,
      }),
    );

    expect(result.current.documentHeadings).toEqual([]);
    expect(result.current.documentOutline).toEqual({
      headings: [],
      truncated: false,
    });
    expect(result.current.currentMarkdownHeading).toBeNull();
  });
});

describe("useMarkdownHeadingContext", () => {
  const headings: MarkdownHeading[] = [
    { level: 1, line: 1, text: "H1" },
    { level: 2, line: 5, text: "H2a" },
    { level: 2, line: 10, text: "H2b" },
  ];

  it("returns null previous and the first heading as next when the cursor is above all headings", () => {
    const { result } = renderHook(() =>
      useMarkdownHeadingContext(headings, 0),
    );

    expect(result.current).toEqual({
      previous: null,
      current: null,
      next: headings[0],
    });
  });

  it("returns the right previous / current / next when the cursor is between headings", () => {
    const { result } = renderHook(() =>
      useMarkdownHeadingContext(headings, 7),
    );

    expect(result.current).toEqual({
      previous: headings[0],
      current: headings[1],
      next: headings[2],
    });
  });

  it("returns null next when the cursor sits at or past the last heading", () => {
    const { result } = renderHook(() =>
      useMarkdownHeadingContext(headings, 99),
    );

    expect(result.current).toEqual({
      previous: headings[1],
      current: headings[2],
      next: null,
    });
  });

  it("returns all-null context for an empty heading list", () => {
    const { result } = renderHook(() => useMarkdownHeadingContext([], 5));

    expect(result.current).toEqual({
      previous: null,
      current: null,
      next: null,
    });
  });
});

describe("clampScrollRatio", () => {
  it("returns 0 for non-finite values", () => {
    expect(clampScrollRatio(Number.NaN)).toBe(0);
    expect(clampScrollRatio(Number.POSITIVE_INFINITY)).toBe(0);
    expect(clampScrollRatio(Number.NEGATIVE_INFINITY)).toBe(0);
  });

  it("clamps values below 0 up to 0", () => {
    expect(clampScrollRatio(-0.5)).toBe(0);
  });

  it("clamps values above 1 down to 1", () => {
    expect(clampScrollRatio(1.5)).toBe(1);
  });

  it("passes through values already in [0, 1]", () => {
    expect(clampScrollRatio(0)).toBe(0);
    expect(clampScrollRatio(0.5)).toBe(0.5);
    expect(clampScrollRatio(1)).toBe(1);
  });
});
