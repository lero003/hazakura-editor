import { MENU_LANGUAGE_STORAGE_KEY, type MenuLanguage } from "../../types";

/**
 * `lang` for regions that render the user's own document text: the editor
 * body, the preview, the reader, and the assist input / generated draft.
 *
 * `documentLanguageForMenuLanguage` answers a different question (which
 * language the UI copy is written in), and the two must not be conflated.
 * Hazakura has no per-document language setting yet, so an English manuscript
 * under a Japanese UI would otherwise be announced as Japanese. The empty
 * string is the HTML-defined "language unknown" value, which stops inheritance
 * from the root without declaring a wrong language. When a document-language
 * setting exists, these regions take its value instead.
 */
export const DOCUMENT_CONTENT_LANG = "";

export function isMenuLanguage(value: string | null): value is MenuLanguage {
  return value === "en" || value === "ja" || value === "kana";
}

export function readStoredMenuLanguage(): MenuLanguage {
  if (typeof window === "undefined") {
    return "en";
  }

  try {
    const value = window.localStorage.getItem(MENU_LANGUAGE_STORAGE_KEY);
    return isMenuLanguage(value) ? value : "en";
  } catch {
    // The storage getter itself can throw before the recovery root mounts.
    return "en";
  }
}

/**
 * Set `<html lang>` from the stored UI language before React renders, so the
 * chrome is never announced with `index.html`'s default language.
 */
export function syncDocumentLanguageFromStorage(): "en" | "ja" {
  const language = documentLanguageForMenuLanguage(readStoredMenuLanguage());
  document.documentElement.lang = language;
  return language;
}

/**
 * The kana presentation is Japanese copy with a gentler orthography, so its
 * document language remains Japanese for browser and assistive-technology
 * pronunciation. Keep this mapping narrower than the UI preference type:
 * adding a new menu language must make an explicit document-language choice.
 */
export function documentLanguageForMenuLanguage(
  menuLanguage: MenuLanguage,
): "en" | "ja" {
  switch (menuLanguage) {
    case "en":
      return "en";
    case "ja":
    case "kana":
      return "ja";
  }

  const unsupportedLanguage: never = menuLanguage;
  return unsupportedLanguage;
}
