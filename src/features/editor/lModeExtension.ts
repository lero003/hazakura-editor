// L Mode (えるモード) — Markdown marker suppression extension.
//
// This is the v0.9 display-only decoration engine for L Mode.
// It hides Markdown marker characters (`#`, `*`, `_`, `>`,
// `-`, backticks, link brackets, etc.) in *inactive* lines
// so the document reads closer to prose. The active line is
// always revealed so the user can still see what they are
// editing.
//
// CRITICAL INVARIANT — saved file is byte-identical in L Mode
// and normal mode. The extension only adds `Decoration.mark`
// and `Decoration.line` ranges; the underlying document text
// is never modified. The test in
// `lModeExtension.test.ts` enforces this end-to-end.

import {
  Compartment,
  EditorState,
  type Extension,
  type Range,
  StateField,
} from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
} from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";

export const lModeCompartment = new Compartment();

const hiddenMarker = Decoration.mark({ class: "cm-lmode-hidden" });

// Marker node names to hide. Each entry is a Lezer node name
// from @lezer/markdown (or its GFM extension) that represents
// a Markdown marker character — i.e. a syntactic glyph, not the
// content the marker wraps.
//   HeaderMark     — the `#` characters in an ATX heading
//   EmphasisMark   — `*`, `_`, and the `**` / `__` strong
//                    delimiters (the parser counts adjacent
//                    marks; the tree still emits one
//                    EmphasisMark per `*` / `_`).
//   CodeMark       — backticks for inline code AND the fence
//                    delimiters of a FencedCode block
//   QuoteMark      — the `>` at the start of a blockquote line
//   ListMark       — `-`, `*`, `+`, or `1.` at the start of a
//                    list item
//   LinkMark       — the `[` and `]` of a link / image
//   URL            — the `(...)` of a link / image URL
//   StrikethroughMark — the `~~` of a GFM strikethrough
//   TaskMarker     — the `[ ]` / `[x]` of a GFM task list
//   CodeInfo       — the language spec after the opening fence
const MARKER_NODE_NAMES = new Set<string>([
  "HeaderMark",
  "EmphasisMark",
  "CodeMark",
  "QuoteMark",
  "ListMark",
  "LinkMark",
  "URL",
  "StrikethroughMark",
  "TaskMarker",
  "CodeInfo",
]);

function buildLModeDecorations(state: EditorState): DecorationSet {
  return computeLModeDecorations(state);
}

/**
 * Build the L Mode decoration set for the given editor state.
 *
 * Exported for unit tests so the cornerstone invariant ("saved
 * file is byte-identical in L Mode and normal mode") can be
 * asserted without spinning up a full EditorView.
 */
