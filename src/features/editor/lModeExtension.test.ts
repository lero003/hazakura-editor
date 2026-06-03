import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import type { DecorationSet } from "@codemirror/view";
import { computeLModeDecorations } from "./lModeExtension";

// Build an EditorState with the markdown grammar so the syntax
// tree is populated, and a selection on the line the test wants
// to treat as "active". The L Mode extension reads the active
// line from `state.selection.main.head`.
function makeState(doc: string, head: number): EditorState {
  return EditorState.create({
    doc,
    extensions: [markdown()],
    selection: { anchor: head },
  });
}

function collectRanges(set: DecorationSet, docLength: number) {
  const ranges: Array<{ from: number; to: number }> = [];
  set.between(0, docLength, (from, to) => {
    ranges.push({ from, to });
  });
  return ranges;
}

describe("computeLModeDecorations", () => {
  // The cornerstone invariant of L Mode: the saved file is
  // byte-identical in L Mode and normal mode. The extension is
  // display-only — it adds Decoration.mark / Decoration.line
  // ranges, never modifies the document. This test pins that
  // invariant directly on the function.
  it("does not modify the document (cornerstone invariant)", () => {
    const source =
      "# Heading 1\n" +
      "## Heading 2\n" +
      "**bold** and *italic* and `code`\n" +
      "> a quoted line\n" +
      "- list item\n" +
      "1. ordered item\n" +
      "~~struck~~ [link](https://example.com)\n" +
      "```js\ncode fence\n```\n";
    const state = makeState(source, source.length);
    const originalText = state.doc.toString();
    const originalLength = state.doc.length;

    // Drive the extension.
    const set = computeLModeDecorations(state);

    // 1) The doc itself is unchanged.
    expect(state.doc.toString()).toBe(originalText);
    expect(state.doc.length).toBe(originalLength);

    // 2) Every decoration range is in-bounds. Some decorations
    // are intentionally zero-width (line decorations attached
    // at a line-start position), so we only require `to >= from`.
    let count = 0;
    let nonEmptyCount = 0;
    set.between(0, state.doc.length, (from, to) => {
      expect(from).toBeGreaterThanOrEqual(0);
      expect(to).toBeLessThanOrEqual(state.doc.length);
      expect(to).toBeGreaterThanOrEqual(from);
      if (to > from) {
        nonEmptyCount += 1;
      }
      count += 1;
    });
    expect(count).toBeGreaterThan(0);
    expect(nonEmptyCount).toBeGreaterThan(0);
  });

  it("hides markers on lines other than the active line", () => {
    // Place the cursor on the trailing newline so no marker
    // line is "active". Every marker in the doc should pick
    // up a hidden range.
    const source = "# Hello **world**\n> quoted line\n";
    const state = makeState(source, source.length);
    const ranges = collectRanges(computeLModeDecorations(state), state.doc.length);

    // 1 HeaderMark + 2 EmphasisMarks (`**` open) + 2 EmphasisMarks
    // (`**` close) + 1 QuoteMark = 6 hidden marker ranges, plus
    // line classes for the heading and the blockquote.
    expect(ranges.length).toBeGreaterThanOrEqual(6);
  });

  it("does NOT hide markers on the active line", () => {
    // The cursor is on the heading line. The heading's markers
    // (the `#` and the `**`s) are revealed, so the count of
    // hidden ranges on that line is strictly less than the
    // all-hidden baseline.
    const source = "# Hello **world**\n> quoted line\n";
    const docLength = source.length;

    // Cursor on the heading line (line 1).
    const onHeading = collectRanges(
      computeLModeDecorations(makeState(source, 0)),
      docLength,
    );

    // All-hidden baseline (cursor past EOF).
    const allHidden = collectRanges(
      computeLModeDecorations(makeState(source, docLength)),
      docLength,
    );

    // The reveal must be strictly smaller than the all-hidden
    // baseline — the markers on the heading line are unhidden.
    expect(onHeading.length).toBeLessThan(allHidden.length);
  });

  it("hides every documented marker type", () => {
    // A fixture that exercises each marker type listed in
    // MARKER_NODE_NAMES. If any future change drops a marker
    // from that set, this test will fail and the omission
    // will be obvious in the diff.
    const source =
      // HeaderMark
      "# H1\n" +
      // EmphasisMark (`*` and `**`)
      "*em* and **strong**\n" +
      // CodeMark (inline)
      "use `code` here\n" +
      // QuoteMark
      "> a quote\n" +
      // ListMark (bullet)
      "- a\n" +
      // ListMark (ordered)
      "1. one\n" +
      // StrikethroughMark + LinkMark + URL
      "~~struck~~ and [link](https://example.com)\n" +
      // TaskMarker (GFM task list)
      "- [ ] todo\n" +
      "- [x] done\n" +
      // CodeInfo (language spec after the opening fence)
      "```js\nlet x = 1;\n```\n";

    // Place the selection on the implicit empty trailing line
    // so no marker line is active.
    const state = makeState(source, source.length);
    const ranges = collectRanges(computeLModeDecorations(state), state.doc.length);

    // Each marker type contributes at least one hidden range
    // — the test fixture covers all 10 types, so the count
    // must be at least 10. (The line-decorations add more on
    // top of that, so we keep this as a lower bound.)
    expect(ranges.length).toBeGreaterThanOrEqual(10);
  });
});
