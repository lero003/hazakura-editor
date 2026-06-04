// L Mode (えるモード) — Markdown marker suppression extension.
//
// This is the v0.9 display-only decoration engine for L Mode.
// It marks Markdown marker characters (`#`, `*`, `_`, `>`,
// `-`, backticks, link brackets, etc.) as visually hidden so
// the document reads closer to prose. Active and hovered lines
// receive a CSS reveal path so the user can still see what
// they are editing. In v0.9+ it also replaces `Image` nodes
// with the L Mode image widget (see `lModeImageWidget.ts`).
//
// CRITICAL INVARIANT — saved file is byte-identical in L Mode
// and normal mode. The extension only adds `Decoration.mark`,
// `Decoration.line`, and `Decoration.replace` ranges; the
// underlying document text is never modified. The test in
// `lModeExtension.test.ts` enforces this end-to-end.

import {
  Compartment,
  EditorState,
  type Extension,
  Facet,
  type Range,
  StateField,
} from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  WidgetType,
} from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import {
  classifyImageUrl,
  ensureWorkspaceImageResolved,
  LModeImageWidget,
  lModeImageResolverPlugin,
  peekResolvedImage,
  refreshImagesEffect,
} from "./lModeImageWidget";
import {
  LModeTaskWidget,
  lModeTaskClickPlugin,
} from "./lModeTaskWidget";
import type { SyntaxNode } from "@lezer/common";

export const lModeCompartment = new Compartment();

// Context the L Mode extension needs from the surrounding app
// to resolve workspace-relative image URLs. Provided as a
// Facet (not a Compartment) because the values change with
// document switches and we want React to drive the update
// without rebuilding the editor.
//
// `workspaceRoot` and `documentPath` are both nullable: when
// no workspace is open, image URLs fall back to the alt-text
// placeholder (no file read is attempted).
export type LModeContext = {
  workspaceRoot: string | null;
  documentPath: string | null;
};

export const lModeContextFacet = Facet.define<LModeContext, LModeContext>({
  combine: (values) => values[values.length - 1] ?? { workspaceRoot: null, documentPath: null },
});

const hiddenMarker = Decoration.mark({ class: "cm-lmode-hidden" });
const sourceLineClass = "cm-lmode-source-line";
const dimmedLineClass = "cm-lmode-dimmed";

// Inline rendering marks. Applied to the parent node range of
// the construct (Emphasis / StrongEmphasis / Strikethrough /
// Link). The marker children inside the range are still hidden
// by the existing `MARKER_NODE_NAMES` path, so the visible
// portion of the range is just the prose text, and the parent
// class drives its visual style (italic / bold / line-through /
// link color).
const emphasisClassMark = Decoration.mark({ class: "cm-lmode-emphasis" });
const strongClassMark = Decoration.mark({ class: "cm-lmode-strong" });
const strikeClassMark = Decoration.mark({ class: "cm-lmode-strike" });
const linkClassMark = Decoration.mark({ class: "cm-lmode-link" });
const pipeClassMark = Decoration.mark({ class: "cm-lmode-pipe" });

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
//   LinkLabel      — the `[ref]` suffix of a reference link
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
  "LinkLabel",
  "StrikethroughMark",
  "TaskMarker",
  "CodeInfo",
]);

function buildLModeDecorations(
  state: EditorState,
  context: LModeContext,
): DecorationSet {
  return computeLModeDecorations(state, context);
}

/**
 * Build the L Mode decoration set for the given editor state.
 *
 * Exported for unit tests so the cornerstone invariant ("saved
 * file is byte-identical in L Mode and normal mode") can be
 * asserted without spinning up a full EditorView.
 */
