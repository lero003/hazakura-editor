import { resolveLocalMarkdownLinkTarget } from "../editor/markdownLinks";
import { isPathInsideDirectory, normalizeAbsolutePath } from "../../lib/utils";
import { slugify } from "./epubTextHelpers";
import type { ContentDocumentNodes, EpubExportChapter, HeadingEntry } from "./epubContentDocuments";

export function rewritePackagedMarkdownLinks(
  documents: readonly ContentDocumentNodes[],
  headings: readonly HeadingEntry[],
  chapters: readonly EpubExportChapter[],
  workspaceRoot: string,
): void {
  const chapterByPath = new Map(
    chapters.map((chapter, index) => [
      normalizeAbsolutePath(chapter.documentPath),
      index,
    ] as const),
  );
  const firstDocumentByChapter = new Map<number, ContentDocumentNodes>();
  for (const contentDocument of documents) {
    if (!firstDocumentByChapter.has(contentDocument.chapterIndex)) {
      firstDocumentByChapter.set(contentDocument.chapterIndex, contentDocument);
    }
  }

  for (const contentDocument of documents) {
    const sourceChapter = chapters[contentDocument.chapterIndex];
    if (!sourceChapter) continue;

    for (const anchor of anchorsInNodes(contentDocument.nodes)) {
      const href = anchor.getAttribute("href")?.trim() ?? "";
      let targetChapterIndex: number | undefined;
      if (href.startsWith("#")) {
        targetChapterIndex = contentDocument.chapterIndex;
      } else {
        const targetPath = resolvePackagedMarkdownLinkTarget(
          href,
          sourceChapter.documentPath,
          workspaceRoot,
        );
        if (!targetPath) continue;
        targetChapterIndex =
          chapterByPath.get(targetPath) ??
          chapterByPath.get(normalizeAbsolutePath(`${targetPath}/index.md`));
      }
      if (targetChapterIndex === undefined) continue;

      const targetHeading = targetHeadingForLink(
        headings.filter((heading) => heading.chapterIndex === targetChapterIndex),
        href,
      );
      if (hasLinkFragment(href) && !targetHeading) continue;
      const targetDocument = targetHeading
        ? documents.find((document) => document.path === targetHeading.contentPath)
        : firstDocumentByChapter.get(targetChapterIndex);
      if (!targetDocument) continue;

      anchor.setAttribute(
        "href",
        `${targetDocument.path}${targetHeading ? `#${targetHeading.id}` : ""}`,
      );
    }
  }
}

function resolvePackagedMarkdownLinkTarget(
  href: string,
  sourcePath: string,
  workspaceRoot: string,
): string | null {
  const trimmed = href.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return resolveLocalMarkdownLinkTarget(trimmed, sourcePath, workspaceRoot);
  }
  const hrefWithoutAnchor = trimmed.split("#", 1)[0] ?? "";
  const hrefPath = hrefWithoutAnchor.split("?", 1)[0]?.trim() ?? "";
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(hrefPath.slice(1));
  } catch {
    return null;
  }
  if (!decodedPath || decodedPath.includes("\0") || decodedPath.startsWith("/")) {
    return null;
  }
  const root = normalizeAbsolutePath(workspaceRoot);
  const target = normalizeAbsolutePath(`${root}/${decodedPath}`);
  return isPathInsideDirectory(target, root) ? target : null;
}

function anchorsInNodes(nodes: readonly ChildNode[]): HTMLAnchorElement[] {
  const anchors: HTMLAnchorElement[] = [];
  for (const node of nodes) {
    if (!(node instanceof Element)) continue;
    if (node.matches("a[href]")) {
      anchors.push(node as HTMLAnchorElement);
    }
    anchors.push(...Array.from(node.querySelectorAll<HTMLAnchorElement>("a[href]")));
  }
  return anchors;
}

function targetHeadingForLink(
  headings: readonly HeadingEntry[],
  href: string,
): HeadingEntry | null {
  const hashIndex = href.indexOf("#");
  if (hashIndex === -1 || hashIndex === href.length - 1) {
    return headings[0] ?? null;
  }
  const encodedFragment = href.slice(hashIndex + 1).split("?", 1)[0] ?? "";
  let fragment = encodedFragment;
  try {
    fragment = decodeURIComponent(encodedFragment);
  } catch {
    // Keep the literal fragment for a conservative best-effort match.
  }
  const normalizedFragment = slugify(fragment);
  return (
    headings.find(
      (heading) =>
        heading.id === fragment || slugify(heading.text) === normalizedFragment,
    ) ?? null
  );
}

function hasLinkFragment(href: string): boolean {
  const hashIndex = href.indexOf("#");
  return hashIndex !== -1 && hashIndex < href.length - 1;
}
