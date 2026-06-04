import { isJapaneseMenuLanguage, type MenuLanguage } from "../../types";
import { isKanaStyle } from "./_helpers";

export type LModeCopy = {
  preferenceLabel: string;
  preferenceHint: string;
  typewriterPreferenceLabel: string;
  typewriterPreferenceHint: string;
  paletteCommand: string;
  exitPillLabel: string;
  exitPillTitle: string;
};

export function getLModeCopy(lang: MenuLanguage): LModeCopy {
  if (isKanaStyle(lang)) {
    return {
      preferenceLabel: "えるもーど",
      preferenceHint: "しゅうへんUIをかくしてほんぶんにしゅうちゅうします。",
      typewriterPreferenceLabel: "たいぷらいたーもーど",
      typewriterPreferenceHint:
        "そくtyoせんのうほうをちゅうおうにキープします。",
      paletteCommand: "えるモードきりかえ",
      exitPillLabel: "えるもーどしゅうりょう",
      exitPillTitle: "えるもーどをとじる",
    };
  }

  return isJapaneseMenuLanguage(lang)
    ? {
        preferenceLabel: "えるモード",
        preferenceHint: "周辺UIを隠して本文に集中します。",
        typewriterPreferenceLabel: "タイプライターモード",
        typewriterPreferenceHint:
          "カーソル行を縦方向中央付近に保ち、書きながら視線を動かさないようにします。",
        paletteCommand: "えるモード切替",
        exitPillLabel: "えるモード終了",
        exitPillTitle: "えるモードを閉じる",
      }
    : {
        preferenceLabel: "L Mode",
        preferenceHint: "Hide the workspace chrome for focused reading.",
        typewriterPreferenceLabel: "Typewriter mode",
        typewriterPreferenceHint:
          "Keep the active line near the vertical center of the viewport as you type.",
        paletteCommand: "Toggle L Mode",
        exitPillLabel: "Exit L Mode",
        exitPillTitle: "Close L Mode",
      };
}
