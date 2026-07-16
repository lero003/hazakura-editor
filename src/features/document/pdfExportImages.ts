/**
 * PDF export image embedding helpers.
 *
 * Images are always inlined as `data:` URLs before WebKit createPDF —
 * the PDF save destination is never used for lookup. Callers must provide
 * a workspace-contained loader; do not add an `openImageFile` fallback,
 * because Preview, HTML, and PDF share the same containment policy.
 */

import { buildBlockedImageElement } from "../editor/imagePolicy";

const WORKSPACE_IMAGE_PATH_ATTR = "data-hazakura-image-path";
const TRANSPARENT_GIF_PREFIX = "data:image/gif;base64,";

export type PdfImageLoader = (absolutePath: string) => Promise<string>;

/**
 * Load every `data-hazakura-image-path` image to a data URL and stamp
 * createPDF-safe inline styles on all embedded bitmaps (cover + body).
 */
export async function embedAndStampPdfImages(
  html: string,
  loadImageDataUrl: PdfImageLoader,
  options: { bodyMaxHeightPx: number },
): Promise<{ html: string; embeddedCount: number; failedPaths: string[] }> {
  if (typeof document === "undefined") {
    return { html, embeddedCount: 0, failedPaths: [] };
  }

  const template = document.createElement("template");
  template.innerHTML = html;
  const failedPaths: string[] = [];
  let embeddedCount = 0;

  for (const image of Array.from(
    template.content.querySelectorAll(`img[${WORKSPACE_IMAGE_PATH_ATTR}]`),
  )) {
    const path = image.getAttribute(WORKSPACE_IMAGE_PATH_ATTR)?.trim();
    if (!path) {
      continue;
    }
    try {
      const dataUrl = await loadImageDataUrl(path);
      if (!dataUrl.startsWith("data:image/") || dataUrl.startsWith(TRANSPARENT_GIF_PREFIX)) {
        throw new Error("loader returned a non-bitmap data URL");
      }
      image.setAttribute("src", dataUrl);
      image.removeAttribute(WORKSPACE_IMAGE_PATH_ATTR);
      image.removeAttribute("srcset");
      embeddedCount += 1;
    } catch {
      failedPaths.push(path);
      // Leave a visible note rather than a blank hole (same M0 contract as Preview).
      const basename = path.split("/").filter(Boolean).pop() ?? path;
      image.replaceWith(
        buildBlockedImageElement({
          reason: "load-failed",
          alt: image.getAttribute("alt")?.trim(),
          reference: basename,
        }),
      );
    }
  }

  stampEmbeddedImageStyles(template.content, options.bodyMaxHeightPx);

  return {
    html: serializeFragment(template.content),
    embeddedCount,
    failedPaths,
  };
}

/** Apply fixed-px sizing so WebKit createPDF paints data: images reliably. */
export function stampEmbeddedImageStyles(
  root: ParentNode,
  maxHeightPx: number,
): void {
  const height = Math.max(120, Math.floor(maxHeightPx));
  for (const image of Array.from(root.querySelectorAll("img"))) {
    const src = image.getAttribute("src")?.trim() ?? "";
    if (!src.startsWith("data:image/") || src.startsWith(TRANSPARENT_GIF_PREFIX)) {
      continue;
    }
    image.style.display = "block";
    image.style.width = "auto";
    image.style.height = "auto";
    image.style.maxWidth = "100%";
    image.style.maxHeight = `${height}px`;
    image.style.objectFit = "contain";
    image.style.margin = "10px auto 16px";
    image.style.border = "0";
    image.style.boxShadow = "none";
    // Avoid multicol "unbreakable tall box" collapse in createPDF.
    image.style.breakInside = "auto";
    image.removeAttribute("width");
    image.removeAttribute("height");
  }
}

function serializeFragment(fragment: DocumentFragment): string {
  const wrap = document.createElement("div");
  wrap.append(...Array.from(fragment.childNodes));
  return wrap.innerHTML;
}
