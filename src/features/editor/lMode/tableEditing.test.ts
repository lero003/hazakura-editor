import { describe, expect, it, vi } from "vitest";
import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView, type ViewUpdate } from "@codemirror/view";
import {
  deleteSelectedTableRows,
  insertTableRowAfterCursor,
  insertTableCellBreak,
  insertTableCellPipe,
  lModeCursorBoundaryPlugin,
  moveTableCellLeft,
  moveTableCellRight,
  snapLModeCursorToContent,
} from "./tableEditing";

function makeView(doc: string, anchor: number, head = anchor): EditorView {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  return new EditorView({
    parent,
    state: EditorState.create({
      doc,
      selection: EditorSelection.range(anchor, head),
    }),
  });
}

function offsetOf(doc: string, needle: string): number {
  const offset = doc.indexOf(needle);
  if (offset < 0) {
    throw new Error(`Missing fixture text: ${needle}`);
  }
  return offset;
}

describe("L Mode table editing", () => {
  it("moves right from the end of a table cell into the next cell", () => {
    const doc =
      "| プラン | 内容 | 想定ユーザー |\n" +
      "| --- | --- | --- |\n" +
      "| Preview | 開発版・検証用 | 早期に試したい人 |\n";
    const view = makeView(doc, offsetOf(doc, "Preview") + "Preview".length);

    expect(moveTableCellRight(view)).toBe(true);
    expect(view.state.selection.main.from).toBe(offsetOf(doc, "開発版"));
  });

  it("moves left from the start of a table cell into the previous cell", () => {
    const doc =
      "| プラン | 内容 | 想定ユーザー |\n" +
      "| --- | --- | --- |\n" +
      "| Preview | 開発版・検証用 | 早期に試したい人 |\n";
    const view = makeView(doc, offsetOf(doc, "開発版"));

    expect(moveTableCellLeft(view)).toBe(true);
    expect(view.state.selection.main.from).toBe(
      offsetOf(doc, "Preview") + "Preview".length,
    );
  });

  it("inserts a new body row after the current table row", () => {
    const doc =
      "| プラン | 内容 | 想定ユーザー |\n" +
      "| --- | --- | --- |\n" +
      "| Preview | 開発版・検証用 | 早期に試したい人 |\n" +
      "| Standard | 基本機能 | Markdownを書く人 |\n";
    const view = makeView(doc, offsetOf(doc, "Preview"));

    expect(insertTableRowAfterCursor(view)).toBe(true);
    expect(view.state.doc.toString()).toBe(
      "| プラン | 内容 | 想定ユーザー |\n" +
        "| --- | --- | --- |\n" +
        "| Preview | 開発版・検証用 | 早期に試したい人 |\n" +
        "|  |  |  |\n" +
        "| Standard | 基本機能 | Markdownを書く人 |\n",
    );
  });

  it("inserts a full row after a table row without a trailing pipe", () => {
    const doc =
      "| プラン | 内容 | 想定ユーザー |\n" +
      "| --- | --- | --- |\n" +
      "| Preview | 表示確認 | 公開前の見え方を確認 |\n" +
      "| Review | 差分・見出し・比較 | 長文レビューを補助\n";
    const view = makeView(
      doc,
      offsetOf(doc, "長文レビューを補助") + "長文レビューを補助".length,
    );

    expect(insertTableRowAfterCursor(view)).toBe(true);
    expect(view.state.doc.toString()).toBe(
      "| プラン | 内容 | 想定ユーザー |\n" +
        "| --- | --- | --- |\n" +
        "| Preview | 表示確認 | 公開前の見え方を確認 |\n" +
        "| Review | 差分・見出し・比較 | 長文レビューを補助\n" +
        "|  |  |  |\n",
    );
  });

  it("inserts a Markdown-safe cell break on Shift+Enter", () => {
    const doc =
      "| プラン | 内容 | 想定ユーザー |\n" +
      "| --- | --- | --- |\n" +
      "| Review | 差分・見出し・比較 | 長文レビューを補助 |\n";
    const insertAt = offsetOf(doc, "長文レビュー") + "長文レビュー".length;
    const view = makeView(doc, insertAt);

    expect(insertTableCellBreak(view)).toBe(true);
    expect(view.state.doc.toString()).toBe(
      "| プラン | 内容 | 想定ユーザー |\n" +
        "| --- | --- | --- |\n" +
        "| Review | 差分・見出し・比較 | 長文レビュー<br>を補助 |\n",
    );
  });

  it("escapes a typed pipe inside a table cell instead of adding a column", () => {
    const doc =
      "| プラン | 内容 | 想定ユーザー |\n" +
      "| --- | --- | --- |\n" +
      "| Preview | 開発版・検証用 | 早期に試したい人 |\n";
    const insertAt = offsetOf(doc, "開発版") + "開発版".length;
    const view = makeView(doc, insertAt);

    expect(insertTableCellPipe(view)).toBe(true);
    expect(view.state.doc.toString()).toBe(
      "| プラン | 内容 | 想定ユーザー |\n" +
        "| --- | --- | --- |\n" +
        "| Preview | 開発版\\|・検証用 | 早期に試したい人 |\n",
    );
  });

  it("moves the cursor out of structural marker prefixes", () => {
    const doc = "# Heading\n> Quote\n";
    const view = makeView(doc, offsetOf(doc, "# Heading") + "#".length);

    expect(snapLModeCursorToContent(view)).toBe(true);
    expect(view.state.selection.main.from).toBe(offsetOf(doc, "Heading"));

    view.dispatch({
      selection: EditorSelection.cursor(offsetOf(doc, "> Quote") + ">".length),
    });

    expect(snapLModeCursorToContent(view)).toBe(true);
    expect(view.state.selection.main.from).toBe(offsetOf(doc, "Quote"));
  });

  it("moves the cursor out of table cell padding", () => {
    const doc =
      "| プラン | 内容 |\n" +
      "| --- | --- |\n" +
      "| あ |  い|\n";
    const view = makeView(doc, offsetOf(doc, "| あ |") + "|".length);

    expect(snapLModeCursorToContent(view)).toBe(true);
    expect(view.state.selection.main.from).toBe(offsetOf(doc, "あ"));

    view.dispatch({
      selection: EditorSelection.cursor(offsetOf(doc, "  い") + 1),
    });

    expect(snapLModeCursorToContent(view)).toBe(true);
    expect(view.state.selection.main.from).toBe(offsetOf(doc, "い"));
  });

  it("deletes whole selected table body rows", () => {
    // v0.18 caret boundary around table syntax. The row
    // delete shortcut is an opt-in for an explicit
    // whole-line selection. A selection that starts or
    // ends inside a cell is treated as normal text and
    // falls through to the standard CodeMirror Backspace /
    // Delete handler, in line with the L Mode plan's
    // "preserve normal Markdown semantics" rule.
    const doc =
      "| プラン | 内容 | 想定ユーザー |\n" +
      "| --- | --- | --- |\n" +
      "| Preview | 開発版・検証用 | 早期に試したい人 |\n" +
      "| Standard | 基本機能 | Markdownを書く人 |\n" +
      "| Supporter | 支援つき | 開発を応援したい人 |\n";
    const selectionStart = offsetOf(doc, "Preview") - 2;
    const standardRow = "| Standard | 基本機能 | Markdownを書く人 |";
    const selectionEnd = offsetOf(doc, standardRow) + standardRow.length;
    const view = makeView(doc, selectionStart, selectionEnd);

    expect(deleteSelectedTableRows(view)).toBe(true);
    expect(view.state.doc.toString()).toBe(
      "| プラン | 内容 | 想定ユーザー |\n" +
        "| --- | --- | --- |\n" +
        "| Supporter | 支援つき | 開発を応援したい人 |\n",
    );
  });

  // v0.18 caret boundary around table syntax.
  //
  // L Mode should preserve normal Markdown semantics for
  // Backspace / Delete. The "delete a row" shortcut only
  // makes sense when the user is clearly targeting a full
  // body line; a selection that is strictly inside a single
  // cell (e.g. a double-clicked word) should fall through to
  // the standard CodeMirror Backspace / Delete handler so
  // the selected text is removed and the rest of the row
  // stays intact.
  it("does not delete the row when only a cell's text is selected", () => {
    const doc =
      "| プラン | 内容 |\n" +
      "| --- | --- |\n" +
      "| Preview | 表示確認 |\n";
    const cellStart = offsetOf(doc, "Preview");
    const cellEnd = cellStart + "Preview".length;
    const view = makeView(doc, cellStart, cellEnd);

    expect(deleteSelectedTableRows(view)).toBe(false);
    // The function refused the command; the doc must be
    // untouched, so the standard Backspace / Delete handler
    // gets a clean shot at the selected text.
    expect(view.state.doc.toString()).toBe(doc);
  });

  it("deletes a single body row when the whole body line is selected", () => {
    // Companion to the "cell text only" test: when the
    // selection spans the full body line (line start to
    // line end, without the trailing newline), the row
    // delete shortcut still fires.
    const doc =
      "| プラン | 内容 |\n" +
      "| --- | --- |\n" +
      "| Preview | 表示確認 |\n" +
      "| Standard | 基本機能 |\n";
    const row = "| Preview | 表示確認 |";
    const rowStart = offsetOf(doc, row);
    const rowEnd = rowStart + row.length;
    const view = makeView(doc, rowStart, rowEnd);

    expect(deleteSelectedTableRows(view)).toBe(true);
    expect(view.state.doc.toString()).toBe(
      "| プラン | 内容 |\n" +
        "| --- | --- |\n" +
        "| Standard | 基本機能 |\n",
    );
  });
});

