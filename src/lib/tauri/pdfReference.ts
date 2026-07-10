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

/** Regular-file metadata for any reference path (text / PDF / image). */
export type ReferenceFileMetadata = {
  path: string;
  size: number;
  modified_ms: number | null;
  fingerprint: string;
  large_file_warning: boolean;
};

/**
 * Disk fingerprint for reference external-change detection.
 * Unlike getFileMetadata, accepts binary-looking PDF/image files.
 */
export async function getReferenceFileMetadata(
  path: string,
): Promise<ReferenceFileMetadata> {
  return invoke<ReferenceFileMetadata>("get_reference_file_metadata", { path });
}

/** Build a data URL for UI consumers of a rendered page (tests / fallback). */
export function pdfPageImageToDataUrl(image: PdfReferencePageImage): string {
  return `data:${image.mime};base64,${image.dataBase64}`;
}

/**
 * Convert a rendered page to an object URL so the browser can decode once
 * without keeping a large base64 string in the React tree. Caller must
 * `URL.revokeObjectURL` when discarding the URL.
 */
export function pdfPageImageToObjectUrl(image: PdfReferencePageImage): string {
  const binary = atob(image.dataBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: image.mime || "image/png" });
  return URL.createObjectURL(blob);
}

/** Localize common Rust PDF-reference errors for Japanese UI. */
export function localizePdfReferenceError(
  error: unknown,
  language: "ja" | "en",
): string {
  const raw = String(error);
  const lower = raw.toLowerCase();
  const stale =
    lower.includes("unknown or stale") ||
    lower.includes("no active pdf reference") ||
    lower.includes("pdf reference id is empty");
  if (stale) {
    return language === "ja"
      ? "参照PDFのハンドルが無効です。参照を開き直してください。"
      : "This PDF reference is no longer valid. Re-open the reference.";
  }
  if (language === "ja" && raw.startsWith("Error: ")) {
    return raw.slice("Error: ".length);
  }
  return raw;
}
