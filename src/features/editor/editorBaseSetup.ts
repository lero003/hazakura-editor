// Curated CodeMirror base setup for the Safe Editor writing surface.
//
// `basicSetup` from the `codemirror` package is a convenient IDE-oriented
// bundle. It includes `foldGutter` + `foldKeymap`, which interact badly with
// Markdown writing:
//
//   - The Markdown language marks every block node (including `FencedCode`)
//     as foldable. A fence such as ```markdown … ``` folds from the end of
//     the opening line through the whole sample template.
//   - Heading fold service can collapse an entire section under
//     `#### …` that contains the fence and following prose.
//   - Accidental gutter clicks (or fold shortcuts) while focusing/editing
//     that region look like "lines disappeared", even though the buffer is
//     intact. L Mode hides gutters, so the same document looks fine there.
//
// Hazakura is a Markdown-first Safe Editor, not an IDE. We keep the useful
// bits of basicSetup and deliberately omit folding.

import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import {
  bracketMatching,
  defaultHighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { EditorState, type Extension } from "@codemirror/state";
import {
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
} from "@codemirror/view";

/**
 * Writing-surface base extensions. Intentionally excludes:
 * - `foldGutter` / `foldKeymap` (see file header)
 * - `rectangularSelection` / `crosshairCursor` (added separately in EditorPane
 *   so the composition stays explicit)
 * - `lintKeymap` (no lint surface in Safe Editor)
 */
export const editorBaseSetup: Extension = [
  lineNumbers(),
  highlightActiveLineGutter(),
  highlightSpecialChars(),
  history(),
  drawSelection(),
  dropCursor(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  bracketMatching(),
  closeBrackets(),
  autocompletion(),
  highlightActiveLine(),
  highlightSelectionMatches(),
  keymap.of([
    ...closeBracketsKeymap,
    ...defaultKeymap,
    ...searchKeymap,
    ...historyKeymap,
    ...completionKeymap,
  ]),
];
