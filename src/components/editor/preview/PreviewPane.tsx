import {
  type KeyboardEvent,
  type MouseEvent,
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  inlineMarkdownImages,
  renderMarkdown,
} from "../../../features/editor/markdown";
import type { MediaImageAccessOptions } from "../../../features/editor/imagePolicy";
import { schedulePreviewRender } from "../../../features/editor/previewRenderDebounce";
import {
  fetchRemoteImage,
  openLocalImageUnderRoots,
  openWorkspaceImage,
} from "../../../lib/tauri";

/** Why Preview finished a paint. Parent scroll restore only needs `initial`. */
export type PreviewRenderCompleteKind = "initial" | "update";

type PreviewPaneProps = {
  documentKey?: string | null;
  documentPath?: string | null;
  mediaAccess?: MediaImageAccessOptions | null;
  onApproveLocalImageParent?: (resolvedPath: string) => void;
  onOpenLocalLink?: (href: string) => void;
  /**
   * Fires after a settled Markdown paint.
   * - `initial`: first paint for this document identity (or after remount)
   * - `update`: same-document re-render (typing, image inline, …)
   */
  onRenderComplete?: (kind: PreviewRenderCompleteKind) => void;
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
  mediaAccess = null,
  onApproveLocalImageParent,
  onOpenLocalLink,
  onRenderComplete,
  source,
  workspaceRoot,
}: PreviewPaneProps) {
  const mediaAccessKey = useMemo(
    () =>
      JSON.stringify({
        outsideImages: mediaAccess?.outsideImages ?? "ask",
        loadRemoteImages: mediaAccess?.loadRemoteImages ?? false,
        approvedRoots: mediaAccess?.approvedRoots ?? [],
      }),
    [mediaAccess],
  );
  const previewIdentity = useMemo(
    () =>
      `${documentKey ?? documentPath ?? ""}\u0000${workspaceRoot ?? ""}\u0000${mediaAccessKey}`,
    [documentKey, documentPath, mediaAccessKey, workspaceRoot],
  );
  const [preview, setPreview] = useState<PreviewState>(() => ({
    html: "",
    identity: previewIdentity,
    pending: true,
  }));
  // First settled paint per document identity is `initial`; later paints
  // (typing debounce, workspace image inlining) are `update` so the parent
  // can avoid re-applying scroll-ratio after content height changes.
  const completedIdentityRef = useRef<string | null>(null);
  // First paint for the current identity skips the typing debounce.
  const paintedIdentityRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const isSameDocumentPaint =
      paintedIdentityRef.current === previewIdentity;

    setPreview((current) => {
      if (current.identity === previewIdentity && current.html.length > 0) {
        // Same document: keep showing the last good HTML. Flipping
        // `pending` here forces an extra React commit on every keystroke
        // burst without changing visible content.
        return current;
      }

      return { html: "", identity: previewIdentity, pending: true };
    });

    const paint = () => {
      if (cancelled) {
        return;
      }

      const renderedHtml = renderMarkdown(source, {
        documentPath,
        workspaceRoot,
        mediaAccess,
      });

      const commitHtml = (html: string) => {
        if (cancelled) {
          return;
        }

        setPreview((current) => {
          if (
            current.identity === previewIdentity &&
            current.html === html &&
            !current.pending
          ) {
            return current;
          }

          return {
            html,
            identity: previewIdentity,
            pending: false,
          };
        });
      };

      const commit = () => {
        commitHtml(renderedHtml);
      };

      // Deprioritize preview commits relative to editor input when this is
      // a same-document refresh. First paint stays synchronous after the
      // scheduler yields so opening Preview feels immediate.
      if (isSameDocumentPaint) {
        startTransition(commit);
      } else {
        commit();
      }

      paintedIdentityRef.current = previewIdentity;

      const approvedRoots = [...(mediaAccess?.approvedRoots ?? [])];
      void inlineMarkdownImages(renderedHtml, {
        loadWorkspaceImage: async (path) => {
          if (!workspaceRoot) {
            throw new Error("workspace root required");
          }
          const image = await openWorkspaceImage(workspaceRoot, path);
          return image.dataUrl;
        },
        loadApprovedLocalImage: async (path) => {
          const image = await openLocalImageUnderRoots(path, approvedRoots);
          return image.dataUrl;
        },
        loadRemoteImage: mediaAccess?.loadRemoteImages
          ? async (url) => {
              const image = await fetchRemoteImage(url);
              return image.dataUrl;
            }
          : undefined,
      }).then((nextHtml) => {
        if (cancelled || nextHtml === renderedHtml) {
          return;
        }

        startTransition(() => {
          commitHtml(nextHtml);
        });
      });
    };

    const cancelRender = schedulePreviewRender(paint, {
      immediate: !isSameDocumentPaint,
      sourceLength: source.length,
    });

    return () => {
      cancelled = true;
      cancelRender();
    };
  }, [documentPath, mediaAccess, previewIdentity, source, workspaceRoot]);

  useEffect(() => {
    if (
      preview.pending ||
      preview.identity !== previewIdentity ||
      preview.html.length === 0
    ) {
      return;
    }

    const kind: PreviewRenderCompleteKind =
      completedIdentityRef.current === previewIdentity ? "update" : "initial";
    completedIdentityRef.current = previewIdentity;
    onRenderComplete?.(kind);
  }, [
    onRenderComplete,
    preview.html,
    preview.identity,
    preview.pending,
    previewIdentity,
  ]);

  const handleMediaAction = (actionHost: Element) => {
    const action = actionHost.getAttribute("data-hazakura-image-action");
    const resolved =
      actionHost.getAttribute("data-hazakura-resolved-path")?.trim() ?? "";
    if (action === "approve-parent" && resolved && onApproveLocalImageParent) {
      onApproveLocalImageParent(resolved);
    }
  };

  const handleClick = (event: MouseEvent<HTMLElement>) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const actionHost = target.closest("[data-hazakura-image-action]");
    if (actionHost && event.currentTarget.contains(actionHost)) {
      event.preventDefault();
      handleMediaAction(actionHost);
      return;
    }

    if (!onOpenLocalLink) {
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

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const actionHost = target.closest("[data-hazakura-image-action]");
    if (!actionHost || !event.currentTarget.contains(actionHost)) {
      return;
    }
    event.preventDefault();
    handleMediaAction(actionHost);
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
      onKeyDown={handleKeyDown}
    />
  );
}
