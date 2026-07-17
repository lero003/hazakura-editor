export const MAX_BOOK_SCOPE_CHAPTERS = 100;

const MARKDOWN_EXTENSIONS = new Set(["md", "markdown", "mdown", "mkd", "mdx"]);

export function isBookScopeMarkdownPath(path: string): boolean {
  const name = path.split("/").at(-1) ?? path;
  const dot = name.lastIndexOf(".");
  return dot > 0 && MARKDOWN_EXTENSIONS.has(name.slice(dot + 1).toLowerCase());
}

export function normalizeBookScopeRelativePath(path: string): string | null {
  if (!path || path.startsWith("/") || path.includes("\\")) return null;
  const parts = path.split("/");
  if (parts.some((part) => !part || part === "." || part === "..")) return null;
  const normalized = parts.join("/");
  return isBookScopeMarkdownPath(normalized) ? normalized : null;
}

export function mergeBookScopeSelection(
  currentOrder: readonly string[],
  selectedTreeOrder: readonly string[],
): string[] {
  const selected = new Set(selectedTreeOrder);
  const retained = currentOrder.filter((path) => selected.has(path));
  const retainedSet = new Set(retained);
  const added = selectedTreeOrder.filter((path) => !retainedSet.has(path));
  return [...retained, ...added].slice(0, MAX_BOOK_SCOPE_CHAPTERS);
}

export function moveBookScopeChapter(
  paths: readonly string[],
  index: number,
  direction: -1 | 1,
): string[] {
  const target = index + direction;
  if (index < 0 || index >= paths.length || target < 0 || target >= paths.length) {
    return [...paths];
  }
  const next = [...paths];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function removeBookScopePath(
  paths: readonly string[],
  relativePath: string,
  includeDescendants = false,
): string[] {
  return paths.filter(
    (path) =>
      path !== relativePath &&
      !(includeDescendants && path.startsWith(`${relativePath}/`)),
  );
}

export function remapBookScopePathPrefix(
  paths: readonly string[],
  oldRelativePath: string,
  newRelativePath: string,
): string[] {
  return paths.map((path) => {
    if (path === oldRelativePath) return newRelativePath;
    if (path.startsWith(`${oldRelativePath}/`)) {
      return `${newRelativePath}${path.slice(oldRelativePath.length)}`;
    }
    return path;
  });
}
