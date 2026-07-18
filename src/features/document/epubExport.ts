import { renderMarkdown } from "../editor/markdown";
import { applyEbookPageBreakMarkers } from "../editor/ebookChapters";
import { resolveLocalMarkdownLinkTarget } from "../editor/markdownLinks";
import { parseMarkdownStructure } from "../editor/markdownStructure";
import {
  blockedImageWarningLabel,
  type MediaImageAccessOptions,
} from "../editor/imagePolicy";
import {
  escapeXml,
  extensionFromMediaType,
  normalizeImageMediaType,
  slugify,
  stripYamlFrontmatter,
  titleFromDocumentName,
} from "./epubTextHelpers";
import { extractInlineMarkdownLinksBounded } from "../okf/okfLinks";
import {
  directoryPathFromPath,
  isPathInsideDirectory,
  normalizeAbsolutePath,
} from "../../lib/utils";
import type { BookScopeNode } from "../bookScope/model";

type BuildEpubBetaArchiveOptions = {
  bookNavigation?: readonly BookScopeNode[];
  chapters?: readonly EpubExportChapter[];
  documentPath?: string | null;
  documentName: string;
  loadApprovedLocalImage?: (absolutePath: string) => Promise<LoadedEpubImage>;
  loadRemoteImage?: (url: string) => Promise<LoadedEpubImage>;
  loadWorkspaceImage?: (absolutePath: string) => Promise<LoadedEpubImage>;
  mediaAccess?: MediaImageAccessOptions | null;
  metadata?: Partial<EpubExportMetadata>;
  markdown: string;
  workspaceRoot?: string | null;
};

export type EpubExportChapter = {
  documentName: string;
  documentPath: string;
  markdown: string;
};

export type EpubExportMetadata = {
  author: string;
  language: string;
  modified: string;
  title: string;
};

export type EpubExportSettings = Pick<
  EpubExportMetadata,
  "author" | "language" | "title"
>;

export type EpubExportWarning = {
  label: string | null;
  type: "image-unavailable";
};

export type EpubExportArchiveReport = {
  archive: Uint8Array;
  warnings: EpubExportWarning[];
};

type EpubEntry = {
  path: string;
  bytes: Uint8Array;
};

type HeadingEntry = {
  chapterIndex: number;
  contentPath: string;
  id: string;
  level: number;
  text: string;
};

type MarkdownHeadingEntry = {
  chapterIndex: number;
  level: number;
  text: string;
  navigationLabel: string | null;
};

type ContentDocument = {
  body: string;
  chapterIndex: number;
  id: string;
  navigationLabel: string | null;
  path: string;
};

type ContentDocumentNodes = {
  chapterIndex: number;
  id: string;
  navigationLabel: string | null;
  nodes: ChildNode[];
  path: string;
};

type NavigationNode = {
  children: NavigationNode[];
  href: string | null;
  text: string;
};

type LoadedEpubImage =
  | {
      bytes: Uint8Array;
      extension?: string;
      mediaType: string;
    }
  | {
      dataUrl: string;
    };

type ImageEntry = EpubEntry & {
  id: string;
  mediaType: string;
  relativePath: string;
};

const encoder = new TextEncoder();
const WORKSPACE_IMAGE_PATH_ATTR = "data-hazakura-image-path";
const IMAGE_ORIGIN_ATTR = "data-hazakura-image-origin";
const REMOTE_IMAGE_URL_ATTR = "data-hazakura-image-remote";
const EPUB_CHAPTER_INDEX_ATTR = "data-hazakura-epub-chapter-index";

export async function buildEpubBetaArchive({
  bookNavigation,
  chapters,
  documentPath = null,
  documentName,
  loadApprovedLocalImage,
  loadRemoteImage,
  loadWorkspaceImage,
  mediaAccess = null,
  metadata,
  markdown,
  workspaceRoot = null,
}: BuildEpubBetaArchiveOptions): Promise<Uint8Array> {
  const { archive } = await buildEpubBetaArchiveWithReport({
    bookNavigation,
    chapters,
    documentPath,
    documentName,
    loadApprovedLocalImage,
    loadRemoteImage,
    loadWorkspaceImage,
    mediaAccess,
    metadata,
    markdown,
    workspaceRoot,
  });
  return archive;
}

