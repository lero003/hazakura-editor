import type { WorkspaceTreeEntry } from "../../lib/tauri";

function mergeWorkspaceTreeEntry(
  current: WorkspaceTreeEntry,
  replacement: WorkspaceTreeEntry,
): WorkspaceTreeEntry {
  if (current.path !== replacement.path || current.kind !== replacement.kind) {
    return replacement;
  }
  // Parent listings contain unloaded folder placeholders. They must not erase
  // an already loaded folder's children or pagination metadata.
  if (replacement.kind === "directory" && !replacement.children_loaded && current.children_loaded) {
    return current.name === replacement.name ? current : { ...current, name: replacement.name };
  }
  const previous = new Map(current.children.map((child) => [child.path, child]));
  const children = replacement.children.map((child) => {
    const existing = previous.get(child.path);
    return existing ? mergeWorkspaceTreeEntry(existing, child) : child;
  });
  if (
    current.name === replacement.name &&
    current.children_loaded === replacement.children_loaded &&
    current.children_truncated === replacement.children_truncated &&
    current.hidden_children_count === replacement.hidden_children_count &&
    current.children.length === children.length &&
    children.every((child, index) => child === current.children[index])
  ) {
    return current;
  }
  return { ...replacement, children };
}

export function replaceWorkspaceTreeEntry(
  tree: WorkspaceTreeEntry,
  replacement: WorkspaceTreeEntry,
): WorkspaceTreeEntry {
  if (tree.path === replacement.path) {
    // Only the parent listing can change an entry's kind. A delayed child
    // listing must not restore a folder that the parent now reports as a file.
    return tree.kind === replacement.kind ? mergeWorkspaceTreeEntry(tree, replacement) : tree;
  }

  const children = tree.children.map((child) => replaceWorkspaceTreeEntry(child, replacement));
  return children.every((child, index) => child === tree.children[index])
    ? tree
    : { ...tree, children };
}

/** Only list the root and displayed expanded folders; never walk collapsed subtrees. */
export function displayedWorkspaceDirectories(tree: WorkspaceTreeEntry, expanded: ReadonlySet<string>): string[] {
  const paths: string[] = [];
  function visit(entry: WorkspaceTreeEntry, root = false) {
    if (entry.kind !== "directory" || (!root && !expanded.has(entry.path))) return;
    paths.push(entry.path);
    if (expanded.has(entry.path)) entry.children.forEach((child) => visit(child));
  }
  visit(tree, true);
  return paths;
}
