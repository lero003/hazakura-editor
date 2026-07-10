import type { MenuLanguage } from "../../types";
import { isJapaneseMenuLanguage } from "../../types";
import { isKanaStyle } from "./_helpers";

export type ReferenceCompareCopy = {
  closeReference: string;
  emptyEditorHint: string;
  externalChangeNotice: string;
  fitPage: string;
  fitWidth: string;
  followActive: string;
  nextPage: string;
  nextReview: string;
  openAsReference: string;
  openReferenceFile: string;
  pageLabel: string;
  previousPage: string;
  previousReview: string;
  readOnly: string;
  referenceLabel: string;
  reloadReference: string;
  replaceReference: string;
  resumeFollow: string;
  retryRender: string;
  reviewAdvisory: string;
  reviewLabel: string;
  showDiff: string;
  showEditor: string;
  showReference: string;
  unsupportedType: string;
  zoomIn: string;
  zoomOut: string;
};

export function referenceCompareCopy(
  menuLanguage: MenuLanguage,
): ReferenceCompareCopy {
  if (isKanaStyle(menuLanguage)) {
    return {
      closeReference: "さんしょうを とぢる",
      emptyEditorHint: "へんしゅうする Markdown を ひらくか つくってください",
      externalChangeNotice: "さんしょうファイルが へんこうされました",
      fitPage: "ページにあわせる",
      fitWidth: "はばにあわせる",
      followActive: "ついじゅう ちゅう",
      nextPage: "つぎの ページ",
      nextReview: "つぎの ようかくにん",
      openAsReference: "さんしょうとして ひらく",
      openReferenceFile: "さんしょうファイルを ひらく…",
      pageLabel: "ページ",
      previousPage: "まえの ページ",
      previousReview: "まえの ようかくにん",
      readOnly: "よみとりせんよう",
      referenceLabel: "さんしょう",
      reloadReference: "さいど よみこむ",
      replaceReference: "さんしょうを いれかえる…",
      resumeFollow: "ついじゅうを さいかい",
      retryRender: "さいど ひょうじ",
      reviewAdvisory: "めやす（せいかく とは かぎりません）",
      reviewLabel: "ようかくにん",
      showDiff: "さぶんを みる",
      showEditor: "へんしゅう",
      showReference: "さんしょう",
      unsupportedType: "この しゅるいは さんしょうできません",
      zoomIn: "拡大",
      zoomOut: "縮小",
    };
  }
  if (isJapaneseMenuLanguage(menuLanguage)) {
    return {
      closeReference: "参照を閉じる",
      emptyEditorHint: "編集する Markdown を開くか作成してください",
      externalChangeNotice: "参照ファイルが変更されました",
      fitPage: "ページに合わせる",
      fitWidth: "幅に合わせる",
      followActive: "追従中",
      nextPage: "次のページ",
      nextReview: "次の要確認",
      openAsReference: "参照として開く",
      openReferenceFile: "参照ファイルを開く…",
      pageLabel: "ページ",
      previousPage: "前のページ",
      previousReview: "前の要確認",
      readOnly: "読み取り専用",
      referenceLabel: "参照",
      reloadReference: "再読み込み",
      replaceReference: "参照を入れ替え…",
      resumeFollow: "追従を再開",
      retryRender: "再表示",
      reviewAdvisory: "目安です（正確とは限りません）",
      reviewLabel: "要確認",
      showDiff: "差分を見る",
      showEditor: "編集",
      showReference: "参照",
      unsupportedType: "この種類は参照として開けません",
      zoomIn: "拡大",
      zoomOut: "縮小",
    };
  }
  return {
    closeReference: "Close reference",
    emptyEditorHint:
      "Open or create a Markdown file to edit beside the reference.",
    externalChangeNotice: "The reference file has changed on disk.",
    fitPage: "Fit page",
    fitWidth: "Fit width",
    followActive: "Following",
    nextPage: "Next page",
    nextReview: "Next to review",
    openAsReference: "Open as reference",
    openReferenceFile: "Open reference file…",
    pageLabel: "Page",
    previousPage: "Previous page",
    previousReview: "Previous to review",
    readOnly: "Read-only",
    referenceLabel: "Reference",
    reloadReference: "Reload",
    replaceReference: "Replace reference…",
    resumeFollow: "Resume follow",
    retryRender: "Retry",
    reviewAdvisory: "Advisory only — not a correctness claim",
    reviewLabel: "Review",
    showDiff: "View diff",
    showEditor: "Edit",
    showReference: "Reference",
    unsupportedType: "This file type cannot be opened as a reference.",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
  };
}
