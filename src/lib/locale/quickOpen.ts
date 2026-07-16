import { isJapaneseMenuLanguage, type MenuLanguage } from "../../types";
import { isKanaStyle } from "./_helpers";

export type QuickOpenCopy = {
  dialogLabel: string;
  placeholder: string;
  empty: string;
  /** Always shown: list is the currently loaded tree, not a whole-workspace index. */
  scopeHint: string;
  /** Shown when some directories are truncated or not expanded yet. */
  treePartialHint: string;
  /** Shown when the result list is capped (e.g. first 100). */
  resultCapHint: (shown: number, total: number) => string;
};

export function getQuickOpenCopy(lang: MenuLanguage): QuickOpenCopy {
  if (isKanaStyle(lang)) {
    return {
      dialogLabel: "ふみを すぐひらく",
      placeholder: "ふみのなまえを...",
      empty: "ぴったりのふみはありません",
      scopeHint:
        "いまツリーに よみこまれた ふみだけを さがします。ぜんぶの フォルダを 索引しません。",
      treePartialHint:
        "まだひらいていない / 上限でみきれない フォルダは ふくみません。",
      resultCapHint: (shown, total) =>
        `${total} けんちゅう ${shown} けんを ひょうじ（さきの ${shown} けん）`,
    };
  }

  if (isJapaneseMenuLanguage(lang)) {
    return {
      dialogLabel: "クイックオープン",
      placeholder: "ファイル名を入力...",
      empty: "一致するファイルがありません",
      scopeHint:
        "ワークスペースツリーに読み込まれたファイルだけを検索します。全体索引はありません。",
      treePartialHint:
        "未展開、または件数上限で見切れたフォルダ内は含まれません。",
      resultCapHint: (shown, total) =>
        `${total} 件中 ${shown} 件を表示（先頭 ${shown} 件）`,
    };
  }

  return {
    dialogLabel: "Quick Open",
    placeholder: "Type a file name...",
    empty: "No matching files",
    scopeHint:
      "Searches files already loaded in the workspace tree. There is no whole-workspace index.",
    treePartialHint:
      "Folders not expanded yet, or truncated by the per-folder cap, are not included.",
    resultCapHint: (shown, total) =>
      `Showing ${shown} of ${total} (first ${shown})`,
  };
}
