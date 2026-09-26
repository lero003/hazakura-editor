import { getMarkdownPreviewCss } from "./markdownExportCss";
import { escapeHtml } from "./htmlEscape";
import {
  formatPdfPointValue,
  PDF_A4_PAGE_HEIGHT_POINTS,
  PDF_A4_PAGE_WIDTH_POINTS,
  pdfMarginCss,
  type PdfMarginPreset,
  type PdfScreenPageLayout,
} from "./pdfExport";
import type { DocumentExportScope } from "./exportScope";

type PdfExportHtmlOptions = {
  title: string;
  scope: DocumentExportScope;
  preset: PdfMarginPreset;
  layout: PdfScreenPageLayout;
  coverHtml: string;
  bodyHtml: string;
  coverMaxHeightPx: number;
  imageMaxHeightPx: number;
};

/** Produces the same self-contained HTML for native PDF and browser print. */
export function buildPdfExportHtml({
  title, scope, preset, layout: pdfLayout, coverHtml, bodyHtml,
  coverMaxHeightPx, imageMaxHeightPx,
}: PdfExportHtmlOptions): string {
  const hasCover = coverHtml.length > 0;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root {
    --bg: #ffffff;
    --text: #1d1d1f;
    --text-muted: #6e6e73;
    --accent: #b3416a;
    --accent-soft: rgba(179, 65, 106, 0.12);
    --border: #d2d2d7;
    --surface: #ffffff;
    --surface-muted: #f5f5f7;
    --surface-strong: #ffffff;
    --status-bg: #1c2420;
    --status-text: #f0f7f3;
    --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    --font-ui: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    --pdf-page-width: ${PDF_A4_PAGE_WIDTH_POINTS}px;
    --pdf-page-height: ${PDF_A4_PAGE_HEIGHT_POINTS}px;
    --pdf-margin-block: ${formatPdfPointValue(pdfLayout.marginBlockPoints)}px;
    --pdf-margin-inline: ${formatPdfPointValue(pdfLayout.marginInlinePoints)}px;
    --pdf-content-width: ${formatPdfPointValue(pdfLayout.contentWidthPoints)}px;
    --pdf-content-height: ${formatPdfPointValue(pdfLayout.contentHeightPoints)}px;
    --pdf-column-gap: ${formatPdfPointValue(pdfLayout.columnGapPoints)}px;
  }
  html {
    background: #ffffff;
    min-height: var(--pdf-page-height);
    /* Grow horizontally with cover + multicol columns for createPDF. */
    min-width: max-content;
  }
  body {
    background: var(--bg);
    color: var(--text);
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    font-family: var(--font-ui);
    margin: 0;
    min-height: var(--pdf-page-height);
    height: var(--pdf-page-height);
    padding: 0;
    position: relative;
    width: max-content;
  }
  .pdf-export-background {
    background: #ffffff;
    height: 100%;
    inset: 0;
    pointer-events: none;
    position: absolute;
    width: 100%;
    z-index: 0;
  }
  /* Dedicated first A4 page for leading cover image (outside multicol). */
  .pdf-export-cover-page {
    background: #ffffff;
    box-sizing: border-box;
    display: flex;
    flex: 0 0 var(--pdf-page-width);
    align-items: center;
    justify-content: center;
    height: var(--pdf-page-height);
    margin: 0;
    padding: var(--pdf-margin-block) var(--pdf-margin-inline);
    position: relative;
    width: var(--pdf-page-width);
    z-index: 1;
  }
  .pdf-export-cover-page p {
    margin: 0;
    width: 100%;
  }
  .pdf-export-cover-page img {
    border: 0;
    border-radius: 0;
    box-shadow: none;
    display: block;
    height: auto;
    margin: 0 auto;
    /* Numeric px also set inline on the cover <img>; keep a CSS fallback. */
    max-height: ${coverMaxHeightPx}px;
    max-width: 100%;
    object-fit: contain;
    width: auto;
  }
  ${getMarkdownPreviewCss()}
  /* WKWebView.createPDF captures the screen layout rather than paged-media
     @page rules. A one-page-high multi-column flow makes every 595-point
     horizontal slice an A4 page with the selected margins already present.
     --pdf-content-height already reserves bottom safety so the last line
     boxes stay inside the capture rect (see PDF_CONTENT_BOTTOM_SAFETY_POINTS). */
  .markdown-preview {
    background: #ffffff;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    /* border-box so bottom padding shrinks column flow height. */
    box-sizing: border-box;
    color: #000000;
    column-fill: auto;
    column-gap: var(--pdf-column-gap);
    column-width: var(--pdf-content-width);
    flex: 0 0 auto;
    font-family: "Iowan Old Style", "Charter", Georgia, "Times New Roman", serif;
    font-size: 11pt;
    height: var(--pdf-content-height);
    line-height: 1.45;
    margin: var(--pdf-margin-block) var(--pdf-margin-inline);
    max-width: none;
    overflow: visible;
    padding: 0 0 2.25em;
    position: relative;
    width: var(--pdf-content-width);
    z-index: 1;
  }
  .markdown-preview .pdf-export-tail-guard {
    display: block;
    height: 3em;
    margin: 0;
    padding: 0;
    visibility: hidden;
  }
  /* Put the break on non-empty chapter content. WebKit may discard an empty
     multicol break marker, which would pack short chapters onto one page. */
  .book-scope-pdf-chapter {
    break-inside: auto;
  }
  .book-scope-pdf-chapter--next {
    -webkit-column-break-before: always;
    break-before: column;
  }
  .markdown-preview h1,
  .markdown-preview h2,
  .markdown-preview h3,
  .markdown-preview h4 {
    break-after: avoid;
    color: #000000;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  .markdown-preview pre,
  .markdown-preview blockquote {
    break-inside: avoid;
  }
  /* Body images: prefer inline styles stamped after embed. Keep CSS as
     fallback; break-inside:auto so tall images do not vanish in multicol. */
  .markdown-preview img {
    border: 0;
    border-radius: 0;
    break-inside: auto;
    box-shadow: none;
    display: block;
    height: auto;
    margin: 10px auto 16px;
    max-height: ${imageMaxHeightPx}px;
    max-width: 100%;
    object-fit: contain;
    width: auto;
  }
  .markdown-preview pre {
    background: var(--status-bg);
    border-left: 2px solid #999999;
    box-sizing: border-box;
    color: var(--status-text);
    display: inline-block;
    max-width: 100%;
    overflow: visible;
    padding: 16px;
    white-space: pre-wrap;
    width: 100%;
  }
  .markdown-preview pre code {
    background: transparent;
    color: inherit;
  }
  .markdown-preview .markdown-table-frame {
    break-inside: auto;
    max-width: 100%;
    overflow: visible;
  }
  .markdown-preview .markdown-table-frame table {
    display: block;
    min-width: 0;
    width: 100%;
  }
  .markdown-preview .markdown-table-frame thead,
  .markdown-preview .markdown-table-frame tbody {
    display: block;
  }
  .markdown-preview .markdown-table-frame tr {
    break-inside: avoid;
    display: grid;
    grid-template-columns: repeat(var(--pdf-table-columns), minmax(0, 1fr));
  }
  .markdown-preview .markdown-table-frame th,
  .markdown-preview .markdown-table-frame td {
    box-sizing: border-box;
    min-width: 0;
    overflow-wrap: anywhere;
    white-space: normal;
  }
  .markdown-preview a { color: inherit; text-decoration: underline; }
  .markdown-preview a[href^="http"]::after {
    content: " (" attr(href) ")";
    color: #555555;
    font-size: 0.85em;
  }
  @media print {
    .book-scope-pdf-chapter--next { break-before: page; page-break-before: always; }
    @page { margin: ${pdfMarginCss(preset)}; }
    html { min-height: 0; min-width: 0; }
    body {
      background: #ffffff;
      color: #000000;
      margin: 0;
      min-height: 0;
      padding: 0;
      width: auto;
    }
    .markdown-preview {
      color: #000000;
      column-fill: balance;
      column-gap: normal;
      column-width: auto;
      font-family: "Iowan Old Style", "Charter", Georgia, "Times New Roman", serif;
      font-size: 11pt;
      height: auto;
      line-height: 1.45;
      margin: 0;
      max-width: none;
      padding: 0;
      width: auto;
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
    .markdown-preview img { page-break-inside: avoid; }
    .markdown-preview pre {
      background: var(--status-bg);
      border-left: 2px solid #999999;
      box-sizing: border-box;
      color: var(--status-text);
      display: inline-block;
      max-width: 100%;
      overflow: visible;
      padding: 16px;
      white-space: pre-wrap;
      width: 100%;
    }
    .markdown-preview pre code {
      background: transparent;
      color: inherit;
    }
    .markdown-preview .markdown-table-frame { page-break-inside: auto; }
    .markdown-preview a { color: inherit; text-decoration: underline; }
    .markdown-preview a[href^="http"]::after {
      content: " (" attr(href) ")";
      font-size: 0.85em;
      color: #555555;
    }
  }
</style>
</head>
<body>
<div class="pdf-export-background" aria-hidden="true"></div>
${
  hasCover
    ? `<div class="pdf-export-cover-page">${coverHtml}</div>`
    : ""
}
<div class="markdown-preview">
${bodyHtml}
${scope === "book" ? "" : '<p class="pdf-export-tail-guard" aria-hidden="true">&#8203;</p>'}
</div>
</body>
</html>`;
}