describe("lModeCursorBoundaryPlugin", () => {
  type BoundaryPluginValue = {
    update: (update: ViewUpdate) => void;
    destroy: () => void;
  };
  type BoundaryPluginSpec = {
    create: (view: EditorView) => BoundaryPluginValue;
  };
  function createPluginInstance(raf: ReturnType<typeof vi.spyOn>) {
    const view = makeView(
      "| a | b |\n| --- | --- |\n| x | y |\n",
      offsetOf("| a | b |\n| --- | --- |\n| x | y |\n", "x"),
    );
    // CodeMirror sends a synthetic "no transactions" update to every
    // view plugin right after construction. Discard it so each test
    // observes only the update it explicitly feeds below.
    raf.mockClear();
    const pluginSpec = lModeCursorBoundaryPlugin() as unknown as BoundaryPluginSpec;
    const instance = pluginSpec.create(view);
    return { instance, view };
  }

  function feedUpdate(
    instance: { update: (update: ViewUpdate) => void },
    overrides: { docChanged: boolean; selectionSet: boolean },
  ) {
    instance.update(overrides as unknown as ViewUpdate);
  }

  it("does not schedule a snap rAF when neither the document nor the selection change", () => {
    const raf = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation(() => 0);
    try {
      const { instance, view } = createPluginInstance(raf);
      feedUpdate(instance, { docChanged: false, selectionSet: false });
      expect(raf).not.toHaveBeenCalled();
      instance.destroy();
      view.destroy();
    } finally {
      raf.mockRestore();
    }
  });

  it("schedules a snap rAF when the document changes", () => {
    const raf = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation(() => 0);
    try {
      const { instance, view } = createPluginInstance(raf);
      feedUpdate(instance, { docChanged: true, selectionSet: false });
      expect(raf).toHaveBeenCalled();
      instance.destroy();
      view.destroy();
    } finally {
      raf.mockRestore();
    }
  });

  it("schedules a snap rAF when the selection changes", () => {
    const raf = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation(() => 0);
    try {
      const { instance, view } = createPluginInstance(raf);
      feedUpdate(instance, { docChanged: false, selectionSet: true });
      expect(raf).toHaveBeenCalled();
      instance.destroy();
      view.destroy();
    } finally {
      raf.mockRestore();
    }
  });
});
