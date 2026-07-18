export const MAX_BOOK_SCOPE_CHAPTERS = 100;
export const MAX_BOOK_SCOPE_DEPTH = 16;
export const MAX_BOOK_SCOPE_GROUP_TITLE_LENGTH = 200;

export type BookScopeDocumentNode = {
  kind: "document";
  relativePath: string;
  children: BookScopeNode[];
};

export type BookScopeGroupNode = {
  kind: "group";
  title: string;
  children: BookScopeNode[];
};

/**
 * App-private interpretation of one book. OKF/index data may suggest this tree,
 * but the persisted shape deliberately contains no OKF version or metadata.
 */
export type BookScopeNode = BookScopeDocumentNode | BookScopeGroupNode;

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

export function documentBookScopeNodes(paths: readonly string[]): BookScopeNode[] {
  return paths.flatMap((value) => {
    const relativePath = normalizeBookScopeRelativePath(value);
    return relativePath
      ? [{ kind: "document" as const, relativePath, children: [] }]
      : [];
  });
}

export function flattenBookScopeNodes(nodes: readonly BookScopeNode[]): string[] {
  const paths: string[] = [];
  const visit = (entries: readonly BookScopeNode[]): void => {
    for (const node of entries) {
      if (node.kind === "document") paths.push(node.relativePath);
      visit(node.children);
    }
  };
  visit(nodes);
  return paths.slice(0, MAX_BOOK_SCOPE_CHAPTERS);
}

export function sanitizeBookScopeNodes(nodes: readonly unknown[]): BookScopeNode[] {
  const seenPaths = new Set<string>();
  let documentCount = 0;

  const visit = (entries: readonly unknown[], depth: number): BookScopeNode[] => {
    if (depth > MAX_BOOK_SCOPE_DEPTH || documentCount >= MAX_BOOK_SCOPE_CHAPTERS) {
      return [];
    }
    const sanitized: BookScopeNode[] = [];
    for (const value of entries) {
      if (
        !value ||
        typeof value !== "object" ||
        documentCount >= MAX_BOOK_SCOPE_CHAPTERS
      ) {
        continue;
      }
      const candidate = value as {
        kind?: unknown;
        relativePath?: unknown;
        title?: unknown;
        children?: unknown;
      };
      const childrenInput = Array.isArray(candidate.children)
        ? candidate.children
        : [];
      if (candidate.kind === "document") {
        if (typeof candidate.relativePath !== "string") continue;
        const relativePath = normalizeBookScopeRelativePath(candidate.relativePath);
        if (!relativePath || seenPaths.has(relativePath)) continue;
        seenPaths.add(relativePath);
        documentCount += 1;
        sanitized.push({
          kind: "document",
          relativePath,
          children: visit(childrenInput, depth + 1),
        });
        continue;
      }
      if (candidate.kind === "group" && typeof candidate.title === "string") {
        const title = candidate.title.trim().slice(0, MAX_BOOK_SCOPE_GROUP_TITLE_LENGTH);
        if (!title) continue;
        const children = visit(childrenInput, depth + 1);
        if (children.length > 0) {
          sanitized.push({ kind: "group", title, children });
        }
      }
    }
    return sanitized;
  };

  return visit(nodes, 0);
}

export function moveBookScopeNode(
  nodes: readonly BookScopeNode[],
  relativePath: string,
  direction: -1 | 1,
): BookScopeNode[] {
  const visit = (entries: readonly BookScopeNode[]): BookScopeNode[] => {
    const index = entries.findIndex(
      (node) => node.kind === "document" && node.relativePath === relativePath,
    );
    if (index >= 0) {
      const target = index + direction;
      if (target < 0 || target >= entries.length) return [...entries];
      const next = entries.map(cloneBookScopeNode);
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    }
    return entries.map((node) => ({
      ...node,
      children: visit(node.children),
    }));
  };
  return visit(nodes);
}

export function bookScopeSiblingPosition(
  nodes: readonly BookScopeNode[],
  relativePath: string,
): { index: number; count: number } | null {
  for (const entries of siblingLists(nodes)) {
    const index = entries.findIndex(
      (node) => node.kind === "document" && node.relativePath === relativePath,
    );
    if (index >= 0) return { index, count: entries.length };
  }
  return null;
}

export function mergeBookScopeTreeSelection(
  currentNodes: readonly BookScopeNode[],
  selectedTreeOrder: readonly string[],
): BookScopeNode[] {
  const selected = new Set(selectedTreeOrder);
  const retained = filterBookScopeNodes(currentNodes, selected);
  const retainedPaths = new Set(flattenBookScopeNodes(retained));
  const added = selectedTreeOrder
    .filter((path) => !retainedPaths.has(path))
    .map((relativePath) => ({
      kind: "document" as const,
      relativePath,
      children: [],
    }));
  return sanitizeBookScopeNodes([...retained, ...added]);
}

export function removeBookScopeNodePath(
  nodes: readonly BookScopeNode[],
  relativePath: string,
  includeDescendants = false,
): BookScopeNode[] {
  const visit = (entries: readonly BookScopeNode[]): BookScopeNode[] =>
    entries.flatMap((node): BookScopeNode[] => {
      const children = visit(node.children);
      if (node.kind === "group") {
        return children.length ? [{ ...node, children }] : [];
      }
      const matches =
        node.relativePath === relativePath ||
        (includeDescendants && node.relativePath.startsWith(`${relativePath}/`));
      if (matches) return includeDescendants ? [] : children;
      return [{ ...node, children }];
    });
  return visit(nodes);
}

export function remapBookScopeNodePathPrefix(
  nodes: readonly BookScopeNode[],
  oldRelativePath: string,
  newRelativePath: string,
): BookScopeNode[] {
  return sanitizeBookScopeNodes(
    nodes.map((node): BookScopeNode => {
      if (node.kind === "group") {
        return {
          ...node,
          children: remapBookScopeNodePathPrefix(
            node.children,
            oldRelativePath,
            newRelativePath,
          ),
        };
      }
      const relativePath =
        node.relativePath === oldRelativePath
          ? newRelativePath
          : node.relativePath.startsWith(`${oldRelativePath}/`)
            ? `${newRelativePath}${node.relativePath.slice(oldRelativePath.length)}`
            : node.relativePath;
      return {
        ...node,
        relativePath,
        children: remapBookScopeNodePathPrefix(
          node.children,
          oldRelativePath,
          newRelativePath,
        ),
      };
    }),
  );
}

function cloneBookScopeNode(node: BookScopeNode): BookScopeNode {
  return { ...node, children: node.children.map(cloneBookScopeNode) };
}

function* siblingLists(
  nodes: readonly BookScopeNode[],
): Generator<readonly BookScopeNode[]> {
  yield nodes;
  for (const node of nodes) {
    yield* siblingLists(node.children);
  }
}

function filterBookScopeNodes(
  nodes: readonly BookScopeNode[],
  selected: ReadonlySet<string>,
): BookScopeNode[] {
  return nodes.flatMap((node): BookScopeNode[] => {
    const children = filterBookScopeNodes(node.children, selected);
    if (node.kind === "group") {
      return children.length ? [{ ...node, children }] : [];
    }
    if (selected.has(node.relativePath)) return [{ ...node, children }];
    return children;
  });
}
