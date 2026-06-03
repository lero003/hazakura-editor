import { invoke } from "@tauri-apps/api/core";
import type { ImagePreviewDocument } from "./files";

export type WorkspaceTreeEntry = {
  name: string;
  path: string;
  kind: "directory" | "file";
  children: WorkspaceTreeEntry[];
  children_loaded: boolean;
  children_truncated: boolean;
};

export async function listWorkspaceTree(
  root: string,
): Promise<WorkspaceTreeEntry> {
  return invoke<WorkspaceTreeEntry>("list_workspace_tree", { root });
}

export async function listWorkspaceDirectory(
  root: string,
  directory: string,
): Promise<WorkspaceTreeEntry> {
  return invoke<WorkspaceTreeEntry>("list_workspace_directory", {
    root,
    directory,
  });
}

export async function openWorkspaceImage(
  root: string,
  path: string,
): Promise<ImagePreviewDocument> {
  return invoke<ImagePreviewDocument>("open_workspace_image", { root, path });
}

export async function savePastedImage(
  workspaceRoot: string,
  dataBase64: string,
  fileName: string,
): Promise<string> {
  return invoke<string>("save_pasted_image", {
    workspaceRoot,
    dataBase64,
    fileName,
  });
}

export async function importImageFromPath(
  workspaceRoot: string,
  sourcePath: string,
): Promise<string> {
  return invoke<string>("import_image_from_path", {
    workspaceRoot,
    sourcePath,
  });
}

// `WorkspaceSearchMatch` and `WorkspaceSearchFileResult` mirror
// the Rust types in `src-tauri/src/commands/search.rs`. The
// front-end never inspects `path` directly — it only needs
// `relativePath` for display and the original `path` to feed
// `openWorkspaceFile` once the user picks a row.
export type WorkspaceSearchMatch = {
  line: number;
  column: number;
  text: string;
};

export type WorkspaceSearchFileResult = {
  path: string;
  relativePath: string;
  matches: WorkspaceSearchMatch[];
  truncated: boolean;
};

export type WorkspaceSearchResult = {
  files: WorkspaceSearchFileResult[];
  totalMatches: number;
  totalFilesScanned: number;
  truncated: boolean;
};

export async function searchWorkspaceFiles(
  root: string,
  query: string,
): Promise<WorkspaceSearchResult> {
  return invoke<WorkspaceSearchResult>("search_workspace_files", {
    root,
    query,
  });
}

export async function createTextFolder(
  path: string,
  workspaceRoot: string,
): Promise<void> {
  await invoke<void>("create_text_folder", { path, workspaceRoot });
}

export async function renameWorkspaceEntry(
  src: string,
  dst: string,
  workspaceRoot: string,
): Promise<void> {
  await invoke<void>("rename_workspace_entry", { src, dst, workspaceRoot });
}

export async function moveWorkspaceEntry(
  src: string,
  dst: string,
  workspaceRoot: string,
): Promise<void> {
  await invoke<void>("move_workspace_entry", { src, dst, workspaceRoot });
}

export async function moveWorkspaceEntryToTrash(
  path: string,
  workspaceRoot: string,
): Promise<void> {
  await invoke<void>("move_workspace_entry_to_trash", { path, workspaceRoot });
}