export function computeLModeDecorations(
  state: EditorState,
  context: LModeContext = { workspaceRoot: null, documentPath: null },
): DecorationSet {
  const contentDecorations: Range<Decoration>[] = [];
  const tree = syntaxTree(state);

  // Reveal Markdown markers only on the active selection
  // line(s). Everything outside the user's current editing
  // line stays visually quiet.
  const activeLineRanges = getActiveLineRanges(state);

  // Block-level decoration targets. These are attached to the
  // line containing the block (not to the marker range) so the
  // whole line picks up the L Mode rhythm. Built up as a
  // line-number → class map.
  const lineClasses = new Map<number, string[]>();

  for (const line of activeLineRanges) {
    pushLineClass(lineClasses, line.number, sourceLineClass);
  }

  // Soft focus: every line that is NOT part of the active
  // selection gets `cm-lmode-dimmed`. The CSS rule lowers its
  // opacity so the cursor's line(s) stand out without us having
  // to track the cursor in a special way. The active-line
  // reveal is still expressed by `sourceLineClass` on top of
  // the dim (CSS sets opacity: 1 for active lines), so the
  // two signals compose cleanly.
  const activeLineNumbers = new Set(activeLineRanges.map((l) => l.number));
  for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber++) {
    if (!activeLineNumbers.has(lineNumber)) {
      pushLineClass(lineClasses, lineNumber, dimmedLineClass);
    }
  }

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

      // Image — replace the source text visually with the
      // L Mode image widget. The widget handles cursor
      // navigation (`ignoreEvent: false`) and is byte-identical
      // to the source under the hood. We do NOT descend into
      // the Image's children (LinkMark / URL): once we've
      // decided to replace the whole node, the markers inside
      // it are no longer relevant.
      if (name === "Image") {
        const imageNode = node.node;
        const alt = getImageAlt(imageNode, state);
        const rawUrl = getImageUrl(imageNode, state);
        if (rawUrl) {
          const classified = classifyImageUrl(
            rawUrl,
            context.documentPath,
            context.workspaceRoot,
          );
          let resolvedSrc: string | null | undefined;
          if (classified.kind === "http" || classified.kind === "data") {
            resolvedSrc = classified.value;
          } else if (classified.kind === "workspace") {
            const cached = peekResolvedImage(
              context.workspaceRoot as string,
              classified.value,
            );
            if (cached !== undefined) {
              resolvedSrc = cached;
            } else {
              resolvedSrc = undefined;
              ensureWorkspaceImageResolved(
                context.workspaceRoot as string,
                classified.value,
              );
            }
          } else {
            // Outside the workspace — placeholder forever, no read.
            resolvedSrc = null;
          }
          contentDecorations.push(
            Decoration.replace({
              widget: new LModeImageWidget(rawUrl, resolvedSrc, alt),
            }).range(node.from, node.to),
          );
        }
        return false;
      }

      // HorizontalRule — replace the `---` / `***` / `___`
      // source with a thin-line widget. The widget carries the
      // visual divider; the underlying doc text is untouched.
      if (name === "HorizontalRule") {
        contentDecorations.push(
          Decoration.replace({
            widget: new LModeHorizontalRuleWidget(),
          }).range(node.from, node.to),
        );
        return false;
      }

      // Task list — the `Task` node is the whole list-item
      // line. The 3-char `TaskMarker` child is what we replace
      // with the checkbox widget; the rest of the line is
      // normal text the user types. We return true so the
      // iterator descends and visits the TaskMarker, where
      // the widget replacement is emitted.
      if (name === "Task") {
        return true;
      }
      if (name === "TaskMarker") {
        const markerText = state.doc.sliceString(node.from, node.to);
        const checked = markerText === "[x]";
        contentDecorations.push(
          Decoration.replace({
            widget: new LModeTaskWidget(node.from, node.to, checked),
          }).range(node.from, node.to),
        );
        return false;
      }

      // Tables — the delimiter row (`| --- | --- |`) is
      // visual noise once the line borders do the same job, so
      // we collapse it to an empty widget and let the next
      // line sit immediately under the header. TableHeader and
      // TableRow get line classes; we also walk each line to
      // mark every `|` with a muted class so the cell
      // separators read as quiet vertical rules instead of
      // raw source characters.
      if (name === "TableDelimiter") {
        contentDecorations.push(
          Decoration.replace({ widget: new LModeTableDelimiterWidget() }).range(
            node.from,
            node.to,
          ),
        );
        return false;
      }
      if (name === "TableHeader") {
        const fromLine = state.doc.lineAt(node.from).number;
        pushLineClass(lineClasses, fromLine, "cm-lmode-table-header");
        addPipeMarks(state, state.doc.line(fromLine), contentDecorations);
        return true;
      }
      if (name === "TableRow") {
        const fromLine = state.doc.lineAt(node.from).number;
        pushLineClass(lineClasses, fromLine, "cm-lmode-table-row");
        addPipeMarks(state, state.doc.line(fromLine), contentDecorations);
        return true;
      }

      // Inline emphasis / strong / strikethrough — apply a
      // class mark to the parent node range. The marker
      // children inside the range are still hidden by the
      // `MARKER_NODE_NAMES` path below, so the visible
      // portion is just the prose text picking up the
      // visual style (italic / bold / line-through).
      if (name === "Emphasis") {
        contentDecorations.push(emphasisClassMark.range(node.from, node.to));
        return true;
      }
      if (name === "StrongEmphasis") {
        contentDecorations.push(strongClassMark.range(node.from, node.to));
        return true;
      }
      if (name === "Strikethrough") {
        contentDecorations.push(strikeClassMark.range(node.from, node.to));
        return true;
      }
      // Link — the parent class mark styles the visible link
      // text. The LinkMark / URL children are hidden as before,
      // so the user sees a single styled `link text` span.
      if (name === "Link") {
        contentDecorations.push(linkClassMark.range(node.from, node.to));
        return true;
      }

      if (!MARKER_NODE_NAMES.has(name)) {
        return true;
      }

      // Always mark source syntax as hidden. Active-line and
      // hover reveal are purely CSS concerns via
      // `.cm-lmode-source-line`, so style changes cannot change
      // which marker ranges exist.
      contentDecorations.push(hiddenMarker.range(node.from, node.to));
      // Do not descend into marker children (markers are leaves).
      return false;
    },
  });

  const lineDecorations = buildLineDecorations(state, lineClasses);
  return Decoration.set(
    sortDecorations([...lineDecorations, ...contentDecorations]),
    true,
  );
}

