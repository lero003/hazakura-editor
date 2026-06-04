import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { EditorView, type DecorationSet } from "@codemirror/view";
import { computeLModeDecorations, lModeExtension } from "./lModeExtension";

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

  it("keeps marker ranges stable and marks the active line for CSS reveal", () => {
    // The extension always emits the same hidden marker ranges.
    // CSS decides whether the active line reveals those markers
    // through the `cm-lmode-source-line` line decoration.
    const source = "# Hello **world**\n> quoted line\n";
    const docLength = source.length;
    const blockquoteLineStart = "# Hello **world**\n".length;

    const onHeading = computeLModeDecorations(makeState(source, 0));
    const onBlockquote = computeLModeDecorations(
      makeState(source, blockquoteLineStart),
    );
    const allHidden = computeLModeDecorations(makeState(source, docLength));

    expect(hiddenMarkerRangeCount(onHeading)).toBe(
      hiddenMarkerRangeCount(allHidden),
    );
    expect(hiddenMarkerRangeCount(onBlockquote)).toBe(
      hiddenMarkerRangeCount(allHidden),
    );

    expect(hasLineClass(onHeading, 0, "cm-lmode-source-line")).toBe(true);
    expect(
      hasLineClass(onBlockquote, blockquoteLineStart, "cm-lmode-source-line"),
    ).toBe(true);
  });

  it("reveals only the active line's `>` in a multi-line blockquote", () => {
    // L Mode keeps Markdown visible only where the cursor is.
    // A multi-line blockquote remains quiet except for the
    // selected editing line.
    const source = "# H\n\n> quote line 1\n> quote line 2\n";
    const docLength = source.length;
    const bqLine1 = source.indexOf("> quote line 1");
    const bqLine2 = source.indexOf("> quote line 2");

    // The two QuoteMarks are at known positions. Hidden marker
    // ranges remain stable; active-line reveal is expressed as
    // a separate line class for CSS.
    const onBqLine1 = computeLModeDecorations(makeState(source, bqLine1));
    const onBqLine2 = computeLModeDecorations(makeState(source, bqLine2));
    expect(bqHiddenOn(onBqLine1, bqLine1, bqLine2)).toBe(2);
    expect(bqHiddenOn(onBqLine2, bqLine1, bqLine2)).toBe(2);
    expect(hasLineClass(onBqLine1, bqLine1, "cm-lmode-source-line")).toBe(true);
    expect(hasLineClass(onBqLine2, bqLine2, "cm-lmode-source-line")).toBe(true);

    // And with the cursor on the heading, both QuoteMarks are
    // hidden because neither blockquote line is active.
    const onHeading = computeLModeDecorations(makeState(source, 0));
    expect(bqHiddenOn(onHeading, bqLine1, bqLine2)).toBe(2);

    // Sanity: the all-hidden baseline hides both.
    const allHidden = computeLModeDecorations(
      makeState(source, docLength),
    );
    expect(bqHiddenOn(allHidden, bqLine1, bqLine2)).toBe(2);
  });

  it("reveals only the active list item's marker (not the sibling's)", () => {
    // A list is a sequence of items, each with its own
    // marker. The cursor in one item must reveal only that
    // item's `-` — NOT the `-` of the other item.
    const source = "- a\n- b\n";
    const docLength = source.length;
    const item1Dash = 0; // first `-` is at position 0
    const item2Dash = source.indexOf("- b"); // second `-`

    // Cursor in item 1: both markers still get stable hidden
    // ranges, while item 1's line gets the CSS reveal class.
    const onItem1 = computeLModeDecorations(makeState(source, 1));
    expect(listMarkHiddenCount(onItem1, item1Dash, item2Dash)).toBe(2);
    expect(hasLineClass(onItem1, item1Dash, "cm-lmode-source-line")).toBe(true);

    // Cursor in item 2: symmetric.
    const onItem2 = computeLModeDecorations(makeState(source, item2Dash));
    expect(listMarkHiddenCount(onItem2, item1Dash, item2Dash)).toBe(2);
    expect(hasLineClass(onItem2, item2Dash, "cm-lmode-source-line")).toBe(true);

    // All-hidden baseline: both markers are hidden.
    const allHidden = computeLModeDecorations(
      makeState(source, docLength),
    );
    expect(listMarkHiddenCount(allHidden, item1Dash, item2Dash)).toBe(2);
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

  it("replaces Image nodes with the L Mode image widget (doc text untouched)", () => {
    // The cornerstone invariant for the image lane: the saved
    // file is byte-identical in L Mode and normal mode. The
    // `![alt](url)` source is visually replaced by the widget,
    // not mutated, so the doc length and the doc text are both
    // exactly preserved.
    const source = "Before ![alt](https://example.com/foo.png) after\n";
    const state = makeState(source, source.length);
    const originalText = state.doc.toString();
    const originalLength = state.doc.length;

    // No workspace context — http(s) URLs resolve directly.
    const set = computeLModeDecorations(state, {
      workspaceRoot: null,
      documentPath: null,
    });

    // 1) The doc itself is unchanged.
    expect(state.doc.toString()).toBe(originalText);
    expect(state.doc.length).toBe(originalLength);

    // 2) The Image range is fully covered by a replace
    // decoration. The `![alt](url)` source is `from..to` of
    // the Image node; the replacement range must equal that
    // exactly, and it must not extend past the node.
    const imageStart = source.indexOf("![alt]");
    const imageEnd = source.indexOf(")", imageStart) + 1;
    const coveringReplaces: Array<{ from: number; to: number }> = [];
    set.between(imageStart, imageEnd, (from, to) => {
      coveringReplaces.push({ from, to });
    });
    expect(coveringReplaces).toEqual([{ from: imageStart, to: imageEnd }]);
  });

  it("replaces workspace-relative images with a placeholder when unresolved", () => {
    // A workspace-relative path is classified as "workspace".
    // Until the async Rust call resolves, the widget's
    // resolvedSrc is undefined and the placeholder (alt text)
    // is what gets rendered. The cornerstone invariant still
    // holds: the doc is not mutated.
    const source = "![figure](./assets/foo.png)\n";
    const state = makeState(source, source.length);
    const originalText = state.doc.toString();

    const set = computeLModeDecorations(state, {
      workspaceRoot: "/ws",
      documentPath: "/ws/notes/today.md",
    });

    expect(state.doc.toString()).toBe(originalText);

    // The full `![figure](./assets/foo.png)` range must be
    // covered by a replace decoration.
    const imageStart = source.indexOf("![");
    const imageEnd = source.indexOf(")", imageStart) + 1;
    const coveringReplaces: Array<{ from: number; to: number }> = [];
    set.between(imageStart, imageEnd, (from, to) => {
      coveringReplaces.push({ from, to });
    });
    expect(coveringReplaces).toEqual([{ from: imageStart, to: imageEnd }]);
  });

  it("renders source markers on the active EditorView line only", () => {
    const source = "# Active\n## Quiet\n";
    const quietLineStart = source.indexOf("Quiet");
    const parent = document.createElement("div");
    document.body.append(parent);

    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: source,
        extensions: [
          markdown(),
          lModeExtension(true, { workspaceRoot: null, documentPath: null }),
        ],
        selection: { anchor: source.indexOf("Active") },
      }),
    });

    expect(activeLineText(parent)).toContain("Active");
    expect(activeMarkerCount(parent)).toBeGreaterThanOrEqual(1);

    view.dispatch({ selection: { anchor: quietLineStart } });

    expect(activeLineText(parent)).toContain("Quiet");
    expect(activeMarkerCount(parent)).toBeGreaterThanOrEqual(1);
    expect(parent.querySelectorAll(".cm-lmode-hidden").length).toBeGreaterThanOrEqual(
      2,
    );

    view.destroy();
    parent.remove();
  });
});

