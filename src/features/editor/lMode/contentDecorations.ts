// L Mode (えるモード) — content-decoration computation.
//
// This file holds the pure function that maps an
// `EditorState` + `LModeContext` to a list of inline
// `Range<Decoration>` entries. The output covers four
// concerns:
//
//   1. **Marker hiding.** Every Lezer node whose name is
//      in `LModeMarkerNodeNames` (the `#` of a heading, the
//      `*` of emphasis, the `>` of a blockquote, the
//      backticks of a code span, etc.) gets a
//      `LModeClasses.hiddenMarker` mark, which CSS renders as
//      a zero-width transparent span. This is the cornerstone
//      of L Mode's "marker suppression" behavior.
//
//   2. **Inline styling.** Parent nodes like `Emphasis`,
//      `StrongEmphasis`, `Strikethrough`, and `Link` get
//      their own class mark on the parent range (italic,
//      bold, line-through, link color). The marker children
//      inside those ranges are still hidden by the marker
//      pass, so the visible text is just the prose picking
//      up the visual style.
//
//   3. **Widget replacements.** `Image`, `HorizontalRule`,
//      `TableDelimiter`, and `TaskMarker` nodes are replaced
//      with display-only widgets. The underlying doc text is
//      never modified — this is the cornerstone invariant
//      the test suite enforces.
//
//   4. **Pipe marks in tables.** Every `|` in a table row
//      gets a muted class so the cell separators read as
//      quiet vertical rules instead of raw source
//      characters.
//
// The line-classes map (built by `lineDecorations.ts`) is
// NOT touched here — line decorations are a separate pass
// over the same state.

import type { EditorState, Range } from "@codemirror/state";
import { Decoration, type DecorationSet } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import type { SyntaxNode } from "@lezer/common";
import {
  LModeClasses,
  LModeInlineRules,
  LModeMarkerNodeNames,
  LModeChipLabels,
} from "./classes";
import {
  classifyImageUrl,
  ensureWorkspaceImageResolved,
  LModeImageWidget,
  peekResolvedImage,
} from "./imageWidget";
import { LModeTaskWidget } from "./taskWidget";
import {
  LModeHorizontalRuleWidget,
  LModeTableDelimiterWidget,
} from "./widgets";
import type { LModeContext } from "./extension";

// --- Decoration factories ---
//
// The `Decoration` constructors are called inside the tree
// walk, so caching the mark objects as module-level
// constants keeps the per-call cost down. The replacement
// widgets (image, task, HR, table delimiter) are constructed
// per-range because they carry per-instance data.

const hiddenMarker = Decoration.mark({ class: LModeClasses.hiddenMarker });

const inlineMarkByClass = new Map<string, Decoration>();
for (const rule of LModeInlineRules) {
  inlineMarkByClass.set(
    rule.className,
    Decoration.mark({ class: rule.className }),
  );
}

const pipeClassMark = Decoration.mark({ class: LModeClasses.pipe });

/**
 * Pure function: state + context → list of inline
 * decorations. The caller (the orchestrator in
 * `extension.ts`) is responsible for joining these with
 * the line decorations into a single `DecorationSet`.
 */
