import type { MenuLanguage } from "../../types";
import { isJapaneseMenuLanguage } from "../../types";
import { isKanaStyle } from "./_helpers";

export type ImportAssistConfirmCopy = {
  message: string;
  title: string;
};

/** Localized confirm copy shown before Import Assist runs. */
export function importAssistConfirmCopy(
  menuLanguage: MenuLanguage,
  fileName: string,
): ImportAssistConfirmCopy {
  if (isKanaStyle(menuLanguage)) {
    return {
      title: "Markdown したがきとして とりこむ",
      message: [
        `「${fileName}」を Markdown の したがきとして とりこみますか？`,
        "",
        "・みほぞんの たぶで ひらきます（もと ファイルは かえません）",
        "・てきすと ちゅうしゅつを ゆうせんし、ひつようなら たんまつない OCR を つかいます",
        "・かんぜんな へんかんではなく、へんしゅうようの したがきです",
      ].join("\n"),
    };
  }

  if (isJapaneseMenuLanguage(menuLanguage)) {
    return {
      title: "Markdown 下書きとして取り込む",
      message: [
        `「${fileName}」を Markdown 下書きとして取り込みますか？`,
        "",
        "・未保存のタブで開きます（元ファイルは変更しません）",
        "・テキスト抽出を優先し、必要なら端末内 OCR を使います",
        "・完全な変換ではなく、編集用の下書きです",
      ].join("\n"),
    };
  }

  return {
    title: "Import as Markdown draft",
    message: [
      `Import “${fileName}” as a Markdown draft?`,
      "",
      "• Opens in an unsaved tab (the original file is not modified)",
      "• Prefers embedded text; uses on-device OCR only when needed",
      "• This is an editable draft, not a perfect conversion",
    ].join("\n"),
  };
}
