import { useCallback, useRef, useState } from "react";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import {
  isTauriRuntime,
  exportPdfFile,
  openWorkspaceImage,
  saveBinaryFileAs,
  saveTextFileAs,
} from "../../lib/tauri";
import {
  buildEpubBetaArchiveWithReport,
  defaultEpubExportSettings,
  type EpubExportSettings,
} from "../../features/document/epubExport";
import {
  DEFAULT_PDF_MARGIN_PRESET,
  extractPdfLeadingCoverHtml,
  formatPdfPointValue,
  PDF_A4_PAGE_HEIGHT_POINTS,
  PDF_A4_PAGE_WIDTH_POINTS,
  pdfMarginCss,
  pdfScreenPageLayout,
  preparePdfExportTables,
  type PdfMarginPreset,
} from "../../features/document/pdfExport";
import { embedAndStampPdfImages } from "../../features/document/pdfExportImages";
import { getMarkdownPreviewCss } from "../../features/document/markdownExportCss";
import { renderMarkdown } from "../../features/editor/markdown";
import { isDirty } from "../../features/editor/editorTabs";
import type { EditorTab } from "../../types";

type UseDocumentExportOptions = {
  activeContents: string;
  activeTab: EditorTab | null;
  setGlobalError: (message: string | null) => void;
  setStatus: (message: string) => void;
  workspaceRootPath: string | null;
};

export type EpubExportRequest = {
  documentName: string;
  hasUnsavedChanges: boolean;
  settings: EpubExportSettings;
  tabId: string;
};

export type PdfExportRequest = {
  documentName: string;
  hasUnsavedChanges: boolean;
  preset: PdfMarginPreset;
  tabId: string;
};

