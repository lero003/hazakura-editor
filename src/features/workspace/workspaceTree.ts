import type { WorkspaceTreeEntry } from "../../lib/tauri";

export function replaceWorkspaceTreeEntry(
  tree: WorkspaceTreeEntry,
  replacement: WorkspaceTreeEntry,
): WorkspaceTreeEntry {
  if (tree.path === replacement.path) {
    return replacement;
  }

  return {
    ...tree,
    children: tree.children.map((child) =>
      replaceWorkspaceTreeEntry(child, replacement),
    ),
  };
}
