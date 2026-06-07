import { describe, expect, it } from "vitest";
import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
  deleteSelectedTableRows,
  insertTableRowAfterCursor,
  insertTableCellBreak,
  insertTableCellPipe,
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
    const doc =
      "| プラン | 内容 | 想定ユーザー |\n" +
      "| --- | --- | --- |\n" +
      "| Preview | 開発版・検証用 | 早期に試したい人 |\n" +
      "| Standard | 基本機能 | Markdownを書く人 |\n" +
      "| Supporter | 支援つき | 開発を応援したい人 |\n";
    const selectionStart = offsetOf(doc, "Preview");
    const selectionEnd = offsetOf(doc, "Markdownを書く人") + "Markdownを書く人".length;
    const view = makeView(doc, selectionStart, selectionEnd);

    expect(deleteSelectedTableRows(view)).toBe(true);
    expect(view.state.doc.toString()).toBe(
      "| プラン | 内容 | 想定ユーザー |\n" +
        "| --- | --- | --- |\n" +
        "| Supporter | 支援つき | 開発を応援したい人 |\n",
    );
  });
});
