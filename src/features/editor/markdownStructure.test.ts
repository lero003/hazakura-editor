import { describe, expect, it } from "vitest";
import {
  markdownStructureItems,
  parseMarkdownStructure,
} from "./markdownStructure";

describe("parseMarkdownStructure", () => {
  it("shares frontmatter, headings, page breaks, and navigation candidates", () => {
    const source = [
      "---",
      "title: # metadata",
      "---",
      "# Chapter One",
      "",
      "---",
      "",
      "## Chapter Two ##",
    ].join("\n");

    const structure = parseMarkdownStructure(source);

    expect(structure.frontmatter).toEqual({ bodyOffset: 26, endLine: 3 });
    expect(structure.headings).toEqual([
      expect.objectContaining({
        level: 1,
        line: 4,
        navigationLabel: "Chapter One",
        text: "Chapter One",
      }),
      expect.objectContaining({
        level: 2,
        line: 8,
        navigationLabel: "Chapter Two",
        text: "Chapter Two",
      }),
    ]);
    expect(structure.pageBreaks).toEqual([
      expect.objectContaining({ line: 6, role: "page-break" }),
    ]);
    expect(source.slice(structure.headings[0].startOffset)).toMatch(
      /^# Chapter One/,
    );
  });

  it("uses matching fence character and opener length for every consumer", () => {
    const source = [
      "# Outside",
      "````",
      "```",
      "## Still fenced",
      "````",
      "## Outside again",
    ].join("\n");

    expect(
      parseMarkdownStructure(source).headings.map((heading) => heading.text),
    ).toEqual(["Outside", "Outside again"]);
  });

  it("supports CRLF fences without losing source offsets", () => {
    const source = "# One\r\n```\r\n## fenced\r\n```\r\n## Two\r\n";
    const headings = parseMarkdownStructure(source).headings;

    expect(headings.map((heading) => heading.text)).toEqual(["One", "Two"]);
    expect(source.slice(headings[1].startOffset, headings[1].endOffset)).toBe(
      "## Two",
    );
  });

  it("keeps empty headings structural but out of EPUB navigation", () => {
    const [heading] = parseMarkdownStructure("#\n").headings;

    expect(heading).toMatchObject({
      level: 1,
      navigationLabel: null,
      text: "",
    });
  });

  it("classifies a trailing standalone marker as render-only drop", () => {
    const source = "body\n\n---\n\n";

    expect(parseMarkdownStructure(source).pageBreaks).toEqual([
      expect.objectContaining({ line: 3, role: "drop" }),
    ]);
  });

  it("returns headings and page breaks in source order for overview consumers", () => {
    const source = "# One\n\n---\n\n### Three\n";
    const items = markdownStructureItems(parseMarkdownStructure(source));

    expect(items.map((item) => [item.kind, item.line])).toEqual([
      ["heading", 1],
      ["page-break", 3],
      ["heading", 5],
    ]);
  });
});
