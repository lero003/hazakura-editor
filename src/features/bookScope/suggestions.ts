import {
  classifyOkfInlineLink,
  extractInlineMarkdownLinksBounded,
  isReservedOkfFileName,
  normalizeBundleRelativePath,
  type OkfDiscoveryLike,
} from "../okf";
import { directoryFromRelativePath } from "../okf/okfPaths";
import { parseMarkdownStructure } from "../editor/markdownStructure";
import {
  flattenBookScopeNodes,
  MAX_BOOK_SCOPE_CHAPTERS,
  sanitizeBookScopeNodes,
  type BookScopeNode,
} from "./model";

const MAX_INDEX_LINKS = 500;

export type BookScopeSuggestion = {
  nodes: BookScopeNode[];
  chapterRelativePaths: string[];
  linkedChapterCount: number;
  includedIndexPageCount: number;
  excludedSupportFileCount: number;
  unreadableFileCount: number;
  candidateLimitReached: boolean;
  scanIncomplete: boolean;
};

export type BookScopeSuggestionOptions = {
  includeIndexPages: boolean;
};

/**
 * Turn one explicit OKF disk snapshot into an editable Book Scope draft.
 * This is Hazakura ordering advice, not an OKF compatibility claim.
 */
export function suggestBookScopeFromDiscovery(
  discovery: OkfDiscoveryLike,
  options: BookScopeSuggestionOptions,
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
  const rootNodes: BookScopeNode[] = [];
  const linkedChapterPaths = new Set<string>();
  const includedIndexPagePaths = new Set<string>();
  const seen = new Set<string>();
  const visitedIndexes = new Set<string>();
  const readableByPath = new Map(
    readableFiles
      .filter((file) => file.relativePath)
      .map((file) => [file.relativePath, file] as const),
  );
  const rootIndex = readableFiles.find(
    (file) => file.relativePath.toLowerCase() === "index.md",
  );
  if (rootIndex) {
    let remainingLinks = MAX_INDEX_LINKS;
    const visitIndex = (indexPath: string): BookScopeNode[] => {
      if (visitedIndexes.has(indexPath) || remainingLinks <= 0) return [];
      visitedIndexes.add(indexPath);

      const indexFile = readableByPath.get(indexPath);
      if (!indexFile || indexFile.content === null) return [];
      const children: BookScopeNode[] = [];
      const sectionGroups = new Map<number, Extract<BookScopeNode, { kind: "group" }>>();
      if (options.includeIndexPages && !seen.has(indexPath)) {
        linked.push(indexPath);
        seen.add(indexPath);
        includedIndexPagePaths.add(indexPath);
      }
      const indexDirectory = directoryFromRelativePath(indexPath);
      const extracted = extractInlineMarkdownLinksBounded(
        indexFile.content,
        remainingLinks,
      );
      remainingLinks -= extracted.links.length;
      const headings = parseMarkdownStructure(indexFile.content).headings;
      const titleHeading = headings.find((heading) => heading.level === 1) ?? null;

      for (const link of extracted.links) {
        const classified = classifyOkfInlineLink(link.destination, {
          sourceRelativePath: indexPath,
          knownFiles,
          knownDirectories,
        });
        const target = classified.targetRelativePath;
        if (
          classified.kind !== "internal" ||
          classified.broken ||
          !target
        ) {
          continue;
        }
        if (
          indexDirectory &&
          target !== indexDirectory &&
          !target.startsWith(`${indexDirectory}/`)
        ) {
          continue;
        }
        let targetNodes: BookScopeNode[] = [];
        if (eligible.has(target) && !seen.has(target)) {
          linked.push(target);
          seen.add(target);
          linkedChapterPaths.add(target);
          targetNodes = [
            { kind: "document", relativePath: target, children: [] },
          ];
        } else if (fileName(target).toLowerCase() === "index.md") {
          const nested = visitIndex(target);
          targetNodes =
            options.includeIndexPages || nested.length === 0
              ? nested
              : [
                  {
                    kind: "group",
                    title: link.text.trim() || fileName(target),
                    children: nested,
                  },
                ];
        }
        if (targetNodes.length === 0) continue;

        const headingPath: typeof headings = [];
        for (const heading of headings) {
          if (heading.startOffset > link.sourceOffset) break;
          if (heading === titleHeading || !heading.navigationLabel) continue;
          while (
            headingPath.length > 0 &&
            headingPath[headingPath.length - 1].level >= heading.level
          ) {
            headingPath.pop();
          }
          headingPath.push(heading);
        }
        let container = children;
        for (const heading of headingPath) {
          let group = sectionGroups.get(heading.startOffset);
          if (!group) {
            group = {
              kind: "group",
              title: heading.navigationLabel!,
              children: [],
            };
            sectionGroups.set(heading.startOffset, group);
            container.push(group);
          }
          container = group.children;
        }
        container.push(...targetNodes);
      }

      if (options.includeIndexPages) {
        return [
          { kind: "document", relativePath: indexPath, children },
        ];
      }
      return children;
    };

    rootNodes.push(...visitIndex(rootIndex.relativePath));
  }

  const ordered = [
    ...linked,
    ...eligiblePaths.filter((path) => !seen.has(path)),
  ];
  for (const path of eligiblePaths) {
    if (seen.has(path)) continue;
    rootNodes.push({ kind: "document", relativePath: path, children: [] });
  }
  const nodes = sanitizeBookScopeNodes(rootNodes);
  const chapterRelativePaths = flattenBookScopeNodes(nodes);
  const linkedChapterCount = chapterRelativePaths.filter((path) =>
    linkedChapterPaths.has(path),
  ).length;
  const includedIndexPageCount = chapterRelativePaths.filter((path) =>
    includedIndexPagePaths.has(path),
  ).length;

  return {
    nodes,
    chapterRelativePaths,
    linkedChapterCount,
    includedIndexPageCount,
    excludedSupportFileCount:
      normalizedFiles.filter((file) =>
        isReservedOkfFileName(fileName(file.relativePath)),
      ).length - includedIndexPageCount,
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
