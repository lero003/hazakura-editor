import DOMPurify from "dompurify";
import { marked } from "marked";

marked.use({
  gfm: true,
  breaks: false,
});

const WORKSPACE_IMAGE_PATH_ATTR = "data-hazakura-image-path";
const TRANSPARENT_IMAGE_SRC =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

export function renderMarkdown(
  source: string,
  options?: { documentPath?: string | null; workspaceRoot?: string | null },
): string {
  const rawHtml = marked.parse(source, { async: false }) as string;
  const imageBoundedHtml = applyImagePreviewPolicy(
    rawHtml,
    options?.workspaceRoot ?? null,
    options?.documentPath ?? null,
  );
  const tableBoundedHtml = applyTablePreviewPolicy(imageBoundedHtml);

  return DOMPurify.sanitize(tableBoundedHtml, {
    USE_PROFILES: { html: true },
    ALLOWED_URI_REGEXP:
      /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    FORBID_TAGS: [
      "script",
      "iframe",
      "object",
      "embed",
      // v0.17 slice 2.3: explicit blocks for Safe Editor
      // preview/export. `<style>` with CSS url(https://...)
      // is an external-fetch path that DOMPurify does not
      // sanitise; `<form>` / `<input>` / `<button>` /
      // `<textarea>` / `<select>` / `<option>` are
      // non-script form controls whose `action` attribute
      // could point to an off-site submit target in
      // exported HTML. Neither is useful inside a Markdown
      // preview; both are stripped so the App Store lane
      // can reasonably claim "no external fetch or
      // submission path appears".
      "style",
      "form",
      "input",
      "button",
      "textarea",
      "select",
      "option",
    ],
    FORBID_ATTR: ["onerror", "onload", "onclick"],
  });
}

export async function inlineWorkspaceAssetImages(
  html: string,
  loadImageDataUrl: (absolutePath: string) => Promise<string>,
): Promise<string> {
  if (!html.includes(WORKSPACE_IMAGE_PATH_ATTR)) {
    return html;
  }

  const template = document.createElement("template");
  template.innerHTML = html;

  for (const image of Array.from(
    template.content.querySelectorAll(`img[${WORKSPACE_IMAGE_PATH_ATTR}]`),
  )) {
    const path = image.getAttribute(WORKSPACE_IMAGE_PATH_ATTR);
    if (!path) {
      continue;
    }

    try {
      const dataUrl = await loadImageDataUrl(path);
      image.setAttribute("src", dataUrl);
      image.removeAttribute(WORKSPACE_IMAGE_PATH_ATTR);
    } catch {
      image.replaceWith(blockedImageMessage(image.getAttribute("alt")?.trim()));
    }
  }

  return template.innerHTML;
}

function applyImagePreviewPolicy(
  html: string,
  workspaceRoot: string | null,
  documentPath: string | null,
): string {
  const template = document.createElement("template");
  template.innerHTML = html;

  for (const image of Array.from(template.content.querySelectorAll("img"))) {
    const src = image.getAttribute("src")?.trim() ?? "";

    if (isAllowedEmbeddedImageSource(src)) {
      image.removeAttribute("srcset");
      image.setAttribute("loading", "lazy");
      image.setAttribute("decoding", "async");
      continue;
    }

    const imagePath = workspaceImagePath(src, workspaceRoot, documentPath);
    if (imagePath) {
      image.setAttribute("src", TRANSPARENT_IMAGE_SRC);
      image.setAttribute(WORKSPACE_IMAGE_PATH_ATTR, imagePath);
      image.removeAttribute("srcset");
      image.setAttribute("loading", "lazy");
      image.setAttribute("decoding", "async");
      continue;
    }

    image.replaceWith(blockedImageMessage(image.getAttribute("alt")?.trim()));
  }

  return template.innerHTML;
}