export async function buildEpubBetaArchiveWithReport({
  bookNavigation,
  chapters,
  documentPath = null,
  documentName,
  loadApprovedLocalImage,
  loadRemoteImage,
  loadWorkspaceImage,
  mediaAccess = null,
  metadata,
  markdown,
  workspaceRoot = null,
}: BuildEpubBetaArchiveOptions): Promise<EpubExportArchiveReport> {
  const { contentDocuments, images, navigation, title, warnings } =
    await buildContent({
      bookNavigation,
      chapters,
      documentName,
      documentPath,
      loadApprovedLocalImage,
      loadRemoteImage,
      loadWorkspaceImage,
      mediaAccess,
      markdown,
      workspaceRoot,
    });
  const epubMetadata = normalizeEpubMetadata(metadata, title);
  const entries: EpubEntry[] = [
    textEntry("mimetype", "application/epub+zip"),
    textEntry("META-INF/container.xml", containerXml()),
    textEntry(
      "OEBPS/package.opf",
      packageOpf(
        epubMetadata,
        images,
        createEpubIdentifier(),
        contentDocuments,
      ),
    ),
    textEntry(
      "OEBPS/nav.xhtml",
      navXhtml(
        epubMetadata.title,
        epubMetadata.language,
        navigation,
      ),
    ),
    ...contentDocuments.map((contentDocument) =>
      textEntry(
        `OEBPS/${contentDocument.path}`,
        contentXhtml(
          epubMetadata.title,
          epubMetadata.language,
          contentDocument.body,
        ),
      ),
    ),
    textEntry("OEBPS/styles.css", epubCss()),
    ...images,
  ];

  return {
    archive: buildStoredZip(entries),
    warnings,
  };
}

export function defaultEpubExportSettings({
  documentName,
  markdown,
}: {
  documentName: string;
  markdown: string;
}): EpubExportSettings {
  const contentMarkdown = stripYamlFrontmatter(markdown);
  const firstHeading = collectMarkdownHeadings(contentMarkdown, 0).find(
    (heading) => heading.navigationLabel !== null,
  );
  const title = firstHeading
    ? markdownInlineText(firstHeading.text)
    : titleFromDocumentName(documentName);

  return {
    author: "",
    language: "ja",
    title,
  };
}

