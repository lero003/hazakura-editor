import { invoke } from "@tauri-apps/api/core";

/** v1.7 R0 — open result for a single active PDF reference handle. */
export type PdfReferenceOpenResult = {
  referenceId: string;
  pageCount: number;
  name: string;
};

/** v1.7 R0 — one bounded PNG page raster (base64, no data: prefix). */
export type PdfReferencePageImage = {
  referenceId: string;
  page: number;
  width: number;
  height: number;
  mime: string;
  dataBase64: string;
};

export async function openPdfReference(
  path: string,
): Promise<PdfReferenceOpenResult> {
  return invoke<PdfReferenceOpenResult>("open_pdf_reference", { path });
}

export async function renderPdfReferencePage(
  referenceId: string,
  pageIndex: number,
  maxPixels?: number,
): Promise<PdfReferencePageImage> {
  return invoke<PdfReferencePageImage>("render_pdf_reference_page", {
    referenceId,
    pageIndex,
    maxPixels: maxPixels ?? null,
  });
}

export async function closePdfReference(referenceId: string): Promise<void> {
  return invoke("close_pdf_reference", { referenceId });
}

/** Build a data URL for UI consumers of a rendered page. */
export function pdfPageImageToDataUrl(image: PdfReferencePageImage): string {
  return `data:${image.mime};base64,${image.dataBase64}`;
}
