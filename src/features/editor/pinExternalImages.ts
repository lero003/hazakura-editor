/**
 * Theme G M4 — pure helpers to rewrite Markdown image references to
 * workspace-relative `assets/…` paths after explicit import.
 * Does not touch disk; callers use import_image_from_path / save_pasted_image.
 */

export type PinableImageReference = {
  /** Full match including `![alt](src)` or raw HTML img if needed later. */
  raw: string;
  alt: string;
  src: string;
  index: number;
  kind: "markdown" | "remote" | "local";
};

const MARKDOWN_IMAGE_RE = /!\[([^\]]*)\]\(([^)\n]+)\)/g;

export function listPinableImageReferences(source: string): PinableImageReference[] {
  const results: PinableImageReference[] = [];
  for (const match of source.matchAll(MARKDOWN_IMAGE_RE)) {
    const raw = match[0] ?? "";
    const alt = match[1] ?? "";
    const src = (match[2] ?? "").trim();
    const index = match.index ?? 0;
    if (!src || src.startsWith("data:")) {
      continue;
    }
    const isRemote = /^https?:\/\//i.test(src);
    results.push({
      raw,
      alt,
      src,
      index,
      kind: isRemote ? "remote" : "local",
    });
  }
  return results;
}

/**
 * Replace image src values by exact original src string.
 * Later occurrences of the same src all map to the same relative path.
 */
export function rewriteImageSources(
  source: string,
  replacements: ReadonlyMap<string, string>,
): string {
  if (replacements.size === 0) {
    return source;
  }
  return source.replace(MARKDOWN_IMAGE_RE, (full, alt: string, src: string) => {
    const trimmed = src.trim();
    const next = replacements.get(trimmed);
    if (!next) {
      return full;
    }
    return `![${alt}](${next})`;
  });
}

export function relativeAssetPath(fileName: string): string {
  const cleaned = fileName.replace(/^\/+/, "").replace(/\\/g, "/");
  if (cleaned.startsWith("assets/")) {
    return cleaned;
  }
  return `assets/${cleaned.split("/").pop() ?? cleaned}`;
}
