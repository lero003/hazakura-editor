import { renderMarkdown } from "../editor/markdown";
import { splitMarkdownIntoChapters } from "../editor/ebookChapters";

type BuildEpubBetaArchiveOptions = {
  documentPath?: string | null;
  documentName: string;
  loadWorkspaceImage?: (absolutePath: string) => Promise<LoadedEpubImage>;
  metadata?: Partial<EpubExportMetadata>;
  markdown: string;
  workspaceRoot?: string | null;
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

type EpubEntry = {
  path: string;
  bytes: Uint8Array;
};

type HeadingEntry = {
  id: string;
  level: number;
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

export async function buildEpubBetaArchive({
  documentPath = null,
  documentName,
  loadWorkspaceImage,
  metadata,
  markdown,
  workspaceRoot = null,
}: BuildEpubBetaArchiveOptions): Promise<Uint8Array> {
  const { body, headings, images, title } = await buildContent({
    documentName,
    documentPath,
    loadWorkspaceImage,
    markdown,
    workspaceRoot,
  });
  const epubMetadata = normalizeEpubMetadata(metadata, title);
  const entries: EpubEntry[] = [
    textEntry("mimetype", "application/epub+zip"),
    textEntry("META-INF/container.xml", containerXml()),
    textEntry(
      "OEBPS/package.opf",
      packageOpf(epubMetadata, images, createEpubIdentifier()),
    ),
    textEntry("OEBPS/nav.xhtml", navXhtml(epubMetadata.title, headings)),
    textEntry("OEBPS/content.xhtml", contentXhtml(epubMetadata.title, body)),
    textEntry("OEBPS/styles.css", epubCss()),
    ...images,
  ];

  return buildStoredZip(entries);
}

export function defaultEpubExportSettings({
  documentName,
  markdown,
}: {
  documentName: string;
  markdown: string;
}): EpubExportSettings {
  const contentMarkdown = stripYamlFrontmatter(markdown);
  const firstHeading = collectMarkdownHeadings(contentMarkdown)[0];
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
  documentName,
  documentPath,
  loadWorkspaceImage,
  markdown,
  workspaceRoot,
}: Required<Pick<BuildEpubBetaArchiveOptions, "documentName" | "markdown">> &
  Pick<
    BuildEpubBetaArchiveOptions,
    "documentPath" | "loadWorkspaceImage" | "workspaceRoot"
  >) {
  const contentMarkdown = stripYamlFrontmatter(markdown);
  const rendered = renderMarkdown(contentMarkdown, {
    documentPath,
    workspaceRoot,
  });
  const template = document.createElement("template");
  template.innerHTML = rendered;
  const markdownHeadings = collectMarkdownHeadings(contentMarkdown);
  const images = await packageWorkspaceImages(template, loadWorkspaceImage);
  cleanupPreviewOnlyMarkup(template);
  const headingElements = Array.from(
    template.content.querySelectorAll("h1, h2, h3, h4, h5, h6"),
  );
  const headings: HeadingEntry[] = [];
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

    const id = uniqueId(
      slugify(text) || `section-${headings.length + 1}`,
      usedIds,
    );
    heading.setAttribute("id", id);
    headings.push({
      id,
      level: sourceHeading.level,
      text,
    });
    sourceHeadingIndex += 1;
  });

  const title = headings[0]?.text || titleFromDocumentName(documentName);
  const serializer = new XMLSerializer();
  const body = Array.from(template.content.childNodes)
    .map((node) => serializer.serializeToString(node))
    .join("\n");

  return { body, headings, images, title };
}

function collectMarkdownHeadings(markdown: string): HeadingEntry[] {
  return splitMarkdownIntoChapters(markdown)
    .filter((chapter) => chapter.headingLevel !== null)
    .map((chapter) => ({
      id: "",
      level: chapter.headingLevel ?? 1,
      text: chapter.headingText ?? "Section",
    }));
}

