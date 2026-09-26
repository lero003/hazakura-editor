import type { BookScopeNode } from "../bookScope/model";
import { resolveLocalMarkdownLinkTarget } from "../editor/markdownLinks";
import { extractInlineMarkdownLinksBounded } from "../okf/okfLinks";
import { directoryPathFromPath, isPathInsideDirectory, normalizeAbsolutePath } from "../../lib/utils";
import { escapeXml, titleFromDocumentName } from "./epubTextHelpers";
import type { ContentDocument, EpubExportChapter, HeadingEntry } from "./epubContentDocuments";

type NavigationNode = {
  children: NavigationNode[];
  href: string | null;
  text: string;
};

export function buildNavigation(
  headings: readonly HeadingEntry[],
  contentDocuments: readonly ContentDocument[],
  chapters: readonly EpubExportChapter[] | null,
  workspaceRoot: string | null | undefined,
  bookNavigation: readonly BookScopeNode[] | null | undefined,
): NavigationNode[] {
  if (!chapters?.length) {
    return headingNavigationTree(headings);
  }

  const chapterNodes = new Map<number, NavigationNode>();
  for (let chapterIndex = 0; chapterIndex < chapters.length; chapterIndex += 1) {
    const chapterHeadings = headings.filter(
      (heading) => heading.chapterIndex === chapterIndex,
    );
    const firstDocument = contentDocuments.find(
      (contentDocument) => contentDocument.chapterIndex === chapterIndex,
    );
    chapterNodes.set(
      chapterIndex,
      chapterNavigationNode(
        chapterHeadings,
        firstDocument,
        titleFromDocumentName(chapters[chapterIndex].documentName),
      ),
    );
  }

  if (!workspaceRoot) {
    return chapters.flatMap((_, index) => {
      const node = chapterNodes.get(index);
      return node ? [node] : [];
    });
  }

  const chapterByPath = new Map(
    chapters.map((chapter, index) => [
      normalizeAbsolutePath(chapter.documentPath),
      index,
    ] as const),
  );
  if (bookNavigation?.length) {
    return buildBookScopeNavigation(
      bookNavigation,
      chapterNodes,
      chapterByPath,
      chapters,
      workspaceRoot,
    );
  }
  const rootIndexPath = normalizeAbsolutePath(`${workspaceRoot}/index.md`);
  const rootIndex = chapterByPath.get(rootIndexPath);
  const claimed = new Set<number>();

  const visitChapter = (
    chapterIndex: number,
    ancestors: ReadonlySet<number>,
  ): NavigationNode | null => {
    const sourceNode = chapterNodes.get(chapterIndex);
    const chapter = chapters[chapterIndex];
    if (!sourceNode || !chapter) return null;

    claimed.add(chapterIndex);
    const node: NavigationNode = {
      ...sourceNode,
      children: isIndexDocument(chapter.documentName)
        ? []
        : sourceNode.children,
    };
    if (!isIndexDocument(chapter.documentName)) return node;

    const nextAncestors = new Set(ancestors);
    nextAncestors.add(chapterIndex);
    const indexPath = normalizeAbsolutePath(chapter.documentPath);
    const indexDirectory = directoryPathFromPath(indexPath);
    const links = extractInlineMarkdownLinksBounded(chapter.markdown, 500).links;

    for (const link of links) {
      const resolved = resolveLocalMarkdownLinkTarget(
        link.destination,
        chapter.documentPath,
        workspaceRoot,
      );
      if (!resolved) continue;
      const targetIndex =
        chapterByPath.get(resolved) ??
        chapterByPath.get(normalizeAbsolutePath(`${resolved}/index.md`));
      if (
        targetIndex === undefined ||
        targetIndex === chapterIndex ||
        nextAncestors.has(targetIndex) ||
        claimed.has(targetIndex)
      ) {
        continue;
      }
      const targetPath = normalizeAbsolutePath(chapters[targetIndex].documentPath);
      if (
        indexPath !== rootIndexPath &&
        !isPathInsideDirectory(targetPath, indexDirectory)
      ) {
        continue;
      }
      const child = visitChapter(targetIndex, nextAncestors);
      if (child) node.children.push(child);
    }
    return node;
  };

  const navigation: NavigationNode[] = [];
  if (rootIndex !== undefined) {
    const root = visitChapter(rootIndex, new Set());
    if (root) navigation.push(root);
  }
  for (let chapterIndex = 0; chapterIndex < chapters.length; chapterIndex += 1) {
    if (claimed.has(chapterIndex)) continue;
    const node = visitChapter(chapterIndex, new Set());
    if (node) navigation.push(node);
  }
  return navigation;
}

