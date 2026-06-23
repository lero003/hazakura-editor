import { describe, expect, it } from "vitest";
import {
  applyEbookPageBreakMarkers,
  splitMarkdownIntoChapters,
} from "./ebookChapters";

describe("splitMarkdownIntoChapters", () => {
  it("returns a single preamble chapter for a heading-less document", () => {
    const source = "Just prose.\nNo headings here.\n";
    const chapters = splitMarkdownIntoChapters(source);

    expect(chapters).toHaveLength(1);
    expect(chapters[0].index).toBe(0);
    expect(chapters[0].headingLevel).toBeNull();
    expect(chapters[0].headingText).toBeNull();
    expect(chapters[0].source).toBe("Just prose.\nNo headings here.\n");
  });

  it("splits at top-level ATX headings and carries heading metadata", () => {
    const source = [
      "Intro paragraph before any heading.",
      "",
      "# Chapter One",
      "",
      "Body of chapter one.",
      "",
      "# Chapter Two",
      "",
      "Body of chapter two.",
    ].join("\n");

    const chapters = splitMarkdownIntoChapters(source);

    expect(chapters).toHaveLength(3);

    expect(chapters[0].headingLevel).toBeNull();
    expect(chapters[0].headingText).toBeNull();
    expect(chapters[0].source.startsWith("Intro paragraph")).toBe(true);

    expect(chapters[1].headingLevel).toBe(1);
    expect(chapters[1].headingText).toBe("Chapter One");
    expect(chapters[1].source.startsWith("# Chapter One")).toBe(true);
    expect(chapters[1].source).toContain("Body of chapter one.");

    expect(chapters[2].headingLevel).toBe(1);
    expect(chapters[2].headingText).toBe("Chapter Two");
    expect(chapters[2].source.startsWith("# Chapter Two")).toBe(true);
    expect(chapters[2].source).toContain("Body of chapter two.");
  });

  it("records one-based source start lines for the editor reader bridge", () => {
    const source = [
      "Intro paragraph before any heading.",
      "",
      "# Chapter One",
      "",
      "Body of chapter one.",
      "",
      "## Chapter Two",
      "",
      "Body of chapter two.",
    ].join("\n");

    const chapters = splitMarkdownIntoChapters(source);

    expect(chapters.map((chapter) => chapter.startLine)).toEqual([1, 3, 7]);
  });

  it("detects heading levels 1 through 6", () => {
    const source = ["# H1", "## H2", "### H3", "###### H6"].join("\n");

    const chapters = splitMarkdownIntoChapters(source);

    // Document starts with a heading, so the empty preamble is dropped.
    expect(chapters.map((c) => c.headingLevel)).toEqual([1, 2, 3, 6]);
    expect(chapters.map((c) => c.headingText)).toEqual(["H1", "H2", "H3", "H6"]);
  });

  it("keeps a non-empty preamble before the first heading", () => {
    const source = "Intro text.\n\n# Chapter\n\nbody";
    const chapters = splitMarkdownIntoChapters(source);

    expect(chapters.map((c) => c.headingLevel)).toEqual([null, 1]);
    // Verbatim slice: the preamble keeps its trailing blank line.
    expect(chapters[0].source).toBe("Intro text.\n\n");
    expect(chapters[1].headingText).toBe("Chapter");
  });

  it("ignores `#` inside fenced code blocks", () => {
    const source = [
      "# Real Chapter",
      "",
      "```ts",
      "# not a heading inside a fence",
      "const x = 1;",
      "```",
      "",
      "## After the fence, a real subheading",
    ].join("\n");

    const chapters = splitMarkdownIntoChapters(source);

    // The `#` inside the fence does not start a chapter; only the H1 and
    // the H2 after the fence closes are boundaries. Document starts with
    // a heading, so the empty preamble is dropped.
    expect(chapters).toHaveLength(2);
    expect(chapters[0].headingLevel).toBe(1);
    expect(chapters[0].headingText).toBe("Real Chapter");
    expect(chapters[0].source).toContain("# not a heading inside a fence");
    expect(chapters[1].headingLevel).toBe(2);
    expect(chapters[1].headingText).toBe("After the fence, a real subheading");
  });

  it("ignores YAML frontmatter headings and keeps it with the preamble", () => {
    const source = [
      "---",
      "title: # Metadata Title",
      "# internal note",
      "tags:",
      "  - draft",
      "---",
      "",
      "# Real Chapter",
      "",
      "Body.",
    ].join("\n");

    const chapters = splitMarkdownIntoChapters(source);

    expect(chapters).toHaveLength(2);
    expect(chapters[0].headingLevel).toBeNull();
    expect(chapters[0].source).toContain("title: # Metadata Title");
    expect(chapters[0].source).toContain("# internal note");
    expect(chapters[1].headingLevel).toBe(1);
    expect(chapters[1].headingText).toBe("Real Chapter");
  });

  it("does not treat an unclosed opening horizontal rule as frontmatter", () => {
    const source = ["---", "", "# Real Chapter", "", "Body."].join("\n");

    const chapters = splitMarkdownIntoChapters(source);

    expect(chapters).toHaveLength(2);
    expect(chapters[0].source).toBe("---\n\n");
    expect(chapters[1].headingText).toBe("Real Chapter");
  });

  it("pairs backtick and tilde fences independently", () => {
    const source = [
      "# Chapter",
      "```",
      "# inside backtick fence",
      "~~~",
      "# still inside outer fence",
      "```",
      "# after closing backtick fence",
    ].join("\n");

    const chapters = splitMarkdownIntoChapters(source);

    // Chapter 1 covers the fenced region; the heading after the backtick
    // fence closes starts chapter 2.
    expect(chapters).toHaveLength(2);
    expect(chapters[0].source).toContain("# inside backtick fence");
    expect(chapters[0].source).toContain("# still inside outer fence");
    expect(chapters[1].headingText).toBe("after closing backtick fence");
  });

  it("does not close a fence with a shorter closing run", () => {
    // A four-backtick opener (````) must not be closed by a three-
    // backtick line (```); the inner `#` stays inside the fence and
    // does not split a chapter. CommonMark 4.5: the closing fence must
    // be at least as long as the opening fence.
    const source = [
      "# Real Chapter",
      "````",
      "# not a heading (short close below does not close the fence)",
      "```",
      "# still inside the four-backtick fence",
      "````",
      "## after the fence, a real subheading",
    ].join("\n");

    const chapters = splitMarkdownIntoChapters(source);

    // Only the H1 and the post-fence H2 are boundaries. The `#` lines
    // inside the fence are NOT chapter starts.
    expect(chapters).toHaveLength(2);
    expect(chapters[0].headingLevel).toBe(1);
    expect(chapters[0].headingText).toBe("Real Chapter");
    expect(chapters[0].source).toContain("# not a heading (short close below does not close the fence)");
    expect(chapters[0].source).toContain("# still inside the four-backtick fence");
    expect(chapters[1].headingLevel).toBe(2);
    expect(chapters[1].headingText).toBe("after the fence, a real subheading");
  });

  it("does not close a backtick fence with a tilde close of equal length", () => {
    // The close fence must use the same character as the opener; a
    // tilde run cannot close a backtick fence even at equal length.
    const source = [
      "# Chapter",
      "```",
      "# inside backtick fence",
      "~~~",
      "# still inside (tilde did not close backtick)",
      "```",
      "# after the backtick fence closes",
    ].join("\n");

    const chapters = splitMarkdownIntoChapters(source);

    expect(chapters).toHaveLength(2);
    expect(chapters[0].headingText).toBe("Chapter");
    expect(chapters[0].source).toContain("# still inside (tilde did not close backtick)");
    expect(chapters[1].headingText).toBe("after the backtick fence closes");
  });

  it("treats a heading-like line inside a fence as prose in the slice", () => {
    // Belt-and-braces: the `#` inside the fence must appear verbatim in
    // the surrounding chapter's slice, proving it was not treated as a
    // boundary that would have placed it in its own chapter.
    const source = "# Chapter\n\n```\n# inside the fence\n```\n";
    const chapters = splitMarkdownIntoChapters(source);

    expect(chapters).toHaveLength(1);
    expect(chapters[0].source).toBe(source);
    expect(chapters[0].source).toContain("# inside the fence");
  });

  it("does not close a fence when the run is followed by non-whitespace", () => {
    // A line that looks like a close fence but carries trailing
    // non-whitespace (an "info string") is fenced content, not a
    // closer — mirroring `marked`. Without this rule, a ``` ```not
    // close ``` line inside the block would close it and the following
    // `#` would start a chapter.
    const source = [
      "# Chapter",
      "```",
      "```not close",
      "# still inside the code block",
      "```",
      "## real subheading after the block",
    ].join("\n");

    const chapters = splitMarkdownIntoChapters(source);

    expect(chapters).toHaveLength(2);
    expect(chapters[0].headingText).toBe("Chapter");
    // The `# still inside the code block` line is content, not a
    // chapter boundary, so it stays in the H1 chapter's slice.
    expect(chapters[0].source).toContain("# still inside the code block");
    expect(chapters[1].headingText).toBe("real subheading after the block");
  });

  it("closes a fence whose run is followed by trailing spaces only", () => {
    // Trailing whitespace after the closing run is allowed (CommonMark
    // 4.7), so a padded closer does close the block.
    const source = [
      "# Chapter",
      "```ts",
      "const x = 1;",
      "```   ",
      "## after the padded close",
    ].join("\n");

    const chapters = splitMarkdownIntoChapters(source);

    expect(chapters).toHaveLength(2);
    expect(chapters[0].headingText).toBe("Chapter");
    expect(chapters[1].headingText).toBe("after the padded close");
  });

  it("each chapter source is a verbatim substring of the original", () => {
    const source = "# A\n\ntext\n\n## B\n\nmore text\n";
    const chapters = splitMarkdownIntoChapters(source);

    for (const chapter of chapters) {
      expect(source).toContain(chapter.source);
    }
    // No empty chapters.
    expect(chapters.every((c) => c.source.length > 0)).toBe(true);
  });

  it("preserves trailing blank lines in the preamble as an exact slice", () => {
    // The motivating bug: a split/join round-trip dropped the second
    // "\n" of the preamble's trailing blank line, so the preamble
    // chapter read "Intro\n" instead of "Intro\n\n".
    const source = "Intro\n\n# Chapter\n\nbody\n";
    const chapters = splitMarkdownIntoChapters(source);

    expect(chapters).toHaveLength(2);
    expect(chapters[0].headingLevel).toBeNull();
    expect(chapters[0].source).toBe("Intro\n\n");
    expect(chapters[1].source).toBe("# Chapter\n\nbody\n");

    // Rejoining the verbatim slices in order reconstructs the whole
    // source byte-for-byte. This is the real invariant the renderer
    // relies on.
    const rejoined = chapters.map((c) => c.source).join("");
    expect(rejoined).toBe(source);
  });

  it("keeps each chapter source as source.slice(start, end)", () => {
    const source = "preamble text\n\n# H1\n\npara\n\n## H2\n\npara2\n";
    const chapters = splitMarkdownIntoChapters(source);

    // Contiguous, non-overlapping slices that cover the whole source.
    expect(chapters.length).toBeGreaterThan(0);
    for (let i = 0; i < chapters.length; i++) {
      expect(source.includes(chapters[i].source)).toBe(true);
    }
    const whole = chapters.map((c) => c.source).join("");
    expect(whole).toBe(source);
  });

  it("strips an optional closing sequence of hashes from heading text", () => {
    // Leading heading: preamble is empty and dropped, so the heading
    // chapter is at index 0.
    const chapters = splitMarkdownIntoChapters("# Title #");
    expect(chapters).toHaveLength(1);
    expect(chapters[0].headingText).toBe("Title");

    const closedMid = splitMarkdownIntoChapters("## Topic ##  ");
    expect(closedMid).toHaveLength(1);
    expect(closedMid[0].headingText).toBe("Topic");
  });

  it("does not treat a `#` glued to text as a heading", () => {
    const source = "#tag1 and #tag2 are not headings";
    const chapters = splitMarkdownIntoChapters(source);

    expect(chapters).toHaveLength(1);
    expect(chapters[0].headingLevel).toBeNull();
  });

  it("handles an empty source as a single empty preamble", () => {
    const chapters = splitMarkdownIntoChapters("");
    expect(chapters).toHaveLength(1);
    expect(chapters[0].source).toBe("");
    expect(chapters[0].headingLevel).toBeNull();
  });

  it("treats a Setext underline as prose, not a chapter boundary", () => {
    const source = ["Setext Title", "=============", "", "body"].join("\n");
    const chapters = splitMarkdownIntoChapters(source);

    expect(chapters).toHaveLength(1);
    expect(chapters[0].source).toContain("=============");
  });
});

