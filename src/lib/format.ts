// Pure formatting helpers for the editor status surfaces.
// These turn enum-shaped data (line endings, text encodings) into
// the localized label shown in the status bar / toast. They have
// no React or Tauri dependencies, so they live outside the
// per-feature hooks.
import type { LineEndingKind, MenuLanguage, TextEncoding } from "../types";

export function formatLineEndingKind(
  lineEnding: LineEndingKind,
  menuLanguage: MenuLanguage = "en",
): string {
  if (lineEnding === "crlf") {
    return "CRLF";
  }

  if (lineEnding === "mixed") {
    return menuLanguage !== "en" ? "混在" : "Mixed";
  }

  if (lineEnding === "none") {
    return menuLanguage !== "en" ? "改行なし" : "No line endings";
  }

  return "LF";
}

export function formatTextEncoding(
  encoding: TextEncoding,
  menuLanguage: MenuLanguage,
): string {
  if (menuLanguage === "en") {
    switch (encoding) {
      case "utf-8":
        return "UTF-8";
      case "utf-8-bom":
        return "UTF-8 BOM";
      case "shift-jis":
        return "Shift-JIS";
      case "euc-jp":
        return "EUC-JP";
    }
  }
  switch (encoding) {
    case "utf-8":
      return "UTF-8";
    case "utf-8-bom":
      return "UTF-8 BOM";
    case "shift-jis":
      return "シフトJIS";
    case "euc-jp":
      return "EUC-JP";
  }
}
