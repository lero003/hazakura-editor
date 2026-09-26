import {
  EditorState,
  StateEffect,
  StateField,
  type Extension,
  type Range,
  type Text,
} from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";

type DecoratedSearchMatch = { from: number; to: number; active: boolean };

export const setSearchMatchesEffect =
  StateEffect.define<readonly DecoratedSearchMatch[]>();

// `EditorView.editable` は DOM から直接編集できるかの設定で、API 経由の
// `dispatch({ changes })` は止めない。標準編集コマンドと自作コマンドが参照する
// `EditorState.readOnly` も必ず一緒に立てる（自作 dispatch は個別の検査も要る）。
export function editorReadOnlyExtensions(readOnly: boolean): Extension {
  return [
    EditorState.readOnly.of(readOnly),
    EditorView.editable.of(!readOnly),
  ];
}

export const invisibleCharactersField = StateField.define<DecorationSet>({
  create(state) {
    return buildInvisibleDecorations(state.doc);
  },
  update(decorations, transaction) {
    if (transaction.docChanged) {
      return buildInvisibleDecorations(transaction.state.doc);
    }

    return decorations.map(transaction.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});

export const searchHighlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(highlights, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setSearchMatchesEffect)) {
        return buildSearchDecorations(effect.value);
      }
    }

    if (transaction.docChanged) {
      return highlights.map(transaction.changes);
    }

    return highlights;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export function editorTheme(theme: "light" | "dark", fontSize: number) {
  const safeFontSize = Math.min(Math.max(fontSize, 12), 22);

  return EditorView.theme(
    {
      "&": {
        backgroundColor: "var(--cm-bg)",
        color: "var(--cm-fg)",
        height: "100%",
        fontSize: `${safeFontSize}px`,
      },
      ".cm-scroller": {
        fontFamily:
          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      },
      ".cm-content": {
        caretColor: "var(--cm-caret)",
        padding: "18px 0",
      },
      ".cm-line": {
        padding: "0 22px",
      },
      ".cm-gutters": {
        backgroundColor: "var(--cm-gutter-bg)",
        borderRight: "1px solid var(--cm-gutter-border)",
        color: "var(--cm-gutter-fg)",
        fontSize: "0.78em",
      },
      ".cm-activeLine": {
        backgroundColor: "var(--cm-active-line-bg)",
      },
      ".cm-activeLineGutter": {
        backgroundColor: "var(--cm-active-gutter-bg)",
      },
      ".cm-selectionLayer .cm-selectionBackground": {
        backgroundColor: "var(--cm-selection-bg)",
        opacity: "1",
      },
      "&.cm-focused .cm-selectionLayer .cm-selectionBackground": {
        backgroundColor: "var(--cm-selection-bg)",
      },
      "&.cm-focused": {
        // Focus shown as a single accent underline at the top edge of the
        // editor, not a four-sided inset ring: under the v0.25 transparent
        // shell a full inset box-shadow reads as an unnatural border around
        // the whole editor pane.
        boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--accent) 40%, transparent)",
        outline: "none",
      },
      ".cm-content ::selection": {
        backgroundColor: "var(--cm-selection-bg)",
      },
      ".cm-searchMatch": {
        backgroundColor: "var(--cm-search-match-bg)",
        borderRadius: "3px",
      },
      ".cm-searchMatch-active": {
        backgroundColor: "var(--cm-search-match-active-bg)",
        boxShadow: "var(--cm-search-match-active-shadow)",
      },
      ".cm-invisible-space": {
        backgroundImage: "var(--cm-invisible-space)",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      },
      ".cm-invisible-tab": {
        backgroundColor: "var(--cm-invisible-tab)",
        borderRadius: "3px",
      },
      ".cm-trailing-space": {
        backgroundColor: "var(--cm-trailing-space)",
      },
    },
    { dark: theme === "dark" },
  );
}

export function getEditorWrappingExtensions(
  wrapLines: boolean,
  lModeEnabled: boolean,
): Extension[] {
  return wrapLines || lModeEnabled ? [EditorView.lineWrapping] : [];
}

function buildInvisibleDecorations(doc: Text): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const maxDecorations = 20000;

  for (
    let lineNumber = 1;
    lineNumber <= doc.lines && decorations.length < maxDecorations;
    lineNumber += 1
  ) {
    const line = doc.line(lineNumber);
    const trailingWhitespaceStart = line.text.search(/[ \t]+$/);

    for (
      let index = 0;
      index < line.text.length && decorations.length < maxDecorations;
      index += 1
    ) {
      const char = line.text[index];

      if (char !== " " && char !== "\t") {
        continue;
      }

      const isTrailing =
        trailingWhitespaceStart !== -1 && index >= trailingWhitespaceStart;
      const className = [
        char === "\t" ? "cm-invisible-tab" : "cm-invisible-space",
        isTrailing ? "cm-trailing-space" : "",
      ]
        .filter(Boolean)
        .join(" ");

      decorations.push(
        Decoration.mark({ class: className }).range(
          line.from + index,
          line.from + index + 1,
        ),
      );
    }
  }

  return Decoration.set(decorations, true);
}

function buildSearchDecorations(
  matches: readonly DecoratedSearchMatch[],
): DecorationSet {
  return Decoration.set(
    matches
      .filter((match) => match.from >= 0 && match.to > match.from)
      .map((match) =>
        Decoration.mark({
          class: match.active
            ? "cm-searchMatch cm-searchMatch-active"
            : "cm-searchMatch",
        }).range(match.from, match.to),
      ),
    true,
  );
}
