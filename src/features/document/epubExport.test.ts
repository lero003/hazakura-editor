import { describe, expect, it } from "vitest";
import { buildEpubBetaArchive } from "./epubExport";

function archiveText(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

describe("buildEpubBetaArchive", () => {
  it("builds a minimal EPUB archive with the required package files", () => {
    const archive = buildEpubBetaArchive({
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

  it("escapes metadata and content for XHTML output", () => {
    const archive = buildEpubBetaArchive({
      markdown: '# A & B\n\n<script>alert("x")</script>\n\nPlain text.',
      documentName: "a-and-b.md",
    });
    const text = archiveText(archive);

    expect(text).toContain("A &amp; B");
    expect(text).not.toContain("<script>");
    expect(text).toContain("Plain text.");
  });
});
