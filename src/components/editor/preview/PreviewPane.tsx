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
import type { MenuLanguage } from "../../../types";
import { PreviewFeedback } from "./PreviewFeedback";
import {
  interceptPreviewLink,
  paintPreviewHtml,
  subscribePreviewGestureEnd,
} from "./previewDomSafety";
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
  menuLanguage?: MenuLanguage;
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
  failed: boolean;
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
  menuLanguage = "ja",
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
    failed: false,
  }));
  const [retryRevision, setRetryRevision] = useState(0);
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
  const paintedHtmlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // A queued selection paint belongs to the superseded source, not this render.
    pendingHtmlRef.current = null;
    const isSameDocumentPaint =
      paintedIdentityRef.current === previewIdentity;

    setPreview((current) => {
      if (
        current.identity === previewIdentity &&
        !current.pending &&
        !current.failed
      ) {
        // Same document: keep showing the last good HTML. Flipping
        // `pending` here forces an extra React commit on every keystroke
        // burst without changing visible content.
        return current;
      }

      return {
        html: current.identity === previewIdentity ? current.html : "",
        identity: previewIdentity,
        pending: true,
        failed: false,
      };
    });

    if (!isSameDocumentPaint) {
      resolvedImagesRef.current.clear();
      pendingHtmlRef.current = null;
      paintedHtmlRef.current = null;
    }

    const paint = () => {
      if (cancelled) {
        return;
      }

      let renderedHtml: string;
      try {
        renderedHtml = renderMarkdown(source, {
          documentPath,
          workspaceRoot,
          mediaAccess,
        });
      } catch {
        // Scheduled callbacks are outside React error boundaries. Keep only
        // this document's last good paint, never another tab's contents.
        pendingHtmlRef.current = null;
        setPreview((current) => {
          if (cancelled) return current;
          return {
            html: current.identity === previewIdentity ? current.html : "",
            identity: previewIdentity,
            pending: false,
            failed: true,
          };
        });
        return;
      }

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
        setPreview((current) => {
          if (cancelled) return current;
          if (
            current.identity === previewIdentity &&
            current.html === html &&
            !current.pending &&
            !current.failed
          ) {
            return current;
          }

          return {
            html,
            identity: previewIdentity,
            pending: false,
            failed: false,
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
  }, [
    documentPath, mediaAccess, previewIdentity, retryRevision, source, workspaceRoot,
  ]);

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

    // Empty HTML is a valid completed render. Identity changes must clear
    // the previous document before the browser can paint or follow its links.
    const html = preview.identity === previewIdentity ? preview.html : "";
    paintedHtmlRef.current = paintPreviewHtml(
      host,
      html,
      paintedHtmlRef.current,
      () => applyCachedPreviewImages(host, resolvedImagesRef.current),
    );
  }, [preview.html, preview.identity, preview.pending, previewIdentity]);

  useEffect(() => {
    // Retain the scroller for cleanup: React clears the host ref on unmount.
    const gestureScroller = previewHostRef.current?.parentElement ?? null;
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
      setPreview((current) => {
        if (
          current.identity !== previewIdentity ||
          (current.html === pendingHtml && !current.pending && !current.failed)
        ) {
          return current;
        }
        return {
          html: pendingHtml,
          identity: previewIdentity,
          pending: false,
          failed: false,
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
      if (!pointerDownRef.current) return;
      if ((event.buttons & 1) === 0) {
        endPointer();
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
      if (!pointerDownRef.current) return;
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
    const removeGestureEnd = subscribePreviewGestureEnd(document, endPointer);
    document.addEventListener("selectionchange", flushPendingHtml);
    return () => {
      stopSelectionScrollLoop();
      document.removeEventListener("pointermove", onPointerMove);
      removeGestureEnd();
      pointerDownRef.current = false;
      lastPointerYRef.current = null;
      setPreviewSelecting(gestureScroller, false);
      document.removeEventListener("selectionchange", flushPendingHtml);
    };
  }, [previewIdentity]);

  useEffect(() => {
    if (
      preview.pending ||
      preview.identity !== previewIdentity ||
      preview.failed
    ) {
      return;
    }

    const kind: PreviewRenderCompleteKind =
      completedIdentityRef.current === previewIdentity ? "update" : "initial";
    completedIdentityRef.current = previewIdentity;
    onRenderComplete?.(kind);
  }, [
    onRenderComplete,
    preview.failed,
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

    const href = interceptPreviewLink(event);
    if (href === null || isPreviewUserSelecting(event.currentTarget)) return;
    onOpenLocalLink?.(href);
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

  const current = preview.identity === previewIdentity;
  const pending = !current || preview.pending;
  const empty = current && !pending && preview.html.trim().length === 0;

  return (
    <>
      {current && preview.failed ? (
        <PreviewFeedback
          kind="error"
          retained={preview.html.length > 0}
          menuLanguage={menuLanguage}
          onRetry={() => setRetryRevision((revision) => revision + 1)}
        />
      ) : empty ? (
        <PreviewFeedback kind="empty" menuLanguage={menuLanguage} />
      ) : null}
      <article
        aria-busy={pending ? "true" : undefined}
        hidden={empty}
        className={
          pending && (!current || preview.html.length === 0)
            ? "markdown-preview markdown-preview-loading"
            : "markdown-preview"
        }
        onAuxClick={(event) => {
          interceptPreviewLink(event);
        }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          pointerDownRef.current = true;
          lastPointerYRef.current = event.clientY;
          setPreviewSelecting(event.currentTarget.parentElement, true);
        }}
        ref={previewHostRef}
      />
    </>
  );
}
