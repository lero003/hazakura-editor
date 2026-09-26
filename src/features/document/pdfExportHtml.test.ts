import { describe, expect, it } from "vitest";
import { pdfScreenPageLayout } from "./pdfExport";
import { buildPdfExportHtml } from "./pdfExportHtml";

const layout = pdfScreenPageLayout("standard");

describe("PDF export document", () => {
  it("keeps the cover, body, escaped title, and document tail guard", () => {
    const html = buildPdfExportHtml({
      title: 'A & "B" <draft>',
      scope: "document",
      preset: "standard",
      layout,
      coverHtml: "<img alt=\"cover\">",
      bodyHtml: "<p>本文</p>",
      coverMaxHeightPx: 676,
      imageMaxHeightPx: 397,
    });

    expect(html).toContain("<title>A &amp; &quot;B&quot; &lt;draft&gt;</title>");
    expect(html).toContain('<div class="pdf-export-cover-page"><img alt="cover"></div>');
    expect(html).toContain("<p>本文</p>");
    expect(html).toContain('<p class="pdf-export-tail-guard" aria-hidden="true">&#8203;</p>');
    expect(html).toContain("--pdf-page-width: 595px;");
    expect(html).toContain("max-height: 397px;");
  });

  it("leaves whole-book page breaks to the chapter sections", () => {
    const html = buildPdfExportHtml({
      title: "Book",
      scope: "book",
      preset: "wide",
      layout: pdfScreenPageLayout("wide"),
      coverHtml: "",
      bodyHtml: '<section class="book-scope-pdf-chapter--next">Chapter 2</section>',
      coverMaxHeightPx: 600,
      imageMaxHeightPx: 300,
    });

    expect(html).toContain("book-scope-pdf-chapter--next");
    expect(html).toContain("@page { margin:");
    expect(html).not.toContain('<div class="pdf-export-cover-page">');
    expect(html).not.toContain('<p class="pdf-export-tail-guard" aria-hidden="true">&#8203;</p>');
  });
});
