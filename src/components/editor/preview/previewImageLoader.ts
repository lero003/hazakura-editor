import { buildBlockedImageElement } from "../../../features/editor/imagePolicy";

const WORKSPACE_IMAGE_PATH_ATTR = "data-hazakura-image-path";
const IMAGE_ORIGIN_ATTR = "data-hazakura-image-origin";
const REMOTE_IMAGE_URL_ATTR = "data-hazakura-image-remote";
const MAX_CONCURRENT_IMAGE_LOADS = 2;
const INTERSECTION_FALLBACK_DELAY_MS = 1_200;

type PreviewImageLoaders = {
  loadApprovedLocalImage?: (absolutePath: string) => Promise<string>;
  loadRemoteImage?: (url: string) => Promise<string>;
  loadWorkspaceImage: (absolutePath: string) => Promise<string>;
  /** Persist a resolved/replaced placeholder in the owning React state. */
  onDomChange?: () => void;
};

/**
 * Resolve Preview image placeholders only when they are close to the visible
 * viewport. Markdown rendering already applies the access policy and leaves
 * inert data attributes behind, so this layer never widens what may be read.
 */
export function loadPreviewImagesNearViewport(
  host: HTMLElement,
  loaders: PreviewImageLoaders,
): () => void {
  const images = Array.from(
    host.querySelectorAll<HTMLImageElement>(
      `img[${WORKSPACE_IMAGE_PATH_ATTR}], img[${REMOTE_IMAGE_URL_ATTR}]`,
    ),
  );
  if (images.length === 0) {
    return () => undefined;
  }

  let cancelled = false;
  let activeLoads = 0;
  const queued = new Set<HTMLImageElement>();
  const queue: HTMLImageElement[] = [];
  let observer: IntersectionObserver | null = null;
  let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

  const drainQueue = () => {
    while (
      !cancelled &&
      activeLoads < MAX_CONCURRENT_IMAGE_LOADS &&
      queue.length > 0
    ) {
      const image = queue.shift();
      if (!image) {
        continue;
      }
      activeLoads += 1;
      void resolvePreviewImage(image, loaders, () => cancelled)
        .finally(() => {
          activeLoads -= 1;
          drainQueue();
        });
    }
  };

  const enqueue = (image: HTMLImageElement) => {
    if (cancelled || queued.has(image)) {
      return;
    }
    queued.add(image);
    observer?.unobserve(image);
    queue.push(image);
    drainQueue();
  };

  if (typeof globalThis.IntersectionObserver === "function") {
    observer = new IntersectionObserver(
      (entries) => {
        let observedIntersection = false;
        for (const entry of entries) {
          if (entry.isIntersecting && entry.target instanceof HTMLImageElement) {
            observedIntersection = true;
            enqueue(entry.target);
          }
        }
        // A nested WKWebView scroll surface can emit one initial
        // non-intersecting record and then never report the placeholder again.
        // That record is not proof that viewport loading works, so retain the
        // bounded fallback until at least one real intersection was observed.
        if (observedIntersection && fallbackTimer !== null) {
          clearTimeout(fallbackTimer);
          fallbackTimer = null;
        }
      },
      {
        // Start shortly before the user reaches the image so normal scrolling
        // does not expose the transparent placeholder.
        rootMargin: "640px 0px",
        threshold: 0.01,
      },
    );
    for (const image of images) {
      observer.observe(image);
    }
    // WKWebView can occasionally retain a valid placeholder without
    // delivering any intersection callback when Preview lives inside a nested
    // scrolling surface. Keep viewport-first loading, but never leave a valid
    // local image permanently transparent: after a short grace period, feed
    // the remaining placeholders into the same two-read bounded queue.
    fallbackTimer = setTimeout(() => {
      fallbackTimer = null;
      for (const image of images) {
        enqueue(image);
      }
    }, INTERSECTION_FALLBACK_DELAY_MS);
  } else {
    // IntersectionObserver exists in the supported WebKit runtime. Eagerly
    // retain functionality in unusual/test hosts that do not provide it.
    for (const image of images) {
      enqueue(image);
    }
  }

  return () => {
    cancelled = true;
    if (fallbackTimer !== null) {
      clearTimeout(fallbackTimer);
    }
    observer?.disconnect();
    queue.length = 0;
  };
}

async function resolvePreviewImage(
  image: HTMLImageElement,
  loaders: PreviewImageLoaders,
  isCancelled: () => boolean,
): Promise<void> {
  const path = image.getAttribute(WORKSPACE_IMAGE_PATH_ATTR)?.trim() ?? "";
  const remoteUrl = image.getAttribute(REMOTE_IMAGE_URL_ATTR)?.trim() ?? "";
  const origin = image.getAttribute(IMAGE_ORIGIN_ATTR) ?? "workspace";
  const reference = remoteUrl || path.split("/").filter(Boolean).pop() || path;

  try {
    let dataUrl: string;
    if (remoteUrl) {
      if (!loaders.loadRemoteImage) {
        throw new Error("remote image loader unavailable");
      }
      dataUrl = await loaders.loadRemoteImage(remoteUrl);
    } else if (origin === "approved-local") {
      if (!loaders.loadApprovedLocalImage) {
        throw new Error("approved local image loader unavailable");
      }
      dataUrl = await loaders.loadApprovedLocalImage(path);
    } else {
      dataUrl = await loaders.loadWorkspaceImage(path);
    }

    if (isCancelled() || !image.isConnected) {
      return;
    }
    // Reading is already delayed and concurrency-bounded by this loader.
    // Keeping the transparent placeholder's native lazy flag can make WebKit
    // retain that completed placeholder after `src` changes in a nested
    // Preview scroll surface.
    image.removeAttribute("loading");
    image.setAttribute("src", dataUrl);
    image.removeAttribute(WORKSPACE_IMAGE_PATH_ATTR);
    image.removeAttribute(REMOTE_IMAGE_URL_ATTR);
    image.removeAttribute(IMAGE_ORIGIN_ATTR);
    loaders.onDomChange?.();
    if (typeof image.decode === "function") {
      void image.decode().catch(() => undefined);
    }
  } catch {
    if (isCancelled() || !image.isConnected) {
      return;
    }
    const blocked = buildBlockedImageElement({
      reason: "load-failed",
      alt: image.getAttribute("alt")?.trim(),
      reference,
      resolvedPath: path || undefined,
    });
    image.replaceWith(blocked);
    loaders.onDomChange?.();
  }
}