async function buildContent({
  bookNavigation,
  chapters,
  documentName,
  documentPath,
  loadApprovedLocalImage,
  loadRemoteImage,
  loadWorkspaceImage,
  mediaAccess,
  markdown,
  workspaceRoot,
}: Required<Pick<BuildEpubBetaArchiveOptions, "documentName" | "markdown">> &
  Pick<
    BuildEpubBetaArchiveOptions,
    | "chapters"
    | "bookNavigation"
    | "documentPath"
    | "loadApprovedLocalImage"
    | "loadRemoteImage"
    | "loadWorkspaceImage"
    | "mediaAccess"
    | "workspaceRoot"
  >) {
  const bookChapters = chapters?.length ? chapters : null;
  const contentMarkdown = bookChapters
    ? bookChapters
        .map((chapter) => stripYamlFrontmatter(chapter.markdown))
        .join("\n\n")
    : stripYamlFrontmatter(markdown);
  const rendered = bookChapters
    ? bookChapters
        .map((chapter, index) =>
          `<span ${EPUB_CHAPTER_INDEX_ATTR}="${index}" hidden="hidden"></span>${renderMarkdown(
            applyEbookPageBreakMarkers(stripYamlFrontmatter(chapter.markdown)),
            {
              documentPath: chapter.documentPath,
              mediaAccess,
              workspaceRoot,
            },
          )}`,
        )
        .join(
          '<div class="page-break" role="separator" aria-label="Page break"></div>',
        )
    : renderMarkdown(applyEbookPageBreakMarkers(contentMarkdown), {
        documentPath,
        mediaAccess,
        workspaceRoot,
      });
  const template = document.createElement("template");
  template.innerHTML = rendered;
  const markdownHeadings = bookChapters
    ? bookChapters.flatMap((chapter, chapterIndex) =>
        collectMarkdownHeadings(
          stripYamlFrontmatter(chapter.markdown),
          chapterIndex,
        ),
      )
    : collectMarkdownHeadings(contentMarkdown, 0);
  const warnings: EpubExportWarning[] = [];
  const images = await packageWorkspaceImages(
    template,
    warnings,
    loadWorkspaceImage,
    loadApprovedLocalImage,
    loadRemoteImage,
  );
  cleanupPreviewOnlyMarkup(template, warnings);
  const headingElements = Array.from(
    template.content.querySelectorAll("h1, h2, h3, h4, h5, h6"),
  );
  const pendingHeadings: Omit<HeadingEntry, "contentPath">[] = [];
  const usedIds = new Set<string>();

  let sourceHeadingIndex = 0;
  headingElements.forEach((heading) => {
    const sourceHeading = markdownHeadings[sourceHeadingIndex];
    const text = heading.textContent?.trim() || "";
    const sourceText = sourceHeading
      ? markdownInlineText(sourceHeading.text)
      : "";

    if (!sourceHeading || text !== sourceText) {
      return;
    }

    sourceHeadingIndex += 1;
    if (sourceHeading.navigationLabel === null) {
      return;
    }

    const id = uniqueId(
      slugify(text) || `section-${pendingHeadings.length + 1}`,
      usedIds,
    );
    heading.setAttribute("id", id);
    pendingHeadings.push({
      chapterIndex: sourceHeading.chapterIndex,
      id,
      level: sourceHeading.level,
      text,
    });
  });

  const { contentDocumentNodes, headingContentPaths } =
    splitTemplateContentIntoDocumentNodes(
      template.content,
      bookChapters?.map((chapter) => titleFromDocumentName(chapter.documentName)) ?? [],
    );
  const firstContentPath = contentDocumentNodes[0]?.path ?? "content.xhtml";
  const headings = pendingHeadings.map((heading) => ({
    ...heading,
    contentPath: headingContentPaths.get(heading.id) ?? firstContentPath,
  }));
  if (bookChapters && workspaceRoot) {
    rewritePackagedMarkdownLinks(
      contentDocumentNodes,
      headings,
      bookChapters,
      workspaceRoot,
    );
  }
  const contentDocuments = serializeContentDocuments(contentDocumentNodes);
  const navigation = buildNavigation(
    headings,
    contentDocuments,
    bookChapters,
    workspaceRoot,
    bookNavigation,
  );
  const title = headings[0]?.text || titleFromDocumentName(documentName);

  return { contentDocuments, images, navigation, title, warnings };
}

function collectMarkdownHeadings(
  markdown: string,
  chapterIndex: number,
): MarkdownHeadingEntry[] {
  return parseMarkdownStructure(markdown).headings.map((heading) => ({
    chapterIndex,
    level: heading.level,
    text: heading.text,
    navigationLabel: heading.navigationLabel,
  }));
}

