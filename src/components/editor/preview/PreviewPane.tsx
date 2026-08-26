import {
  type KeyboardEvent,
  type MouseEvent,
  startTransition,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { renderMarkdown } from "../../../features/editor/markdown";
import type { MediaImageAccessOptions } from "../../../features/editor/imagePolicy";
import { schedulePreviewRender } from "../../../features/editor/previewRenderDebounce";
import {
  fetchRemoteImage,
  openLocalImageUnderRoots,
  openWorkspaceImage,
} from "../../../lib/tauri";
import { loadPreviewImagesNearViewport } from "./previewImageLoader";
import {
  applyCachedPreviewImages,
  applyPreviewSelectionAutoScroll,
  isPreviewUserSelecting,
  rememberResolvedPreviewImage,
  setPreviewSelecting,
  type PreviewImageCache,
} from "./previewPaintStability";

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
  const previewHostRef = useRef<HTMLElement | null>(null);
  const resolvedImagesRef = useRef<PreviewImageCache>(new Map());
  const pendingHtmlRef = useRef<string | null>(null);
  const pointerDownRef = useRef(false);
  const lastPointerYRef = useRef<number | null>(null);
  const selectionScrollFrameRef = useRef<number | null>(null);
  const scrollTopBeforePaintRef = useRef<number | null>(null);
  const paintedHtmlRef = useRef<string | null>(null);

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

    if (!isSameDocumentPaint) {
      resolvedImagesRef.current.clear();
      pendingHtmlRef.current = null;
      scrollTopBeforePaintRef.current = null;
      paintedHtmlRef.current = null;
    }

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

        const host = previewHostRef.current;
        if (
          isSameDocumentPaint &&
          host &&
          (pointerDownRef.current || isPreviewUserSelecting(host))
        ) {
          pendingHtmlRef.current = html;
          return;
        }

        pendingHtmlRef.current = null;
        if (isSameDocumentPaint) {
          const scroller = host?.parentElement;
          if (scroller) {
            scrollTopBeforePaintRef.current = scroller.scrollTop;
          }
        } else {
          scrollTopBeforePaintRef.current = null;
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
      preview.html.length === 0 ||
      !previewHostRef.current
    ) {
      return;
    }

    const approvedRoots = [...(mediaAccess?.approvedRoots ?? [])];
    return loadPreviewImagesNearViewport(previewHostRef.current, {
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
      onImageResolved: (cacheKey, dataUrl) => {
        rememberResolvedPreviewImage(
          resolvedImagesRef.current,
          cacheKey,
          dataUrl,
        );
      },
    });
  }, [
    mediaAccess,
    preview.html,
    preview.identity,
    preview.pending,
    previewIdentity,
    workspaceRoot,
  ]);

  useLayoutEffect(() => {
    const host = previewHostRef.current;
    if (!host) {
      return;
    }

    if (preview.pending && preview.html.length === 0) {
      host.innerHTML = "";
      paintedHtmlRef.current = "";
      return;
    }

    if (preview.html.length === 0) {
      return;
    }

    if (paintedHtmlRef.current !== preview.html) {
      const scroller = host.parentElement;
      const savedTop = scrollTopBeforePaintRef.current ?? scroller?.scrollTop;
      host.innerHTML = preview.html;
      paintedHtmlRef.current = preview.html;
      applyCachedPreviewImages(host, resolvedImagesRef.current);
      if (scroller && savedTop !== undefined) {
        scroller.scrollTop = savedTop;
      }
      return;
    }

    applyCachedPreviewImages(host, resolvedImagesRef.current);
  }, [preview.html, preview.pending]);

  useEffect(() => {
    const flushPendingHtml = () => {
      const host = previewHostRef.current;
      const pendingHtml = pendingHtmlRef.current;
      if (
        pendingHtml == null ||
        pointerDownRef.current ||
        (host && isPreviewUserSelecting(host))
      ) {
        return;
      }

      pendingHtmlRef.current = null;
      const scroller = host?.parentElement;
      if (scroller) {
        scrollTopBeforePaintRef.current = scroller.scrollTop;
      }
      setPreview((current) => {
        if (current.identity !== previewIdentity || current.html === pendingHtml) {
          return current;
        }
        return {
          html: pendingHtml,
          identity: previewIdentity,
          pending: false,
        };
      });
    };

    const stopSelectionScrollLoop = () => {
      if (selectionScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(selectionScrollFrameRef.current);
        selectionScrollFrameRef.current = null;
      }
    };

    const tickSelectionScroll = () => {
      selectionScrollFrameRef.current = null;
      if (!pointerDownRef.current) {
        return;
      }
      const scroller = previewHostRef.current?.parentElement;
      const clientY = lastPointerYRef.current;
      if (!scroller || clientY == null) {
        return;
      }
      const applied = applyPreviewSelectionAutoScroll(scroller, clientY);
      if (applied !== 0) {
        selectionScrollFrameRef.current =
          window.requestAnimationFrame(tickSelectionScroll);
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!pointerDownRef.current || event.buttons !== 1) {
        return;
      }
      lastPointerYRef.current = event.clientY;
      const scroller = previewHostRef.current?.parentElement;
      if (!scroller) {
        return;
      }
      const applied = applyPreviewSelectionAutoScroll(scroller, event.clientY);
      if (applied !== 0 && selectionScrollFrameRef.current === null) {
        selectionScrollFrameRef.current =
          window.requestAnimationFrame(tickSelectionScroll);
      }
    };

    const endPointer = () => {
      const host = previewHostRef.current;
      const scroller = host?.parentElement;
      pointerDownRef.current = false;
      lastPointerYRef.current = null;
      stopSelectionScrollLoop();
      setPreviewSelecting(scroller ?? null, false);
      if (scroller) {
        scroller.dispatchEvent(new Event("scroll"));
      }
      flushPendingHtml();
    };

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", endPointer);
    document.addEventListener("pointercancel", endPointer);
    document.addEventListener("selectionchange", flushPendingHtml);
    return () => {
      stopSelectionScrollLoop();
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", endPointer);
      document.removeEventListener("pointercancel", endPointer);
      document.removeEventListener("selectionchange", flushPendingHtml);
    };
  }, [previewIdentity]);

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
    if (isPreviewUserSelecting(event.currentTarget)) {
      return;
    }
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
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onPointerDown={(event) => {
        if (event.button !== 0) {
          return;
        }
        pointerDownRef.current = true;
        lastPointerYRef.current = event.clientY;
        setPreviewSelecting(event.currentTarget.parentElement, true);
      }}
      ref={previewHostRef}
    />
  );
}
