import { describe, expect, it } from "vitest";
import {
  DEFAULT_PDF_MARGIN_PRESET,
  PDF_A4_PAGE_HEIGHT_POINTS,
  PDF_A4_PAGE_WIDTH_POINTS,
  PDF_CONTENT_BOTTOM_SAFETY_POINTS,
  PDF_MARGIN_PRESETS,
  formatPdfPointValue,
  pdfMarginCss,
  pdfScreenPageLayout,
  preparePdfExportTables,
} from "./pdfExport";

// mm -> PostScript points: (value * 72) / 25.4
const mmToPoints = (value: number) => (value * 72) / 25.4;

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

describe("pdfScreenPageLayout", () => {
  it("derives the A4 content box and column gap from the narrow preset", () => {
    const { blockMm, inlineMm } = PDF_MARGIN_PRESETS.narrow;
    const marginBlock = mmToPoints(blockMm);
    const marginInline = mmToPoints(inlineMm);
    const layout = pdfScreenPageLayout("narrow");

    expect(layout.marginBlockPoints).toBeCloseTo(marginBlock, 3);
    expect(layout.marginInlinePoints).toBeCloseTo(marginInline, 3);
    expect(layout.columnGapPoints).toBeCloseTo(marginInline * 2, 3);
    expect(layout.contentWidthPoints).toBeCloseTo(
      PDF_A4_PAGE_WIDTH_POINTS - marginInline * 2,
      3,
    );
    expect(layout.contentHeightPoints).toBeCloseTo(
      PDF_A4_PAGE_HEIGHT_POINTS -
        marginBlock * 2 -
        PDF_CONTENT_BOTTOM_SAFETY_POINTS,
      3,
    );
  });

  it("derives a wider content box and column gap from the wide preset", () => {
    const { blockMm, inlineMm } = PDF_MARGIN_PRESETS.wide;
    const marginBlock = mmToPoints(blockMm);
    const marginInline = mmToPoints(inlineMm);
    const layout = pdfScreenPageLayout("wide");

    expect(layout.marginBlockPoints).toBeCloseTo(marginBlock, 3);
    expect(layout.marginInlinePoints).toBeCloseTo(marginInline, 3);
    expect(layout.columnGapPoints).toBeCloseTo(marginInline * 2, 3);
    expect(layout.contentWidthPoints).toBeCloseTo(
      PDF_A4_PAGE_WIDTH_POINTS - marginInline * 2,
      3,
    );
    expect(layout.contentHeightPoints).toBeCloseTo(
      PDF_A4_PAGE_HEIGHT_POINTS -
        marginBlock * 2 -
        PDF_CONTENT_BOTTOM_SAFETY_POINTS,
      3,
    );
  });

  it("shrinks the content box more for the standard preset than for narrow", () => {
    const narrow = pdfScreenPageLayout("narrow");
    const standard = pdfScreenPageLayout("standard");

    // Standard margins are larger, so the content box is smaller.
    expect(standard.contentWidthPoints).toBeLessThan(narrow.contentWidthPoints);
    expect(standard.contentHeightPoints).toBeLessThan(
      narrow.contentHeightPoints,
    );
    expect(standard.marginBlockPoints).toBeGreaterThan(
      narrow.marginBlockPoints,
    );
  });

  it("reserves bottom safety so last line boxes stay inside the A4 capture", () => {
    expect(PDF_CONTENT_BOTTOM_SAFETY_POINTS).toBeGreaterThanOrEqual(12);
    expect(PDF_CONTENT_BOTTOM_SAFETY_POINTS).toBeLessThanOrEqual(24);

    for (const preset of ["narrow", "standard", "wide"] as const) {
      const layout = pdfScreenPageLayout(preset);
      const occupied =
        layout.marginBlockPoints * 2 + layout.contentHeightPoints;
      // Margins + content fit strictly inside one A4 page; the reserved
      // strip stays empty so descenders are not clipped by createPDF.
      expect(occupied).toBeLessThan(PDF_A4_PAGE_HEIGHT_POINTS);
      expect(occupied).toBeCloseTo(
        PDF_A4_PAGE_HEIGHT_POINTS - PDF_CONTENT_BOTTOM_SAFETY_POINTS,
        3,
      );
    }
  });
});

describe("formatPdfPointValue", () => {
  it("strips a trailing .000 from a whole-number point value", () => {
    expect(formatPdfPointValue(595)).toBe("595");
    expect(formatPdfPointValue(842)).toBe("842");
  });

  it("keeps three decimal places for fractional point values", () => {
    // toFixed(3) pads to three decimals; only the exact ".000" suffix is
    // stripped, so trailing zeros on fractional values remain.
    expect(formatPdfPointValue(28.346)).toBe("28.346");
    expect(formatPdfPointValue(28.5)).toBe("28.500");
    expect(formatPdfPointValue(28.34)).toBe("28.340");
  });
});
