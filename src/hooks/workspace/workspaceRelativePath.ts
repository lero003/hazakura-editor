// Shared helper for turning an absolute file path into a
// workspace-relative path. Used by both the auto-backup writer
// (`useAutoBackup`) and the auto-backup restore flow
// (`useAutoBackupRestore`) so the two sides agree on what the
// "relative" key is — diverging writers and readers would
// silently miss every backup.
//
// Returns `null` if the file is not strictly inside the
// workspace (different volume, escapes via `..`, or points at
// the workspace root itself). Callers should treat `null` as
// "skip" without surfacing an error to the user.

export type WorkspaceRelativePathInput = {
  workspaceRoot: string | null;
  filePath: string;
};

export function workspaceRelativePath(
  input: WorkspaceRelativePathInput,
): string | null {
  const { workspaceRoot, filePath } = input;
  if (!workspaceRoot) {
    return null;
  }

  const normalizedPath = normalizeAbsolutePath(filePath);
  const normalizedWorkspaceRoot = normalizeAbsolutePath(workspaceRoot);

  if (!isPathInsideDirectory(normalizedPath, normalizedWorkspaceRoot)) {
    return null;
  }

  if (normalizedPath === normalizedWorkspaceRoot) {
    return null;
  }

  return normalizedPath.slice(normalizedWorkspaceRoot.length + 1);
}

function isPathInsideDirectory(path: string, directoryPath: string): boolean {
  const normalizedPath = normalizeAbsolutePath(path);
  const normalizedDirectory = normalizeAbsolutePath(directoryPath);

  return (
    normalizedPath === normalizedDirectory ||
    normalizedPath.startsWith(`${normalizedDirectory}/`)
  );
}

function normalizeAbsolutePath(path: string): string {
  const parts: string[] = [];
  const isAbsolute = path.startsWith("/");

  for (const part of path.split("/")) {
    if (!part || part === ".") {
      continue;
    }

    if (part === "..") {
      if (parts.length === 0) {
        return isAbsolute ? "/" : "";
      }

      parts.pop();
      continue;
    }

    parts.push(part);
  }

  return `${isAbsolute ? "/" : ""}${parts.join("/")}`;
}
