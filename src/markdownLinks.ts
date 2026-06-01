import {
  directoryPathFromPath,
  isPathInsideDirectory,
  normalizeAbsolutePath,
} from "./utils";

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