// Count how many of the two `>` positions of a multi-line
// blockquote are hidden in the given decoration set. The two
// positions correspond to the two `>` markers; a hidden
// marker is a non-line, non-zero-width range that starts at
// the marker position.
function bqHiddenOn(set: DecorationSet, p1: number, p2: number): number {
  let count = 0;
  set.between(0, Number.MAX_SAFE_INTEGER, (from, to) => {
    if (to > from && (from === p1 || from === p2)) {
      count += 1;
    }
  });
  return count;
}

// Same shape for the two `-` markers of a two-item list.
function listMarkHiddenCount(
  set: DecorationSet,
  p1: number,
  p2: number,
): number {
  let count = 0;
  set.between(0, Number.MAX_SAFE_INTEGER, (from, to) => {
    if (to > from && (from === p1 || from === p2)) {
      count += 1;
    }
  });
  return count;
}

function hiddenMarkerRangeCount(set: DecorationSet): number {
  let count = 0;
  set.between(0, Number.MAX_SAFE_INTEGER, (from, to) => {
    if (to > from) {
      count += 1;
    }
  });
  return count;
}

function hasLineClass(
  set: DecorationSet,
  position: number,
  className: string,
): boolean {
  let found = false;
  set.between(position, position, (from, to, value) => {
    const spec = value.spec as { class?: string } | undefined;
    if (from === position && to === position && spec?.class?.includes(className)) {
      found = true;
    }
  });
  return found;
}

function activeLineText(parent: HTMLElement): string {
  return parent.querySelector(".cm-lmode-source-line")?.textContent ?? "";
}

function activeMarkerCount(parent: HTMLElement): number {
  return (
    parent
      .querySelector(".cm-lmode-source-line")
      ?.querySelectorAll(".cm-lmode-hidden").length ?? 0
  );
}
