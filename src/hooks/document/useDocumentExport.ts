import { useCallback, useRef } from "react";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import {
  isTauriRuntime,
  openTempPrintHtml,
  openWorkspaceImage,
  saveTextFileAs,
} from "../../lib/tauri";
import { getMarkdownPreviewCss } from "../../features/document/markdownExportCss";
import type { EditorTab } from "../../types";

// `marked` + `dompurify` together are ~150 kB gzipped. Export
// runs once when the user picks Export HTML / PDF from a menu,
// so deferring the chunk via dynamic import keeps the cold-start
// bundle smaller without a perceivable delay on the actual
// export.
const loadMarkdownRenderer = () => import("../../features/editor/markdown");

type UseDocumentExportOptions = {
  activeContents: string;
  activeTab: EditorTab | null;
  setGlobalError: (message: string | null) => void;
  setStatus: (message: string) => void;
  workspaceRootPath: string | null;
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

  const exportPdf = useCallback(async () => {
    if (!activeContents || !activeTab) {
      setStatus("No active document to print");
      return;
    }

    setStatus("Opening in browser for printing...");
    try {
      const { renderMarkdown, inlineWorkspaceAssetImages } =
        await loadMarkdownRenderer();
      let rendered = renderMarkdown(activeContents, {
        documentPath: activeTab.path,
        workspaceRoot: workspaceRootPath ?? undefined,
      });
      if (workspaceRootPath) {
        rendered = await inlineWorkspaceAssetImages(rendered, async (path) => {
          const image = await openWorkspaceImage(workspaceRootPath, path);
          return image.dataUrl;
        });
      }

      const standaloneHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(activeTab.name)}</title>
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
  }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--font-ui);
    margin: 0;
    padding: 0;
  }
  ${getMarkdownPreviewCss()}
  @media print {
    @page { margin: 18mm 16mm; }
    body { background: #ffffff; color: #000000; margin: 0; padding: 0; }
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
    .markdown-preview img { page-break-inside: avoid; }
    .markdown-preview pre,
    .markdown-preview code,
    .markdown-preview .markdown-table-frame th { background: transparent; }
    .markdown-preview pre {
      border-left: 2px solid #999999;
      padding: 0 0 0 8px;
    }
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
<div class="markdown-preview">
${rendered}
</div>
<script>window.addEventListener("load", () => window.print());</script>
</body>
</html>`;

      if (isTauriRuntime()) {
        const tempPath = await openTempPrintHtml(
          standaloneHtml,
          activeTab.name.replace(/\.[^.]+$/, "") + ".html",
        );
        if (tempPath) {
          setStatus("Opening in browser for printing...");
        }
        setTimeout(() => setStatus(""), 2000);
        return;
      }

      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        setStatus("Print unavailable");
        return;
      }
      printWindow.document.open();
      printWindow.document.write(standaloneHtml);
      printWindow.document.close();
      setTimeout(() => setStatus(""), 2000);
    } catch (err) {
      console.warn("Print failed:", err);
      setStatus("Print unavailable");
    }
  }, [activeContents, activeTab, setStatus, workspaceRootPath]);

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

      const { renderMarkdown, inlineWorkspaceAssetImages } =
        await loadMarkdownRenderer();
      let bodyHtml = renderMarkdown(contentsForExport, {
        documentPath: tabForExport.path,
        workspaceRoot: workspaceRootPath,
      });
      if (workspaceRootPath) {
        bodyHtml = await inlineWorkspaceAssetImages(bodyHtml, async (path) => {
          const image = await openWorkspaceImage(workspaceRootPath, path);
          return image.dataUrl;
        });
      }

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
   in-app "Print to PDF" path so a saved file printed later
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

  return { exportHtml, exportPdf };
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