function splitTemplateContentIntoDocumentNodes(
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

function serializeContentDocuments(
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

function rewritePackagedMarkdownLinks(
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

async function packageWorkspaceImages(
  template: HTMLTemplateElement,
  warnings: EpubExportWarning[],
  loadWorkspaceImage?: (absolutePath: string) => Promise<LoadedEpubImage>,
  loadApprovedLocalImage?: (absolutePath: string) => Promise<LoadedEpubImage>,
  loadRemoteImage?: (url: string) => Promise<LoadedEpubImage>,
): Promise<ImageEntry[]> {
  const images: ImageEntry[] = [];
  const imageElements = Array.from(template.content.querySelectorAll("img"));

  for (const image of imageElements) {
    const workspacePath = image.getAttribute(WORKSPACE_IMAGE_PATH_ATTR);
    const remoteUrl = image.getAttribute(REMOTE_IMAGE_URL_ATTR);
    const origin = image.getAttribute(IMAGE_ORIGIN_ATTR) ?? "workspace";
    const dataSrc = image.getAttribute("src")?.trim() ?? "";

    if (!workspacePath && !remoteUrl && isSupportedImageDataUrl(dataSrc)) {
      try {
        const asset = imageAssetFromDataUrl(dataSrc);
        addImageAsset(image, images, asset);
      } catch {
        replaceImageWithWarning(image, warnings);
      }
      continue;
    }

    const reference = remoteUrl ?? workspacePath;
    const loader = remoteUrl
      ? loadRemoteImage
      : origin === "approved-local"
        ? loadApprovedLocalImage
        : loadWorkspaceImage;

    if (!reference || !loader) {
      replaceImageWithWarning(image, warnings);
      continue;
    }

    try {
      const loaded = await loader(reference);
      const asset = normalizeLoadedImage(loaded);
      addImageAsset(image, images, asset);
    } catch {
      replaceImageWithWarning(image, warnings);
    }
  }

  return images;
}

function replaceImageWithWarning(
  image: HTMLImageElement,
  warnings: EpubExportWarning[],
): void {
  const label = image.getAttribute("alt")?.trim() || null;
  warnings.push({
    label,
    type: "image-unavailable",
  });
  image.replaceWith(epubWarningMessage(label));
}

function addImageAsset(
  image: HTMLImageElement,
  images: ImageEntry[],
  asset: { bytes: Uint8Array; extension: string; mediaType: string },
): void {
  const index = images.length + 1;
  const id = `image-${index}`;
  const relativePath = `images/${id}.${asset.extension}`;
  image.setAttribute("src", relativePath);
  image.removeAttribute(WORKSPACE_IMAGE_PATH_ATTR);
  image.removeAttribute(REMOTE_IMAGE_URL_ATTR);
  image.removeAttribute(IMAGE_ORIGIN_ATTR);
  image.removeAttribute("loading");
  image.removeAttribute("decoding");
  images.push({
    bytes: asset.bytes,
    id,
    mediaType: asset.mediaType,
    path: `OEBPS/${relativePath}`,
    relativePath,
  });
}

function cleanupPreviewOnlyMarkup(
  template: HTMLTemplateElement,
  warnings: EpubExportWarning[],
): void {
  for (const frame of Array.from(
    template.content.querySelectorAll<HTMLElement>(".markdown-table-frame"),
  )) {
    const table = frame.querySelector("table");
    if (table) {
      frame.replaceWith(table);
    }
  }

  for (const checkbox of Array.from(
    template.content.querySelectorAll<HTMLElement>(".markdown-task-checkbox"),
  )) {
    const checked = checkbox.getAttribute("aria-checked") === "true";
    checkbox.parentElement?.classList.remove("markdown-task-list-item");
    checkbox.replaceWith(document.createTextNode(checked ? "[x]" : "[ ]"));
  }

  for (const blocked of Array.from(
    template.content.querySelectorAll<HTMLElement>(".blocked-image"),
  )) {
    const label = blockedImageWarningLabel(blocked);
    warnings.push({
      label,
      type: "image-unavailable",
    });
    blocked.replaceWith(epubWarningMessage(label));
  }
}

function epubWarningMessage(label?: string | null): HTMLSpanElement {
  const warning = document.createElement("span");
  warning.setAttribute("role", "note");
  const cleanLabel = label?.trim();
  warning.textContent = cleanLabel
    ? `Image unavailable: ${cleanLabel}`
    : "Image unavailable.";
  return warning;
}

function normalizeLoadedImage(loaded: LoadedEpubImage): {
  bytes: Uint8Array;
  extension: string;
  mediaType: string;
} {
  if ("bytes" in loaded) {
    const mediaType = normalizeImageMediaType(loaded.mediaType);
    return {
      bytes: loaded.bytes,
      extension: loaded.extension ?? extensionFromMediaType(mediaType),
      mediaType,
    };
  }

  return imageAssetFromDataUrl(loaded.dataUrl);
}

function markdownInlineText(markdown: string): string {
  const template = document.createElement("template");
  template.innerHTML = renderMarkdown(markdown);
  return template.content.textContent?.trim() || markdown.trim();
}

function isSupportedImageDataUrl(src: string): boolean {
  return /^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(src);
}

function imageAssetFromDataUrl(dataUrl: string): {
  bytes: Uint8Array;
  extension: string;
  mediaType: string;
} {
  const match = /^data:(image\/(?:png|jpe?g|gif|webp));base64,([\s\S]+)$/i.exec(
    dataUrl,
  );
  if (!match) {
    throw new Error("Unsupported EPUB image data URL");
  }

  const binary = atob(match[2].replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return {
    bytes,
    extension: extensionFromMediaType(match[1]),
    mediaType: normalizeImageMediaType(match[1]),
  };
}

function containerXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/package.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
`;
}

function normalizeEpubMetadata(
  metadata: Partial<EpubExportMetadata> | undefined,
  fallbackTitle: string,
): EpubExportMetadata {
  return {
    author: metadata?.author?.trim() ?? "",
    language: metadata?.language?.trim() || "ja",
    modified: metadata?.modified?.trim() || "2026-01-01T00:00:00Z",
    title: metadata?.title?.trim() || fallbackTitle,
  };
}

function packageOpf(
  metadata: EpubExportMetadata,
  images: ImageEntry[],
  identifier: string,
  contentDocuments: ContentDocument[],
): string {
  const escapedTitle = escapeXml(metadata.title);
  const escapedIdentifier = escapeXml(identifier);
  const creator = metadata.author
    ? `    <dc:creator>${escapeXml(metadata.author)}</dc:creator>\n`
    : "";
  const contentItems = contentDocuments
    .map(
      (contentDocument) =>
        `    <item id="${escapeXml(contentDocument.id)}" href="${escapeXml(
          contentDocument.path,
        )}" media-type="application/xhtml+xml"/>`,
    )
    .join("\n");
  const imageItems = images
    .map(
      (image) =>
        `    <item id="${escapeXml(image.id)}" href="${escapeXml(
          image.relativePath,
        )}" media-type="${escapeXml(image.mediaType)}"/>`,
    )
    .join("\n");
  const manifestImageItems = imageItems.length > 0 ? `${imageItems}\n` : "";
  const spineItems = contentDocuments
    .map(
      (contentDocument) =>
        `    <itemref idref="${escapeXml(contentDocument.id)}"/>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<package version="3.0" unique-identifier="book-id" xmlns="http://www.idpf.org/2007/opf">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">${escapedIdentifier}</dc:identifier>
    <dc:title>${escapedTitle}</dc:title>
${creator}    <dc:language>${escapeXml(metadata.language)}</dc:language>
    <meta property="dcterms:modified">${escapeXml(metadata.modified)}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
${contentItems}
    <item id="style" href="styles.css" media-type="text/css"/>
${manifestImageItems}  </manifest>
  <spine>
${spineItems}
  </spine>
</package>
`;
}

function createEpubIdentifier(): string {
  return `urn:uuid:${createUuid()}`;
}

function createUuid(): string {
  const randomUUID = globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
  if (randomUUID) {
    return randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

function buildNavigation(
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

function navXhtml(
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

function contentXhtml(title: string, language: string, body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="${escapeXml(language)}" xml:lang="${escapeXml(language)}">
<head>
  <meta charset="utf-8"/>
  <title>${escapeXml(title)}</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
${body}
</body>
</html>
`;
}

function epubCss(): string {
  return `body {
  font-family: serif;
  line-height: 1.7;
}
pre, code {
  font-family: monospace;
}
img {
  max-width: 100%;
}
table {
  border-collapse: collapse;
  margin: 1em 0;
  width: 100%;
}
th, td {
  border: 1px solid #d9d4cc;
  padding: 0.35em 0.55em;
  vertical-align: top;
}
th {
  background: #f7f3ed;
  font-weight: 600;
}
.page-break {
  break-before: page;
  height: 0;
  margin: 0;
  page-break-before: always;
}
`;
}

function textEntry(path: string, contents: string): EpubEntry {
  return { path, bytes: encoder.encode(contents) };
}

function buildStoredZip(entries: EpubEntry[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  const centralDirectory: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const fileName = encoder.encode(entry.path);
    const crc = crc32(entry.bytes);
    const localHeader = localFileHeader(fileName, entry.bytes.length, crc);
    chunks.push(localHeader, entry.bytes);
    centralDirectory.push(
      centralDirectoryHeader(fileName, entry.bytes.length, crc, offset),
    );
    offset += localHeader.length + entry.bytes.length;
  }

  const centralDirectoryOffset = offset;
  const centralDirectorySize = centralDirectory.reduce(
    (sum, bytes) => sum + bytes.length,
    0,
  );
  chunks.push(...centralDirectory);
  chunks.push(
    endOfCentralDirectory(
      entries.length,
      centralDirectorySize,
      centralDirectoryOffset,
    ),
  );

  return concatBytes(chunks);
}

function localFileHeader(
  fileName: Uint8Array,
  size: number,
  crc: number,
): Uint8Array {
  const header = new Uint8Array(30 + fileName.length);
  const view = new DataView(header.buffer);
  writeUint32(view, 0, 0x04034b50);
  writeUint16(view, 4, 20);
  writeUint16(view, 6, 0);
  writeUint16(view, 8, 0);
  writeUint16(view, 10, 0);
  writeUint16(view, 12, 0);
  writeUint32(view, 14, crc);
  writeUint32(view, 18, size);
  writeUint32(view, 22, size);
  writeUint16(view, 26, fileName.length);
  writeUint16(view, 28, 0);
  header.set(fileName, 30);
  return header;
}

function centralDirectoryHeader(
  fileName: Uint8Array,
  size: number,
  crc: number,
  offset: number,
): Uint8Array {
  const header = new Uint8Array(46 + fileName.length);
  const view = new DataView(header.buffer);
  writeUint32(view, 0, 0x02014b50);
  writeUint16(view, 4, 20);
  writeUint16(view, 6, 20);
  writeUint16(view, 8, 0);
  writeUint16(view, 10, 0);
  writeUint16(view, 12, 0);
  writeUint16(view, 14, 0);
  writeUint32(view, 16, crc);
  writeUint32(view, 20, size);
  writeUint32(view, 24, size);
  writeUint16(view, 28, fileName.length);
  writeUint16(view, 30, 0);
  writeUint16(view, 32, 0);
  writeUint16(view, 34, 0);
  writeUint16(view, 36, 0);
  writeUint32(view, 38, 0);
  writeUint32(view, 42, offset);
  header.set(fileName, 46);
  return header;
}

function endOfCentralDirectory(
  entryCount: number,
  centralDirectorySize: number,
  centralDirectoryOffset: number,
): Uint8Array {
  const header = new Uint8Array(22);
  const view = new DataView(header.buffer);
  writeUint32(view, 0, 0x06054b50);
  writeUint16(view, 4, 0);
  writeUint16(view, 6, 0);
  writeUint16(view, 8, entryCount);
  writeUint16(view, 10, entryCount);
  writeUint32(view, 12, centralDirectorySize);
  writeUint32(view, 16, centralDirectoryOffset);
  writeUint16(view, 20, 0);
  return header;
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function writeUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value >>> 0, true);
}

function uniqueId(base: string, usedIds: Set<string>): string {
  let candidate = base;
  let suffix = 2;

  while (usedIds.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  usedIds.add(candidate);
  return candidate;
}
