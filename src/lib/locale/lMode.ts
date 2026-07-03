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
  actionRailAppleAssistShortLabel: string;
  actionRailTypewriterShortLabel: string;
  actionRailReviewChangesShortLabel: string;
  actionRailAppleAssistTooltip: string;
  actionRailTypewriterTooltip: string;
  actionRailReviewChangesTooltip: string;
  statusBarAppleAssistTitle: string;
  workspaceToggleLabel: string;
  workspaceToggleTitle: string;
  workspaceOverlayLabel: string;
  workspaceOverlayCloseLabel: string;
  unsavedIndicatorLabel: string;
  changeReviewSheetLabel: string;
  changeReviewSheetTitle: string;
  changeReviewSheetCloseLabel: string;
  changeReviewSheetCloseTitle: string;
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
      exitPillLabel: "へんしゅうへ",
      exitPillTitle: "へんしゅうもーどに きりかへ",
      actionRailLabel: "えるもーどのどうせん",
      statusBarReviewChangesLabel: "へんこうを かくにん",
      statusBarWorkspaceLabel: "わーくすぺーすへ",
      statusBarReviewChangesTitle: "えるもーどのまま ディスクとの さぶんを ひらく",
      statusBarWorkspaceTitle: "えるもーどをとじて わーくすぺーすに もどる",
      statusBarAppleAssistLabel: "Hazakura Local Assist",
      actionRailAppleAssistShortLabel: "Assist",
      actionRailTypewriterShortLabel: "たいぷ",
      actionRailReviewChangesShortLabel: "さぶん",
      actionRailAppleAssistTooltip:
        "Hazakura Local Assist の うぃんどう を ひらく (えるもーどから でずに)",
      actionRailTypewriterTooltip:
        "そくせん ちゅうおう を オン / オフ に きりかへ",
      actionRailReviewChangesTooltip:
        "えるもーどのまま ディスクとの さぶん を ひらく",
      statusBarAppleAssistTitle: "Hazakura Local Assist の ウィンドウを ひらく / かくす",
      workspaceToggleLabel: "わーくすぺーすを ひらく",
      workspaceToggleTitle: "えるもーどのまま ファイルツリーを ひらく / とぢる",
      workspaceOverlayLabel: "えるもーどの ファイルツリー",
      workspaceOverlayCloseLabel: "ファイルツリーを とぢる",
      unsavedIndicatorLabel: "ほぞんしていません",
      changeReviewSheetLabel: "へんこうの かくにん",
      changeReviewSheetTitle: "ディスクとの差分",
      changeReviewSheetCloseLabel: "とぢる",
      changeReviewSheetCloseTitle: "へんこうの かくにんを とぢる",
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
        exitPillLabel: "編集モードへ",
        exitPillTitle: "編集モードに切り替え",
        actionRailLabel: "えるモードの導線",
        statusBarReviewChangesLabel: "変更を確認",
        statusBarWorkspaceLabel: "ワークスペースへ",
        statusBarReviewChangesTitle: "えるモードのままディスクとの差分を開く",
        statusBarWorkspaceTitle: "えるモードを閉じてワークスペースに戻る",
        statusBarAppleAssistLabel: "Hazakura Local Assist",
        actionRailAppleAssistShortLabel: "Assist",
        actionRailTypewriterShortLabel: "タイプ",
        actionRailReviewChangesShortLabel: "確認",
        actionRailAppleAssistTooltip:
          "Hazakura Local Assist ウィンドウを開く（えるモードから出ずに）",
        actionRailTypewriterTooltip:
          "タイプライターモードをオン / オフに切り替え（カーソル行を縦中央付近に保つ）",
        actionRailReviewChangesTooltip:
          "えるモードのまま、ディスクとの差分を開く",
        statusBarAppleAssistTitle: "Hazakura Local Assist ウィンドウを表示 / 非表示",
        workspaceToggleLabel: "ワークスペースを開く",
        workspaceToggleTitle: "えるモードのままファイルツリーを表示 / 非表示",
        workspaceOverlayLabel: "えるモードのファイルツリー",
        workspaceOverlayCloseLabel: "ファイルツリーを閉じる",
        unsavedIndicatorLabel: "未保存です",
        changeReviewSheetLabel: "変更の確認",
        changeReviewSheetTitle: "ディスクとの差分",
        changeReviewSheetCloseLabel: "閉じる",
        changeReviewSheetCloseTitle: "変更の確認を閉じる",
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
        exitPillLabel: "Edit mode",
        exitPillTitle: "Switch to edit mode",
        actionRailLabel: "L Mode actions",
        statusBarReviewChangesLabel: "Review changes",
        statusBarWorkspaceLabel: "Open workspace",
        statusBarReviewChangesTitle: "Open the diff against disk without leaving L Mode",
        statusBarWorkspaceTitle: "Exit L Mode and return to the workspace",
        statusBarAppleAssistLabel: "Hazakura Local Assist",
        actionRailAppleAssistShortLabel: "Assist",
        actionRailTypewriterShortLabel: "Type",
        actionRailReviewChangesShortLabel: "Diff",
        actionRailAppleAssistTooltip:
          "Open the Hazakura Local Assist writing companion without leaving L Mode",
        actionRailTypewriterTooltip:
          "Toggle typewriter mode on or off (keeps the active line near the vertical center)",
        actionRailReviewChangesTooltip:
          "Open the disk-vs-editor diff without leaving L Mode",
        statusBarAppleAssistTitle:
          "Show or hide the Hazakura Local Assist writing companion window",
        workspaceToggleLabel: "Open workspace",
        workspaceToggleTitle: "Show or hide the file tree without leaving L Mode",
        workspaceOverlayLabel: "L Mode file tree",
        workspaceOverlayCloseLabel: "Close file tree",
        unsavedIndicatorLabel: "Unsaved changes",
        changeReviewSheetLabel: "Change review",
        changeReviewSheetTitle: "Changes against disk",
        changeReviewSheetCloseLabel: "Close",
        changeReviewSheetCloseTitle: "Close change review",
        emptyPlaceholderText: "Start writing…",
        emptyPlaceholderHint: "Press Cmd+Shift+L to return to normal mode",
      };
}
