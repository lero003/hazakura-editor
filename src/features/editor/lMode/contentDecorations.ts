// L Mode (えるモード) — content-decoration computation.
//
// This file holds the pure function that maps an
// `EditorState` + `LModeContext` to a list of inline
// `Range<Decoration>` entries. The output covers four
// concerns:
//
//   1. **Marker hiding.** Non-active Lezer nodes whose name is
//      in `LModeMarkerNodeNames` (the `#` of a heading, the
//      `*` of emphasis, the `>` of a blockquote, the
//      backticks of a code span, etc.) gets a
//      `LModeClasses.hiddenMarker` mark, which CSS renders as
//      a zero-width transparent span. Active / selected lines
//      stay source-like and do not receive those hidden spans.
//
//   2. **Inline styling.** Parent nodes like `Emphasis`,
//      `StrongEmphasis`, `Strikethrough`, and `Link` get
//      their own class mark on the parent range (italic,
//      bold, line-through, link color). The marker children
//      inside those ranges are still hidden by the marker
//      pass, so the visible text is just the prose picking
//      up the visual style.
//
//   3. **Widget replacements.** On inactive lines, `Image`,
//      `HorizontalRule`,
//      `TableDelimiter`, and `TaskMarker` nodes are replaced
//      with display-only widgets. The underlying doc text is
//      never modified — this is the cornerstone invariant
//      the test suite enforces.
//
//   4. **Pipe marks in tables.** Every `|` in an inactive table row
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
  LModeTableCellBreakWidget,
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
const MAX_TABLE_CELL_WIDTH_CH = 42;
const MIN_TABLE_CELL_WIDTH_CH = 4;

type TableCellSpan = {
  from: number;
  to: number;
  widthCh: number;
};

/**
 * Pure function: state + context → list of inline
 * decorations. The caller (the orchestrator in
 * `extension.ts`) is responsible for joining these with
 * the line decorations into a single `DecorationSet`.
 */
export function computeContentDecorations(
  state: EditorState,
  context: LModeContext = { workspaceRoot: null, documentPath: null },
  sourceLineNumbers: ReadonlySet<number> = new Set(),
): Range<Decoration>[] {
  const decorations: Range<Decoration>[] = [];
  const tree = syntaxTree(state);
  const tableCellPlan = buildTableCellPlan(state);

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
        if (touchesSourceLine(state, node.from, node.to, sourceLineNumbers)) {
          return false;
        }
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
        if (touchesSourceLine(state, node.from, node.to, sourceLineNumbers)) {
          return false;
        }
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
        if (touchesSourceLine(state, node.from, node.to, sourceLineNumbers)) {
          return false;
        }
        const markerText = state.doc.sliceString(node.from, node.to);
        const checked = markerText === "[x]" || markerText === "[X]";
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
        if (touchesSourceLine(state, node.from, node.to, sourceLineNumbers)) {
          return false;
        }
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
        const line = state.doc.line(fromLine);
        if (sourceLineNumbers.has(line.number)) {
          return true;
        }
        addPipeMarks(state, line, decorations);
        addTableCellMarks(line.number, tableCellPlan, decorations);
        addTableCellBreakWidgets(state, line.number, tableCellPlan, decorations);
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
        if (touchesSourceLine(state, node.from, node.to, sourceLineNumbers)) {
          return true;
        }
        const mark = inlineMarkByClass.get(inlineClass);
        if (mark) {
          decorations.push(mark.range(node.from, node.to));
        }
        return true;
      }

      // --- Marker hiding ---
      //
      // Hide source syntax only on non-source lines. The
      // active line and selection lines are Live Source: they
      // keep the Markdown markers directly editable instead of
      // asking CSS to reconstruct them from hidden spans.
      // Marker nodes are leaves in the Lezer tree, so we do
      // not descend.
      if (name === "HeaderMark" && isSetextDividerLine(state, node.node)) {
        if (touchesSourceLine(state, node.from, node.to, sourceLineNumbers)) {
          return false;
        }
        decorations.push(
          Decoration.replace({
            widget: new LModeHorizontalRuleWidget(),
          }).range(node.from, node.to),
        );
        return false;
      }

      if (LModeMarkerNodeNames.has(name)) {
        if (touchesSourceLine(state, node.from, node.to, sourceLineNumbers)) {
          return false;
        }
        const markerTo = markerRangeTo(state, node.node);
        decorations.push(hiddenMarker.range(node.from, markerTo));
        return false;
      }

      return true;
    },
  });

  return decorations;
}

function touchesSourceLine(
  state: EditorState,
  from: number,
  to: number,
  sourceLineNumbers: ReadonlySet<number>,
): boolean {
  if (sourceLineNumbers.size === 0) {
    return false;
  }

  const fromLine = state.doc.lineAt(from).number;
  const inclusiveTo = to > from ? to - 1 : to;
  const toLine = state.doc.lineAt(inclusiveTo).number;
  for (let lineNumber = fromLine; lineNumber <= toLine; lineNumber += 1) {
    if (sourceLineNumbers.has(lineNumber)) {
      return true;
    }
  }
  return false;
}

function markerRangeTo(state: EditorState, node: SyntaxNode): number {
  if (
    !shouldHideFollowingMarkerSpace(node.name) ||
    node.to >= state.doc.length
  ) {
    return node.to;
  }

  return state.doc.sliceString(node.to, node.to + 1) === " "
    ? node.to + 1
    : node.to;
}

