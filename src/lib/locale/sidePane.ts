import { isJapaneseMenuLanguage, type MenuLanguage } from "../../types";
import { isKanaStyle } from "./_helpers";

export type SidePaneCopy = {
  agentWindow: string;
  agentWindowTitle: string;
  appleAssistWindow: string;
  appleAssistWindowTitle: string;
  diffTab: string;
  diffTabTitle: string;
  fileComparison: string;
  imagePreview: string;
  markdownPreview: string;
  outlineEmpty: string;
  outlineTab: string;
  outlineTabTitle: string;
  outlineTruncated: string;
  documentOutline: string;
  openTextFileToPreview: string;
  previewDisabled: string;
  previewTab: string;
  previewTabTitle: string;
  previewUnavailable: string;
  reviewMenu: string;
  reviewMenuTitle: string;
  resizeColumns: string;
  resizeColumnsTitle: string;
  sidePaneMode: string;
};

export function getSidePaneCopy(lang: MenuLanguage): SidePaneCopy {
  if (isKanaStyle(lang)) {
    return {
      agentWindow: "Agent",
      agentWindowTitle: "Agent まどをひらく",
      appleAssistWindow: "Apple Local Assist",
      appleAssistWindowTitle: "Apple Local Assist まどを ひらく / かくす",
      diffTab: "ちがひ",
      diffTabTitle: "ちがひのまどをひらく",
      fileComparison: "ふみくらべ",
      imagePreview: "ゑのしたみ",
      markdownPreview: "Markdown したみ",
      outlineEmpty: "このふみに Markdown のみだしはありません。",
      outlineTab: "みだし",
      outlineTabTitle: "みだしをしめす",
      outlineTruncated: "みだしがおほいため、はじめの200件までしめします。",
      documentOutline: "ふみのみだし",
      openTextFileToPreview:
        "Markdown したみをしめすには、てきすとのふみをひらいてください。",
      previewDisabled: "したみのまどは、おこのみにて無効です。",
      previewTab: "したみ",
      previewTabTitle: "したみのまどをしめす",
      previewUnavailable: "したみをしめせません",
      reviewMenu: "かくにん",
      reviewMenuTitle: "へんこう、ちがひ、みだしのまどをひらく",
      resizeColumns: "えでぃたとよこのまどのはばをかへる",
      resizeColumnsTitle: "ひきて、えでぃたとよこのまどのはばをかへます",
      sidePaneMode: "よこのまど",
    };
  }

  return isJapaneseMenuLanguage(lang)
    ? {
        agentWindow: "Agent",
        agentWindowTitle: "Agent ウィンドウを開く",
        appleAssistWindow: "Apple Local Assist",
        appleAssistWindowTitle: "Apple Local Assist ウィンドウを表示 / 非表示",
        diffTab: "差分",
        diffTabTitle: "差分ペインを表示",
        fileComparison: "ファイル比較",
        imagePreview: "画像プレビュー",
        markdownPreview: "Markdown プレビュー",
        outlineEmpty: "このファイルに Markdown 見出しはありません。",
        outlineTab: "アウトライン",
        outlineTabTitle: "アウトラインを表示",
        outlineTruncated: "見出しが多いため、最初の200件まで表示しています。",
        documentOutline: "文書アウトライン",
        openTextFileToPreview:
          "Markdown プレビューを表示するにはテキストファイルを開いてください。",
        previewDisabled: "プレビューは設定で無効です。",
        previewTab: "プレビュー",
        previewTabTitle: "プレビューペインを表示",
        previewUnavailable: "プレビューを表示できません",
        reviewMenu: "確認",
        reviewMenuTitle: "変更確認・差分・アウトラインを開く",
        resizeColumns: "エディタとサイドペインの幅を変更",
        resizeColumnsTitle:
          "ドラッグしてエディタとサイドペインの幅を変更",
        sidePaneMode: "サイドペイン表示",
      }
    : {
        agentWindow: "Agent",
        agentWindowTitle: "Open Agent window",
        appleAssistWindow: "Apple Local Assist",
        appleAssistWindowTitle: "Show or hide Apple Local Assist window",
        diffTab: "Diff",
        diffTabTitle: "Show diff pane",
        fileComparison: "File comparison",
        imagePreview: "Image Preview",
        markdownPreview: "Markdown preview",
        outlineEmpty: "This file has no Markdown headings.",
        outlineTab: "Outline",
        outlineTabTitle: "Show outline pane",
        outlineTruncated:
          "Showing the first 200 headings because this file has more.",
        documentOutline: "Document outline",
        openTextFileToPreview: "Open a text file to show Markdown preview.",
        previewDisabled: "Preview pane is disabled in Preferences.",
        previewTab: "Preview",
        previewTabTitle: "Show preview pane",
        previewUnavailable: "Preview unavailable",
        reviewMenu: "Review",
        reviewMenuTitle: "Open change review, diff, or outline",
        resizeColumns: "Resize editor and side pane columns",
        resizeColumnsTitle: "Drag to resize editor and side pane",
        sidePaneMode: "Side pane mode",
      };
}
