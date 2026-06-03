import { isJapaneseMenuLanguage, type MenuLanguage } from "../../types";
import { isKanaStyle } from "./_helpers";

export type LModeCopy = {
  preferenceLabel: string;
  preferenceHint: string;
  paletteCommand: string;
  exitPillLabel: string;
  exitPillTitle: string;
};

export function getLModeCopy(lang: MenuLanguage): LModeCopy {
  if (isKanaStyle(lang)) {
    return {
      preferenceLabel: "えるもーど",
      preferenceHint: "しゅうへんUIをかくしてほんぶんにしゅうちゅうします。",
      paletteCommand: "えるモードきりかえ",
      exitPillLabel: "えるもーどしゅうりょう",
      exitPillTitle: "えるもーどをとじる",
    };
  }

  return isJapaneseMenuLanguage(lang)
    ? {
        preferenceLabel: "えるモード",
        preferenceHint: "周辺UIを隠して本文に集中します。",
        paletteCommand: "えるモード切替",
        exitPillLabel: "えるモード終了",
        exitPillTitle: "えるモードを閉じる",
      }
    : {
        preferenceLabel: "L Mode",
        preferenceHint: "Hide the workspace chrome for focused reading.",
        paletteCommand: "Toggle L Mode",
        exitPillLabel: "Exit L Mode",
        exitPillTitle: "Close L Mode",
      };
}
