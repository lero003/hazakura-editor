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
import { schedulePreviewRender } from "../../../features/editor/previewRenderDebounce";
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

// v1.1 position-continuity observation: PreviewPane does not own scroll
// position. The scroll container is the shared SidePane wrapper div (held by
// `previewPaneRef`), which SidePane renders in every mode — so the div and its
// `scrollTop` persist across a side-pane mode switch in jsdom even though this
// leaf component unmounts. The user-visible "Preview reopen starts at the top"
// symptom (see docs/v1.1-v1.2-followup.md) is therefore not caused by
// PreviewPane state loss; it needs real-layout reproduction (e.g. HTML
// replacement collapsing scrollHeight, or the editor-sync path resetting
// scrollTop). Any save/restore contract keyed by document identity belongs at
// the parent (SidePane / AppWorkspace), not inside this unmounted leaf.

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
