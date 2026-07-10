import { isComparableTextFile } from "../diff/diff";
import { fileNameFromPath } from "../../lib/utils";
import type { ReferenceDocument } from "./types";

/** Text/Markdown extensions accepted as a read-only reference in R1. */
export function isTextReferencePath(path: string): boolean {
  return isComparableTextFile(path);
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
  return normalizePathForCompare(referencePath) === normalizePathForCompare(activeEditorPath);
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
