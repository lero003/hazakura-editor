import { isJapaneseMenuLanguage, type MenuLanguage } from "../../types";
import { isKanaStyle } from "./_helpers";

export type SidePaneCopy = {
  agentWindow: string;
  agentWindowTitle: string;
  appleAssistWindow: string;
  appleAssistWindowTitle: string;
  diffTab: string;
  diffTabTitle: string;
  /** Active Diff: hide the compare pane without discarding source. */
  diffTabTitleHide: string;
  ebookReading: string;
  ebookTab: string;
  ebookTabTitle: string;
  ebookTabTitleHide: string;
  fileComparison: string;
  imagePreview: string;
  markdownPreview: string;
  outlineEmpty: string;
  outlineEmptyHeading: string;
  outlineAdvisorySummary: (count: number) => string;
  outlineSkippedLevel: (previousLevel: number, level: number) => string;
  outlineDuplicateLabel: (firstLine: number) => string;
  outlineLongSection: (lineCount: number) => string;
  outlinePromoteHeading: (label: string) => string;
  outlineDemoteHeading: (label: string) => string;
  outlinePageBreak: string;
  outlineTrailingPageBreak: string;
  outlineTab: string;
  outlineTabTitle: string;
  outlineTabTitleHide: string;
  outlineTruncated: string;
  documentOutline: string;
  openTextFileToPreview: string;
  openTextFileToEbook: string;
  previewDisabled: string;
  previewTab: string;
  previewTabTitle: string;
  previewTabTitleHide: string;
  referenceTab: string;
  referenceTabTitle: string;
  referenceTabTitleHide: string;
  /** Reference session is loaded but the column is hidden. */
  referenceTabTitleRetained: string;
  referenceRetainedStatus: string;
  lModeReferenceRetainedStatus: string;
  previewUnavailable: string;
  /** Delayed Suspense status for Preview chunk load. */
  loadingPreview: string;
  /** Delayed Suspense status for e-book chunk load. */
  loadingEbook: string;
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
      diffTabTitleHide: "さぶんを かくす（げんぽんは のこる）",
      ebookReading: "ほんのやうに よむ (えーぼっく)",
      ebookTab: "ゑーほん",
      ebookTabTitle: "ほんのやうに ふみを よみかへす",
      ebookTabTitleHide: "えーぼっくを かくす（ふみは のこる）",
      fileComparison: "ふみくらべ",
      imagePreview: "ゑのしたみ",
      markdownPreview: "Markdown したみ",
      outlineEmpty: "このふみに Markdown のみだしはありません。",
      outlineEmptyHeading: "なまへのない みだし",
      outlineAdvisorySummary: (count) => `こうぞうの ていあん ${count}けん`,
      outlineSkippedLevel: (previousLevel, level) =>
        `みだしの だんが ${previousLevel} から ${level} へ とんでいます`,
      outlineDuplicateLabel: (firstLine) =>
        `${firstLine}ぎょうめと おなじ みだしです`,
      outlineLongSection: (lineCount) =>
        `この せくしょんは とても ながいです（${lineCount}ぎょう）`,
      outlinePromoteHeading: (label) => `${label} の だんを ひとつ あげる`,
      outlineDemoteHeading: (label) => `${label} の だんを ひとつ さげる`,
      outlinePageBreak: "ぺーじの きれめ",
      outlineTrailingPageBreak: "さいごの ぺーじきれめ（ひょうじでは のぞく）",
      outlineTab: "みだし",
      outlineTabTitle: "みだしから もくてきの ばしょへ うつる",
      outlineTabTitleHide: "みだしを かくす",
      outlineTruncated: "みだしがおほいため、はじめの200件までしめします。",
      documentOutline: "ふみのみだし",
      openTextFileToPreview:
        "よむには、てきすとのふみを ひらいてください。",
      openTextFileToEbook:
        "ほんのように よむには、てきすとのふみを ひらいてください。",
      previewDisabled:
        "したみは おこのみで つかわないせっていです。ふみそのものは のこります。",
      previewTab: "したみ",
      previewTabTitle: "かいた Markdown の みためを たしかめる",
      previewTabTitleHide: "したみを かくす（げんぽんは のこる）",
      referenceTab: "さんしょう",
      referenceTabTitle: "げんぽんを よこに みながら なおす",
      referenceTabTitleHide: "さんしょうを かくす（よみこみは のこる）",
      referenceTabTitleRetained: "よみこんだ さんしょうを ふたたび ひらく",
      referenceRetainedStatus:
        "さんしょうは のこっています。さんしょうボタンで ふたたび ひらけます。",
      lModeReferenceRetainedStatus:
        "L Mode ちゅうは さんしょうを かくします。おわると もどります。",
      previewUnavailable: "したみをしめせません",
      loadingPreview: "したみを よみこみちゅう…",
      loadingEbook: "えーぼっくを よみこみちゅう…",
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
        diffTabTitleHide: "差分を隠す（原稿は残る）",
        ebookReading: "本のように読む（電子書籍）",
        ebookTab: "電子書籍",
        ebookTabTitle: "本のように読み返す",
        ebookTabTitleHide: "電子書籍表示を隠す（原稿は残る）",
        fileComparison: "ファイル比較",
        imagePreview: "画像プレビュー",
        markdownPreview: "Markdown プレビュー",
        outlineEmpty: "このファイルに Markdown 見出しはありません。",
        outlineEmptyHeading: "名前のない見出し",
        outlineAdvisorySummary: (count) => `構造の提案 ${count}件`,
        outlineSkippedLevel: (previousLevel, level) =>
          `見出しレベルが ${previousLevel} から ${level} へ飛んでいます`,
        outlineDuplicateLabel: (firstLine) =>
          `${firstLine}行目と同じナビゲーション名です`,
        outlineLongSection: (lineCount) =>
          `このセクションは非常に長いです（${lineCount}行）`,
        outlinePromoteHeading: (label) =>
          `「${label}」の見出しレベルを1つ上げる`,
        outlineDemoteHeading: (label) =>
          `「${label}」の見出しレベルを1つ下げる`,
        outlinePageBreak: "ページ区切り",
        outlineTrailingPageBreak: "末尾のページ区切り（表示では除外）",
        outlineTab: "アウトライン",
        outlineTabTitle: "見出しから目的の場所へ移動",
        outlineTabTitleHide: "アウトラインを隠す",
        outlineTruncated: "見出しが多いため、最初の200件まで表示しています。",
        documentOutline: "文書アウトライン",
        openTextFileToPreview:
          "読む・見た目を確かめるには、テキストファイルを開いてください。",
        openTextFileToEbook:
          "本のように読むには、テキストファイルを開いてください。",
        previewDisabled:
          "プレビューは設定でオフです。原稿そのものは残ります。",
        previewTab: "プレビュー",
        previewTabTitle: "書いた Markdown の見た目を確認",
        previewTabTitleHide: "プレビューを隠す（原稿は残る）",
        referenceTab: "参照",
        referenceTabTitle: "原本を横に見ながら直す",
        referenceTabTitleHide: "参照を隠す（読み込みは残る）",
        referenceTabTitleRetained: "読み込み済みの参照を再表示",
        referenceRetainedStatus:
          "参照は保持されています。参照ボタンでもう一度表示できます。",
        lModeReferenceRetainedStatus:
          "L Mode 中は参照を一時的に隠します。終了すると戻ります。",
        previewUnavailable: "プレビューを表示できません",
        loadingPreview: "プレビューを読み込み中…",
        loadingEbook: "電子書籍表示を読み込み中…",
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
        diffTabTitleHide: "Hide Diff — source stays in the editor",
        ebookReading: "Read as a book (e-book)",
        ebookTab: "e-book",
        ebookTabTitle: "Read the document like a book",
        ebookTabTitleHide: "Hide e-book reading — source stays",
        fileComparison: "File comparison",
        imagePreview: "Image Preview",
        markdownPreview: "Markdown preview",
        outlineEmpty: "This file has no Markdown headings.",
        outlineEmptyHeading: "Untitled heading",
        outlineAdvisorySummary: (count) =>
          `${count} structure suggestion${count === 1 ? "" : "s"}`,
        outlineSkippedLevel: (previousLevel, level) =>
          `Heading level jumps from ${previousLevel} to ${level}`,
        outlineDuplicateLabel: (firstLine) =>
          `Same navigation label as line ${firstLine}`,
        outlineLongSection: (lineCount) =>
          `This section is very long (${lineCount} lines)`,
        outlinePromoteHeading: (label) => `Promote “${label}” one level`,
        outlineDemoteHeading: (label) => `Demote “${label}” one level`,
        outlinePageBreak: "Page break",
        outlineTrailingPageBreak: "Trailing page break (not rendered)",
        outlineTab: "Outline",
        outlineTabTitle: "Jump to a section from its headings",
        outlineTabTitleHide: "Hide outline",
        outlineTruncated:
          "Showing the first 200 headings because this file has more.",
        documentOutline: "Document outline",
        openTextFileToPreview:
          "Open a text file to read and check how it looks.",
        openTextFileToEbook: "Open a text file to read it like a book.",
        previewDisabled:
          "Preview is off in Preferences. Your source stays intact.",
        previewTab: "Preview",
        previewTabTitle: "Check how the Markdown looks",
        previewTabTitleHide: "Hide preview — source stays in the editor",
        referenceTab: "Reference",
        referenceTabTitle: "Edit while checking the source beside it",
        referenceTabTitleHide: "Hide reference — the loaded file stays",
        referenceTabTitleRetained: "Show the loaded reference again",
        referenceRetainedStatus:
          "Reference is still loaded. Toggle Reference to show it again.",
        lModeReferenceRetainedStatus:
          "L Mode hides Reference for now; it returns when you leave.",
        previewUnavailable: "Preview unavailable",
        loadingPreview: "Loading preview…",
        loadingEbook: "Loading e-book…",
        reviewMenu: "Review",
        reviewMenuTitle: "Review changes",
        resizeColumns: "Resize editor and side pane columns",
        resizeColumnsTitle: "Drag to resize editor and side pane",
        sidePaneMode: "Side pane mode",
      };
}
