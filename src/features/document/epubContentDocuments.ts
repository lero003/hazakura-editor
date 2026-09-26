// Shared content identities used by chapter splitting, link rewriting and TOC.
export type EpubExportChapter = {
  documentName: string;
  documentPath: string;
  markdown: string;
};

export type HeadingEntry = {
  chapterIndex: number;
  contentPath: string;
  id: string;
  level: number;
  text: string;
};

export type ContentDocument = {
  body: string;
  chapterIndex: number;
  id: string;
  navigationLabel: string | null;
  path: string;
};

export type ContentDocumentNodes = {
  chapterIndex: number;
  id: string;
  navigationLabel: string | null;
  nodes: ChildNode[];
  path: string;
};

export const EPUB_CHAPTER_INDEX_ATTR = "data-hazakura-epub-chapter-index";

export function splitTemplateContentIntoDocumentNodes(
  fragment: DocumentFragment,
  chapterNavigationLabels: readonly string[],
): {
  contentDocumentNodes: ContentDocumentNodes[];
  headingContentPaths: Map<string, string>;
} {
  const documents: ContentDocumentNodes[] = [];
  let currentNodes: ChildNode[] = [];
  let activeChapterIndex = 0;
  let pendingNavigationLabel: string | null = null;

  const pushDocument = () => {
    if (!hasSerializableContent(currentNodes)) {
      currentNodes = [];
      return;
    }
    const index = documents.length;
    documents.push({
      chapterIndex: activeChapterIndex,
      id: contentDocumentId(index),
      navigationLabel: pendingNavigationLabel,
      nodes: currentNodes,
      path: contentDocumentPath(index),
    });
    currentNodes = [];
    pendingNavigationLabel = null;
  };

  for (const node of Array.from(fragment.childNodes)) {
    const chapterIndex = epubChapterIndex(node);
    if (chapterIndex !== null) {
      activeChapterIndex = chapterIndex;
      pendingNavigationLabel = chapterNavigationLabels[chapterIndex] ?? null;
      continue;
    }
    if (isPageBreakElement(node)) {
      pushDocument();
      continue;
    }
    currentNodes.push(node);
  }
  pushDocument();

  if (documents.length === 0) {
    documents.push({
      chapterIndex: 0,
      id: contentDocumentId(0),
      navigationLabel: chapterNavigationLabels[0] ?? null,
      nodes: [],
      path: contentDocumentPath(0),
    });
  }

  const headingContentPaths = new Map<string, string>();
  for (const contentDocument of documents) {
    rememberHeadingContentPaths(
      contentDocument.nodes,
      contentDocument.path,
      headingContentPaths,
    );
  }

  return {
    contentDocumentNodes: documents,
    headingContentPaths,
  };
}

export function serializeContentDocuments(
  documents: readonly ContentDocumentNodes[],
): ContentDocument[] {
  const serializer = new XMLSerializer();
  return documents.map((contentDocument) => ({
    body: contentDocument.nodes
      .map((node) => serializer.serializeToString(node))
      .join("\n"),
    chapterIndex: contentDocument.chapterIndex,
    id: contentDocument.id,
    navigationLabel: contentDocument.navigationLabel,
    path: contentDocument.path,
  }));
}

function epubChapterIndex(node: ChildNode): number | null {
  if (!(node instanceof HTMLElement)) {
    return null;
  }
  const value = node.getAttribute(EPUB_CHAPTER_INDEX_ATTR);
  if (value === null || !/^\d+$/.test(value)) {
    return null;
  }
  return Number(value);
}

function contentDocumentId(index: number): string {
  return `content-${index + 1}`;
}

function contentDocumentPath(index: number): string {
  return index === 0 ? "content.xhtml" : `content-${index + 1}.xhtml`;
}

function hasSerializableContent(nodes: ChildNode[]): boolean {
  return nodes.some(
    (node) => node.nodeType !== Node.TEXT_NODE || node.textContent?.trim(),
  );
}

function isPageBreakElement(node: ChildNode): boolean {
  return (
    node instanceof HTMLElement &&
    node.classList.contains("page-break") &&
    node.getAttribute("role") === "separator" &&
    node.getAttribute("aria-label") === "Page break"
  );
}

function rememberHeadingContentPaths(
  nodes: ChildNode[],
  contentPath: string,
  headingContentPaths: Map<string, string>,
): void {
  for (const node of nodes) {
    if (!(node instanceof Element)) {
      continue;
    }
    if (isHeadingElement(node)) {
      const id = node.getAttribute("id");
      if (id) {
        headingContentPaths.set(id, contentPath);
      }
    }
    for (const heading of Array.from(
      node.querySelectorAll<HTMLElement>(
        "h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]",
      ),
    )) {
      const id = heading.getAttribute("id");
      if (id) {
        headingContentPaths.set(id, contentPath);
      }
    }
  }
}

function isHeadingElement(element: Element): boolean {
  return /^H[1-6]$/.test(element.tagName);
}
