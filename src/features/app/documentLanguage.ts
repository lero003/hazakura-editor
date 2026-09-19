import type { MenuLanguage } from "../../types";

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
