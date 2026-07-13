// v1.4 observability seam: the pure text / media-type helpers for EPUB
// export, extracted from epubExport.ts so the Japanese-slug, YAML-frontmatter,
// and XML-escape edge cases gain focused coverage.
//
// These functions take plain strings and return plain strings. epubExport.ts
// owns the DOM / archive assembly; this module owns no React or DOM state.

export { stripYamlFrontmatter } from "../editor/markdownFrontmatter";

export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function titleFromDocumentName(name: string): string {
  return name.replace(/\.[^.]+$/, "") || "Untitled";
}

export function escapeXml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

// Normalize a media type so JPEG inputs map to the canonical image/jpeg. All
// other types are returned lowercased as-is.
export function normalizeImageMediaType(mediaType: string): string {
  return mediaType.toLowerCase() === "image/jpg"
    ? "image/jpeg"
    : mediaType.toLowerCase();
}

// Map an image media type to its EPUB archive file extension. Unknown types
// default to png.
export function extensionFromMediaType(mediaType: string): string {
  switch (mediaType.toLowerCase()) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/gif":
      return "gif";
    case "image/webp":
      return "webp";
    case "image/png":
    default:
      return "png";
  }
}
