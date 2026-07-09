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
      title: "もじを よみとって したがきを つくる",
      message: [
        `「${fileName}」のなかの もじを よみとって、へんしゅうできる したがきを つくります。`,
        "",
        "・あたらしい たぶに、まだ ほぞんしていない したがきとして ひらきます",
        "・もとの ファイルは そのままです（かきかえません）",
        "・この Mac のなかだけで 処理します（ネットには おくりません）",
        "・うまく よめない ところも あるので、あとから なおせる したがきです",
      ].join("\n"),
    };
  }

  if (isJapaneseMenuLanguage(menuLanguage)) {
    return {
      title: "文字を読み取って下書きを作る",
      message: [
        `「${fileName}」のなかの文字を読み取って、編集できる下書きを作ります。`,
        "",
        "・新しいタブに、まだ保存していない下書きとして開きます",
        "・もとのファイルはそのままです（書き換えません）",
        "・この Mac の中だけで処理します（インターネットには送りません）",
        "・うまく読めないところもあるので、あとから直せる下書きです",
      ].join("\n"),
    };
  }

  return {
    title: "Read text into a draft",
    message: [
      `Read the text in “${fileName}” and open it as an editable draft?`,
      "",
      "• Opens in a new tab as an unsaved draft",
      "• Your original file stays as-is (nothing is overwritten)",
      "• Processing stays on this Mac (nothing is sent online)",
      "• Some parts may not read perfectly — you can edit the draft afterward",
    ].join("\n"),
  };
}