async function packageWorkspaceImages(
  template: HTMLTemplateElement,
  loadWorkspaceImage?: (absolutePath: string) => Promise<LoadedEpubImage>,
): Promise<ImageEntry[]> {
  const images: ImageEntry[] = [];
  const imageElements = Array.from(template.content.querySelectorAll("img"));

  for (const image of imageElements) {
    const workspacePath = image.getAttribute(WORKSPACE_IMAGE_PATH_ATTR);
    const dataSrc = image.getAttribute("src")?.trim() ?? "";

    if (!workspacePath && isSupportedImageDataUrl(dataSrc)) {
      try {
        const asset = imageAssetFromDataUrl(dataSrc);
        addImageAsset(image, images, asset);
      } catch {
        image.replaceWith(epubWarningMessage(image.getAttribute("alt")?.trim()));
      }
      continue;
    }

    if (!workspacePath || !loadWorkspaceImage) {
      image.replaceWith(epubWarningMessage(image.getAttribute("alt")?.trim()));
      continue;
    }

    try {
      const loaded = await loadWorkspaceImage(workspacePath);
      const asset = normalizeLoadedImage(loaded);
      addImageAsset(image, images, asset);
    } catch {
      image.replaceWith(epubWarningMessage(image.getAttribute("alt")?.trim()));
    }
  }

  return images;
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

function cleanupPreviewOnlyMarkup(template: HTMLTemplateElement): void {
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
    blocked.replaceWith(
      epubWarningMessage(
        blocked.textContent?.replace(/^Image blocked:\s*/i, ""),
      ),
    );
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

function normalizeImageMediaType(mediaType: string): string {
  return mediaType.toLowerCase() === "image/jpg"
    ? "image/jpeg"
    : mediaType.toLowerCase();
}

function extensionFromMediaType(mediaType: string): string {
  switch (mediaType.toLowerCase()) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/gif":
      return "gif";
    case "image/webp":
      return "webp";
    case "image/png":
    default:
      return "png";
  }
}

function stripYamlFrontmatter(markdown: string): string {
  const firstLineEnd = markdown.indexOf("\n");
  const firstLine = firstLineEnd === -1 ? markdown : markdown.slice(0, firstLineEnd);
  if (firstLine.trim() !== "---") {
    return markdown;
  }

  let lineStart = firstLineEnd === -1 ? markdown.length : firstLineEnd + 1;
  while (lineStart < markdown.length) {
    const lineEnd = markdown.indexOf("\n", lineStart);
    const effectiveLineEnd = lineEnd === -1 ? markdown.length : lineEnd;
    const line = markdown.slice(lineStart, effectiveLineEnd);
    if (line.trim() === "---") {
      return lineEnd === -1 ? "" : markdown.slice(lineEnd + 1);
    }
    lineStart = lineEnd === -1 ? markdown.length : lineEnd + 1;
  }

  return markdown;
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
): string {
  const escapedTitle = escapeXml(metadata.title);
  const escapedIdentifier = escapeXml(identifier);
  const creator = metadata.author
    ? `    <dc:creator>${escapeXml(metadata.author)}</dc:creator>\n`
    : "";
  const imageItems = images
    .map(
      (image) =>
        `    <item id="${escapeXml(image.id)}" href="${escapeXml(
          image.relativePath,
        )}" media-type="${escapeXml(image.mediaType)}"/>`,
    )
    .join("\n");
  const manifestImageItems = imageItems.length > 0 ? `${imageItems}\n` : "";
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
    <item id="content" href="content.xhtml" media-type="application/xhtml+xml"/>
    <item id="style" href="styles.css" media-type="text/css"/>
${manifestImageItems}  </manifest>
  <spine>
    <itemref idref="content"/>
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

function navXhtml(title: string, headings: HeadingEntry[]): string {
  const navItems =
    headings.length > 0
      ? headings
          .map(
            (heading) =>
              `      <li><a href="content.xhtml#${escapeXml(heading.id)}">${escapeXml(
                heading.text,
              )}</a></li>`,
          )
          .join("\n")
      : '      <li><a href="content.xhtml">本文</a></li>';

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="ja" xml:lang="ja">
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

function contentXhtml(title: string, body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="ja" xml:lang="ja">
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

function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleFromDocumentName(name: string): string {
  return name.replace(/\.[^.]+$/, "") || "Untitled";
}

function escapeXml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
