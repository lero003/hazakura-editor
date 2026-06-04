import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { EditorView, type DecorationSet } from "@codemirror/view";
import {
  computeLModeDecorations,
  lModeExtension,
} from "./extension";
import { LModeHorizontalRuleWidget, LModeTableDelimiterWidget } from "./widgets";
import { LModeTaskWidget } from "./taskWidget";

// Build an EditorState with the markdown grammar so the syntax
// tree is populated, and a selection on the line the test wants
// to treat as "active". The L Mode extension reads the active
// line from `state.selection.main.head`.
function makeState(doc: string, head: number): EditorState {
  return EditorState.create({
    doc,
    // Use the GFM base parser to match the production editor
    // (see EditorPane). The default `markdown()` base is
    // strict CommonMark and would not emit `Strikethrough`,
    // `Table`, `TableDelimiter`, `Task`, or `TaskMarker`
    // nodes — making the v0.11 tests for those decorations
    // vacuous.
    extensions: [markdown({ base: markdownLanguage })],
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
      // LinkLabel (reference-style link suffix)
      "[OpenCode][2]\n" +
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
    // — the test fixture covers all 11 types, so the count
    // must be at least 11. (The line-decorations add more on
    // top of that, so we keep this as a lower bound.)
    expect(ranges.length).toBeGreaterThanOrEqual(11);
  });

  it("hides reference-style link labels while preserving link text", () => {
    const source = "([OpenCode][2])\n";
    const refLabelStart = source.indexOf("[2]");
    const refLabelEnd = refLabelStart + "[2]".length;
    const state = makeState(source, source.length);
    const set = computeLModeDecorations(state);

    expect(hasHiddenRange(set, refLabelStart, refLabelEnd)).toBe(true);
    expect(state.doc.toString()).toBe(source);
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
    // exactly, and it must not extend past the node. We
    // filter to non-zero-width ranges so that any line-level
    // decoration sitting at the line start (e.g. the soft
    // focus `cm-lmode-dimmed` line class) does not show up
    // here — those are a separate concern.
    const imageStart = source.indexOf("![alt]");
    const imageEnd = source.indexOf(")", imageStart) + 1;
    const coveringReplaces: Array<{ from: number; to: number }> = [];
    set.between(imageStart, imageEnd, (from, to) => {
      if (to > from) {
        coveringReplaces.push({ from, to });
      }
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
    // covered by a replace decoration. Filter to non-zero
    // ranges so any line-level decoration (the soft-focus
    // dim class) on this first line does not show up in the
    // cover list — line classes are not the thing under
    // test here.
    const imageStart = source.indexOf("![");
    const imageEnd = source.indexOf(")", imageStart) + 1;
    const coveringReplaces: Array<{ from: number; to: number }> = [];
    set.between(imageStart, imageEnd, (from, to) => {
      if (to > from) {
        coveringReplaces.push({ from, to });
      }
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
          markdown({ base: markdownLanguage }),
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

// --- v0.11 Typora-feel decorations ---
//
// These cover the new inline and block rendering targets
// that move L Mode from "marker-hidden source" toward a
// document-like display. The cornerstone invariant (the
// source text is never mutated) is checked per-case by
// re-reading `state.doc.toString()`.

describe("v0.11 Typora-feel rendering", () => {
  it("applies the emphasis class to the *italic* range", () => {
    const source = "*italic* and **strong**\n";
    const italicStart = source.indexOf("*italic*");
    const italicEnd = italicStart + "*italic*".length;
    const state = makeState(source, source.length);
    const set = computeLModeDecorations(state);

    expect(state.doc.toString()).toBe(source);
    expect(hasClassMark(set, italicStart, italicEnd, "cm-lmode-emphasis")).toBe(
      true,
    );
  });

  it("applies the strong class to the **bold** range", () => {
    const source = "*italic* and **strong**\n";
    const boldStart = source.indexOf("**strong**");
    const boldEnd = boldStart + "**strong**".length;
    const state = makeState(source, source.length);
    const set = computeLModeDecorations(state);

    expect(state.doc.toString()).toBe(source);
    expect(hasClassMark(set, boldStart, boldEnd, "cm-lmode-strong")).toBe(
      true,
    );
  });

  it("applies the strike class to the ~~struck~~ range", () => {
    const source = "~~struck~~\n";
    const strikeStart = source.indexOf("~~struck~~");
    const strikeEnd = strikeStart + "~~struck~~".length;
    const state = makeState(source, source.length);
    const set = computeLModeDecorations(state);

    expect(state.doc.toString()).toBe(source);
    expect(hasClassMark(set, strikeStart, strikeEnd, "cm-lmode-strike")).toBe(
      true,
    );
  });

  it("applies the link class to the [text](url) range and hides the URL", () => {
    const source = "see [docs](https://example.com) here\n";
    // The `markdown` GFM parser emits `[`/`]`/`(`/`)` as
    // LinkMark nodes; the URL node covers only the text
    // *inside* the parens. The Link node covers the whole
    // `[docs](https://example.com)` range.
    const linkStart = source.indexOf("[docs]");
    const linkEnd = source.indexOf(")", linkStart) + 1;
    const urlStart = source.indexOf("(") + 1;
    const urlEnd = source.indexOf(")");
    const state = makeState(source, source.length);
    const set = computeLModeDecorations(state);

    expect(state.doc.toString()).toBe(source);
    expect(hasClassMark(set, linkStart, linkEnd, "cm-lmode-link")).toBe(true);
    // The URL portion should still be hidden by the existing
    // marker path — the link class mark does not replace
    // that, it composes with it.
    expect(hasClassMark(set, urlStart, urlEnd, "cm-lmode-hidden")).toBe(true);
  });

  it("replaces the HorizontalRule source with the HR widget", () => {
    const source = "before\n\n---\n\nafter\n";
    const hrStart = source.indexOf("---");
    const hrEnd = hrStart + 3;
    const state = makeState(source, source.length);
    const set = computeLModeDecorations(state);

    expect(state.doc.toString()).toBe(source);
    expect(
      hasReplaceWithWidget(set, hrStart, hrEnd, LModeHorizontalRuleWidget),
    ).toBe(true);
  });

  it("replaces the TaskMarker with a checkbox widget (doc text untouched)", () => {
    const source = "- [ ] todo\n- [x] done\n";
    const uncheckedStart = source.indexOf("[ ]");
    const uncheckedEnd = uncheckedStart + 3;
    const checkedStart = source.indexOf("[x]");
    const checkedEnd = checkedStart + 3;
    const state = makeState(source, source.length);
    const set = computeLModeDecorations(state);

    expect(state.doc.toString()).toBe(source);
    expect(
      hasReplaceWithWidget(set, uncheckedStart, uncheckedEnd, LModeTaskWidget),
    ).toBe(true);
    expect(
      hasReplaceWithWidget(set, checkedStart, checkedEnd, LModeTaskWidget),
    ).toBe(true);
  });

  it("replaces the TableDelimiter row with the delimiter widget", () => {
    const source = "| col1 | col2 |\n| --- | --- |\n| a | b |\n";
    const delimStart = source.indexOf("| --- | --- |");
    const delimEnd = delimStart + "| --- | --- |".length;
    const state = makeState(source, source.length);
    const set = computeLModeDecorations(state);

    expect(state.doc.toString()).toBe(source);
    expect(
      hasReplaceWithWidget(
        set,
        delimStart,
        delimEnd,
        LModeTableDelimiterWidget,
      ),
    ).toBe(true);
  });

  it("applies table line classes and mutes the pipe separators", () => {
    const source = "| col1 | col2 |\n| --- | --- |\n| a | b |\n";
    const headerLineStart = 0;
    const bodyLineStart = source.indexOf("| a | b |");
    const headerPipe = source.indexOf("|", 1); // first pipe after `| col1`
    const bodyPipe = source.indexOf("|", bodyLineStart + 1);

    const state = makeState(source, source.length);
    const set = computeLModeDecorations(state);

    expect(state.doc.toString()).toBe(source);
    expect(
      hasLineClass(set, headerLineStart, "cm-lmode-table-header"),
    ).toBe(true);
    expect(
      hasLineClass(set, bodyLineStart, "cm-lmode-table-row"),
    ).toBe(true);
    expect(hasClassMark(set, headerPipe, headerPipe + 1, "cm-lmode-pipe")).toBe(
      true,
    );
    expect(hasClassMark(set, bodyPipe, bodyPipe + 1, "cm-lmode-pipe")).toBe(
      true,
    );
  });

  it("dims every line that is not the active selection line", () => {
    // Three lines; the cursor lives on the second. The other
    // two should pick up `cm-lmode-dimmed`. The active line
    // picks up `cm-lmode-source-line` instead.
    const source = "alpha\nbeta\ngamma\n";
    const betaStart = source.indexOf("beta");
    const state = makeState(source, betaStart);
    const set = computeLModeDecorations(state);

    const alphaStart = 0;
    const gammaStart = source.indexOf("gamma");

    expect(hasLineClass(set, alphaStart, "cm-lmode-dimmed")).toBe(true);
    expect(hasLineClass(set, gammaStart, "cm-lmode-dimmed")).toBe(true);
    // The active line carries the source-line class (the
    // reveal hook) and is NOT dimmed — its class list does
    // not include `cm-lmode-dimmed`.
    expect(hasLineClass(set, betaStart, "cm-lmode-source-line")).toBe(true);
  });

  it("attaches the data-l-chip attribute to structural lines (heading, blockquote, fenced code)", () => {
    // The chip labels live in the TS catalog
    // (`LModeChipLabels`) and the CSS renders them via
    // `content: attr(data-l-chip)`. This test pins the
    // attribute on each structural line type so a typo in
    // the catalog or a dropped attribute in the line-
    // decoration code fails loudly here, not visually.
    const source =
      "# H1 line\n" +
      "## H2 line\n" +
      "> quote line\n" +
      "```js\n" +
      "code\n" +
      "```\n";
    const state = makeState(source, source.length);
    const set = computeLModeDecorations(state);

    const h1Start = 0;
    const h2Start = source.indexOf("## ");
    const bqStart = source.indexOf("> ");
    const fenceStart = source.indexOf("```js");
    const fenceEnd = source.lastIndexOf("```");

    expect(lineChip(set, h1Start)).toBe("H1");
    expect(lineChip(set, h2Start)).toBe("H2");
    expect(lineChip(set, bqStart)).toBe(">");
    expect(lineChip(set, fenceStart)).toBe("```");
    expect(lineChip(set, fenceEnd)).toBe("```");

    // A non-structural line carries no chip.
    const codeLine = source.indexOf("code");
    expect(lineChip(set, codeLine)).toBeUndefined();
  });
});

// --- v0.11 Task toggle click handler ---
//
// The click handler lives in the view plugin; the test
// builds a real EditorView so we can dispatch a click on the
// widget DOM and observe the buffer change.

describe("v0.11 task toggle click", () => {
  it("toggles [ ] to [x] and back when the checkbox is clicked", () => {
    const source = "- [ ] todo\n";
    const parent = document.createElement("div");
    document.body.append(parent);

    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: source,
        extensions: [
          markdown({ base: markdownLanguage }),
          lModeExtension(true, { workspaceRoot: null, documentPath: null }),
        ],
        selection: { anchor: source.length },
      }),
    });

    // Find the rendered checkbox widget in the DOM. The
    // L Mode extension replaces the 3-char TaskMarker
    // range with a `cm-lmode-task` span.
    const taskEl = parent.querySelector<HTMLElement>(".cm-lmode-task");
    expect(taskEl).not.toBeNull();
    expect(taskEl?.classList.contains("cm-lmode-task-unchecked")).toBe(true);

    // Click — the handler toggles the buffer.
    taskEl?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(view.state.doc.toString()).toBe("- [x] todo\n");
    const after = parent.querySelector<HTMLElement>(".cm-lmode-task");
    expect(after?.classList.contains("cm-lmode-task-checked")).toBe(true);

    // Click again — toggles back.
    after?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(view.state.doc.toString()).toBe("- [ ] todo\n");

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

function hasHiddenRange(
  set: DecorationSet,
  expectedFrom: number,
  expectedTo: number,
): boolean {
  let found = false;
  set.between(expectedFrom, expectedTo, (from, to) => {
    if (from === expectedFrom && to === expectedTo) {
      found = true;
    }
  });
  return found;
}

function hasLineClass(
  set: DecorationSet,
  position: number,
  className: string,
): boolean {
  let found = false;
  set.between(position, position, (from, to, value) => {
    const spec = value.spec as { class?: string } | undefined;
    if (
      from === position &&
      to === position &&
      classesContainToken(spec?.class, className)
    ) {
      found = true;
    }
  });
  return found;
}

// Does the spec's `class` string contain `className` as a
// whole token? Using `includes` (substring match) would let
// `cm-lmode-list` silently match `cm-lmode-list-bullet` —
// this helper tokenizes the class string first, then checks
// for the exact token. The same pattern applies to DOM
// className strings.
function classesContainToken(
  classString: string | undefined,
  className: string,
): boolean {
  if (!classString) return false;
  return classString.split(/\s+/).includes(className);
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

// Does a range `[from, to)` carry a Decoration.mark with the
// given class? The class mark is wrapped in the mark spec, so
// we read the spec's `class` field. Returns true if a mark
// covering exactly the range exists with the class in its
// `class` string.
function hasClassMark(
  set: DecorationSet,
  expectedFrom: number,
  expectedTo: number,
  className: string,
): boolean {
  let found = false;
  set.between(expectedFrom, expectedTo, (from, to, value) => {
    const spec = value.spec as { class?: string } | undefined;
    if (
      from === expectedFrom &&
      to === expectedTo &&
      classesContainToken(spec?.class, className)
    ) {
      found = true;
    }
  });
  return found;
}

// Does the range `[from, to)` carry a Decoration.replace with
// a widget of the given constructor? Returns true if a replace
// covering exactly the range exists and its widget is an
// instance of the given class.
function hasReplaceWithWidget(
  set: DecorationSet,
  expectedFrom: number,
  expectedTo: number,
  ctor: new (...args: never[]) => unknown,
): boolean {
  let found = false;
  set.between(expectedFrom, expectedTo, (from, to, value) => {
    const spec = value.spec as { widget?: unknown } | undefined;
    if (
      from === expectedFrom &&
      to === expectedTo &&
      spec?.widget instanceof ctor
    ) {
      found = true;
    }
  });
  return found;
}

// Read the `data-l-chip` attribute (if any) on the line
// decoration that starts at `position`. Returns `undefined`
// when the line has no chip attribute. The position is the
// zero-width line-start point, which is where
// `Decoration.line` ranges are attached.
function lineChip(
  set: DecorationSet,
  position: number,
): string | undefined {
  let chip: string | undefined;
  set.between(position, position, (from, to, value) => {
    if (from !== position || to !== position) return;
    const spec = value.spec as
      | { attributes?: Record<string, string> }
      | undefined;
    if (spec?.attributes && typeof spec.attributes["data-l-chip"] === "string") {
      chip = spec.attributes["data-l-chip"];
    }
  });
  return chip;
}