export function useDocumentExport({
  activeContents,
  activeTab,
  setGlobalError,
  setStatus,
  workspaceRootPath,
}: UseDocumentExportOptions) {
  const activeContentsRef = useRef(activeContents);
  activeContentsRef.current = activeContents;
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const [epubExportRequest, setEpubExportRequest] =
    useState<EpubExportRequest | null>(null);
  const [pdfExportRequest, setPdfExportRequest] =
    useState<PdfExportRequest | null>(null);

  const exportPdf = useCallback(async () => {
    // Match HTML / EPUB: an open tab may be empty (pathless draft or blank
    // file). Only a missing active tab is "no document".
    if (!activeTab || activeContents === undefined) {
      setStatus("No active document to export PDF");
      return;
    }

    setPdfExportRequest({
      documentName: activeTab.name,
      hasUnsavedChanges: isDirty(activeTab),
      preset: DEFAULT_PDF_MARGIN_PRESET,
      tabId: activeTab.id,
    });
  }, [activeContents, activeTab, setStatus]);

  const cancelPdfExport = useCallback(() => {
    setPdfExportRequest(null);
  }, []);

  const confirmPdfExport = useCallback(async (preset: PdfMarginPreset) => {
    const request = pdfExportRequest;
    if (!request) {
      return;
    }

    setPdfExportRequest(null);
    const tabForExport = activeTabRef.current;
    if (!tabForExport || tabForExport.id !== request.tabId) {
      setStatus("PDF export stopped; document changed");
      return;
    }

    setStatus("Preparing PDF export...");
    try {
      let rendered = renderMarkdown(activeContentsRef.current, {
        documentPath: tabForExport.path,
        workspaceRoot: workspaceRootPath ?? undefined,
      });
      rendered = preparePdfExportTables(rendered);

      const pdfLayout = pdfScreenPageLayout(preset);
      const pdfPoint = formatPdfPointValue;
      const coverMaxHeightPx = Math.max(
        320,
        Math.floor(
          PDF_A4_PAGE_HEIGHT_POINTS - pdfLayout.marginBlockPoints * 2 - 24,
        ),
      );
      const imageMaxHeightPx = Math.max(
        200,
        Math.floor(pdfLayout.contentHeightPoints * 0.72),
      );

      // Embed every workspace-contained local image as a data: URL, then stamp
      // createPDF-safe sizes. The shared Markdown image policy has already
      // blocked paths outside the selected workspace, so Preview, HTML, and
      // PDF share one document-relative containment boundary.
      const embedResult = await embedAndStampPdfImages(
        rendered,
        async (path) => {
          if (!workspaceRootPath) {
            throw new Error("Workspace image access requires an open workspace");
          }
          const image = await openWorkspaceImage(workspaceRootPath, path);
          return image.dataUrl;
        },
        // The leading cover is split and resized below. Keep every body image
        // within the shortened multicolumn flow so its inline style cannot
        // override the body CSS safety limit.
        { bodyMaxHeightPx: imageMaxHeightPx },
      );
      rendered = embedResult.html;
      if (embedResult.failedPaths.length > 0) {
        setStatus(
          `PDF: ${embedResult.embeddedCount} image(s) embedded, ${embedResult.failedPaths.length} skipped (access/path)`,
        );
      }

      const { coverHtml, bodyHtml } = extractPdfLeadingCoverHtml(
        rendered,
        coverMaxHeightPx,
      );
      const hasCover = coverHtml.length > 0;

      const standaloneHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(tabForExport.name)}</title>
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
    --pdf-margin-block: ${pdfPoint(pdfLayout.marginBlockPoints)}px;
    --pdf-margin-inline: ${pdfPoint(pdfLayout.marginInlinePoints)}px;
    --pdf-content-width: ${pdfPoint(pdfLayout.contentWidthPoints)}px;
    --pdf-content-height: ${pdfPoint(pdfLayout.contentHeightPoints)}px;
    --pdf-column-gap: ${pdfPoint(pdfLayout.columnGapPoints)}px;
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
<p class="pdf-export-tail-guard" aria-hidden="true">&#8203;</p>
</div>
</body>
</html>`;

      if (isTauriRuntime()) {
        const destPath = await saveDialog({
          defaultPath: request.documentName.replace(/\.[^.]+$/, "") + ".pdf",
          filters: [{ name: "PDF", extensions: ["pdf"] }],
        });
        if (!destPath) {
          setStatus("");
          return;
        }

        const currentTab = activeTabRef.current;
        if (!currentTab || currentTab.id !== request.tabId) {
          setStatus("PDF export stopped; document changed");
          return;
        }

        await exportPdfFile(destPath, standaloneHtml);
        setStatus(
          embedResult.failedPaths.length > 0
            ? `PDF exported with ${embedResult.failedPaths.length} image warning(s)`
            : "PDF exported",
        );
        setTimeout(() => setStatus(""), 2000);
        return;
      }

      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        setStatus("PDF export unavailable");
        return;
      }
      printWindow.document.open();
      printWindow.document.write(standaloneHtml);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      setTimeout(() => setStatus(""), 2000);
    } catch (err) {
      console.warn("PDF export failed:", err);
      setGlobalError(`PDF export failed: ${String(err)}`);
      setStatus("PDF export unavailable");
    }
  }, [pdfExportRequest, setGlobalError, setStatus, workspaceRootPath]);

  const exportHtml = useCallback(async () => {
    if (!activeTab || activeContents === undefined) {
      setStatus("No active document to export");
      return;
    }

    try {
      const destPath = await saveDialog({
        defaultPath: activeTab.name.replace(/\.[^.]+$/, "") + ".html",
        filters: [{ name: "HTML", extensions: ["html"] }],
      });
      if (!destPath) return;

      const tabForExport = activeTabRef.current;
      if (!tabForExport || tabForExport.id !== activeTab.id) {
        setStatus("Export HTML stopped; document changed");
        return;
      }
      const contentsForExport = activeContentsRef.current;

      let bodyHtml = renderMarkdown(contentsForExport, {
        documentPath: tabForExport.path,
        workspaceRoot: workspaceRootPath,
      });
      const htmlEmbed = await embedAndStampPdfImages(
        bodyHtml,
        async (path) => {
          if (!workspaceRootPath) {
            throw new Error("Workspace image access requires an open workspace");
          }
          const image = await openWorkspaceImage(workspaceRootPath, path);
          return image.dataUrl;
        },
        { bodyMaxHeightPx: 1200 },
      );
      bodyHtml = htmlEmbed.html;

      const root = document.documentElement;
      const cs = getComputedStyle(root);
      const cssVars = [
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
        .map((v) => `  ${v}: ${cs.getPropertyValue(v)};`)
        .join("\n");

      // The body content is wrapped in a `.markdown-preview`
      // container so the inlined preview CSS (sourced from
      // `styles/preview.css`) applies with the same selectors
      // the live preview pane uses. Saving with a different
      // class would force a parallel stylesheet to be kept in
      // sync.
      const standaloneHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(tabForExport.name)}</title>
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

      await saveTextFileAs(destPath, standaloneHtml, "lf", "utf-8", null);
      setStatus(`Exported HTML: ${destPath}`);
    } catch (err) {
      setGlobalError(`Export HTML failed: ${String(err)}`);
      setStatus("Export HTML failed");
    }
  }, [activeContents, activeTab, setGlobalError, setStatus, workspaceRootPath]);

  const exportEpubBeta = useCallback(async () => {
    if (!activeTab || activeContents === undefined) {
      setStatus("No active document to export");
      return;
    }

    setEpubExportRequest({
      documentName: activeTab.name,
      hasUnsavedChanges: isDirty(activeTab),
      settings: defaultEpubExportSettings({
        documentName: activeTab.name,
        markdown: activeContents,
      }),
      tabId: activeTab.id,
    });
  }, [activeContents, activeTab, setStatus]);

  const cancelEpubBetaExport = useCallback(() => {
    setEpubExportRequest(null);
  }, []);

  const confirmEpubBetaExport = useCallback(async (settings: EpubExportSettings) => {
    const request = epubExportRequest;
    if (!request) {
      return;
    }

    setEpubExportRequest(null);

    try {
      const destPath = await saveDialog({
        defaultPath: request.documentName.replace(/\.[^.]+$/, "") + ".epub",
        filters: [{ name: "EPUB", extensions: ["epub"] }],
      });
      if (!destPath) return;

      const tabForExport = activeTabRef.current;
      if (!tabForExport || tabForExport.id !== request.tabId) {
        setStatus("Export EPUB beta stopped; document changed");
        return;
      }

      const { archive, warnings } = await buildEpubBetaArchiveWithReport({
        documentPath: tabForExport.path,
        documentName: tabForExport.name,
        loadWorkspaceImage: workspaceRootPath
          ? async (path) => {
              const image = await openWorkspaceImage(workspaceRootPath, path);
              return { dataUrl: image.dataUrl };
            }
          : undefined,
        metadata: {
          author: settings.author.trim(),
          language: settings.language.trim() || "ja",
          modified: formatEpubModifiedDate(new Date()),
          title: settings.title.trim() || request.settings.title,
        },
        markdown: activeContentsRef.current,
        workspaceRoot: workspaceRootPath,
      });
      await saveBinaryFileAs(destPath, archive);
      setStatus(
        warnings.length > 0
          ? `Exported EPUB with image warnings: ${destPath}`
          : `Exported EPUB: ${destPath}`,
      );
    } catch (err) {
      setGlobalError(`Export EPUB beta failed: ${String(err)}`);
      setStatus("Export EPUB beta failed");
    }
  }, [epubExportRequest, setGlobalError, setStatus, workspaceRootPath]);

  return {
    cancelPdfExport,
    cancelEpubBetaExport,
    confirmPdfExport,
    confirmEpubBetaExport,
    epubExportRequest,
    exportEpubBeta,
    exportHtml,
    exportPdf,
    pdfExportRequest,
  };
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatEpubModifiedDate(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}