function buildBookScopeNavigation(
  nodes: readonly BookScopeNode[],
  chapterNodes: ReadonlyMap<number, NavigationNode>,
  chapterByPath: ReadonlyMap<string, number>,
  chapters: readonly EpubExportChapter[],
  workspaceRoot: string,
): NavigationNode[] {
  const claimed = new Set<number>();
  const visit = (entries: readonly BookScopeNode[]): NavigationNode[] =>
    entries.flatMap((entry): NavigationNode[] => {
      const children = visit(entry.children);
      if (entry.kind === "group") {
        return children.length
          ? [{ children, href: null, text: entry.title }]
          : [];
      }
      const targetPath = normalizeAbsolutePath(
        `${workspaceRoot}/${entry.relativePath}`,
      );
      const chapterIndex = chapterByPath.get(targetPath);
      if (chapterIndex === undefined || claimed.has(chapterIndex)) return children;
      const sourceNode = chapterNodes.get(chapterIndex);
      if (!sourceNode) return children;
      claimed.add(chapterIndex);
      return [
        {
          ...sourceNode,
          children: children.length > 0 ? children : sourceNode.children,
        },
      ];
    });

  const navigation = visit(nodes);
  for (let index = 0; index < chapters.length; index += 1) {
    if (claimed.has(index)) continue;
    const node = chapterNodes.get(index);
    if (node) navigation.push(node);
  }
  return navigation;
}

function chapterNavigationNode(
  headings: readonly HeadingEntry[],
  firstDocument: ContentDocument | undefined,
  fallbackLabel: string,
): NavigationNode {
  const firstHeading = headings[0];
  if (!firstHeading) {
    return {
      children: [],
      href: firstDocument?.path ?? "content.xhtml",
      text: fallbackLabel,
    };
  }
  return {
    children: headingNavigationTree(headings.slice(1)),
    href: `${firstHeading.contentPath}#${firstHeading.id}`,
    text: firstHeading.text,
  };
}

function headingNavigationTree(
  headings: readonly HeadingEntry[],
): NavigationNode[] {
  const roots: NavigationNode[] = [];
  const stack: Array<{ level: number; node: NavigationNode }> = [];
  for (const heading of headings) {
    const node: NavigationNode = {
      children: [],
      href: `${heading.contentPath}#${heading.id}`,
      text: heading.text,
    };
    while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
      stack.pop();
    }
    const parent = stack[stack.length - 1]?.node;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
    stack.push({ level: heading.level, node });
  }
  return roots;
}

function isIndexDocument(documentName: string): boolean {
  return documentName.toLowerCase() === "index.md";
}

export function navXhtml(
  title: string,
  language: string,
  navigation: readonly NavigationNode[],
): string {
  const navItems = navigation.length > 0
    ? serializeNavigationNodes(navigation, 6)
    : `      <li><a href="content.xhtml">本文</a></li>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${escapeXml(language)}" xml:lang="${escapeXml(language)}">
<head>
  <meta charset="utf-8"/>
  <title>${escapeXml(title)} - Navigation</title>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Table of Contents</h1>
    <ol>
${navItems}
    </ol>
  </nav>
</body>
</html>
`;
}

function serializeNavigationNodes(
  nodes: readonly NavigationNode[],
  indentation: number,
): string {
  const padding = " ".repeat(indentation);
  return nodes
    .map((node) => {
      const link = node.href
        ? `<a href="${escapeXml(node.href)}">${escapeXml(node.text)}</a>`
        : `<span>${escapeXml(node.text)}</span>`;
      if (node.children.length === 0) {
        return `${padding}<li>${link}</li>`;
      }
      return [
        `${padding}<li>${link}`,
        `${padding}  <ol>`,
        serializeNavigationNodes(node.children, indentation + 4),
        `${padding}  </ol>`,
        `${padding}</li>`,
      ].join("\n");
    })
    .join("\n");
}
