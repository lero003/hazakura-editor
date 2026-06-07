import {
  EditorSelection,
  Prec,
  type Line,
  type SelectionRange,
} from "@codemirror/state";
import {
  EditorView,
  keymap,
  type PluginValue,
  ViewPlugin,
} from "@codemirror/view";

type TableCell = {
  rawFrom: number;
  rawTo: number;
  contentFrom: number;
  contentTo: number;
};

type TableBlock = {
  delimiterLineNumber: number;
  headerLineNumber: number;
  bodyFromLineNumber: number;
  bodyToLineNumber: number;
  columnCount: number;
};

export function moveTableCellRight(view: EditorView): boolean {
  const range = view.state.selection.main;
  if (!range.empty) {
    return false;
  }

  const row = readTableRowAt(view, range.from);
  if (!row || row.isDelimiter) {
    return false;
  }

  const cellIndex = findCellIndex(row.cells, range.from);
  if (cellIndex < 0 || cellIndex >= row.cells.length - 1) {
    return false;
  }

  const cell = row.cells[cellIndex];
  if (range.from < cell.contentTo) {
    return false;
  }

  setCursor(view, row.cells[cellIndex + 1].contentFrom);
  return true;
}

export function moveTableCellLeft(view: EditorView): boolean {
  const range = view.state.selection.main;
  if (!range.empty) {
    return false;
  }

  const row = readTableRowAt(view, range.from);
  if (!row || row.isDelimiter) {
    return false;
  }

  const cellIndex = findCellIndex(row.cells, range.from);
  if (cellIndex <= 0) {
    return false;
  }

  const cell = row.cells[cellIndex];
  if (range.from > cell.contentFrom) {
    return false;
  }

  setCursor(view, row.cells[cellIndex - 1].contentTo);
  return true;
}

export function insertTableRowAfterCursor(view: EditorView): boolean {
  const range = view.state.selection.main;
  if (!range.empty) {
    return false;
  }

  const row = readTableRowAt(view, range.from);
  if (!row || row.isDelimiter) {
    return false;
  }

  const block = findTableBlock(view, row.line.number);
  if (!block) {
    return false;
  }

  const insertAfterLineNumber =
    row.line.number === block.headerLineNumber
      ? block.delimiterLineNumber
      : row.line.number;
  const insertAfterLine = view.state.doc.line(insertAfterLineNumber);
  const newRow = buildEmptyTableRow(block.columnCount, row.line.text);
  const insertAt = insertAfterLine.to;
  const cursor = insertAt + 2;

  view.dispatch({
    changes: { from: insertAt, insert: `\n${newRow}` },
    selection: EditorSelection.cursor(cursor),
  });
  return true;
}

export function insertTableCellBreak(view: EditorView): boolean {
  const range = view.state.selection.main;
  if (!range.empty) {
    return false;
  }

  const row = readTableRowAt(view, range.from);
  if (!row || row.isDelimiter) {
    return false;
  }

  const cellIndex = findCellIndex(row.cells, range.from);
  if (cellIndex < 0) {
    return false;
  }

  const cell = row.cells[cellIndex];
  const insertAt = Math.min(
    Math.max(range.from, cell.contentFrom),
    cell.contentTo,
  );
  view.dispatch({
    changes: { from: insertAt, insert: "<br>" },
    selection: EditorSelection.cursor(insertAt + "<br>".length),
  });
  return true;
}

export function insertTableCellPipe(view: EditorView): boolean {
  const range = view.state.selection.main;
  if (!range.empty) {
    return false;
  }

  const row = readTableRowAt(view, range.from);
  if (!row || row.isDelimiter) {
    return false;
  }

  const cellIndex = findCellIndex(row.cells, range.from);
  if (cellIndex < 0) {
    return false;
  }

  view.dispatch({
    changes: { from: range.from, insert: "\\|" },
    selection: EditorSelection.cursor(range.from + "\\|".length),
  });
  return true;
}

export function deleteSelectedTableRows(view: EditorView): boolean {
  const range = view.state.selection.main;
  if (range.empty) {
    return false;
  }

  const deleteRange = selectedBodyRowRange(view, range);
  if (!deleteRange) {
    return false;
  }

  view.dispatch({
    changes: deleteRange,
    selection: EditorSelection.cursor(deleteRange.from),
  });
  return true;
}

export function snapLModeCursorToContent(view: EditorView): boolean {
  if (view.composing) {
    return false;
  }

  const range = view.state.selection.main;
  if (!range.empty) {
    return false;
  }

  const snappedPosition = snapCursorPosition(view, range.from);
  if (snappedPosition === null || snappedPosition === range.from) {
    return false;
  }

  setCursor(view, snappedPosition);
  return true;
}