function blockedImageMessage(alt?: string | null): HTMLSpanElement {
  const replacement = document.createElement("span");
  replacement.className = "blocked-image";
  replacement.setAttribute("role", "note");
  replacement.textContent = alt
    ? `Image blocked: ${alt}`
    : "Image blocked: external and local image loading is disabled.";
  return replacement;
}

function applyTablePreviewPolicy(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;

  for (const table of Array.from(template.content.querySelectorAll("table"))) {
    if (table.parentElement?.classList.contains("markdown-table-frame")) {
      continue;
    }

    const frame = document.createElement("div");
    frame.className = "markdown-table-frame";
    frame.setAttribute("role", "region");
    frame.setAttribute("aria-label", "Markdown table");
    table.replaceWith(frame);
    frame.append(table);
  }

  return template.innerHTML;
}

// v0.17 app-store-quality: slice 2.3 — cap embedded images at
// 2 MB. A data:image URI larger than this in a Markdown note
// would produce a multi-megabyte HTML export file and a
// sluggish preview parse; treating it as an oversized
// payload lets the image policy surface a "blocked" message
// instead of injecting a giant inline image into the DOM.
const MAX_EMBEDDED_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB

function isAllowedEmbeddedImageSource(src: string): boolean {
  if (src.length > MAX_EMBEDDED_IMAGE_BYTES) {
    return false;
  }
  return /^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(src);
}

function workspaceImagePath(
  src: string,
  workspaceRoot: string | null,
  documentPath: string | null,
): string | null {
  if (!workspaceRoot) {
    return null;
  }

  let decodedSrc: string;
  try {
    decodedSrc = decodeURIComponent(src);
  } catch {
    return null;
  }

  if (
    !decodedSrc ||
    decodedSrc.includes("\\") ||
    decodedSrc.includes("?") ||
    decodedSrc.includes("#") ||
    /^[a-z][a-z0-9+.-]*:/i.test(decodedSrc)
  ) {
    return null;
  }

  const normalizedRoot = normalizeWorkspaceRoot(workspaceRoot);
  const resolved = isAbsolutePosix(decodedSrc)
    ? normalizePosix(decodedSrc)
    : resolvePosix(documentBaseDir(documentPath, normalizedRoot), decodedSrc);

  if (
    resolved === normalizedRoot ||
    resolved.startsWith(normalizedRoot + "/")
  ) {
    return resolved;
  }

  return null;
}

function normalizeWorkspaceRoot(root: string): string {
  const withoutTrailingSlash = root.replace(/\/+$/, "");
  return withoutTrailingSlash || "/";
}

function documentBaseDir(
  documentPath: string | null,
  normalizedRoot: string,
): string {
  if (
    documentPath &&
    (documentPath === normalizedRoot ||
      documentPath.startsWith(normalizedRoot + "/"))
  ) {
    return dirnamePosix(documentPath);
  }
  return normalizedRoot;
}

function isAbsolutePosix(path: string): boolean {
  return path.startsWith("/");
}

function dirnamePosix(path: string): string {
  const normalized = normalizePosix(path);
  if (normalized === "/") {
    return "/";
  }

  const index = normalized.lastIndexOf("/");
  if (index <= 0) {
    return "/";
  }
  return normalized.slice(0, index);
}

function resolvePosix(baseDir: string, relativePath: string): string {
  return normalizePosix(`${baseDir}/${relativePath}`);
}

function normalizePosix(path: string): string {
  const absolute = path.startsWith("/");
  const segments: string[] = [];

  for (const segment of path.split("/")) {
    if (!segment || segment === ".") {
      continue;
    }
    if (segment === "..") {
      if (segments.length > 0 && segments[segments.length - 1] !== "..") {
        segments.pop();
      } else if (!absolute) {
        segments.push(segment);
      }
      continue;
    }
    segments.push(segment);
  }

  const normalized = segments.join("/");
  return absolute ? `/${normalized}` : normalized;
}
