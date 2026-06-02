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
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; padding: 20px; max-width: 800px; margin: 0 auto; color: #1d1d1f; }
  img { max-width: 100%; height: auto; }
  pre { background: #f5f5f7; padding: 12px; border-radius: 6px; overflow-x: auto; }
  code { background: #f5f5f7; padding: 2px 4px; border-radius: 3px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #d2d2d7; padding: 8px; text-align: left; }
  th { background: #f5f5f7; }
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
<html lang="ja">
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
img { max-width: 100%; height: auto; }
code { font-family: var(--font-mono, monospace); }
pre { overflow-x: auto; }
blockquote { border-left: 3px solid var(--accent); margin-left: 0; padding-left: 1rem; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid var(--border); padding: 0.5rem; text-align: left; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;

      await saveTextFileAs(destPath, standaloneHtml, "lf");
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
