import {
  type MouseEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  inlineWorkspaceAssetImages,
  renderMarkdown,
} from "../../../features/editor/markdown";
import { openWorkspaceImage } from "../../../lib/tauri";

type PreviewPaneProps = {
  documentKey?: string | null;
  documentPath?: string | null;
  onOpenLocalLink?: (href: string) => void;
  source: string;
  workspaceRoot?: string | null;
};

type PreviewState = {
  html: string;
  identity: string;
  pending: boolean;
};

export default function PreviewPane({
  documentKey,
  documentPath,
  onOpenLocalLink,
  source,
  workspaceRoot,
}: PreviewPaneProps) {
  const previewIdentity = useMemo(
    () => `${documentKey ?? documentPath ?? ""}\u0000${workspaceRoot ?? ""}`,
    [documentKey, documentPath, workspaceRoot],
  );
  const [preview, setPreview] = useState<PreviewState>(() => ({
    html: "",
    identity: previewIdentity,
    pending: true,
  }));

  useEffect(() => {
    let cancelled = false;

    setPreview((current) => {
      if (current.identity === previewIdentity && current.html.length > 0) {
        if (current.pending) {
          return current;
        }

        return { ...current, pending: true };
      }

      return { html: "", identity: previewIdentity, pending: true };
    });

    const cancelRender = schedulePreviewRender(() => {
      if (cancelled) {
        return;
      }

      const renderedHtml = renderMarkdown(source, {
        documentPath,
        workspaceRoot,
      });
      setPreview({
        html: renderedHtml,
        identity: previewIdentity,
        pending: false,
      });

      if (!workspaceRoot) {
        return;
      }

      void inlineWorkspaceAssetImages(renderedHtml, async (path) => {
        const image = await openWorkspaceImage(workspaceRoot, path);
        return image.dataUrl;
      }).then((nextHtml) => {
        if (!cancelled) {
          setPreview({
            html: nextHtml,
            identity: previewIdentity,
            pending: false,
          });
        }
      });
    });

    return () => {
      cancelled = true;
      cancelRender();
    };
  }, [documentPath, previewIdentity, source, workspaceRoot]);

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
        preview.pending && preview.html.length === 0
          ? "markdown-preview markdown-preview-loading"
          : "markdown-preview"
      }
      dangerouslySetInnerHTML={{ __html: preview.html }}
      onClick={handleClick}
    />
  );
}

function schedulePreviewRender(callback: () => void): () => void {
  // v0.33: プレビューの Markdown 再描画は編集と同時である必要がない。
  // requestAnimationFrame(1フレ遅延)から debounce(200ms)に変更し、連続入力中の
  // marked + DOMPurify + DOM 操作の同期実行を抑制してタイピングの引っ掛かりを減らす。
  // ソースが止まると200ms後に必ず描画されるので、見かけの遅延は小さい。
  const PREVIEW_RENDER_DEBOUNCE_MS = 200;

  const handle = window.setTimeout(callback, PREVIEW_RENDER_DEBOUNCE_MS);
  return () => {
    window.clearTimeout(handle);
  };
}
