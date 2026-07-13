import { describe, expect, it } from "vitest";
import {
  analyzeMarkdownStructure,
  LONG_SECTION_CHARACTER_THRESHOLD,
  LONG_SECTION_LINE_THRESHOLD,
} from "./markdownStructureAdvisories";

describe("analyzeMarkdownStructure", () => {
  it("reports skipped levels, empty headings, and later duplicate labels", () => {
    const source = [
      "# Chapter",
      "### Scene",
      "##",
      "## chapter",
    ].join("\n");

    expect(analyzeMarkdownStructure(source)).toEqual([
      {
        kind: "skipped-level",
        level: 3,
        line: 2,
        previousLevel: 1,
      },
      { kind: "empty-heading", line: 3 },
      {
        firstLine: 1,
        kind: "duplicate-navigation-label",
        label: "chapter",
        line: 4,
      },
    ]);
  });

  it("reports a section only when an extreme line or character threshold is met", () => {
    const longByLines = `# Lines\n${"body\n".repeat(LONG_SECTION_LINE_THRESHOLD - 1)}`;
    const longByCharacters = `# Characters\n${"x".repeat(LONG_SECTION_CHARACTER_THRESHOLD)}`;

    expect(analyzeMarkdownStructure(longByLines)).toEqual([
      expect.objectContaining({
        kind: "long-section",
        line: 1,
        lineCount: LONG_SECTION_LINE_THRESHOLD + 1,
      }),
    ]);
    expect(analyzeMarkdownStructure(longByCharacters)).toEqual([
      expect.objectContaining({
        kind: "long-section",
        line: 1,
      }),
    ]);
    expect(analyzeMarkdownStructure("# Short\nbody\n")).toEqual([]);
  });

  it("does not treat headings inside fences as advisory candidates", () => {
    expect(
      analyzeMarkdownStructure("# One\n```\n### skipped-looking\n```\n"),
    ).toEqual([]);
  });
});
