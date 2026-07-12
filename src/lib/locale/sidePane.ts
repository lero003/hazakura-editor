import { isJapaneseMenuLanguage, type MenuLanguage } from "../../types";
import { isKanaStyle } from "./_helpers";

export type SidePaneCopy = {
  agentWindow: string;
  agentWindowTitle: string;
  appleAssistWindow: string;
  appleAssistWindowTitle: string;
  diffTab: string;
  diffTabTitle: string;
  ebookReading: string;
  ebookTab: string;
  ebookTabTitle: string;
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
  referenceTab: string;
  referenceTabTitle: string;
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
      appleAssistWindow: "Hazakura Local Assist",
      appleAssistWindowTitle: "Hazakura Local Assist まどを ひらく / かくす",
      diffTab: "ちがひ",
      diffTabTitle: "へんかを みくらべて たしかめる",
      ebookReading: "ほんのやうに よむ (えーぼっく)",
      ebookTab: "ゑーほん",
      ebookTabTitle: "ほんのやうに ふみを よみかへす",
      fileComparison: "ふみくらべ",
      imagePreview: "ゑのしたみ",
      markdownPreview: "Markdown したみ",
      outlineEmpty: "このふみに Markdown のみだしはありません。",
      outlineTab: "みだし",
      outlineTabTitle: "みだしから もくてきの ばしょへ うつる",
      outlineTruncated: "みだしがおほいため、はじめの200件までしめします。",
      documentOutline: "ふみのみだし",
      openTextFileToPreview:
        "Markdown したみをしめすには、てきすとのふみをひらいてください。",
      previewDisabled: "したみのまどは、おこのみにて無効です。",
      previewTab: "したみ",
      previewTabTitle: "かいた Markdown の みためを たしかめる",
      referenceTab: "さんしょう",
      referenceTabTitle: "げんぽんを よこに みながら なおす",
      previewUnavailable: "したみをしめせません",
      reviewMenu: "かくにん",
      reviewMenuTitle: "へんこうをかくにん",
      resizeColumns: "えでぃたとよこのまどのはばをかへる",
      resizeColumnsTitle: "ひきて、えでぃたとよこのまどのはばをかへます",
      sidePaneMode: "よこのまど",
    };
  }

  return isJapaneseMenuLanguage(lang)
    ? {
        agentWindow: "Agent",
        agentWindowTitle: "Agent ウィンドウを開く",
        appleAssistWindow: "Hazakura Local Assist",
        appleAssistWindowTitle: "Hazakura Local Assist ウィンドウを表示 / 非表示",
        diffTab: "差分",
        diffTabTitle: "変更を見比べて確認",
        ebookReading: "本のように読む（電子書籍）",
        ebookTab: "電子書籍",
        ebookTabTitle: "本のように読み返す",
        fileComparison: "ファイル比較",
        imagePreview: "画像プレビュー",
        markdownPreview: "Markdown プレビュー",
        outlineEmpty: "このファイルに Markdown 見出しはありません。",
        outlineTab: "アウトライン",
        outlineTabTitle: "見出しから目的の場所へ移動",
        outlineTruncated: "見出しが多いため、最初の200件まで表示しています。",
        documentOutline: "文書アウトライン",
        openTextFileToPreview:
          "Markdown プレビューを表示するにはテキストファイルを開いてください。",
        previewDisabled: "プレビューは設定で無効です。",
        previewTab: "プレビュー",
        previewTabTitle: "書いた Markdown の見た目を確認",
        referenceTab: "参照",
        referenceTabTitle: "原本を横に見ながら直す",
        previewUnavailable: "プレビューを表示できません",
        reviewMenu: "確認",
        reviewMenuTitle: "変更を確認",
        resizeColumns: "エディタとサイドペインの幅を変更",
        resizeColumnsTitle:
          "ドラッグしてエディタとサイドペインの幅を変更",
        sidePaneMode: "サイドペイン表示",
      }
    : {
        agentWindow: "Agent",
        agentWindowTitle: "Open Agent window",
        appleAssistWindow: "Hazakura Local Assist",
        appleAssistWindowTitle: "Show or hide Hazakura Local Assist window",
        diffTab: "Diff",
        diffTabTitle: "Compare changes before deciding",
        ebookReading: "Read as a book (e-book)",
        ebookTab: "e-book",
        ebookTabTitle: "Read the document like a book",
        fileComparison: "File comparison",
        imagePreview: "Image Preview",
        markdownPreview: "Markdown preview",
        outlineEmpty: "This file has no Markdown headings.",
        outlineTab: "Outline",
        outlineTabTitle: "Jump to a section from its headings",
        outlineTruncated:
          "Showing the first 200 headings because this file has more.",
        documentOutline: "Document outline",
        openTextFileToPreview: "Open a text file to show Markdown preview.",
        previewDisabled: "Preview pane is disabled in Preferences.",
        previewTab: "Preview",
        previewTabTitle: "Check how the Markdown looks",
        referenceTab: "Reference",
        referenceTabTitle: "Edit while checking the source beside it",
        previewUnavailable: "Preview unavailable",
        reviewMenu: "Review",
        reviewMenuTitle: "Review changes",
        resizeColumns: "Resize editor and side pane columns",
        resizeColumnsTitle: "Drag to resize editor and side pane",
        sidePaneMode: "Side pane mode",
      };
}
