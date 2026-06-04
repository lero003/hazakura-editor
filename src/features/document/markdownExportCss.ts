// Raw CSS text for the Markdown preview, used as the base of
// the HTML export. The preview pane in the app loads the same
// rules through `styles/preview.css`; the export copies the
// text inline so the saved HTML can be opened without the app.
// Vite's `?raw` suffix bundles the file as a string at build
// time, so we don't have to maintain a parallel CSS copy.

import previewCss from "../../styles/preview.css?raw";

// Strip the theme-specific override rules (`[data-theme="dark"]`,
// `[data-theme="yakou"]`, `[data-theme="shokou"]`) — the export
// already pulls the resolved CSS variables for the current theme
// via `getComputedStyle`, so the theme overrides would just be
// dead weight. The base `.markdown-preview` rules are kept so the
// saved file uses the same selectors the live preview does.
export function getMarkdownPreviewCss(): string {
  return previewCss.replace(
    /:root\[data-theme="[^"]+"\][^{]*\{[^}]*\}/g,
    "",
  );
}
