/**
 * Bundle-relative path helpers for OKF preview (pure, no filesystem).
 */

export function normalizeBundleRelativePath(path: string): string {
  const replaced = path.replace(/\\/g, "/");
  const parts: string[] = [];

  for (const part of replaced.split("/")) {
    if (!part || part === ".") {
      continue;
    }
    if (part === "..") {
      if (parts.length === 0) {
        // Keep a leading .. marker so callers can detect escape.
        parts.push("..");
      } else if (parts[parts.length - 1] === "..") {
        parts.push("..");
      } else {
        parts.pop();
      }
      continue;
    }
    parts.push(part);
  }

  return parts.join("/");
}

export function isReservedOkfFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower === "index.md" || lower === "log.md";
}

export function fileNameFromRelativePath(relativePath: string): string {
  const normalized = normalizeBundleRelativePath(relativePath);
  const slash = normalized.lastIndexOf("/");
  return slash === -1 ? normalized : normalized.slice(slash + 1);
}

export function directoryFromRelativePath(relativePath: string): string {
  const normalized = normalizeBundleRelativePath(relativePath);
  const slash = normalized.lastIndexOf("/");
  return slash === -1 ? "" : normalized.slice(0, slash);
}

export function joinBundleRelativePath(
  directory: string,
  child: string,
): string {
  if (!directory) {
    return normalizeBundleRelativePath(child);
  }
  return normalizeBundleRelativePath(`${directory}/${child}`);
}

export function isPathInsideBundleRoot(relativePath: string): boolean {
  const normalized = normalizeBundleRelativePath(relativePath);
  if (!normalized) {
    return true;
  }
  return !normalized.split("/").includes("..");
}

export function conceptIdFromRelativePath(relativePath: string): string {
  const normalized = normalizeBundleRelativePath(relativePath);
  if (normalized.toLowerCase().endsWith(".md")) {
    return normalized.slice(0, -3);
  }
  return normalized;
}

export function isMarkdownRelativePath(relativePath: string): boolean {
  const name = fileNameFromRelativePath(relativePath);
  return name.toLowerCase().endsWith(".md");
}