function shouldHideFollowingMarkerSpace(nodeName: string): boolean {
  return (
    nodeName === "HeaderMark" ||
    nodeName === "QuoteMark" ||
    nodeName === "ListMark"
  );
}

function buildTableCellPlan(state: EditorState): Map<number, TableCellSpan[]> {
  const plan = new Map<number, TableCellSpan[]>();

  for (let lineNumber = 2; lineNumber <= state.doc.lines; lineNumber += 1) {
    const delimiterLine = state.doc.line(lineNumber);
    if (!isTableDelimiterText(delimiterLine.text)) {
      continue;
    }

    const headerLine = state.doc.line(lineNumber - 1);
    const headerCells = parseTableCells(headerLine.text, headerLine.from);
    if (headerCells.length === 0) {
      continue;
    }

    const tableLines = [{ line: headerLine, cells: headerCells }];
    for (
      let bodyLineNumber = lineNumber + 1;
      bodyLineNumber <= state.doc.lines;
      bodyLineNumber += 1
    ) {
      const bodyLine = state.doc.line(bodyLineNumber);
      const bodyCells = parseTableCells(bodyLine.text, bodyLine.from);
      if (bodyCells.length === 0) {
        break;
      }
      tableLines.push({ line: bodyLine, cells: bodyCells });
    }

    const columnCount = Math.max(
      ...tableLines.map(({ cells }) => cells.length),
    );
    const widths = Array.from(
      { length: columnCount },
      () => MIN_TABLE_CELL_WIDTH_CH,
    );
    for (const { cells } of tableLines) {
      cells.forEach((cell, index) => {
        widths[index] = Math.max(widths[index], displayWidthCh(cell.text));
      });
    }

    for (const { line, cells } of tableLines) {
      plan.set(
        line.number,
        cells.map((cell, index) => ({
          from: cell.from,
          to: cell.to,
          widthCh: Math.min(MAX_TABLE_CELL_WIDTH_CH, widths[index]),
        })),
      );
    }
  }

  return plan;
}

function addTableCellMarks(
  lineNumber: number,
  tableCellPlan: ReadonlyMap<number, TableCellSpan[]>,
  decorations: Range<Decoration>[],
): void {
  for (const cell of tableCellPlan.get(lineNumber) ?? []) {
    if (cell.to <= cell.from) {
      continue;
    }
    decorations.push(
      Decoration.mark({
        class: LModeClasses.tableCell,
        attributes: {
          style: `--lmode-table-cell-width: ${cell.widthCh}ch`,
        },
      }).range(cell.from, cell.to),
    );
  }
}

function addTableCellBreakWidgets(
  state: EditorState,
  lineNumber: number,
  tableCellPlan: ReadonlyMap<number, TableCellSpan[]>,
  decorations: Range<Decoration>[],
): void {
  for (const cell of tableCellPlan.get(lineNumber) ?? []) {
    const text = state.doc.sliceString(cell.from, cell.to);
    for (const match of text.matchAll(/<br\s*\/?>/gi)) {
      if (match.index === undefined) {
        continue;
      }
      decorations.push(
        Decoration.replace({
          widget: new LModeTableCellBreakWidget(),
        }).range(
          cell.from + match.index,
          cell.from + match.index + match[0].length,
        ),
      );
    }
  }
}

function isTableDelimiterText(text: string): boolean {
  const cells = splitTableCells(text);
  return (
    cells.length > 0 &&
    cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()))
  );
}

function parseTableCells(
  text: string,
  lineFrom: number,
): Array<{ from: number; to: number; text: string }> {
  if (!text.includes("|") || isTableDelimiterText(text)) {
    return [];
  }

  const pipes = pipeIndexes(text);
  if (pipes.length < 2) {
    return [];
  }

  const cells: Array<{ from: number; to: number; text: string }> = [];
  for (let index = 0; index < pipes.length - 1; index += 1) {
    const rawFrom = pipes[index] + 1;
    const rawTo = pipes[index + 1];
    const raw = text.slice(rawFrom, rawTo);
    const leading = raw.match(/^\s*/)?.[0].length ?? 0;
    const trailing = raw.match(/\s*$/)?.[0].length ?? 0;
    const from = lineFrom + rawFrom + leading;
    const to = lineFrom + rawTo - trailing;
    cells.push({ from, to, text: raw.trim() });
  }

  return cells;
}

function splitTableCells(text: string): string[] {
  const pipes = pipeIndexes(text);
  if (pipes.length < 2) {
    return [];
  }
  const cells: string[] = [];
  for (let index = 0; index < pipes.length - 1; index += 1) {
    cells.push(text.slice(pipes[index] + 1, pipes[index + 1]));
  }
  return cells;
}

function pipeIndexes(text: string): number[] {
  const indexes: number[] = [];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "|" && text[index - 1] !== "\\") {
      indexes.push(index);
    }
  }
  return indexes;
}

function displayWidthCh(text: string): number {
  let width = 0;
  for (const char of Array.from(text.trim())) {
    width += /[\u3000-\u9fff\uff01-\uff60]/.test(char) ? 2 : 1;
  }
  return Math.max(MIN_TABLE_CELL_WIDTH_CH, width);
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
