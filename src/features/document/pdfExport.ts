export type PdfMarginPreset = "narrow" | "standard" | "wide";

export const DEFAULT_PDF_MARGIN_PRESET: PdfMarginPreset = "standard";

export const PDF_A4_PAGE_WIDTH_POINTS = 595;
export const PDF_A4_PAGE_HEIGHT_POINTS = 842;

/**
 * Multi-column PDF capture uses a fixed one-page-high content box.
 * WebKit createPDF clips to the A4 rect, so line boxes / descenders that
 * sit flush against the column bottom can lose trailing lines of the
 * document (worse on long JP manuscripts). Reserve several body lines
 * (~11pt × 1.45 line-height) so content wraps into the next column
 * instead of painting past the capture. Do not restore scrollHeight.
 */
export const PDF_CONTENT_BOTTOM_SAFETY_POINTS = 48;

export const PDF_MARGIN_PRESETS = {
  narrow: { blockMm: 10, inlineMm: 10 },
  standard: { blockMm: 18, inlineMm: 16 },
  wide: { blockMm: 25, inlineMm: 22 },
} as const satisfies Record<
  PdfMarginPreset,
  { blockMm: number; inlineMm: number }
>;

export function pdfMarginCss(preset: PdfMarginPreset): string {
  const value = PDF_MARGIN_PRESETS[preset];
  return `${value.blockMm}mm ${value.inlineMm}mm`;
}

export type PdfScreenPageLayout = {
  columnGapPoints: number;
  contentHeightPoints: number;
  contentWidthPoints: number;
  marginBlockPoints: number;
  marginInlinePoints: number;
};

export function pdfScreenPageLayout(
  preset: PdfMarginPreset,
): PdfScreenPageLayout {
  const value = PDF_MARGIN_PRESETS[preset];
  const marginBlockPoints = millimetersToPdfPoints(value.blockMm);
  const marginInlinePoints = millimetersToPdfPoints(value.inlineMm);
  return {
    columnGapPoints: marginInlinePoints * 2,
    contentHeightPoints:
      PDF_A4_PAGE_HEIGHT_POINTS -
      marginBlockPoints * 2 -
      PDF_CONTENT_BOTTOM_SAFETY_POINTS,
    contentWidthPoints: PDF_A4_PAGE_WIDTH_POINTS - marginInlinePoints * 2,
    marginBlockPoints,
    marginInlinePoints,
  };
}

export function formatPdfPointValue(value: number): string {
  return value.toFixed(3).replace(/\.000$/, "");
}

export function preparePdfExportTables(html: string): string {
  if (!html.includes("<table")) {
    return html;
  }

  const template = document.createElement("template");
  template.innerHTML = html;

  for (const table of Array.from(template.content.querySelectorAll("table"))) {
    const columnCount = Math.max(
      1,
      ...Array.from(table.querySelectorAll("tr"), (row) => row.children.length),
    );
    table.style.setProperty("--pdf-table-columns", String(columnCount));
  }

  return template.innerHTML;
}

function millimetersToPdfPoints(value: number): number {
  return (value * 72) / 25.4;
}
