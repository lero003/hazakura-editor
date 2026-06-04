import { invoke } from "@tauri-apps/api/core";
import type { EditableLineEnding, TextEncoding } from "../../types";
import { isTauriRuntime } from "./_runtime";

export type TextFileDocument = {
  path: string;
  name: string;
  contents: string;
  line_ending: EditableLineEnding;
  encoding: TextEncoding;
  size: number;
  modified_ms: number | null;
  fingerprint: string;
  large_file_warning: boolean;
};

export type SavedFileState = {
  path: string;
  line_ending: EditableLineEnding;
  encoding: TextEncoding;
  size: number;
  modified_ms: number | null;
  fingerprint: string;
};

export type FileMetadataState = {
  path: string;
  size: number;
  modified_ms: number | null;
  fingerprint: string;
  large_file_warning: boolean;
};

export type ImagePreviewDocument = {
  path: string;
  name: string;
  dataUrl: string;
  size: number;
};

// Cross-window event fired by the main window once the
// `useOpenedFilesListener` hook has drained the pending list
// out of the Rust queue. The name is paired with the
// `drain_opened_files` Tauri command; both halves live in
// `lib/tauri/files.ts` so the file-open surface stays in one
// place.
export const OPENED_FILES_EVENT = "hazakura-note://opened-files";

export async function openTextFile(path: string): Promise<TextFileDocument> {
  return invoke<TextFileDocument>("open_text_file", { path });
}

export async function createTextFile(
  path: string,
  workspaceRoot: string | null,
): Promise<TextFileDocument> {
  return invoke<TextFileDocument>("create_text_file", {
    path,
    workspaceRoot,
  });
}

export async function getFileMetadata(path: string): Promise<FileMetadataState> {
  return invoke<FileMetadataState>("get_file_metadata", { path });
}

export async function saveTextFile(
  path: string,
  contents: string,
  expectedFingerprint: string,
  lineEnding: EditableLineEnding,
  encoding: TextEncoding,
): Promise<SavedFileState> {
  return invoke<SavedFileState>("save_text_file", {
    path,
    contents,
    expectedFingerprint,
    lineEnding,
    encoding,
  });
}

export async function saveTextFileAs(
  path: string,
  contents: string,
  lineEnding: EditableLineEnding,
  encoding: TextEncoding,
  workspaceRoot: string | null,
): Promise<TextFileDocument> {
  return invoke<TextFileDocument>("save_text_file_as", {
    path,
    contents,
    lineEnding,
    encoding,
    workspaceRoot,
  });
}

export async function revealPathInFileManager(path: string): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  await invoke("reveal_path_in_file_manager", { path });
}

export async function openTempPrintHtml(
  htmlContent: string,
  fileName: string,
): Promise<string> {
  return invoke<string>("open_temp_print_html", {
    htmlContent,
    fileName,
  });
}

export async function drainOpenedFiles(): Promise<string[]> {
  if (!isTauriRuntime()) {
    return [];
  }

  return invoke<string[]>("drain_opened_files");
}
