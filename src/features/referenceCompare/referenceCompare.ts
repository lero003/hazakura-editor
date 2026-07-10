import { isComparableTextFile } from "../diff/diff";
import {
  fileNameFromPath,
  isSupportedImageFile,
} from "../../lib/utils";
import type { ReferenceDocument } from "./types";

/** Text/Markdown extensions accepted as a read-only reference. */
export function isTextReferencePath(path: string): boolean {
  return isComparableTextFile(path);
}

export function isPdfReferencePath(path: string): boolean {
  const ext = fileNameFromPath(path).split(".").at(-1)?.toLowerCase() ?? "";
  return ext === "pdf";
}

export function isImageReferencePath(path: string): boolean {
  return isSupportedImageFile(path);
}

/** Any type R2 can open as a reference (text, pdf, image). */
export function isReferencePath(path: string): boolean {
  return (
    isTextReferencePath(path) ||
    isPdfReferencePath(path) ||
    isImageReferencePath(path)
  );
}

/**
 * Same absolute path as the active editor tab — do not open a self-reference.
 * Callers should route to buffer-vs-disk review instead.
 */
export function isSameFileAsActiveEditor(
  referencePath: string,
  activeEditorPath: string | null | undefined,
): boolean {
  if (!activeEditorPath) {
    return false;
  }
  return (
    normalizePathForCompare(referencePath) ===
    normalizePathForCompare(activeEditorPath)
  );
}

export function normalizePathForCompare(path: string): string {
  // macOS paths are usually NFC; compare case-sensitively but strip trailing slashes.
  return path.replace(/\/+$/, "") || path;
}

export function referenceDisplayName(reference: ReferenceDocument): string {
  return reference.name || fileNameFromPath(reference.path);
}

export function referenceRoleLabel(
  language: "ja" | "en",
  reference: ReferenceDocument,
): string {
  const name = referenceDisplayName(reference);
  if (language === "ja") {
    return `参照: ${name}（読み取り専用）`;
  }
  return `Reference: ${name} (read-only)`;
}

export function isTextReference(
  reference: ReferenceDocument,
): reference is Extract<ReferenceDocument, { kind: "text" }> {
  return reference.kind === "text";
}

export function isPdfReference(
  reference: ReferenceDocument,
): reference is Extract<ReferenceDocument, { kind: "pdf" }> {
  return reference.kind === "pdf";
}

export function isImageReference(
  reference: ReferenceDocument,
): reference is Extract<ReferenceDocument, { kind: "image" }> {
  return reference.kind === "image";
}

/** Default maxPixels budget for a page render (matches helper ceiling). */
export const PDF_REFERENCE_DEFAULT_MAX_PIXELS = 4_000_000;
