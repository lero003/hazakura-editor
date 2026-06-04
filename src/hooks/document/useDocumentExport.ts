import { useCallback } from "react";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import { inlineWorkspaceAssetImages, renderMarkdown } from "../../features/editor/markdown";
import {
  isTauriRuntime,
  openTempPrintHtml,
  openWorkspaceImage,
  saveTextFileAs,
} from "../../lib/tauri";
import type { EditorTab } from "../../types";

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
  const exportPdf = useCallback(async () => {
    if (!activeContents || !activeTab) {
      setStatus("No active document to print");
      return;
    }

    setStatus("Opening in browser for printing...");
    try {
      let rendered = renderMarkdown(activeContents, {
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
  /* Screen preview — used while the user reviews the layout in
     the browser before hitting the print dialog. Mirrors the
     editor's body type stack so the on-screen view feels
     familiar; the @media print block below tightens everything
     up for paper. */
  :root {
    --font-body: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    --text: #1d1d1f;
    --text-muted: #6e6e73;
    --accent: #b3416a;
    --border: #d2d2d7;
    --code-bg: #f5f5f7;
  }
  body {
    background: #ffffff;
    color: var(--text);
    font-family: var(--font-body);
    font-size: 14px;
    line-height: 1.6;
    margin: 0 auto;
    max-width: 720px;
    padding: 32px 24px;
  }
  h1, h2, h3, h4, h5, h6 {
    line-height: 1.25;
    margin-top: 1.6em;
    margin-bottom: 0.5em;
  }
  h1 { font-size: 1.8em; border-bottom: 1px solid var(--border); padding-bottom: 0.25em; }
  h2 { font-size: 1.4em; }
  h3 { font-size: 1.2em; }
  p { margin: 0 0 1em; }
  a { color: var(--accent); text-decoration: none; }
  img { max-width: 100%; height: auto; }
  pre {
    background: var(--code-bg);
    border-radius: 6px;
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 1.5;
    overflow-x: auto;
    padding: 12px 14px;
  }
  code {
    background: var(--code-bg);
    border-radius: 3px;
    font-family: var(--font-mono);
    font-size: 0.92em;
    padding: 1px 5px;
  }
  pre code { background: transparent; padding: 0; }
  blockquote {
    border-left: 3px solid var(--accent);
    color: var(--text-muted);
    margin: 1em 0;
    padding: 0.25em 1em;
  }
  table {
    border-collapse: collapse;
    margin: 1em 0;
    width: 100%;
  }
  th, td { border: 1px solid var(--border); padding: 8px 10px; text-align: left; }
  th { background: var(--code-bg); }
  hr { border: 0; border-top: 1px solid var(--border); margin: 2em 0; }
  ul, ol { padding-left: 1.5em; }
  li + li { margin-top: 0.25em; }

  /* Print stylesheet — switch to serif body, tighten type, hide
     backgrounds that look muddy on paper, and let tables /
     pre blocks flow across page breaks without splitting a
     single row. The @page margins are conservative defaults
     (browser / OS print dialog lets the user override). */
  @media print {
    @page { margin: 18mm 16mm; }
    body {
      background: #ffffff;
      color: #000000;
      font-family: "Iowan Old Style", "Charter", Georgia, "Times New Roman", serif;
      font-size: 11pt;
      line-height: 1.45;
      max-width: none;
      padding: 0;
    }
    h1, h2, h3, h4, h5, h6 {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      page-break-after: avoid;
    }
    h1 { font-size: 18pt; }
    h2 { font-size: 14pt; }
    h3 { font-size: 12pt; }
    pre, blockquote, table, img { page-break-inside: avoid; }
    pre, code {
      background: transparent;
      border: 0;
    }
    pre {
      border-left: 2px solid #999999;
      padding-left: 8px;
    }
    a { color: inherit; text-decoration: underline; }
    a[href^="http"]::after { content: " (" attr(href) ")"; font-size: 0.85em; color: #555555; }
  }
</style>
</head>
<body>${rendered}<script>window.addEventListener("load", () => window.print());</script></body>
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

      let bodyHtml = renderMarkdown(activeContents, {
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
        "--border",
        "--surface",
        "--surface-muted",
        "--surface-strong",
        "--font-mono",
        "--font-ui",
      ]
        .map((v) => `  ${v}: ${cs.getPropertyValue(v)};`)
        .join("\n");

      const standaloneHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(activeTab.name)}</title>
<style>
:root {
${cssVars}
}
body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-ui, system-ui, sans-serif);
  line-height: 1.7;
  max-width: 48rem;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}
h1, h2, h3, h4, h5, h6 { line-height: 1.25; }
h1 { border-bottom: 1px solid var(--border); padding-bottom: 0.25em; }
img { max-width: 100%; height: auto; }
code { font-family: var(--font-mono, monospace); }
pre {
  background: var(--surface-muted);
  border-radius: 6px;
  overflow-x: auto;
  padding: 0.75em 1em;
}
pre code { background: transparent; padding: 0; }
blockquote { border-left: 3px solid var(--accent); margin-left: 0; padding-left: 1rem; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid var(--border); padding: 0.5rem; text-align: left; }
th { background: var(--surface-muted); }
a { color: var(--accent); }
hr { border: 0; border-top: 1px solid var(--border); }

/* Mirror the in-app print polish so users who print the saved
   HTML file later get the same tightened layout. The screen
   block above is unchanged so the file still looks right in a
   browser. */
@media print {
  @page { margin: 18mm 16mm; }
  body {
    background: #ffffff;
    color: #000000;
    font-family: "Iowan Old Style", "Charter", Georgia, "Times New Roman", serif;
    font-size: 11pt;
    line-height: 1.45;
    max-width: none;
    padding: 0;
  }
  h1, h2, h3, h4, h5, h6 {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    page-break-after: avoid;
  }
  pre, blockquote, table, img { page-break-inside: avoid; }
  pre, th { background: transparent; }
  pre { border-left: 2px solid #999999; padding-left: 8px; }
  a { color: inherit; text-decoration: underline; }
  a[href^="http"]::after { content: " (" attr(href) ")"; font-size: 0.85em; color: #555555; }
}
</style>
</head>
<body>
${bodyHtml}
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
