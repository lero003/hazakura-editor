import { describe, expect, it } from "vitest";
import {
  DEFAULT_PDF_MARGIN_PRESET,
  PDF_MARGIN_PRESETS,
  pdfMarginCss,
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
});
