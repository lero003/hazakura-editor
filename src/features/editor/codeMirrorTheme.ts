// Shared CodeMirror theme + highlight style for the editor
// surfaces (EditorPane and CandidateEditor). Each supported
// file family has its own `HighlightStyle` so the colour
// decisions stay in one place per language. The surrounding
// `EditorView.theme` spec differs in CSS variables and padding
// values per surface, so it stays inline in each component.
//
// The picker (`pickEditorLanguage`) keys off the file
// extension, falling back to Markdown for anything we don't
// explicitly recognise. The Markdown style is the same one
// the CandidateEditor uses, since that surface is always
// Markdown (AI drafts).
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as highlightTags } from "@lezer/highlight";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import type { Extension } from "@codemirror/state";

/**
 * File-family kind picked from the document path's extension.
 * Used by `pickEditorLanguage` to choose the parser and the
 * highlight style. New families must be added to the picker
 * AND to the drift test that checks the highlight functions.
 */
export type EditorLanguageKind = "markdown" | "html" | "css";

export function markdownHighlightStyle() {
  return HighlightStyle.define([
    {
      tag: [
        highlightTags.heading,
        highlightTags.heading1,
        highlightTags.heading2,
        highlightTags.heading3,
      ],
      color: "var(--cm-mark-heading)",
      fontWeight: "700",
    },
    {
      tag: [highlightTags.strong, highlightTags.emphasis],
      color: "var(--cm-mark-strong)",
    },
    {
      tag: [highlightTags.link, highlightTags.url],
      color: "var(--cm-mark-link)",
      textDecoration: "underline",
    },
    {
      tag: highlightTags.monospace,
      color: "var(--cm-mark-monospace)",
    },
    {
      tag: highlightTags.quote,
      color: "var(--cm-mark-quote)",
      fontStyle: "italic",
    },
  ]);
}

export function markdownSyntaxHighlighting() {
  return syntaxHighlighting(markdownHighlightStyle());
}

// --- HTML ---
//
// The HTML family picks up the parser's `StartTag` / `EndTag` /
// `TagName` / `AttributeName` / `AttributeValue` / `Comment` /
// `DocumentMeta` (DOCTYPE) / `ProcessingInstruction` (<?...?>)
// nodes. We do NOT enable HTML highlighting inside Markdown
// files — the Markdown parser emits those nodes too, but the
// `markdownHighlightStyle` deliberately omits them so embedded
// `<br>` / `<div>` stays prose-typed in the writing surface.

export function htmlHighlightStyle() {
  return HighlightStyle.define([
    {
      tag: [highlightTags.tagName],
      color: "var(--cm-mark-link)",
      fontWeight: "600",
    },
    {
      tag: [highlightTags.attributeName],
      color: "var(--cm-mark-monospace)",
    },
    {
      tag: [highlightTags.attributeValue],
      color: "var(--cm-mark-monospace)",
    },
    {
      tag: [highlightTags.angleBracket],
      color: "var(--cm-mark-link)",
    },
    {
      tag: [highlightTags.comment, highlightTags.blockComment],
      color: "var(--cm-mark-quote)",
      fontStyle: "italic",
    },
    {
      tag: [highlightTags.documentMeta, highlightTags.processingInstruction],
      color: "var(--cm-mark-quote)",
    },
    {
      tag: [highlightTags.character],
      color: "var(--cm-mark-monospace)",
    },
  ]);
}

export function htmlSyntaxHighlighting() {
  return syntaxHighlighting(htmlHighlightStyle());
}

// --- CSS ---
//
// The CSS family picks up `TagName` (type selectors), `ClassName`
// (`.foo`), `VariableName` (`#foo` ids), `PropertyName` (left-hand
// side of `:`), `String` / `Number` / `Color` / `Unit` (right-hand
// side), `Keyword` (`@media`, `!important`, `from`, `to`), and
// `Comment` nodes. `Operator` is faded to monospace so the `:` and
// `,` and `;` blend with values rather than with the property
// names.

export function cssHighlightStyle() {
  return HighlightStyle.define([
    {
      tag: [highlightTags.tagName, highlightTags.className],
      color: "var(--cm-mark-link)",
      fontWeight: "600",
    },
    {
      tag: [highlightTags.variableName],
      color: "var(--cm-mark-link)",
    },
    {
      tag: [highlightTags.propertyName],
      color: "var(--cm-mark-strong)",
      fontWeight: "600",
    },
    {
      tag: [
        highlightTags.string,
        highlightTags.number,
        highlightTags.color,
        highlightTags.unit,
      ],
      color: "var(--cm-mark-monospace)",
    },
    {
      tag: [highlightTags.keyword, highlightTags.controlKeyword],
      color: "var(--cm-mark-quote)",
      fontWeight: "600",
    },
    {
      tag: [highlightTags.operator],
      color: "var(--cm-mark-strong)",
    },
    {
      tag: [highlightTags.comment, highlightTags.blockComment],
      color: "var(--cm-mark-quote)",
      fontStyle: "italic",
    },
  ]);
}

export function cssSyntaxHighlighting() {
  return syntaxHighlighting(cssHighlightStyle());
}

// --- Dispatch ---

/**
 * Pick the language parser + highlight style for the given
 * document path. The Markdown branch re-uses the GFM-flavoured
 * `markdownLanguage` base (same one `EditorPane` used to hard-
 * code) so the L Mode and Markdown-family decorations keep
 * matching.
 *
 * Unknown extensions fall through to the Markdown parser. That
 * matches the pre-existing behaviour where every file opened in
 * the editor used the Markdown parser; it is a deliberate
 * non-strict default, not an oversight.
 *
 * When `lModeEnabled` is true, the picker forces the Markdown
 * branch regardless of the file extension. The L Mode
 * decoration pass targets Markdown / GFM AST nodes
 * (`ATXHeading*`, `Blockquote`, `FencedCode`, `Task`, etc.),
 * so a non-Markdown parser would leave the surface in an
 * inconsistent state — the file would still be highlighted as
 * CSS / HTML, but no L Mode chrome would render, and the
 * `data-l-chip` margin annotations would silently miss their
 * anchor nodes. Pinning the parser (and the highlight style)
 * to Markdown keeps the L Mode contract honest and matches
 * the user's "L Mode では適用しない" rule by literally not
 * applying the CSS / HTML highlight.
 */
export function pickEditorLanguage(
  documentKey: string,
  options: { lModeEnabled?: boolean } = {},
): {
  kind: EditorLanguageKind;
  language: Extension;
  highlight: Extension;
} {
  if (options.lModeEnabled) {
    return {
      kind: "markdown",
      language: markdown({ base: markdownLanguage }),
      highlight: markdownSyntaxHighlighting(),
    };
  }

  const dotIndex = documentKey.lastIndexOf(".");
  const extension =
    dotIndex === -1
      ? ""
      : documentKey.slice(dotIndex + 1).toLowerCase();

  if (extension === "css") {
    return {
      kind: "css",
      language: css(),
      highlight: cssSyntaxHighlighting(),
    };
  }

  if (extension === "html" || extension === "htm" || extension === "xml") {
    return {
      kind: "html",
      language: html(),
      highlight: htmlSyntaxHighlighting(),
    };
  }

  return {
    kind: "markdown",
    language: markdown({ base: markdownLanguage }),
    highlight: markdownSyntaxHighlighting(),
  };
}
