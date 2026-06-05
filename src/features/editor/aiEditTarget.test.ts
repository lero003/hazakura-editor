import { describe, expect, it } from "vitest";
import { inferAppleAssistTarget } from "./aiEditTarget";

// Bounded target inference is the contract between the main
// window's editor and the Apple Assist window. The cases
// below pin the *order* of the inference (selection > paragraph
// > block > section > document) and the label contract.

function offsetOf(text: string, marker: string): number {
  return text.indexOf(marker);
}

describe("inferAppleAssistTarget", () => {
  it("returns a selection target when the selection is non-empty", () => {
    const text = "# Title\n\nfirst paragraph here\n";
    const from = offsetOf(text, "first");
    const to = offsetOf(text, "paragraph");
    const target = inferAppleAssistTarget({ text, from, to });
    expect(target.kind).toBe("selection");
    expect(target.text).toBe("first ");
  });

  it("expands a cursor inside a paragraph to the whole paragraph", () => {
    const text = "# Title\n\nfirst line\nsecond line\nthird line\n\nnext\n";
    const cursor = offsetOf(text, "second");
    const target = inferAppleAssistTarget({ text, from: cursor, to: cursor });
    expect(target.kind).toBe("paragraph");
    expect(target.text).toBe("first line\nsecond line\nthird line");
  });

  it("returns a paragraph that ends at EOF when there is no trailing blank line", () => {
    const text = "alpha\nbeta\ngamma";
    const cursor = offsetOf(text, "beta");
    const target = inferAppleAssistTarget({ text, from: cursor, to: cursor });
    expect(target.kind).toBe("paragraph");
    expect(target.text).toBe("alpha\nbeta\ngamma");
  });

  it("returns a code block target when the cursor is inside a fenced block", () => {
    const text =
      "before\n\n```ts\nconst x = 1;\nconst y = 2;\n```\n\nafter\n";
    const cursor = offsetOf(text, "const y");
    const target = inferAppleAssistTarget({ text, from: cursor, to: cursor });
    expect(target.kind).toBe("block");
    expect(target.text).toBe("```ts\nconst x = 1;\nconst y = 2;\n```");
    expect(target.label).toBe("Code block (ts)");
  });

  it("returns a code block target for an unlabeled fence", () => {
    const text = "```\nhi\n```";
    const cursor = offsetOf(text, "hi");
    const target = inferAppleAssistTarget({ text, from: cursor, to: cursor });
    expect(target.kind).toBe("block");
    expect(target.text).toBe("```\nhi\n```");
    expect(target.label).toBe("Code block");
  });

  it("does not treat a closed fence above the cursor as an opening fence", () => {
    const text = "```ts\nconst x = 1;\n```\n\nafter paragraph\n";
    const cursor = offsetOf(text, "after");
    const target = inferAppleAssistTarget({ text, from: cursor, to: cursor });
    expect(target.kind).toBe("paragraph");
    expect(target.text).toBe("after paragraph");
  });

  it("returns a section target when the cursor is under a heading", () => {
    const text =
      "# Top\n\nignored\n\n## Section A\n\nbody one\n\nbody two\n\n## Section B\n\nother body\n";
    const cursor = offsetOf(text, "body one");
    const target = inferAppleAssistTarget({ text, from: cursor, to: cursor });
    expect(target.kind).toBe("section");
    expect(target.label).toBe("Section: Section A");
    // The section spans from the `## Section A` heading to
    // just before `## Section B`. The trailing newline after
    // `body two` is included because the section end is the
    // start of the next heading's line.
    expect(target.text).toBe("## Section A\n\nbody one\n\nbody two\n");
  });

  it("section boundary honors heading level (h2 ends at next h2 or h1)", () => {
    // `# Top` is the document title; `## A` is the first
    // real section. The section walker must NOT treat `# Top`
    // as a section (it falls through to paragraph), and it
    // must treat `## A` as a real section.
    const text =
      "# Top\n\nignored\n\n## A\n\na body\n\n### A.1\n\nsub body\n\n## B\n\nb body\n";
    const cursor = offsetOf(text, "a body");
    const target = inferAppleAssistTarget({ text, from: cursor, to: cursor });
    expect(target.kind).toBe("section");
    expect(target.label).toBe("Section: A");
    // Cursor is in h2 A's body, so the section spans h2 A →
    // h3 A.1 (nested) → body, ending at the start of the next
    // h2 (## B).
    expect(target.text).toBe("## A\n\na body\n\n### A.1\n\nsub body\n");
  });

  it("section under a nested h3 ends at the next h3, h2, or h1", () => {
    const text =
      "## A\n\na body\n\n### A.1\n\nsub body\n\n### A.2\n\nother sub\n";
    const cursor = offsetOf(text, "sub body");
    const target = inferAppleAssistTarget({ text, from: cursor, to: cursor });
    expect(target.kind).toBe("section");
    expect(target.label).toBe("Section: A.1");
    // The closest heading above the cursor is h3 A.1; the
    // section ends at the next h3 (### A.2).
    expect(target.text).toBe("### A.1\n\nsub body\n");
  });

  it("falls back to a single-line paragraph when no heading or fence applies", () => {
    // A single-line "paragraph" is still a narrower target than
    // the whole document — when the cursor sits on a non-blank
    // line, the paragraph walker expands to the run of non-blank
    // lines, which here is the whole document.
    const text = "single line, no headings, no fences";
    const cursor = offsetOf(text, "no");
    const target = inferAppleAssistTarget({ text, from: cursor, to: cursor });
    expect(target.kind).toBe("paragraph");
    expect(target.text).toBe(text);
  });

  it("falls back to the whole document when the cursor is on a blank line", () => {
    // An empty document is the only "document" case the
    // inference can land on naturally: no selection, no
    // paragraph (the cursor is on a blank line), no fence, no
    // heading. The mock returns the empty document as a
    // degenerate target.
    const text = "";
    const target = inferAppleAssistTarget({ text, from: 0, to: 0 });
    expect(target.kind).toBe("document");
    expect(target.text).toBe("");
  });

  it("clamps out-of-range offsets before slicing", () => {
    const text = "abc";
    const target = inferAppleAssistTarget({ text, from: -5, to: 999 });
    // The negative `from` is clamped to 0 and `to` is clamped
    // to text.length, so the selection covers the whole
    // document.
    expect(target.kind).toBe("selection");
    expect(target.text).toBe("abc");
  });
});
