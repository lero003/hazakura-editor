import { useCallback, useRef, useState } from "react";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import {
  openWorkspaceImage,
  saveBinaryFileAs,
  saveTextFileAs,
} from "../../lib/tauri";
import {
  buildEpubBetaArchiveWithReport,
  defaultEpubExportSettings,
  type EpubExportSettings,
} from "../../features/document/epubExport";
import { getMarkdownPreviewCss } from "../../features/document/markdownExportCss";
import {
  inlineWorkspaceAssetImages,
  renderMarkdown,
} from "../../features/editor/markdown";
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
  settings: EpubExportSettings;
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

  const exportPdf = useCallback(async () => {
    if (!activeContents || !activeTab) {
      setStatus("No active document to print");
      return;
    }

    setStatus("Opening in browser for printing...");
    try {
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
</body>
</html>`;

      // v0.34: サンドボックスコンテナ内の一時ファイルをブラウザで開くと
      // NSURLErrorCannotOpenFile(-3001) になるため、hidden iframe の srcdoc に
      // HTMLを流し込み print() を呼ぶ。ブラウザにもTauriにも依存しない。
      const frame = document.createElement("iframe");
      frame.style.position = "fixed";
      frame.style.right = "0";
      frame.style.bottom = "0";
      frame.style.width = "0";
      frame.style.height = "0";
      frame.style.border = "0";
      frame.srcdoc = standaloneHtml;
      frame.addEventListener("load", () => {
        try {
          frame.contentWindow?.focus();
          frame.contentWindow?.print();
        } catch {
          setStatus("Print unavailable");
        }
      });
      // 印刷ダイアログ終了後にframeを除去する。
      frame.addEventListener("afterprint", () => {
        document.body.removeChild(frame);
      });
      document.body.appendChild(frame);
      setStatus("Opening print dialog...");
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

  const exportEpubBeta = useCallback(async () => {
    if (!activeTab || activeContents === undefined) {
      setStatus("No active document to export");
      return;
    }

    setEpubExportRequest({
      documentName: activeTab.name,
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
    cancelEpubBetaExport,
    confirmEpubBetaExport,
    epubExportRequest,
    exportEpubBeta,
    exportHtml,
    exportPdf,
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
