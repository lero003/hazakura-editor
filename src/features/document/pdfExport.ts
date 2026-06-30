export type PdfMarginPreset = "narrow" | "standard" | "wide";

export const DEFAULT_PDF_MARGIN_PRESET: PdfMarginPreset = "standard";

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
