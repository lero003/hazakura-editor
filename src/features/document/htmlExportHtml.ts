import { getMarkdownPreviewCss } from "./markdownExportCss";
import { escapeHtml } from "./htmlEscape";

/** Capture only the theme variables used by exported HTML. */
export function htmlExportCssVars(
  style: Pick<CSSStyleDeclaration, "getPropertyValue">,
): string {
  return [
        "--bg",
        "--text",
        "--text-muted",
        "--accent",
        "--accent-soft",
        "--border",
        "--surface",
        "--surface-muted",
        "--surface-strong",
        "--status-bg",
        "--status-text",
        "--font-mono",
        "--font-ui",
        "--shadow-sm",
        "--shadow-md",
      ]
        .map((v) => `  ${v}: ${style.getPropertyValue(v)};`)
        .join("\n");
}

type HtmlExportHtmlOptions = {
  title: string;
  bodyHtml: string;
  cssVars: string;
};

/** Self-contained markup shared by the saved HTML and its print rules. */
export function buildHtmlExportHtml({ title, bodyHtml, cssVars }: HtmlExportHtmlOptions): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
:root {
${cssVars}
}
body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-ui, system-ui, sans-serif);
  margin: 0;
  padding: 0;
}
${getMarkdownPreviewCss()}

/* The preview CSS above is screen-first; the print block
   below tightens type, hides backgrounds, and stops tables /
   code blocks from splitting across pages. Mirrors the
   in-app PDF export path so a saved file printed later
   matches what the user saw in the browser. */
@media print {
  @page { margin: 18mm 16mm; }
  body {
    background: #ffffff;
    color: #000000;
    margin: 0;
    padding: 0;
  }
  .markdown-preview {
    color: #000000;
    font-family: "Iowan Old Style", "Charter", Georgia, "Times New Roman", serif;
    font-size: 11pt;
    line-height: 1.45;
    max-width: none;
    padding: 0;
  }
  .markdown-preview h1,
  .markdown-preview h2,
  .markdown-preview h3,
  .markdown-preview h4 {
    color: #000000;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    page-break-after: avoid;
  }
  .markdown-preview pre,
  .markdown-preview blockquote,
  .markdown-preview .markdown-table-frame,
  .markdown-preview img {
    page-break-inside: avoid;
  }
  .markdown-preview pre,
  .markdown-preview code,
  .markdown-preview .markdown-table-frame th {
    background: transparent;
  }
  .markdown-preview pre {
    border-left: 2px solid #999999;
    padding: 0 0 0 8px;
  }
  .markdown-preview a {
    color: inherit;
    text-decoration: underline;
  }
  .markdown-preview a[href^="http"]::after {
    content: " (" attr(href) ")";
    font-size: 0.85em;
    color: #555555;
  }
}
</style>
</head>
<body>
<div class="markdown-preview">
${bodyHtml}
</div>
</body>
</html>`;
}
