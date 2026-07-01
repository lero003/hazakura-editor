import { describe, expect, it } from "vitest";
import {
  DEFAULT_PDF_MARGIN_PRESET,
  PDF_MARGIN_PRESETS,
  pdfMarginCss,
  preparePdfExportTables,
} from "./pdfExport";

describe("PDF export margin presets", () => {
  it("maps the three allowlisted presets to fixed A4 margins", () => {
    expect(Object.keys(PDF_MARGIN_PRESETS)).toEqual([
      "narrow",
      "standard",
      "wide",
    ]);
    expect(pdfMarginCss("narrow")).toBe("10mm 10mm");
    expect(pdfMarginCss("standard")).toBe("18mm 16mm");
    expect(pdfMarginCss("wide")).toBe("25mm 22mm");
  });

  it("keeps the existing PDF margin as the default", () => {
    expect(DEFAULT_PDF_MARGIN_PRESET).toBe("standard");
  });

  it("annotates rendered tables with their fixed PDF column count", () => {
    const html = preparePdfExportTables(`
      <div class="markdown-table-frame">
        <table style="text-align: right;">
          <thead><tr><th>章</th><th>場面</th><th>状態</th></tr></thead>
          <tbody><tr><td>第一章</td><td>図書室</td><td>確認中</td></tr></tbody>
        </table>
      </div>
    `);

    expect(html).toContain("--pdf-table-columns: 3;");
    expect(html).toContain("text-align: right;");
  });
});
