import type { WorkspaceTreeEntry } from "../../lib/tauri";

export type QuickOpenFlatFile = {
  path: string;
  name: string;
};

/** Cap for both empty-query listing and filtered matches. */
export const QUICK_OPEN_RESULT_LIMIT = 100;

/** Flatten the currently loaded workspace tree into file entries only. */
export function flattenWorkspaceFiles(
  entry: WorkspaceTreeEntry,
): QuickOpenFlatFile[] {
  const result: QuickOpenFlatFile[] = [];
  function walk(node: WorkspaceTreeEntry) {
    if (node.kind === "file") {
      result.push({ path: node.path, name: node.name });
    }
    for (const child of node.children ?? []) {
      walk(child);
    }
  }
  walk(entry);
  return result;
}

/**
 * True when the loaded tree may omit files the user would expect from a
 * full-workspace search: unloaded children or a per-directory cap.
 */
export function workspaceTreeIsPartial(entry: WorkspaceTreeEntry): boolean {
  function walk(node: WorkspaceTreeEntry): boolean {
    if (node.kind === "directory") {
      if (!node.children_loaded || node.children_truncated) {
        return true;
      }
    }
    for (const child of node.children ?? []) {
      if (walk(child)) {
        return true;
      }
    }
    return false;
  }
  return walk(entry);
}
