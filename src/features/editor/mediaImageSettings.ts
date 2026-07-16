/**
 * Theme G media image settings and per-workspace approval roots.
 *
 * Defaults stay safe: remote Off; outside-local Ask (consent before load);
 * export materialize On for package self-containment when sources are readable.
 */

export type OutsideImagePolicy = "off" | "ask" | "remember";

export type MediaImageSettings = {
  /** Outside-workspace / absolute-local images. Default: ask. */
  outsideImages: OutsideImagePolicy;
  /** Preview / e-book may fetch https images when true. Default: false. */
  loadRemoteImages: boolean;
  /**
   * When true, export (HTML / PDF / EPUB) tries to embed resolvable
   * workspace, approved-local, and (if remote allowed) remote images.
   * Source Markdown is never rewritten by this flag alone.
   */
  materializeImagesOnExport: boolean;
};

export const DEFAULT_MEDIA_IMAGE_SETTINGS: MediaImageSettings = {
  outsideImages: "ask",
  loadRemoteImages: false,
  materializeImagesOnExport: true,
};

const APPROVED_ROOTS_STORAGE_PREFIX = "hazakura.media.approvedImageRoots.v1:";

export function parseOutsideImagePolicy(value: unknown): OutsideImagePolicy {
  if (value === "off" || value === "ask" || value === "remember") {
    return value;
  }
  return DEFAULT_MEDIA_IMAGE_SETTINGS.outsideImages;
}

export function parseMediaImageSettings(
  partial: Partial<MediaImageSettings> | null | undefined,
): MediaImageSettings {
  return {
    outsideImages: parseOutsideImagePolicy(partial?.outsideImages),
    loadRemoteImages:
      typeof partial?.loadRemoteImages === "boolean"
        ? partial.loadRemoteImages
        : DEFAULT_MEDIA_IMAGE_SETTINGS.loadRemoteImages,
    materializeImagesOnExport:
      typeof partial?.materializeImagesOnExport === "boolean"
        ? partial.materializeImagesOnExport
        : DEFAULT_MEDIA_IMAGE_SETTINGS.materializeImagesOnExport,
  };
}

export function normalizeAbsolutePosixPath(path: string): string {
  const absolute = path.startsWith("/");
  const segments: string[] = [];
  for (const segment of path.split("/")) {
    if (!segment || segment === ".") {
      continue;
    }
    if (segment === "..") {
      if (segments.length > 0) {
        segments.pop();
      }
      continue;
    }
    segments.push(segment);
  }
  const normalized = segments.join("/");
  return absolute ? `/${normalized}` : normalized;
}

/** True when `path` is exactly an approved root or a descendant. */
export function isPathUnderApprovedRoots(
  path: string,
  approvedRoots: readonly string[],
): boolean {
  const normalized = normalizeAbsolutePosixPath(path);
  if (!normalized.startsWith("/")) {
    return false;
  }
  for (const root of approvedRoots) {
    const normalizedRoot = normalizeAbsolutePosixPath(root);
    if (!normalizedRoot.startsWith("/")) {
      continue;
    }
    if (
      normalized === normalizedRoot ||
      normalized.startsWith(`${normalizedRoot}/`)
    ) {
      return true;
    }
  }
  return false;
}

/** Prefer approving the image's parent folder (covers `../assets/*`). */
export function parentDirectoryOfPath(path: string): string {
  const normalized = normalizeAbsolutePosixPath(path);
  if (normalized === "/" || !normalized.includes("/")) {
    return normalized;
  }
  const index = normalized.lastIndexOf("/");
  return index <= 0 ? "/" : normalized.slice(0, index);
}

export function mergeApprovedRoot(
  approvedRoots: readonly string[],
  newRoot: string,
): string[] {
  const normalized = normalizeAbsolutePosixPath(newRoot);
  if (!normalized.startsWith("/")) {
    return [...approvedRoots];
  }
  // Drop roots that are children of the new root; skip if already covered.
  if (isPathUnderApprovedRoots(normalized, approvedRoots)) {
    return [...approvedRoots];
  }
  const next = approvedRoots.filter(
    (root) => !isPathUnderApprovedRoots(root, [normalized]),
  );
  next.push(normalized);
  return next;
}

export function approvedRootsStorageKey(workspaceRoot: string): string {
  return `${APPROVED_ROOTS_STORAGE_PREFIX}${normalizeAbsolutePosixPath(workspaceRoot)}`;
}

export function readStoredApprovedRoots(workspaceRoot: string | null): string[] {
  if (!workspaceRoot || typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(
      approvedRootsStorageKey(workspaceRoot),
    );
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((entry): entry is string => typeof entry === "string")
      .map(normalizeAbsolutePosixPath)
      .filter((entry) => entry.startsWith("/"));
  } catch {
    return [];
  }
}

export function writeStoredApprovedRoots(
  workspaceRoot: string | null,
  roots: readonly string[],
): void {
  if (!workspaceRoot || typeof window === "undefined") {
    return;
  }
  const key = approvedRootsStorageKey(workspaceRoot);
  if (roots.length === 0) {
    window.localStorage.removeItem(key);
    return;
  }
  window.localStorage.setItem(key, JSON.stringify([...roots]));
}

export function clearStoredApprovedRoots(workspaceRoot: string | null): void {
  writeStoredApprovedRoots(workspaceRoot, []);
}
