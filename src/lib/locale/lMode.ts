import { isJapaneseMenuLanguage, type MenuLanguage } from "../../types";
import { isKanaStyle } from "./_helpers";

export type LModeCopy = {
  preferenceLabel: string;
  preferenceHint: string;
  featureDescription: string;
  typewriterPreferenceLabel: string;
  typewriterPreferenceHint: string;
  paletteCommand: string;
  exitPillLabel: string;
  exitPillTitle: string;
  actionRailLabel: string;
  statusBarReviewChangesLabel: string;
  statusBarWorkspaceLabel: string;
  statusBarReviewChangesTitle: string;
  statusBarWorkspaceTitle: string;
  emptyPlaceholderText: string;
  emptyPlaceholderHint: string;
};

export function getLModeCopy(lang: MenuLanguage): LModeCopy {
  if (isKanaStyle(lang)) {
    return {
      preferenceLabel: "えるもーど",
      preferenceHint: "しゅうへんUIをかくしてほんぶんにしゅうちゅうします。",
      featureDescription: "しずかに かくための じかん。",
      typewriterPreferenceLabel: "たいぷらいたーもーど",
      typewriterPreferenceHint:
        "そくtyoせんのうほうをちゅうおうにキープします。",
      paletteCommand: "えるモードきりかえ",
      exitPillLabel: "えるもーどしゅうりょう",
      exitPillTitle: "えるもーどをとじる",
      actionRailLabel: "えるもーどのどうせん",
      statusBarReviewChangesLabel: "へんこうを かくにん",
      statusBarWorkspaceLabel: "わーくすぺーすへ",
      statusBarReviewChangesTitle: "えるもーどをとじて ディスクとの さぶんを ひらく",
      statusBarWorkspaceTitle: "えるもーどをとじて わーくすぺーすに もどる",
      emptyPlaceholderText: "かきはじめる…",
      emptyPlaceholderHint: "Cmd+Shift+L で いつもの もーどへ もどります",
    };
  }

  return isJapaneseMenuLanguage(lang)
    ? {
        preferenceLabel: "えるモード",
        preferenceHint: "周辺UIを隠して本文に集中します。",
        featureDescription: "書くための、静かな時間。",
        typewriterPreferenceLabel: "タイプライターモード",
        typewriterPreferenceHint:
          "カーソル行を縦方向中央付近に保ち、書きながら視線を動かさないようにします。",
        paletteCommand: "えるモード切替",
        exitPillLabel: "えるモード終了",
        exitPillTitle: "えるモードを閉じる",
        actionRailLabel: "えるモードの導線",
        statusBarReviewChangesLabel: "変更を確認",
        statusBarWorkspaceLabel: "ワークスペースへ",
        statusBarReviewChangesTitle: "えるモードを閉じてディスクとの差分を開く",
        statusBarWorkspaceTitle: "えるモードを閉じてワークスペースに戻る",
        emptyPlaceholderText: "書き始める…",
        emptyPlaceholderHint: "Cmd+Shift+L で通常モードへ戻ります",
      }
    : {
        preferenceLabel: "L Mode",
        preferenceHint: "Hide the workspace chrome for focused reading.",
        featureDescription: "A quieter place to write.",
        typewriterPreferenceLabel: "Typewriter mode",
        typewriterPreferenceHint:
          "Keep the active line near the vertical center of the viewport as you type.",
        paletteCommand: "Toggle L Mode",
        exitPillLabel: "Exit L Mode",
        exitPillTitle: "Close L Mode",
        actionRailLabel: "L Mode actions",
        statusBarReviewChangesLabel: "Review changes",
        statusBarWorkspaceLabel: "Open workspace",
        statusBarReviewChangesTitle: "Exit L Mode and open the diff against disk",
        statusBarWorkspaceTitle: "Exit L Mode and return to the workspace",
        emptyPlaceholderText: "Start writing…",
        emptyPlaceholderHint: "Press Cmd+Shift+L to return to normal mode",
      };
}
