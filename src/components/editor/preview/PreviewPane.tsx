import {
  type MouseEvent,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";
import {
  inlineWorkspaceAssetImages,
  renderMarkdown,
} from "../../../features/editor/markdown";
import { openWorkspaceImage } from "../../../lib/tauri";

type PreviewPaneProps = {
  documentPath?: string | null;
  onOpenLocalLink?: (href: string) => void;
  source: string;
  workspaceRoot?: string | null;
};

export default function PreviewPane({
  documentPath,
  onOpenLocalLink,
  source,
  workspaceRoot,
}: PreviewPaneProps) {
  const [preview, setPreview] = useState({ html: "", pending: true });

  useLayoutEffect(() => {
    setPreview({ html: "", pending: true });
  }, [documentPath, source, workspaceRoot]);

  useEffect(() => {
    let cancelled = false;

    const cancelRender = schedulePreviewRender(() => {
      if (cancelled) {
        return;
      }

      const renderedHtml = renderMarkdown(source, {
        documentPath,
        workspaceRoot,
      });
      setPreview({ html: renderedHtml, pending: false });

      if (!workspaceRoot) {
        return;
      }

      void inlineWorkspaceAssetImages(renderedHtml, async (path) => {
        const image = await openWorkspaceImage(workspaceRoot, path);
        return image.dataUrl;
      }).then((nextHtml) => {
        if (!cancelled) {
          setPreview({ html: nextHtml, pending: false });
        }
      });
    });

    return () => {
      cancelled = true;
      cancelRender();
    };
  }, [documentPath, source, workspaceRoot]);

  const handleClick = (event: MouseEvent<HTMLElement>) => {
    if (!onOpenLocalLink) {
      return;
    }

    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const link = target.closest("a[href]");

    if (!link || !event.currentTarget.contains(link)) {
      return;
    }

    const href = link.getAttribute("href")?.trim() ?? "";

    event.preventDefault();
    onOpenLocalLink(href);
  };

  return (
    <article
      aria-busy={preview.pending ? "true" : undefined}
      className={
        preview.pending
          ? "markdown-preview markdown-preview-loading"
          : "markdown-preview"
      }
      dangerouslySetInnerHTML={{ __html: preview.html }}
      onClick={handleClick}
    />
  );
}

function schedulePreviewRender(callback: () => void): () => void {
  if (typeof requestAnimationFrame === "function") {
    const handle = requestAnimationFrame(callback);
    return () => {
      cancelAnimationFrame(handle);
    };
  }

  const handle = window.setTimeout(callback, 0);
  return () => {
    window.clearTimeout(handle);
  };
}