export function computeContentDecorations(
  state: EditorState,
  context: LModeContext = { workspaceRoot: null, documentPath: null },
): Range<Decoration>[] {
  const decorations: Range<Decoration>[] = [];
  const tree = syntaxTree(state);

  // Pre-build a lookup from Lezer node name → inline class
  // name. Using a Map keeps the per-node dispatch in the
  // tree walk to one map lookup, which matters because the
  // walk visits every node in the document.
  const inlineClassByNode = new Map<string, string>();
  for (const rule of LModeInlineRules) {
    for (const nodeName of rule.nodes) {
      inlineClassByNode.set(nodeName, rule.className);
    }
  }

  tree.iterate({
    enter(node) {
      const name = node.name;

      // --- Widget replacements ---

      // Image — replace the source text visually with the
      // L Mode image widget. The widget handles cursor
      // navigation (`ignoreEvent: false`) and is byte-
      // identical to the source under the hood. We do NOT
      // descend into the Image's children (LinkMark / URL):
      // once we've decided to replace the whole node, the
      // markers inside it are no longer relevant.
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
          decorations.push(
            Decoration.replace({
              widget: new LModeImageWidget(rawUrl, resolvedSrc, alt),
            }).range(node.from, node.to),
          );
        }
        return false;
      }

      // HorizontalRule — replace the `---` / `***` / `___`
      // source with a thin-line widget. The widget carries
      // the visual divider; the underlying doc text is
      // untouched.
      if (name === "HorizontalRule") {
        decorations.push(
          Decoration.replace({
            widget: new LModeHorizontalRuleWidget(),
          }).range(node.from, node.to),
        );
        return false;
      }

      // Task list — the `Task` node is the whole list-item
      // line. We descend into it (return true) so the
      // iterator visits the `TaskMarker` child, where the
      // checkbox widget replacement is emitted. The rest of
      // the line stays as normal text the user types.
      if (name === "Task") {
        return true;
      }
      if (name === "TaskMarker") {
        const markerText = state.doc.sliceString(node.from, node.to);
        const checked = markerText === "[x]";
        decorations.push(
          Decoration.replace({
            widget: new LModeTaskWidget(node.from, node.to, checked),
          }).range(node.from, node.to),
        );
        return false;
      }

      // Tables — the delimiter row (`| --- | --- |`) is
      // visual noise once the line borders do the same job,
      // so we collapse it to an empty widget. TableHeader
      // and TableRow line classes are added in
      // `lineDecorations.ts`; here we just walk the line to
      // mark every `|` with a muted class so the cell
      // separators read as quiet vertical rules instead of
      // raw source characters.
      if (name === "TableDelimiter") {
        decorations.push(
          Decoration.replace({ widget: new LModeTableDelimiterWidget() }).range(
            node.from,
            node.to,
          ),
        );
        return false;
      }
      if (name === "TableHeader" || name === "TableRow") {
        const fromLine = state.doc.lineAt(node.from).number;
        addPipeMarks(state, state.doc.line(fromLine), decorations);
        return true;
      }

      // --- Inline styling ---
      //
      // Apply a class mark to the parent node range. The
      // marker children inside the range are still hidden
      // by the marker-hiding pass, so the visible portion
      // is just the prose text picking up the visual style
      // (italic / bold / line-through / link color).
      const inlineClass = inlineClassByNode.get(name);
      if (inlineClass) {
        const mark = inlineMarkByClass.get(inlineClass);
        if (mark) {
          decorations.push(mark.range(node.from, node.to));
        }
        return true;
      }

      // --- Marker hiding ---
      //
      // Always mark source syntax as hidden. Active-line
      // and hover reveal are purely CSS concerns via
      // `.cm-lmode-source-line`, so style changes cannot
      // change which marker ranges exist. Marker nodes are
      // leaves in the Lezer tree, so we do not descend.
      if (name === "HeaderMark" && isSetextDividerLine(state, node.node)) {
        decorations.push(
          Decoration.replace({
            widget: new LModeHorizontalRuleWidget(),
          }).range(node.from, node.to),
        );
        return false;
      }

      if (LModeMarkerNodeNames.has(name)) {
        decorations.push(hiddenMarker.range(node.from, node.to));
        return false;
      }

      return true;
    },
  });

  return decorations;
}

function isSetextDividerLine(state: EditorState, node: SyntaxNode): boolean {
  const line = state.doc.lineAt(node.from);
  if (node.from !== line.from || node.to !== line.to) {
    return false;
  }
  return /^(?:-{3,}|={3,})$/.test(line.text.trim());
}