export function computeLModeDecorations(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const tree = syntaxTree(state);

  // The active line is the line containing the main selection
  // head. Markers on this line are NOT hidden so the user can
  // still see what they are editing as they type.
  const activeHead = state.selection.main.head;
  const activeLineNumber = state.doc.lineAt(activeHead).number;

  // Block-level decoration targets. These are attached to the
  // line containing the block (not to the marker range) so the
  // whole line picks up the L Mode rhythm. Built up as a
  // line-number → class map.
  const lineClasses = new Map<number, string[]>();

  tree.iterate({
    enter(node) {
      const name = node.name;

      // Block-level heading decoration (so the line picks up
      // the L Mode heading rhythm even after the `#` is hidden).
      // We must return true (or fall through) here so the
      // iteration descends into the heading's children — the
      // `HeaderMark` node is a child of the heading, and we
      // need to visit it to decide whether to hide the `#`.
      if (name === "ATXHeading1") {
        pushHeadingClass(lineClasses, state, node.from, "cm-lmode-heading-1");
        return true;
      }
      if (name === "ATXHeading2") {
        pushHeadingClass(lineClasses, state, node.from, "cm-lmode-heading-2");
        return true;
      }
      if (name === "ATXHeading3") {
        pushHeadingClass(lineClasses, state, node.from, "cm-lmode-heading-3");
        return true;
      }
      if (name === "ATXHeading4") {
        pushHeadingClass(lineClasses, state, node.from, "cm-lmode-heading-4");
        return true;
      }
      if (name === "ATXHeading5") {
        pushHeadingClass(lineClasses, state, node.from, "cm-lmode-heading-5");
        return true;
      }
      if (name === "ATXHeading6") {
        pushHeadingClass(lineClasses, state, node.from, "cm-lmode-heading-6");
        return true;
      }
      if (name === "Blockquote") {
        const fromLine = state.doc.lineAt(node.from).number;
        const toLine = state.doc.lineAt(node.to).number;
        for (let line = fromLine; line <= toLine; line++) {
          pushLineClass(lineClasses, line, "cm-lmode-blockquote");
        }
      }
      if (name === "BulletList" || name === "OrderedList") {
        const fromLine = state.doc.lineAt(node.from).number;
        const toLine = state.doc.lineAt(node.to).number;
        for (let line = fromLine; line <= toLine; line++) {
          pushLineClass(lineClasses, line, "cm-lmode-list");
        }
      }
      if (name === "FencedCode") {
        const fromLine = state.doc.lineAt(node.from).number;
        const toLine = state.doc.lineAt(node.to).number;
        for (let line = fromLine; line <= toLine; line++) {
          pushLineClass(lineClasses, line, "cm-lmode-fenced-code");
        }
        pushLineClass(
          lineClasses,
          fromLine,
          "cm-lmode-fenced-code-start",
        );
        pushLineClass(
          lineClasses,
          toLine,
          "cm-lmode-fenced-code-end",
        );
      }

      if (!MARKER_NODE_NAMES.has(name)) {
        return true;
      }

      // Hide the marker, but only if its line is not the active
      // line. The active line is always revealed so the user
      // can see what they are typing.
      const markerLine = state.doc.lineAt(node.from).number;
      if (markerLine === activeLineNumber) {
        return false;
      }

      decorations.push(hiddenMarker.range(node.from, node.to));
      // Do not descend into marker children (markers are leaves).
      return false;
    },
  });

  for (const [line, classes] of lineClasses) {
    const lineInfo = state.doc.line(line);
    const lineStart = lineInfo.from;
    const className = classes.join(" ");
    decorations.push(
      Decoration.line({ class: className }).range(lineStart, lineStart),
    );
  }

  // Stable sort: range decorations must be in increasing `from`
  // order for CodeMirror to apply them without warnings.
  decorations.sort((a, b) => a.from - b.from);

  return Decoration.set(decorations, true);
}

function pushHeadingClass(
  map: Map<number, string[]>,
  state: EditorState,
  position: number,
  className: string,
): void {
  const line = state.doc.lineAt(position).number;
  pushLineClass(map, line, className);
}

function pushLineClass(
  map: Map<number, string[]>,
  line: number,
  className: string,
): void {
  const existing = map.get(line);
  if (existing) {
    if (!existing.includes(className)) {
      existing.push(className);
    }
    return;
  }
  map.set(line, [className]);
}

const lModeField = StateField.define<DecorationSet>({
  create(state) {
    return buildLModeDecorations(state);
  },
  update(decorations, transaction) {
    // Recompute on every doc change or selection change —
    // selection changes are the active-line reveal. When the
    // user moves the cursor into a new line, the markers on
    // the new line are unhidden on the same paint frame.
    if (transaction.docChanged || transaction.selection !== undefined) {
      return buildLModeDecorations(transaction.state);
    }
    return decorations.map(transaction.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});

export function lModeExtension(active: boolean): Extension {
  // The Compartment is exported so EditorPane can reconfigure
  // the active state from a single place without rebuilding
  // the entire extension list. When `active` is false, the
  // field is removed from the state entirely; no decorations
  // are computed.
  return lModeCompartment.of(active ? [lModeField] : []);
}
