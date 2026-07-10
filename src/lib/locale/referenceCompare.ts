import type { MenuLanguage } from "../../types";
import { isJapaneseMenuLanguage } from "../../types";
import { isKanaStyle } from "./_helpers";

export type ReferenceCompareCopy = {
  closeReference: string;
  emptyEditorHint: string;
  openAsReference: string;
  openReferenceFile: string;
  readOnly: string;
  referenceLabel: string;
  replaceReference: string;
  showDiff: string;
  showEditor: string;
  showReference: string;
  unsupportedType: string;
};

export function referenceCompareCopy(
  menuLanguage: MenuLanguage,
): ReferenceCompareCopy {
  if (isKanaStyle(menuLanguage)) {
    return {
      closeReference: "さんしょうを とぢる",
      emptyEditorHint: "へんしゅうする Markdown を ひらくか つくってください",
      openAsReference: "さんしょうとして ひらく",
      openReferenceFile: "さんしょうファイルを ひらく…",
      readOnly: "よみとりせんよう",
      referenceLabel: "さんしょう",
      replaceReference: "さんしょうを いれかえる…",
      showDiff: "さぶんを みる",
      showEditor: "へんしゅう",
      showReference: "さんしょう",
      unsupportedType: "この しゅるいは まだ さんしょうできません",
    };
  }
  if (isJapaneseMenuLanguage(menuLanguage)) {
    return {
      closeReference: "参照を閉じる",
      emptyEditorHint: "編集する Markdown を開くか作成してください",
      openAsReference: "参照として開く",
      openReferenceFile: "参照ファイルを開く…",
      readOnly: "読み取り専用",
      referenceLabel: "参照",
      replaceReference: "参照を入れ替え…",
      showDiff: "差分を見る",
      showEditor: "編集",
      showReference: "参照",
      unsupportedType: "この種類はまだ参照として開けません",
    };
  }
  return {
    closeReference: "Close reference",
    emptyEditorHint: "Open or create a Markdown file to edit beside the reference.",
    openAsReference: "Open as reference",
    openReferenceFile: "Open reference file…",
    readOnly: "Read-only",
    referenceLabel: "Reference",
    replaceReference: "Replace reference…",
    showDiff: "View diff",
    showEditor: "Edit",
    showReference: "Reference",
    unsupportedType: "This file type cannot be opened as a reference yet.",
  };
}
