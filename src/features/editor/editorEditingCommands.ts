import {
  selectCharLeft,
  selectCharRight,
  selectLineDown,
  selectLineUp,
} from "@codemirror/commands";
import { EditorSelection, EditorState, Prec, type Text } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";

// Commands dispatch one edit transaction. The owning editor gates imperative
// calls on editability; keyboard indentation also checks the state directly.
export type MarkdownFormat =
  | "bold"
  | "italic"
  | "code"
  | "link"
  | "strikethrough"
  | "image";

export const editorKeyboardShortcuts = Prec.highest(keymap.of([
  { key: "Shift-ArrowLeft", run: selectCharLeft },
  { key: "Shift-ArrowRight", run: selectCharRight },
  { key: "Shift-ArrowUp", run: selectLineUp },
  { key: "Shift-ArrowDown", run: selectLineDown },
]));

export const editorTabIndentation = Prec.highest(
  EditorView.domEventHandlers({
    keydown(event, view) {
      if (
        event.key !== "Tab" ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        // 読み取り専用（編集ロック中）は Tab を奪わない。ブラウザの
        // フォーカス移動に任せ、キーボードだけで抜けられるようにする。
        view.state.readOnly
      ) {
        return false;
      }

      event.preventDefault();

      if (event.shiftKey) {
        outdentSelectedLines(view);
      } else {
        indentSelection(view);
      }

      return true;
    },
  }),
);

function indentSelection(view: EditorView) {
  const indent = " ".repeat(view.state.tabSize);

  if (view.state.selection.ranges.every((range) => range.empty)) {
    view.dispatch(
      view.state.changeByRange((range) => ({
        changes: { from: range.from, insert: indent },
        range: EditorSelection.cursor(range.from + indent.length),
      })),
    );
    return;
  }

  const changes = selectedLineNumbers(view.state).map((lineNumber) => ({
    from: view.state.doc.line(lineNumber).from,
    insert: indent,
  }));

  if (changes.length > 0) {
    view.dispatch({ changes });
  }
}

function outdentSelectedLines(view: EditorView) {
  const changes = selectedLineNumbers(view.state)
    .map((lineNumber) => {
      const line = view.state.doc.line(lineNumber);

      if (line.text.startsWith("\t")) {
        return { from: line.from, to: line.from + 1 };
      }

      const leadingSpaces = line.text.match(/^ +/)?.[0].length ?? 0;
      const removableSpaces = Math.min(leadingSpaces, view.state.tabSize);

      return removableSpaces > 0
        ? { from: line.from, to: line.from + removableSpaces }
        : null;
    })
    .filter((change): change is { from: number; to: number } => change !== null);

  if (changes.length > 0) {
    view.dispatch({ changes });
  }
}

export function applyMarkdownFormat(view: EditorView, format: MarkdownFormat) {
  view.dispatch(
    view.state.changeByRange((range) =>
      markdownFormatChange(view.state.doc, range.from, range.to, format),
    ),
  );
}

export function insertTableAtCursor(
  view: EditorView,
  columns: number,
  headerLabels?: readonly string[],
) {
  const header =
    "|" +
    Array.from({ length: columns }, (_, i) => {
      const label = headerLabels?.[i]?.trim() || `Col ${i + 1}`;
      return ` ${label} `;
    }).join("|") +
    "|";
  const separator =
    "|" + Array.from({ length: columns }, () => " --- ").join("|") + "|";
  const row =
    "|" + Array.from({ length: columns }, () => "   ").join("|") + "|";
  const table = `${header}\n${separator}\n${row}\n`;

  view.dispatch({
    changes: {
      from: view.state.selection.main.from,
      to: view.state.selection.main.to,
      insert: table,
    },
  });
}

function markdownFormatChange(
  doc: Text,
  from: number,
  to: number,
  format: MarkdownFormat,
) {
  const selectedText = doc.sliceString(from, to);

  switch (format) {
    case "bold":
      return wrapMarkdownSelection(from, to, selectedText, "**", "**");
    case "italic":
      return wrapMarkdownSelection(from, to, selectedText, "*", "*");
    case "code":
      return wrapMarkdownSelection(from, to, selectedText, "`", "`");
    case "strikethrough":
      return wrapMarkdownSelection(from, to, selectedText, "~~", "~~");
    case "link":
      return linkMarkdownSelection(from, to, selectedText);
    case "image":
      return imageMarkdownSelection(from, to, selectedText);
  }
}

function wrapMarkdownSelection(
  from: number,
  to: number,
  selectedText: string,
  before: string,
  after: string,
) {
  if (from === to) {
    return {
      changes: { from, to, insert: `${before}${after}` },
      range: EditorSelection.cursor(from + before.length),
    };
  }

  return {
    changes: { from, to, insert: `${before}${selectedText}${after}` },
    range: EditorSelection.range(from + before.length, to + before.length),
  };
}

function linkMarkdownSelection(from: number, to: number, selectedText: string) {
  if (from === to) {
    return {
      changes: { from, to, insert: "[text](url)" },
      range: EditorSelection.range(from + 1, from + 5),
    };
  }

  const replacement = `[${selectedText}](url)`;
  const urlStart = from + selectedText.length + 3;

  return {
    changes: { from, to, insert: replacement },
    range: EditorSelection.range(urlStart, urlStart + 3),
  };
}

function imageMarkdownSelection(from: number, to: number, selectedText: string) {
  if (from === to) {
    return {
      changes: { from, to, insert: "![alt](url)" },
      range: EditorSelection.range(from + 2, from + 5),
    };
  }

  const replacement = `![${selectedText}](url)`;
  const urlStart = from + selectedText.length + 4;

  return {
    changes: { from, to, insert: replacement },
    range: EditorSelection.range(urlStart, urlStart + 3),
  };
}

function selectedLineNumbers(state: EditorState) {
  const lineNumbers = new Set<number>();

  for (const range of state.selection.ranges) {
    const inclusiveTo = range.empty
      ? range.to
      : Math.max(range.from, range.to - 1);
    const startLine = state.doc.lineAt(range.from);
    const endLine = state.doc.lineAt(inclusiveTo);

    for (
      let lineNumber = startLine.number;
      lineNumber <= endLine.number;
      lineNumber += 1
    ) {
      lineNumbers.add(lineNumber);
    }
  }

  return Array.from(lineNumbers).sort((a, b) => a - b);
}
