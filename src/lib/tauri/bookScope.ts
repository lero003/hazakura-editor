import { invoke } from "@tauri-apps/api/core";

export type BookScopeChapter = {
  path: string;
  relativePath: string;
  name: string;
};

export type BookScopeEntryStatus =
  | "available"
  | "missing"
  | "duplicate"
  | "invalid-path"
  | "unsupported-extension"
  | "symlink"
  | "not-file"
  | "outside-workspace"
  | "unreadable";

export type BookScopeUnavailableEntry = {
  relativePath: string;
  reason: Exclude<BookScopeEntryStatus, "available">;
};

export type BookScopeResolveResult = {
  chapters: BookScopeChapter[];
  unavailable: BookScopeUnavailableEntry[];
};

export async function resolveBookScope(
  workspaceRoot: string,
  chapterRelativePaths: string[],
): Promise<BookScopeResolveResult> {
  return invoke<BookScopeResolveResult>("resolve_book_scope", {
    workspaceRoot,
    chapterRelativePaths,
  });
}
