import DOMPurify from "dompurify";
import { marked } from "marked";
import {
  buildBlockedImageElement,
  classifyMarkdownImageSource,
} from "./imagePolicy";

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
};

const MARKDOWN_DOMPURIFY_CONFIG = {
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
};

export function renderMarkdown(
  source: string,
  options?: RenderMarkdownOptions,
): string {
  const rawHtml = marked.parse(source, { async: false }) as string;

  // v0.34: policies used to each re-parse HTML; fold into one template parse.
  // Task-list policy must still run before purify (FORBID_TAGS includes `input`).
  const template = document.createElement("template");
  template.innerHTML = rawHtml;
  const fragment = template.content;

  applyImagePreviewPolicyToFragment(
    fragment,
    options?.workspaceRoot ?? null,
    options?.documentPath ?? null,
  );
  applyTablePreviewPolicyToFragment(fragment);
  applyTaskListPreviewPolicyToFragment(fragment);

  // Serialize once after policies, then sanitize. (Passing a host Element
  // into DOMPurify with RETURN_DOM tends to re-introduce an outer <div>,
  // which breaks EPUB page-break spine splitting.)
  return String(
    DOMPurify.sanitize(template.innerHTML, MARKDOWN_DOMPURIFY_CONFIG),
  );
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

  return template.innerHTML;
}

function applyImagePreviewPolicyToFragment(
  fragment: DocumentFragment,
  workspaceRoot: string | null,
  documentPath: string | null,
): void {
  for (const image of Array.from(fragment.querySelectorAll("img"))) {
    const src = image.getAttribute("src")?.trim() ?? "";
    const classification = classifyMarkdownImageSource(
      src,
      workspaceRoot,
      documentPath,
    );

    if (classification.kind === "allowed-data") {
      image.removeAttribute("srcset");
      image.setAttribute("loading", "lazy");
      image.setAttribute("decoding", "async");
      continue;
    }

    if (classification.kind === "allowed-workspace") {
      image.setAttribute("src", TRANSPARENT_IMAGE_SRC);
      image.setAttribute(WORKSPACE_IMAGE_PATH_ATTR, classification.path);
      image.removeAttribute("srcset");
      image.setAttribute("loading", "lazy");
      image.setAttribute("decoding", "async");
      continue;
    }

    // Blocked: no remote fetch and no outside-workspace disk open (M0).
    image.replaceWith(
      buildBlockedImageElement({
        reason: classification.reason,
        alt: image.getAttribute("alt")?.trim(),
        reference: classification.reference,
      }),
    );
  }
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