function buildLineDecorations(
  state: EditorState,
  lineClasses: Map<number, string[]>,
): Range<Decoration>[] {
  const decorations: Range<Decoration>[] = [];
  for (const [line, classes] of lineClasses) {
    const lineInfo = state.doc.line(line);
    const lineStart = lineInfo.from;
    const className = classes.join(" ");
    decorations.push(
      Decoration.line({ class: className }).range(lineStart, lineStart),
    );
  }
  return decorations;
}

function sortDecorations(
  decorations: Range<Decoration>[],
): Range<Decoration>[] {
  // Stable sort: range decorations must be in increasing `from`
  // order for CodeMirror to apply them without warnings. Callers
  // pass line decorations first, so stable same-position ordering
  // keeps line classes attached before inline marker marks.
  return decorations.sort((a, b) => a.from - b.from);
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

// Mark every `|` in the given line with the muted `cm-lmode-pipe`
// class. The `|` characters in a Markdown table line are the
// cell separators; making them muted and slightly recessed
// gives the table line a typographic feel that matches the
// rest of L Mode's body text. In a typical table line the
// pipes are the visual structure, not part of the cell text.
function addPipeMarks(
  state: EditorState,
  line: { from: number; to: number },
  decorations: Range<Decoration>[],
): void {
  const text = state.doc.sliceString(line.from, line.to);
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "|") {
      decorations.push(pipeClassMark.range(line.from + i, line.from + i + 1));
    }
  }
}

// Widget for `---` / `***` / `___` HorizontalRule nodes.
// The widget renders a single thin divider line; the
// underlying source text is not modified. The line keeps its
// own height (driven by the editor's line-height) so the
// rule sits with comfortable whitespace above and below.
// Exported for tests that verify the right widget is
// attached to the right range.
export class LModeHorizontalRuleWidget extends WidgetType {
  toDOM(): HTMLElement {
    const el = document.createElement("div");
    el.className = "cm-lmode-hr";
    el.setAttribute("aria-hidden", "true");
    return el;
  }
}