// Mark every `|` in the given line with the muted pipe
// class. The `|` characters in a Markdown table line are
// the cell separators; making them muted and slightly
// recessed gives the table line a typographic feel that
// matches the rest of L Mode's body text. In a typical
// table line the pipes are the visual structure, not part
// of the cell text.
function addPipeMarks(
  state: EditorState,
  line: { from: number; to: number },
  decorations: Range<Decoration>[],
): void {
  const text = state.doc.sliceString(line.from, line.to);
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "|") {
      decorations.push(
        pipeClassMark.range(line.from + i, line.from + i + 1),
      );
    }
  }
}

// --- Image node helpers ---
//
// Walk an Image node's children looking for the alt text
// and the URL. The Markdown GFM Image structure is:
//
//   Image
//     LinkMark ("[")
//     LinkLabel / alt text
//     LinkMark ("]")
//     URL
//
// The alt text is whatever sits between the two LinkMark
// nodes at the top of the Image, and the URL is the URL
// child node.
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
      // The URL node covers the `(url)` form; the actual
      // URL is the inside. The leading "(" and trailing
      // ")" are separate characters in the source.
      const inner = state.doc.sliceString(child.from, child.to);
      return inner.replace(/^\(|\)$/g, "");
    }
    child = child.nextSibling;
  }
  return null;
}

/**
 * Convert a `Map<lineNumber, string[]>` into a list of
 * `Range<Decoration>` line decorations. Exported so the
 * orchestrator can keep its join step out of
 * `lineDecorations.ts`.
 *
 * When the line's class list contains a class that has an
 * entry in `LModeChipLabels` (e.g. `cm-lmode-heading-1` →
 * `"H1"`), the matching label is attached as a `data-l-chip`
 * attribute on the line. CSS renders the chip via
 * `content: attr(data-l-chip)` so the label lives in the TS
 * catalog (testable, drift-checkable) instead of being a string
 * literal in CSS. A line can have at most one chip in practice
 * (the structural block classes are mutually exclusive per
 * line); the first match wins.
 */
export function buildLineDecorations(
  state: EditorState,
  lineClasses: Map<number, string[]>,
): Range<Decoration>[] {
  const decorations: Range<Decoration>[] = [];
  for (const [line, classes] of lineClasses) {
    const lineInfo = state.doc.line(line);
    const lineStart = lineInfo.from;
    const className = classes.join(" ");
    const chip = chipForLine(classes);
    const dec =
      chip !== undefined
        ? Decoration.line({
            class: className,
            attributes: { "data-l-chip": chip },
          })
        : Decoration.line({ class: className });
    decorations.push(dec.range(lineStart, lineStart));
  }
  return decorations;
}

function chipForLine(classes: readonly string[]): string | undefined {
  for (const cls of classes) {
    const label = LModeChipLabels[cls];
    if (label !== undefined) {
      return label;
    }
  }
  return undefined;
}

/**
 * Sort decorations by `from` position. CodeMirror requires
 * range decorations to be in increasing `from` order; the
 * `Decoration.set` constructor would still work on
 * unsorted input but emits a console warning.
 */
export function sortDecorations(
  decorations: Range<Decoration>[],
): Range<Decoration>[] {
  return decorations.sort((a, b) => a.from - b.from);
}

/**
 * Build a full `DecorationSet` from an editor state, the
 * line-classes map, and the content decorations. The
 * helper is exported so the cornerstone test in
 * `lModeExtension.test.ts` (which calls
 * `computeLModeDecorations`) keeps its current signature
 * during the refactor.
 */
export function buildLModeDecorations(
  state: EditorState,
  lineClasses: Map<number, string[]>,
  contentDecorations: Range<Decoration>[],
): DecorationSet {
  const lineRanges = buildLineDecorations(state, lineClasses);
  return Decoration.set(
    sortDecorations([...lineRanges, ...contentDecorations]),
    true,
  );
}
