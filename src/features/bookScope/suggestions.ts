import {
  classifyOkfInlineLink,
  extractInlineMarkdownLinksBounded,
  isReservedOkfFileName,
  normalizeBundleRelativePath,
  type OkfDiscoveryLike,
} from "../okf";
import { MAX_BOOK_SCOPE_CHAPTERS } from "./model";

const MAX_INDEX_LINKS = 500;

export type BookScopeSuggestion = {
  chapterRelativePaths: string[];
  linkedChapterCount: number;
  excludedSupportFileCount: number;
  unreadableFileCount: number;
  candidateLimitReached: boolean;
  scanIncomplete: boolean;
};

/**
 * Turn one explicit OKF disk snapshot into an editable Book Scope draft.
 * This is Hazakura ordering advice, not an OKF compatibility claim.
 */
export function suggestBookScopeFromDiscovery(
  discovery: OkfDiscoveryLike,
): BookScopeSuggestion {
  const normalizedFiles = discovery.files.map((file) => ({
    ...file,
    relativePath: normalizeBundleRelativePath(file.relativePath),
  }));
  const readableFiles = normalizedFiles.filter((file) => file.content !== null);
  const knownFiles = new Set(
    normalizedFiles.map((file) => file.relativePath).filter(Boolean),
  );
  const knownDirectories = collectKnownDirectories(knownFiles);
  const eligiblePaths = readableFiles
    .map((file) => file.relativePath)
    .filter((path) => path && !isReservedOkfFileName(fileName(path)))
    .sort(comparePaths);
  const eligible = new Set(eligiblePaths);

  const linked: string[] = [];
  const seen = new Set<string>();
  const rootIndex = readableFiles.find(
    (file) => file.relativePath.toLowerCase() === "index.md",
  );
  if (rootIndex?.content) {
    const extracted = extractInlineMarkdownLinksBounded(
      rootIndex.content,
      MAX_INDEX_LINKS,
    );
    for (const link of extracted.links) {
      const classified = classifyOkfInlineLink(link.destination, {
        sourceRelativePath: rootIndex.relativePath,
        knownFiles,
        knownDirectories,
      });
      const target = classified.targetRelativePath;
      if (
        classified.kind === "internal" &&
        !classified.broken &&
        target &&
        eligible.has(target) &&
        !seen.has(target)
      ) {
        linked.push(target);
        seen.add(target);
      }
    }
  }

  const ordered = [
    ...linked,
    ...eligiblePaths.filter((path) => !seen.has(path)),
  ];

  return {
    chapterRelativePaths: ordered.slice(0, MAX_BOOK_SCOPE_CHAPTERS),
    linkedChapterCount: linked.length,
    excludedSupportFileCount: normalizedFiles.filter((file) =>
      isReservedOkfFileName(fileName(file.relativePath)),
    ).length,
    unreadableFileCount: normalizedFiles.filter((file) => file.content === null)
      .length,
    candidateLimitReached: ordered.length > MAX_BOOK_SCOPE_CHAPTERS,
    scanIncomplete: discovery.truncated || discovery.cancelled,
  };
}

function fileName(path: string): string {
  return path.split("/").at(-1) ?? path;
}

function comparePaths(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function collectKnownDirectories(files: ReadonlySet<string>): Set<string> {
  const directories = new Set<string>([""]);
  for (const path of files) {
    const parts = path.split("/");
    for (let index = 1; index < parts.length; index += 1) {
      directories.add(parts.slice(0, index).join("/"));
    }
  }
  return directories;
}