export function lModeTableEditingPlugin() {
  return [
    Prec.highest(
      keymap.of([
        {
          key: "ArrowRight",
          run: runWhenNotComposing(moveTableCellRight),
        },
        {
          key: "ArrowLeft",
          run: runWhenNotComposing(moveTableCellLeft),
        },
        {
          key: "Enter",
          run: runWhenNotComposing(insertTableRowAfterCursor),
        },
        {
          key: "Shift-Enter",
          run: runWhenNotComposing(insertTableCellBreak),
        },
        {
          key: "|",
          run: runWhenNotComposing(insertTableCellPipe),
        },
        {
          key: "Backspace",
          run: runWhenNotComposing(deleteSelectedTableRows),
        },
        {
          key: "Delete",
          run: runWhenNotComposing(deleteSelectedTableRows),
        },
      ]),
    ),
    lModeCursorBoundaryPlugin(),
  ];
}

function readTableRowAt(view: EditorView, position: number) {
  const line = view.state.doc.lineAt(position);
  const cells = parseTableCells(line);
  if (cells.length === 0) {
    return null;
  }

  const isDelimiter = isTableDelimiterText(line.text);
  if (!isDelimiter && !findTableBlock(view, line.number)) {
    return null;
  }

  return { line, cells, isDelimiter };
}

function snapCursorPosition(view: EditorView, position: number): number | null {
  const tablePosition = snapTableCursorPosition(view, position);
  if (tablePosition !== null) {
    return tablePosition;
  }

  return snapStructuralMarkerPosition(view, position);
}

function snapTableCursorPosition(
  view: EditorView,
  position: number,
): number | null {
  const row = readTableRowAt(view, position);
  if (!row || row.isDelimiter) {
    return null;
  }

  const cellIndex = findCellIndex(row.cells, position);
  if (cellIndex < 0) {
    return null;
  }

  const cell = row.cells[cellIndex];
  if (position < cell.contentFrom) {
    return cell.contentFrom;
  }
  if (position > cell.contentTo) {
    return cell.contentTo;
  }
  return null;
}

