import type { BookScopeChapter } from "../../lib/tauri/bookScope";
import { stripYamlFrontmatter } from "../editor/markdownFrontmatter";

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

export type BookScopeReaderSearchMatch = {
  documentIndex: number;
  occurrenceCount: number;
};

export type BookScopeReaderSearchCorpus = ReadonlyArray<{
  documentIndex: number;
  text: string;
}>;

type ReaderTab = { path: string | null; contents: string };
type ReaderDiskDocument = { contents: string; size: number };

export async function loadBookScopeReaderDocuments(options: {
  chapters: readonly BookScopeChapter[];
  tabs: readonly ReaderTab[];
  openTextFile: (path: string) => Promise<ReaderDiskDocument>;
  maxTotalBytes?: number;
  /** When set, match open tabs by workspace-relative path as well as absolute path. */
  workspaceRoot?: string | null;
}): Promise<BookScopeReaderLoadResult> {
  const maxTotalBytes = Math.max(
    0,
    options.maxTotalBytes ?? MAX_BOOK_READER_TOTAL_BYTES,
  );
  const liveByAbsolutePath = new Map<string, string>();
  const liveByRelativePath = new Map<string, string>();
  const workspaceRoot = options.workspaceRoot
    ? normalizePathKey(options.workspaceRoot.replace(/\/+$/, ""))
    : null;
  for (const tab of options.tabs) {
    if (!tab.path) continue;
    liveByAbsolutePath.set(normalizePathKey(tab.path), tab.contents);
    if (workspaceRoot) {
      const relative = relativePathUnderRoot(tab.path, workspaceRoot);
      if (relative) {
        liveByRelativePath.set(normalizePathKey(relative), tab.contents);
      }
    }
  }
  const documents: BookScopeReaderDocument[] = [];
  const failures: BookScopeReaderLoadResult["failures"] = [];
  const skippedForBudget: string[] = [];
  let totalBytes = 0;

  for (const chapter of options.chapters) {
    const liveSource =
      liveByAbsolutePath.get(normalizePathKey(chapter.path)) ??
      liveByRelativePath.get(normalizePathKey(chapter.relativePath));
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

/**
 * Search only the bounded documents already loaded for the explicit reader.
 * Frontmatter is omitted because the reader does not render it.
 */
export function searchBookScopeReaderDocuments(
  documents: readonly BookScopeReaderDocument[],
  rawQuery: string,
): BookScopeReaderSearchMatch[] {
  return searchBookScopeReaderCorpus(
    createBookScopeReaderSearchCorpus(documents),
    rawQuery,
  );
}

export function createBookScopeReaderSearchCorpus(
  documents: readonly BookScopeReaderDocument[],
): BookScopeReaderSearchCorpus {
  return documents.map((document, documentIndex) => ({
    documentIndex,
    text: normalizeSearchText(
      `${document.name}\n${stripYamlFrontmatter(document.source)}`,
    ),
  }));
}

export function searchBookScopeReaderCorpus(
  corpus: BookScopeReaderSearchCorpus,
  rawQuery: string,
): BookScopeReaderSearchMatch[] {
  const query = normalizeSearchText(rawQuery.trim());
  if (!query) return [];

  return corpus.flatMap(({ documentIndex, text }) => {
    const occurrenceCount = countOccurrences(text, query);
    return occurrenceCount > 0 ? [{ documentIndex, occurrenceCount }] : [];
  });
}

/** NFC so Japanese filenames from different path sources still match. */
function normalizePathKey(path: string): string {
  return path.normalize("NFC");
}

function relativePathUnderRoot(filePath: string, workspaceRoot: string): string | null {
  const path = normalizePathKey(filePath.replace(/\/+$/, ""));
  if (path === workspaceRoot || !path.startsWith(`${workspaceRoot}/`)) {
    return null;
  }
  return path.slice(workspaceRoot.length + 1);
}

function utf8ByteLength(source: string): number {
  return new TextEncoder().encode(source).byteLength;
}

function normalizeSearchText(value: string): string {
  return value.normalize("NFKC").toLowerCase();
}

function countOccurrences(value: string, query: string): number {
  let count = 0;
  let offset = 0;
  while (offset <= value.length - query.length) {
    const index = value.indexOf(query, offset);
    if (index < 0) break;
    count += 1;
    offset = index + query.length;
  }
  return count;
}
