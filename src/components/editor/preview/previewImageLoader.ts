import { buildBlockedImageElement } from "../../../features/editor/imagePolicy";

const WORKSPACE_IMAGE_PATH_ATTR = "data-hazakura-image-path";
const IMAGE_ORIGIN_ATTR = "data-hazakura-image-origin";
const REMOTE_IMAGE_URL_ATTR = "data-hazakura-image-remote";
const MAX_CONCURRENT_IMAGE_LOADS = 2;

type PreviewImageLoaders = {
  loadApprovedLocalImage?: (absolutePath: string) => Promise<string>;
  loadRemoteImage?: (url: string) => Promise<string>;
  loadWorkspaceImage: (absolutePath: string) => Promise<string>;
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
        for (const entry of entries) {
          if (entry.isIntersecting && entry.target instanceof HTMLImageElement) {
            enqueue(entry.target);
          }
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
  } else {
    // IntersectionObserver exists in the supported WebKit runtime. Eagerly
    // retain functionality in unusual/test hosts that do not provide it.
    for (const image of images) {
      enqueue(image);
    }
  }

  return () => {
    cancelled = true;
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
    image.setAttribute("data-hazakura-image-loading", "");
    image.setAttribute("src", dataUrl);
    image.removeAttribute(WORKSPACE_IMAGE_PATH_ATTR);
    image.removeAttribute(REMOTE_IMAGE_URL_ATTR);
    image.removeAttribute(IMAGE_ORIGIN_ATTR);
    if (typeof image.decode === "function") {
      void image
        .decode()
        .catch(() => undefined)
        .finally(() => {
          if (image.isConnected) {
            image.removeAttribute("data-hazakura-image-loading");
          }
        });
    } else {
      image.removeAttribute("data-hazakura-image-loading");
    }
  } catch {
    if (isCancelled() || !image.isConnected) {
      return;
    }
    image.replaceWith(
      buildBlockedImageElement({
        reason: "load-failed",
        alt: image.getAttribute("alt")?.trim(),
        reference,
        resolvedPath: path || undefined,
      }),
    );
  }
}