describe("applyEbookPageBreakMarkers", () => {
  it("turns blank-line-flanked standalone markers into page-break blocks", () => {
    const source = ["First page", "", "---", "", "Second page", "", "===", "", "Third page"].join("\n");

    const marked = applyEbookPageBreakMarkers(source);

    expect(marked).toContain('class="page-break"');
    expect(marked.match(/class="page-break"/g)).toHaveLength(2);
    expect(marked).toContain("First page");
    expect(marked).toContain("Second page");
    expect(marked).toContain("Third page");
  });

  it("does not turn a document-ending standalone marker into a blank trailing page", () => {
    const withoutTrailingNewline = applyEbookPageBreakMarkers("Para\n\n---");
    const withTrailingNewline = applyEbookPageBreakMarkers("Para\n\n---\n");

    expect(withoutTrailingNewline).not.toContain('class="page-break"');
    expect(withTrailingNewline).not.toContain('class="page-break"');
    expect(withoutTrailingNewline).not.toContain("---");
    expect(withTrailingNewline).not.toContain("---");
  });

  it("does not double a heading chapter boundary with a trailing marker", () => {
    const source = [
      "# Title",
      "",
      "Title notes.",
      "",
      "---",
      "",
      "# Chapter",
      "",
      "Body.",
    ].join("\n");
    const chapters = splitMarkdownIntoChapters(source);

    expect(chapters).toHaveLength(2);
    const marked = applyEbookPageBreakMarkers(chapters[0].source);
    expect(marked).not.toContain('class="page-break"');
    expect(marked).not.toContain("---");
  });

  it("does not convert frontmatter, fenced code, or non-blank-flanked rules", () => {
    const source = [
      "---",
      "title: Draft",
      "---",
      "",
      "# Chapter",
      "Setext title",
      "---",
      "",
      "```",
      "---",
      "===",
      "```",
      "",
      "Paragraph",
      "",
      "---",
      "",
      "Next page",
    ].join("\n");

    const marked = applyEbookPageBreakMarkers(source);

    expect(marked.match(/class="page-break"/g)).toHaveLength(1);
    expect(marked).toContain("title: Draft");
    expect(marked).toContain("Setext title\n---");
    expect(marked).toContain("```\n---\n===\n```");
  });
});