// Widget for the `| --- | --- |` TableDelimiter row. We
// collapse it to a near-zero-height empty node so the line
// contributes only the spacing the next line needs, without
// showing the delimiter source. Exported for tests.
export class LModeTableDelimiterWidget extends WidgetType {
  toDOM(): HTMLElement {
    const el = document.createElement("span");
    el.className = "cm-lmode-table-delimiter";
    el.setAttribute("aria-hidden", "true");
    return el;
  }
}

const lModeField = StateField.define<DecorationSet>({
  create(state) {
    return buildLModeDecorations(state, readContext(state));
  },
  update(decorations, transaction) {
    // Recompute when the doc changes, when the selection
    // changes (so the active-line reveal follows the cursor),
    // when the L Mode context facet changes (different
    // workspace / document path), or when an async image
    // resolution lands (refreshImagesEffect).
    const contextChanged =
      transaction.startState.facet(lModeContextFacet) !==
      transaction.state.facet(lModeContextFacet);
    const refreshFired = transaction.effects.some(
      (e) => e.is(refreshImagesEffect),
    );
    if (
      transaction.docChanged ||
      transaction.selection !== undefined ||
      contextChanged ||
      refreshFired
    ) {
      return buildLModeDecorations(transaction.state, readContext(transaction.state));
    }
    return decorations.map(transaction.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});

function readContext(state: EditorState): LModeContext {
  return state.facet(lModeContextFacet);
}

export function lModeExtension(
  active: boolean,
  context: LModeContext,
): Extension {
  // The Compartment is exported so EditorPane can reconfigure
  // the active state from a single place without rebuilding
  // the entire extension list. When `active` is false, the
  // field is removed from the state entirely; no decorations
  // are computed.
  //
  // The image resolver ViewPlugin captures the live EditorView
  // for async image resolution dispatches. It is only
  // constructed when L Mode is on, so toggling L Mode off
  // also drops the plugin.
  return lModeCompartment.of(
    active
      ? [
          lModeField,
          lModeContextFacet.of(context),
          lModeImageResolverPlugin(),
          lModeTaskClickPlugin(),
        ]
      : [lModeContextFacet.of(context)],
  );
}

// --- Active line detection ---

function getActiveLineRanges(
  state: EditorState,
): Array<{ number: number; from: number; to: number }> {
  const ranges: Array<{ number: number; from: number; to: number }> = [];
  for (const selection of state.selection.ranges) {
    const from = Math.min(selection.from, selection.to);
    const to = Math.max(selection.from, selection.to);
    const fromLine = state.doc.lineAt(from);
    const toLine = state.doc.lineAt(to);
    for (let lineNumber = fromLine.number; lineNumber <= toLine.number; lineNumber++) {
      const line = state.doc.line(lineNumber);
      ranges.push({ number: line.number, from: line.from, to: line.to });
    }
  }
  return ranges;
}

// --- Image node helpers ---

// Walk an Image node's children looking for the alt text and
// the URL. The Markdown GFM Image structure is:
//
//   Image
//     LinkMark ("[")
//     LinkLabel / alt text
//     LinkMark ("]")
//     URL
//
// The alt text is whatever sits between the two LinkMark nodes
// at the top of the Image, and the URL is the URL child node.
function getImageAlt(imageNode: SyntaxNode, state: EditorState): string {
  let child = imageNode.firstChild;
  let altStart = -1;
  let altEnd = -1;
  let openBrackets = 0;
  while (child) {
    if (child.name === "LinkMark") {
      if (openBrackets === 0) {
        altStart = child.to;
      } else {
        altEnd = child.from;
        break;
      }
      openBrackets += 1;
    }
    child = child.nextSibling;
  }
  if (altStart === -1 || altEnd === -1) return "";
  return state.doc.sliceString(altStart, altEnd);
}

function getImageUrl(imageNode: SyntaxNode, state: EditorState): string | null {
  let child = imageNode.firstChild;
  while (child) {
    if (child.name === "URL") {
      // The URL node covers the `(url)` form; the actual URL
      // is the inside. The leading "(" and trailing ")" are
      // separate characters in the source.
      const inner = state.doc.sliceString(child.from, child.to);
      return inner.replace(/^\(|\)$/g, "");
    }
    child = child.nextSibling;
  }
  return null;
}
