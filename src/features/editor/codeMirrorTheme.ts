// Shared CodeMirror theme + highlight style for the editor
// surfaces (EditorPane and CandidateEditor). The markdown
// highlight style is the only piece the two surfaces have
// in common; the surrounding `EditorView.theme` spec differs
// in CSS variables and padding values per surface, so it stays
// inline in each component.
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as highlightTags } from "@lezer/highlight";

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
