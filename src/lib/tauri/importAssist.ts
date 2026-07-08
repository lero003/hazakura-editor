import { invoke } from "@tauri-apps/api/core";

export type ImportDraftResult = {
  markdown: string;
  sourceName: string;
  pageCount: number;
  usedOcr: boolean;
  fixture: boolean;
};

export async function importSourceToMarkdown(
  path: string,
): Promise<ImportDraftResult> {
  return invoke<ImportDraftResult>("import_source_to_markdown", { path });
}
