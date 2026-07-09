import DOMPurify from "dompurify";
import { marked } from "marked";
import { isAllowedEmbeddedImageSource } from "./imagePolicy";

marked.use({
  gfm: true,
  breaks: false,
});

const WORKSPACE_IMAGE_PATH_ATTR = "data-hazakura-image-path";
const TRANSPARENT_IMAGE_SRC =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

export type RenderMarkdownOptions = {
  documentPath?: string | null;
  workspaceRoot?: string | null;
  /**
   * PDF/HTML export: allow document-relative paths (including `../assets/…`)
   * that resolve outside the open workspace root. Preview stays workspace-bound.
   * Absolute paths written in Markdown are still rejected unless under the
   * workspace. Resolved paths are embedded as data URLs at export time — the
   * PDF destination folder is never used for lookup.
   */
  allowDocumentRelativeOutsideWorkspace?: boolean;
};

export function renderMarkdown(
  source: string,
  options?: RenderMarkdownOptions,
): string {
  const rawHtml = marked.parse(source, { async: false }) as string;

  // v0.34: 3つのポリシー(画像/テーブル/タスクリスト)をそれぞれ別の <template>
  // で parse/シリアライズすると HTML が5回 parse されていた(各ポリシー1回ずつ +
  // DOMPurify)。1つの template に1回 parse し、同じ DOM に全ポリシーを適用して
  // から1回だけシリアライズ → DOMPurify に渡す。
  const template = document.createElement("template");
  template.innerHTML = rawHtml;
  const fragment = template.content;

  applyImagePreviewPolicyToFragment(
    fragment,
    options?.workspaceRoot ?? null,
    options?.documentPath ?? null,
    options?.allowDocumentRelativeOutsideWorkspace === true,
  );
  applyTablePreviewPolicyToFragment(fragment);
  applyTaskListPreviewPolicyToFragment(fragment);

  return DOMPurify.sanitize(template.innerHTML, {
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

function applyImagePreviewPolicyToFragment(
  fragment: DocumentFragment,
  workspaceRoot: string | null,
  documentPath: string | null,
  allowDocumentRelativeOutsideWorkspace = false,
): void {
  for (const image of Array.from(fragment.querySelectorAll("img"))) {
    const src = image.getAttribute("src")?.trim() ?? "";

    if (isAllowedEmbeddedImageSource(src)) {
      image.removeAttribute("srcset");
      image.setAttribute("loading", "lazy");
      image.setAttribute("decoding", "async");
      continue;
    }

    const imagePath = resolveLocalImagePath(src, workspaceRoot, documentPath, {
      allowDocumentRelativeOutsideWorkspace,
    });
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
}

function blockedImageMessage(alt?: string | null): HTMLSpanElement {
  const replacement = document.createElement("span");
  replacement.className = "blocked-image";
  replacement.setAttribute("role", "note");
  // Japanese-first (Q-IMP-1 / product locale). Class stays `blocked-image`
  // for export / CSS. Do not silently load remote or outside-workspace files.
  replacement.textContent = alt
    ? `画像を表示できません: ${alt}`
    : "画像を表示できません（ワークスペース外・未配置・リモートは読み込みません）";
  return replacement;
}

// v0.34: 共通の fragment に直接適用する版（renderMarkdown の1パス化用）。
function applyTablePreviewPolicyToFragment(
  fragment: DocumentFragment,
): void {
  for (const table of Array.from(fragment.querySelectorAll("table"))) {
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
}

// v0.34: 共通の fragment に直接適用する版（renderMarkdown の1パス化用）。
function applyTaskListPreviewPolicyToFragment(
  fragment: DocumentFragment,
): void {
  for (const checkbox of Array.from(
    fragment.querySelectorAll('li > input[type="checkbox"][disabled]'),
  )) {
    const item = checkbox.parentElement;
    const checked = checkbox.hasAttribute("checked");
    const replacement = document.createElement("span");
    replacement.className = checked
      ? "markdown-task-checkbox markdown-task-checkbox--checked"
      : "markdown-task-checkbox markdown-task-checkbox--unchecked";
    replacement.setAttribute("role", "checkbox");
    replacement.setAttribute("aria-checked", checked ? "true" : "false");
    replacement.setAttribute("aria-disabled", "true");
    replacement.textContent = checked ? "☑" : "☐";
    item?.classList.add("markdown-task-list-item");
    checkbox.replaceWith(replacement);
  }
}

/**
 * Resolve a local Markdown image src to an absolute POSIX path.
 * Preview: workspace-contained only.
 * Export (`allowDocumentRelativeOutsideWorkspace`): also allow relative
 * paths resolved from the open document directory (e.g. `../assets/cover.jpg`).
 */
function resolveLocalImagePath(
  src: string,
  workspaceRoot: string | null,
  documentPath: string | null,
  options?: { allowDocumentRelativeOutsideWorkspace?: boolean },
): string | null {
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

  const srcIsAbsolute = isAbsolutePosix(decodedSrc);
  const documentDir =
    documentPath && isAbsolutePosix(documentPath)
      ? dirnamePosix(documentPath)
      : null;

  let resolved: string;
  if (srcIsAbsolute) {
    resolved = normalizePosix(decodedSrc);
  } else {
    // Prefer the real document directory for relative links so `../assets`
    // is not forced through the workspace root alone.
    const baseDir =
      documentDir ??
      (workspaceRoot ? normalizeWorkspaceRoot(workspaceRoot) : null);
    if (!baseDir) {
      return null;
    }
    resolved = resolvePosix(baseDir, decodedSrc);
  }

  if (workspaceRoot) {
    const normalizedRoot = normalizeWorkspaceRoot(workspaceRoot);
    if (
      resolved === normalizedRoot ||
      resolved.startsWith(`${normalizedRoot}/`)
    ) {
      return resolved;
    }
  }

  // Export-only: document-relative (non-absolute) escapes such as ../assets.
  if (
    options?.allowDocumentRelativeOutsideWorkspace &&
    documentDir &&
    !srcIsAbsolute
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
