import { describe, expect, it } from "vitest";
import { buildHtmlExportHtml, htmlExportCssVars } from "./htmlExportHtml";

describe("standalone HTML export", () => {
  it("keeps the document title, preview body, and print rules", () => {
    const cssVars = htmlExportCssVars({
      getPropertyValue: (name: string) => name === "--bg" ? "#fafafa" : "",
    });
    const html = buildHtmlExportHtml({
      title: 'A & "B" <draft>',
      bodyHtml: "<p>本文</p>",
      cssVars,
    });

    expect(html).toContain("<title>A &amp; &quot;B&quot; &lt;draft&gt;</title>");
    expect(html).toContain("--bg: #fafafa;");
    expect(html).toContain('<div class="markdown-preview">\n<p>本文</p>');
    expect(html).toContain("@media print");
    expect(html).toContain("@page { margin: 18mm 16mm; }");
  });
});
