import {
  directoryPathFromPath,
  isPathInsideDirectory,
  normalizeAbsolutePath,
} from "../../lib/utils";

const EXTERNAL_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

export function normalizeExternalMarkdownLink(href: string): string | null {
  const trimmedHref = href.trim();

  if (!trimmedHref || trimmedHref.startsWith("//")) {
    return null;
  }

  if (/[\s\x00-\x1F\x7F]/.test(trimmedHref)) {
    return null;
  }

  const schemeSeparatorIndex = trimmedHref.indexOf(":");
  if (schemeSeparatorIndex <= 0) {
    return null;
  }

  const scheme = trimmedHref.slice(0, schemeSeparatorIndex).toLowerCase();
  const remainder = trimmedHref.slice(schemeSeparatorIndex + 1);

  if (
    (scheme === "http" || scheme === "https") &&
    !remainder.startsWith("//")
  ) {
    return null;
  }

  try {
    const url = new URL(trimmedHref);
    if (!EXTERNAL_LINK_PROTOCOLS.has(url.protocol.toLowerCase())) {
      return null;
    }
    return trimmedHref;
  } catch {
    return null;
  }
}

export function hasUnsafeMarkdownLinkScheme(href: string): boolean {
  const trimmedHref = href.trim();
  return (
    /^[a-z][a-z0-9+.-]*:/i.test(trimmedHref) &&
    !normalizeExternalMarkdownLink(trimmedHref)
  );
}

export function resolveLocalMarkdownLinkTarget(
  href: string,
  sourcePath: string,
  workspaceRootPath: string,
): string | null {
  const trimmedHref = href.trim();

  if (
    !trimmedHref ||
    trimmedHref.startsWith("#") ||
    trimmedHref.startsWith("//") ||
    /^[a-z][a-z0-9+.-]*:/i.test(trimmedHref)
  ) {
    return null;
  }

  const hrefWithoutAnchor = trimmedHref.split("#", 1)[0] ?? "";
  const hrefPath = hrefWithoutAnchor.split("?", 1)[0]?.trim() ?? "";

  if (!hrefPath || hrefPath.startsWith("/")) {
    return null;
  }

  let decodedPath: string;

  try {
    decodedPath = decodeURIComponent(hrefPath);
  } catch {
    return null;
  }

  if (!decodedPath || decodedPath.includes("\0") || decodedPath.startsWith("/")) {
    return null;
  }

  const workspaceRoot = normalizeAbsolutePath(workspaceRootPath);
  const source = normalizeAbsolutePath(sourcePath);

  if (!isPathInsideDirectory(source, workspaceRoot)) {
    return null;
  }

  const sourceDirectory = directoryPathFromPath(source);
  const targetPath = normalizeAbsolutePath(`${sourceDirectory}/${decodedPath}`);

  if (!isPathInsideDirectory(targetPath, workspaceRoot)) {
    return null;
  }

  return targetPath;
}
