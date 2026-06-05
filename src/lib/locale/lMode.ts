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
  statusBarAppleAssistLabel: string;
  statusBarAppleAssistTitle: string;
  // v0.12+ Apple Local Assist Writing Companion (slice 5).
  // The escape-hatch bar shows a one-line summary of a
  // pending AI edit and offers Discard / Close actions.
  // Labels live on `LModeCopy` because the bar's chrome
  // borrows the L Mode palette and tone; reusing the
  // shape avoids creating a new locale module for a
  // single component.
  appleAssistReviewBarLabel: string;
  appleAssistReviewBarTitle: string;
  appleAssistReviewBarOpenDiffLabel: string;
  appleAssistReviewBarCloseDiffLabel: string;
  appleAssistReviewBarDiscardLabel: string;
  appleAssistReviewBarDiscardTitle: string;
  appleAssistReviewBarCloseLabel: string;
  appleAssistReviewBarCloseTitle: string;
  appleAssistReviewBarEmptyDiffLabel: string;
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
      statusBarAppleAssistLabel: "Apple Assist",
      statusBarAppleAssistTitle: "Apple Assist の ウィンドウを ひらく",
      appleAssistReviewBarLabel: "Apple Assist が ほんぶんを へんこうしました",
      appleAssistReviewBarTitle: "さぶんを かくにんするか とりけすか えらんでください",
      appleAssistReviewBarOpenDiffLabel: "さぶんを ひらく",
      appleAssistReviewBarCloseDiffLabel: "さぶんを とぢる",
      appleAssistReviewBarDiscardLabel: "とりけす",
      appleAssistReviewBarDiscardTitle: "へんこうを もとに もどして とりけします",
      appleAssistReviewBarCloseLabel: "とぢる",
      appleAssistReviewBarCloseTitle: "へんこうは のこして とりけしたちに しない",
      appleAssistReviewBarEmptyDiffLabel: "さぶんが ありません",
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
        statusBarAppleAssistLabel: "Apple Assist",
        statusBarAppleAssistTitle: "Apple Assist ウィンドウを開く",
        appleAssistReviewBarLabel: "Apple Assist が本文を変更しました",
        appleAssistReviewBarTitle: "差分を確認するか取り消すか選んでください",
        appleAssistReviewBarOpenDiffLabel: "差分を開く",
        appleAssistReviewBarCloseDiffLabel: "差分を閉じる",
        appleAssistReviewBarDiscardLabel: "取り消す",
        appleAssistReviewBarDiscardTitle: "変更を元に戻して取り消します",
        appleAssistReviewBarCloseLabel: "閉じる",
        appleAssistReviewBarCloseTitle: "変更は残してこの通知を閉じます",
        appleAssistReviewBarEmptyDiffLabel: "差分がありません",
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
        statusBarAppleAssistLabel: "Apple Assist",
        statusBarAppleAssistTitle: "Open the Apple Assist writing companion window",
        appleAssistReviewBarLabel: "Apple Assist changed your text",
        appleAssistReviewBarTitle: "Review or discard the pending AI edit",
        appleAssistReviewBarOpenDiffLabel: "Open diff",
        appleAssistReviewBarCloseDiffLabel: "Close diff",
        appleAssistReviewBarDiscardLabel: "Discard",
        appleAssistReviewBarDiscardTitle: "Revert the buffer and clear the review",
        appleAssistReviewBarCloseLabel: "Close",
        appleAssistReviewBarCloseTitle: "Keep the edit and dismiss the review",
        appleAssistReviewBarEmptyDiffLabel: "No diff to show",
        emptyPlaceholderText: "Start writing…",
        emptyPlaceholderHint: "Press Cmd+Shift+L to return to normal mode",
      };
}
