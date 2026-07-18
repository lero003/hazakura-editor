import type { BookScopeChapter } from "../../lib/tauri/bookScope";

export const MAX_BOOK_READER_TOTAL_BYTES = 32 * 1024 * 1024;

export type BookScopeReaderDocument = {
  name: string;
  path: string;
  relativePath: string;
  source: string;
  usesLiveBuffer: boolean;
};

export type BookScopeReaderLoadResult = {
  documents: BookScopeReaderDocument[];
  failures: Array<{ relativePath: string; reason: string }>;
  skippedForBudget: string[];
  totalBytes: number;
  truncated: boolean;
};

type ReaderTab = { path: string | null; contents: string };
type ReaderDiskDocument = { contents: string; size: number };

export async function loadBookScopeReaderDocuments(options: {
  chapters: readonly BookScopeChapter[];
  tabs: readonly ReaderTab[];
  openTextFile: (path: string) => Promise<ReaderDiskDocument>;
  maxTotalBytes?: number;
}): Promise<BookScopeReaderLoadResult> {
  const maxTotalBytes = Math.max(
    0,
    options.maxTotalBytes ?? MAX_BOOK_READER_TOTAL_BYTES,
  );
  const liveBuffers = new Map(
    options.tabs
      .filter((tab): tab is ReaderTab & { path: string } => Boolean(tab.path))
      .map((tab) => [tab.path, tab.contents]),
  );
  const documents: BookScopeReaderDocument[] = [];
  const failures: BookScopeReaderLoadResult["failures"] = [];
  const skippedForBudget: string[] = [];
  let totalBytes = 0;

  for (const chapter of options.chapters) {
    const liveSource = liveBuffers.get(chapter.path);
    try {
      const disk = liveSource === undefined
        ? await options.openTextFile(chapter.path)
        : null;
      const source = liveSource ?? disk?.contents ?? "";
      const byteLength = liveSource === undefined
        ? (disk?.size ?? utf8ByteLength(source))
        : utf8ByteLength(source);
      if (totalBytes + byteLength > maxTotalBytes) {
        skippedForBudget.push(chapter.relativePath);
        continue;
      }
      totalBytes += byteLength;
      documents.push({
        name: chapter.name,
        path: chapter.path,
        relativePath: chapter.relativePath,
        source,
        usesLiveBuffer: liveSource !== undefined,
      });
    } catch (error) {
      failures.push({
        relativePath: chapter.relativePath,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    documents,
    failures,
    skippedForBudget,
    totalBytes,
    truncated: skippedForBudget.length > 0,
  };
}

function utf8ByteLength(source: string): number {
  return new TextEncoder().encode(source).byteLength;
}