function snapStructuralMarkerPosition(
  view: EditorView,
  position: number,
): number | null {
  const line = view.state.doc.lineAt(position);
  const relative = position - line.from;
  const match = line.text.match(/^(?:#{1,6}|>|[-*+]|\d+[.)])\s+/);
  if (!match) {
    return null;
  }

  const contentStart = match[0].length;
  return relative < contentStart ? line.from + contentStart : null;
}

function findTableBlock(
  view: EditorView,
  lineNumber: number,
): TableBlock | null {
  const doc = view.state.doc;

  for (
    let delimiterLineNumber = Math.min(lineNumber + 1, doc.lines);
    delimiterLineNumber >= 2;
    delimiterLineNumber -= 1
  ) {
    const delimiterLine = doc.line(delimiterLineNumber);
    if (!isTableDelimiterText(delimiterLine.text)) {
      continue;
    }

    const headerLineNumber = delimiterLineNumber - 1;
    const headerLine = doc.line(headerLineNumber);
    const headerCells = parseTableCells(headerLine);
    if (headerCells.length === 0) {
      continue;
    }

    let bodyToLineNumber = delimiterLineNumber;
    for (
      let bodyLineNumber = delimiterLineNumber + 1;
      bodyLineNumber <= doc.lines;
      bodyLineNumber += 1
    ) {
      const bodyLine = doc.line(bodyLineNumber);
      if (parseTableCells(bodyLine).length === 0) {
        break;
      }
      bodyToLineNumber = bodyLineNumber;
    }

    if (
      lineNumber < headerLineNumber ||
      lineNumber > bodyToLineNumber ||
      lineNumber === delimiterLineNumber
    ) {
      continue;
    }

    const tableLines = [
      headerLineNumber,
      ...Array.from(
        { length: bodyToLineNumber - delimiterLineNumber },
        (_, index) => delimiterLineNumber + index + 1,
      ),
    ];
    const columnCount = Math.max(
      ...tableLines.map((n) => parseTableCells(doc.line(n)).length),
    );

    return {
      delimiterLineNumber,
      headerLineNumber,
      bodyFromLineNumber: delimiterLineNumber + 1,
      bodyToLineNumber,
      columnCount,
    };
  }

  return null;
}

function selectedBodyRowRange(
  view: EditorView,
  range: SelectionRange,
): { from: number; to: number } | null {
  const doc = view.state.doc;
  const from = Math.min(range.from, range.to);
  const to = Math.max(range.from, range.to);
  const startLine = doc.lineAt(from);
  const endLine = doc.lineAt(Math.max(from, to - 1));
  const lines: Line[] = [];

  for (
    let lineNumber = startLine.number;
    lineNumber <= endLine.number;
    lineNumber += 1
  ) {
    const line = doc.line(lineNumber);
    if (line.text.trim().length === 0) {
      return null;
    }
    const block = findTableBlock(view, lineNumber);
    if (
      !block ||
      lineNumber < block.bodyFromLineNumber ||
      lineNumber > block.bodyToLineNumber
    ) {
      return null;
    }
    lines.push(line);
  }

  if (lines.length === 0) {
    return null;
  }

  const first = lines[0];
  const last = lines[lines.length - 1];
  const deleteTo = last.to < doc.length ? last.to + 1 : last.to;
  return { from: first.from, to: deleteTo };
}

function parseTableCells(line: Line): TableCell[] {
  const separatorIndexes = tableCellBoundaryIndexes(line.text);
  if (separatorIndexes.length < 2) {
    return [];
  }

  const cells: TableCell[] = [];
  for (let index = 0; index < separatorIndexes.length - 1; index += 1) {
    const rawFrom = line.from + separatorIndexes[index] + 1;
    const rawTo = line.from + separatorIndexes[index + 1];
    cells.push(trimCell(line, rawFrom, rawTo));
  }
  return cells;
}

function tableCellBoundaryIndexes(text: string): number[] {
  const indexes = pipeIndexes(text);
  if (indexes.length === 0) {
    return [];
  }

  const contentStart = text.match(/^\s*/)?.[0].length ?? 0;
  const contentEnd = text.length - (text.match(/\s*$/)?.[0].length ?? 0);
  const boundaries = [...indexes];

  if (boundaries[0] !== contentStart) {
    boundaries.unshift(contentStart - 1);
  }
  if (boundaries[boundaries.length - 1] !== contentEnd - 1) {
    boundaries.push(contentEnd);
  }

  return boundaries;
}

function trimCell(line: Line, rawFrom: number, rawTo: number): TableCell {
  const text = line.text.slice(rawFrom - line.from, rawTo - line.from);
  const leading = text.match(/^\s*/)?.[0].length ?? 0;
  const trailing = text.match(/\s*$/)?.[0].length ?? 0;
  const contentFrom = rawFrom + leading;
  const contentTo = Math.max(contentFrom, rawTo - trailing);

  return { rawFrom, rawTo, contentFrom, contentTo };
}

function pipeIndexes(text: string): number[] {
  const indexes: number[] = [];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "|" && !isEscaped(text, index)) {
      indexes.push(index);
    }
  }
  return indexes;
}

function isEscaped(text: string, index: number): boolean {
  let slashCount = 0;
  for (let i = index - 1; i >= 0 && text[i] === "\\"; i -= 1) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
}

function isTableDelimiterText(text: string): boolean {
  const cells = text
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());

  return (
    cells.length > 0 &&
    cells.every((cell) => /^:?-{3,}:?$/.test(cell))
  );
}

function findCellIndex(cells: readonly TableCell[], position: number): number {
  return cells.findIndex(
    (cell) => position >= cell.rawFrom && position <= cell.rawTo,
  );
}

function buildEmptyTableRow(columnCount: number, sourceLineText: string): string {
  const indent = sourceLineText.match(/^\s*/)?.[0] ?? "";
  return `${indent}| ${Array.from({ length: columnCount }, () => "").join(" | ")} |`;
}

function setCursor(view: EditorView, position: number): void {
  view.dispatch({ selection: EditorSelection.cursor(position) });
}

function lModeCursorBoundaryPlugin() {
  return ViewPlugin.fromClass(
    class implements PluginValue {
      private frame: number | null = null;

      constructor(readonly view: EditorView) {}

      update() {
        this.scheduleSnap();
      }

      destroy() {
        if (this.frame !== null) {
          const win = this.view.dom.ownerDocument.defaultView ?? window;
          win.cancelAnimationFrame(this.frame);
          this.frame = null;
        }
      }

      private scheduleSnap() {
        if (this.frame !== null) {
          return;
        }

        const win = this.view.dom.ownerDocument.defaultView ?? window;
        this.frame = win.requestAnimationFrame(() => {
          this.frame = null;
          snapLModeCursorToContent(this.view);
        });
      }
    },
  );
}

function runWhenNotComposing(
  command: (view: EditorView) => boolean,
): (view: EditorView) => boolean {
  return (view) => {
    if (view.composing) {
      return false;
    }
    return command(view);
  };
}
