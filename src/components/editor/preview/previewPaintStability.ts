const WORKSPACE_IMAGE_PATH_ATTR = "data-hazakura-image-path";
const REMOTE_IMAGE_URL_ATTR = "data-hazakura-image-remote";
const IMAGE_ORIGIN_ATTR = "data-hazakura-image-origin";
const IMAGE_LOADING_ATTR = "data-hazakura-image-loading";

export const PREVIEW_SELECTING_ATTR = "data-preview-selecting";
export const PREVIEW_SELECTION_SCROLL_EDGE_PX = 48;
export const PREVIEW_SELECTION_SCROLL_MAX_PX = 24;

export type PreviewImageCache = Map<string, string>;

export function previewImageCacheKey(
  path: string,
  remoteUrl: string,
): string | null {
  const remote = remoteUrl.trim();
  if (remote.length > 0) {
    return remote;
  }
  const local = path.trim();
  return local.length > 0 ? local : null;
}

export function isPreviewUserSelecting(host: HTMLElement): boolean {
  const selection = host.ownerDocument.defaultView?.getSelection() ?? null;
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return false;
  }
  return (
    isNodeInside(host, selection.anchorNode) ||
    isNodeInside(host, selection.focusNode)
  );
}

export function isPreviewSelectionGesture(host: HTMLElement): boolean {
  return (
    host.hasAttribute(PREVIEW_SELECTING_ATTR) || isPreviewUserSelecting(host)
  );
}

export function setPreviewSelecting(
  host: HTMLElement | null,
  on: boolean,
): void {
  if (!host) {
    return;
  }
  if (on) {
    host.setAttribute(PREVIEW_SELECTING_ATTR, "");
    return;
  }
  host.removeAttribute(PREVIEW_SELECTING_ATTR);
}

export function previewSelectionScrollDelta(
  viewport: { top: number; bottom: number },
  clientY: number,
): number {
  const span = viewport.bottom - viewport.top;
  if (span <= 0) {
    return 0;
  }
  const edge = Math.min(PREVIEW_SELECTION_SCROLL_EDGE_PX, span / 3);
  if (clientY < viewport.top + edge) {
    const t = (viewport.top + edge - clientY) / edge;
    return -Math.ceil(clamp01(t) * PREVIEW_SELECTION_SCROLL_MAX_PX);
  }
  if (clientY > viewport.bottom - edge) {
    const t = (clientY - (viewport.bottom - edge)) / edge;
    return Math.ceil(clamp01(t) * PREVIEW_SELECTION_SCROLL_MAX_PX);
  }
  return 0;
}

export function applyPreviewSelectionAutoScroll(
  scroller: HTMLElement,
  clientY: number,
): number {
  const delta = previewSelectionScrollDelta(
    scroller.getBoundingClientRect(),
    clientY,
  );
  if (delta === 0) {
    return 0;
  }
  const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
  const next = Math.min(max, Math.max(0, scroller.scrollTop + delta));
  const applied = next - scroller.scrollTop;
  scroller.scrollTop = next;
  return applied;
}

export function rememberResolvedPreviewImage(
  cache: PreviewImageCache,
  key: string,
  dataUrl: string,
): void {
  if (key.length === 0 || dataUrl.length === 0) {
    return;
  }
  cache.set(key, dataUrl);
}

export function applyCachedPreviewImages(
  host: HTMLElement,
  cache: PreviewImageCache,
): number {
  if (cache.size === 0) {
    return 0;
  }

  let applied = 0;
  const images = host.querySelectorAll<HTMLImageElement>(
    `img[${WORKSPACE_IMAGE_PATH_ATTR}], img[${REMOTE_IMAGE_URL_ATTR}]`,
  );
  for (const image of images) {
    const key = previewImageCacheKey(
      image.getAttribute(WORKSPACE_IMAGE_PATH_ATTR) ?? "",
      image.getAttribute(REMOTE_IMAGE_URL_ATTR) ?? "",
    );
    if (!key) {
      continue;
    }
    const dataUrl = cache.get(key);
    if (!dataUrl) {
      continue;
    }
    image.removeAttribute("loading");
    image.setAttribute("src", dataUrl);
    image.removeAttribute(WORKSPACE_IMAGE_PATH_ATTR);
    image.removeAttribute(REMOTE_IMAGE_URL_ATTR);
    image.removeAttribute(IMAGE_ORIGIN_ATTR);
    image.removeAttribute(IMAGE_LOADING_ATTR);
    applied += 1;
  }
  return applied;
}

function isNodeInside(host: Node, node: Node | null): boolean {
  return Boolean(node && (host === node || host.contains(node)));
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
