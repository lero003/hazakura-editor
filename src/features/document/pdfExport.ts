export type PdfMarginPreset = "narrow" | "standard" | "wide";

export const DEFAULT_PDF_MARGIN_PRESET: PdfMarginPreset = "standard";

export const PDF_A4_PAGE_WIDTH_POINTS = 595;
export const PDF_A4_PAGE_HEIGHT_POINTS = 842;

/**
 * Multi-column PDF capture uses a fixed one-page-high content box.
 * WebKit createPDF clips the A4 rect, so trailing line boxes near the
 * column bottom can be lost (device: full colophon minus last paragraph).
 *
 * Reserve ~9–10 body lines (11pt × 1.45). Cover images must use a fixed
 * max-height (px) that fits this shortened column — do not use
 * break-inside:avoid without a fit constraint. Do not restore scrollHeight.
 */
export const PDF_CONTENT_BOTTOM_SAFETY_POINTS = 148;

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

export type PdfCoverSplit = {
  /** Outer HTML for a dedicated cover page (empty when no leading image). */
  coverHtml: string;
  /** Remaining Markdown HTML for the multicol body. */
  bodyHtml: string;
};

/**
 * Pull a leading cover image out of rendered Markdown HTML so PDF export
 * can place it on its own A4 page (outside the multicol flow).
 *
 * Matches a leading bare `<img>` or a `<p>` whose only meaningful content
 * is one image (typical of `![](cover.jpg)` at the top of a manuscript).
 */
export function extractPdfLeadingCoverHtml(html: string): PdfCoverSplit {
  if (typeof document === "undefined") {
    return { coverHtml: "", bodyHtml: html };
  }

  const template = document.createElement("template");
  template.innerHTML = html;

  let first: ChildNode | null = template.content.firstChild;
  while (
    first &&
    first.nodeType === Node.TEXT_NODE &&
    !(first.textContent ?? "").trim()
  ) {
    first = first.nextSibling;
  }

  let coverNode: Element | null = null;
  if (first instanceof HTMLImageElement) {
    coverNode = first;
  } else if (first instanceof HTMLParagraphElement) {
    const images = Array.from(first.querySelectorAll("img"));
    if (images.length === 1 && paragraphIsImageOnly(first)) {
      coverNode = first;
    }
  }

  if (!coverNode) {
    return { coverHtml: "", bodyHtml: html };
  }

  const img =
    coverNode instanceof HTMLImageElement
      ? coverNode
      : coverNode.querySelector("img");
  if (!img) {
    return { coverHtml: "", bodyHtml: html };
  }

  // Need a real image payload (data URL or remaining path). Blocked
  // placeholders are spans, not imgs, so they never match above.
  const src = img.getAttribute("src")?.trim() ?? "";
  if (!src || src.startsWith("data:image/gif")) {
    // Transparent policy placeholder not yet inlined — keep in body.
    return { coverHtml: "", bodyHtml: html };
  }

  const coverClone = coverNode.cloneNode(true) as Element;
  coverNode.remove();

  const bodyWrap = document.createElement("div");
  bodyWrap.append(...Array.from(template.content.childNodes));

  return {
    coverHtml: coverClone.outerHTML,
    bodyHtml: bodyWrap.innerHTML,
  };
}

function paragraphIsImageOnly(paragraph: HTMLParagraphElement): boolean {
  for (const node of Array.from(paragraph.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      if ((node.textContent ?? "").trim()) {
        return false;
      }
      continue;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      if (el.tagName === "IMG" || el.tagName === "BR") {
        continue;
      }
      return false;
    }
  }
  return paragraph.querySelector("img") !== null;
}

function millimetersToPdfPoints(value: number): number {
  return (value * 72) / 25.4;
}
