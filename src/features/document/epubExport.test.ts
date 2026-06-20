import { describe, expect, it, vi } from "vitest";
import { buildEpubBetaArchive } from "./epubExport";

function archiveText(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

describe("buildEpubBetaArchive", () => {
  it("builds a minimal EPUB archive with the required package files", async () => {
    const archive = await buildEpubBetaArchive({
      markdown: "# Sakura Draft\n\n## Chapter One\n\nHello **book**.",
      documentName: "draft.md",
    });
    const text = archiveText(archive);

    expect(text).toContain("application/epub+zip");
    expect(text.indexOf("application/epub+zip")).toBeLessThan(
      text.indexOf("META-INF/container.xml"),
    );
    expect(text).toContain("META-INF/container.xml");
    expect(text).toContain("OEBPS/package.opf");
    expect(text).toContain("OEBPS/nav.xhtml");
    expect(text).toContain("OEBPS/content.xhtml");
    expect(text).toContain('xmlns:epub="http://www.idpf.org/2007/ops"');
    expect(text).toContain("Sakura Draft");
    expect(text).toContain('href="content.xhtml#chapter-one"');
  });

  it("escapes metadata and content for XHTML output", async () => {
    const archive = await buildEpubBetaArchive({
      markdown: '# A & B\n\n<script>alert("x")</script>\n\nPlain text.',
      documentName: "a-and-b.md",
    });
    const text = archiveText(archive);

    expect(text).toContain("A &amp; B");
    expect(text).not.toContain("<script>");
    expect(text).toContain("Plain text.");
  });

  it("writes a valid UUID identifier for EPUBCheck", async () => {
    const archive = await buildEpubBetaArchive({
      markdown: "# Identifier\n\nBody.",
      documentName: "identifier.md",
    });
    const text = archiveText(archive);

    expect(text).toMatch(
      /<dc:identifier id="book-id">urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}<\/dc:identifier>/i,
    );
    expect(text).not.toContain("urn:uuid:hazakura-epub-beta");
  });

  it("writes explicit EPUB metadata settings", async () => {
    const archive = await buildEpubBetaArchive({
      markdown: "# Source Title\n\nBody.",
      documentName: "source.md",
      metadata: {
        author: "Kaguya & Co.",
        language: "en",
        modified: "2026-06-20T04:30:00Z",
        title: "Book <Title>",
      },
    });
    const text = archiveText(archive);

    expect(text).toContain("<dc:title>Book &lt;Title&gt;</dc:title>");
    expect(text).toContain("<dc:creator>Kaguya &amp; Co.</dc:creator>");
    expect(text).toContain("<dc:language>en</dc:language>");
    expect(text).toContain(
      '<meta property="dcterms:modified">2026-06-20T04:30:00Z</meta>',
    );
    expect(text).toContain("<title>Book &lt;Title&gt; - Navigation</title>");
  });

  it("omits EPUB creator metadata when author is blank", async () => {
    const archive = await buildEpubBetaArchive({
      markdown: "# Source Title\n\nBody.",
      documentName: "source.md",
      metadata: {
        author: "   ",
        language: "ja",
        modified: "2026-06-20T04:30:00Z",
        title: "Source Title",
      },
    });
    const text = archiveText(archive);

    expect(text).not.toContain("<dc:creator>");
  });

  it("packages workspace images as EPUB resources with relative XHTML references", async () => {
    const loadWorkspaceImage = vi.fn(async (path: string) => ({
      bytes: new Uint8Array([137, 80, 78, 71]),
      mediaType: "image/png",
      extension: "png",
      warning: null,
      path,
    }));

    const archive = await buildEpubBetaArchive({
      markdown: "# Images\n\n![cover](assets/cover.png)",
      documentName: "draft.md",
      documentPath: "/workspace/draft.md",
      workspaceRoot: "/workspace",
      loadWorkspaceImage,
    });
    const text = archiveText(archive);

    expect(loadWorkspaceImage).toHaveBeenCalledWith("/workspace/assets/cover.png");
    expect(text).toContain("OEBPS/images/image-1.png");
    expect(text).toContain(
      '<item id="image-1" href="images/image-1.png" media-type="image/png"/>',
    );
    expect(text).toContain('<img src="images/image-1.png" alt="cover"');
    expect(text).not.toContain("data-hazakura-image-path");
    expect(text).not.toContain("data:image/gif;base64");
  });

  it("packages allowed embedded data images as EPUB resources", async () => {
    const archive = await buildEpubBetaArchive({
      markdown: "# Images\n\n![inline](data:image/png;base64,iVBORw0KGgo=)",
      documentName: "draft.md",
    });
    const text = archiveText(archive);

    expect(text).toContain("OEBPS/images/image-1.png");
    expect(text).toContain(
      '<item id="image-1" href="images/image-1.png" media-type="image/png"/>',
    );
    expect(text).toContain('<img src="images/image-1.png" alt="inline"');
    expect(text).not.toContain("data:image/png;base64");
  });

  it("cleans Preview-only markup before writing XHTML content", async () => {
    const archive = await buildEpubBetaArchive({
      markdown: [
        "# Content",
        "",
        "| A | B |",
        "| --- | --- |",
        "| 1 | 2 |",
        "",
        "- [x] done",
        "- [ ] todo",
        "",
        "![remote](https://example.com/remote.png)",
      ].join("\n"),
      documentName: "content.md",
    });
    const text = archiveText(archive);

    expect(text).toContain("<table");
    expect(text).not.toContain("markdown-table-frame");
    expect(text).not.toContain("markdown-task-checkbox");
    expect(text).not.toContain("markdown-task-list-item");
    expect(text).not.toContain("☑");
    expect(text).not.toContain("☐");
    expect(text).not.toContain("blocked-image");
    expect(text).toContain("Image unavailable: remote");
  });

  it("uses chapter heading parsing so frontmatter headings are not exported to nav", async () => {
    const archive = await buildEpubBetaArchive({
      markdown: ["---", "title: # Metadata Title", "---", "", "# Real Title"].join(
        "\n",
      ),
      documentName: "frontmatter.md",
    });
    const text = archiveText(archive);

    expect(text).toContain("<dc:title>Real Title</dc:title>");
    expect(text).toContain('href="content.xhtml#real-title"');
    expect(text).not.toContain("metadata-title");
  });

  it("keeps later navigation headings when an earlier heading has inline Markdown", async () => {
    const archive = await buildEpubBetaArchive({
      markdown: [
        "# First",
        "",
        "## Sub *emphasis*",
        "",
        "# Second",
      ].join("\n"),
      documentName: "headings.md",
    });
    const text = archiveText(archive);

    expect(text).toContain('href="content.xhtml#first"');
    expect(text).toContain('href="content.xhtml#sub-emphasis"');
    expect(text).toContain('href="content.xhtml#second"');
  });

  it("writes standalone page-break markers as content.xhtml page-break blocks", async () => {
    const archive = await buildEpubBetaArchive({
      markdown: [
        "# Chapter",
        "",
        "Before break.",
        "",
        "---",
        "",
        "After break.",
        "",
        "```",
        "---",
        "===",
        "```",
      ].join("\n"),
      documentName: "breaks.md",
    });
    const text = archiveText(archive);

    expect(text).toContain('class="page-break"');
    expect(text.match(/class="page-break"/g)).toHaveLength(1);
    expect(text).toContain("break-before: page");
    expect(text).toContain("Before break.");
    expect(text).toContain("After break.");
    expect(text).toContain("---\n===");
  });

  it("does not turn YAML frontmatter fences into EPUB page breaks", async () => {
    const archive = await buildEpubBetaArchive({
      markdown: [
        "---",
        "title: Draft",
        "---",
        "",
        "# Chapter",
        "",
        "Body.",
      ].join("\n"),
      documentName: "frontmatter.md",
    });
    const text = archiveText(archive);

    expect(text).not.toContain('class="page-break"');
    expect(text).not.toContain("title: Draft");
  });
});
