import { invoke } from "@tauri-apps/api/core";
import type { ImagePreviewDocument } from "./files";

export type WorkspaceTreeEntry = {
  name: string;
  path: string;
  kind: "directory" | "file";
  children: WorkspaceTreeEntry[];
  children_loaded: boolean;
  children_truncated: boolean;
  hidden_children_count?: number;
};

export async function listWorkspaceTree(
  root: string,
): Promise<WorkspaceTreeEntry> {
  return invoke<WorkspaceTreeEntry>("list_workspace_tree", { root });
}

export async function createSecurityScopedBookmark(
  path: string,
): Promise<number[] | null> {
  return invoke<number[] | null>("create_security_scoped_bookmark", { path });
}

export async function resolveSecurityScopedBookmark(
  bookmark: number[],
): Promise<string> {
  return invoke<string>("resolve_security_scoped_bookmark", { bookmark });
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

/** Theme G M1: load a local image only under FE-approved roots. */
export async function openLocalImageUnderRoots(
  path: string,
  allowedRoots: string[],
): Promise<ImagePreviewDocument> {
  return invoke<ImagePreviewDocument>("open_local_image_under_roots", {
    path,
    allowedRoots,
  });
}

/** Theme G M2: bounded https image fetch (Preference-gated on the FE). */
export async function fetchRemoteImage(
  url: string,
): Promise<ImagePreviewDocument> {
  return invoke<ImagePreviewDocument>("fetch_remote_image", { url });
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
  /** 原文の行での一致開始位置（1始まり・**文字**＝コードポイント単位）。 */
  column: number;
  /** 一致位置を中心に切り出した行の一部。 */
  text: string;
  /** `text` の先頭が原文の何文字目か（1始まり）。1 なら行頭から。 */
  snippetStart: number;
  /** 一致そのものの文字数（原文上）。 */
  matchLength: number;
  /** 原文の行の全文字数（末尾を切ったかの表示に使う）。 */
  lineLength: number;
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
  /** 一致が1件以上あったファイル数（走査数とは別）。 */
  totalFilesMatched: number;
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
): Promise<{ backupWarning: string | null }> {
  return invoke<{ backupWarning: string | null }>("rename_workspace_entry", { src, dst, workspaceRoot });
}

export async function moveWorkspaceEntry(
  src: string,
  dst: string,
  workspaceRoot: string,
): Promise<{ backupWarning: string | null }> {
  return invoke<{ backupWarning: string | null }>("move_workspace_entry", { src, dst, workspaceRoot });
}

export async function moveWorkspaceEntryToTrash(
  path: string,
  workspaceRoot: string,
): Promise<{ backupWarning: string | null }> {
  return invoke<{ backupWarning: string | null }>("move_workspace_entry_to_trash", { path, workspaceRoot });
}
