import { isJapaneseMenuLanguage, type MenuLanguage } from "../../types";
import { isKanaStyle } from "./_helpers";

export type EditorChromeCopy = {
  caseSensitive: string;
  closeSearch: string;
  encoding: string;
  /** 「文字コード」チップの説明（読み直す／保存時の2つの意味を持つ1チップ）。 */
  encodingChipTitle: string;
  /** 読み直せない理由（未保存の編集がある／パスが無い）。 */
  encodingReopenBlocked: string;
  /** 1チップ内の第1群: ファイルをこの文字コードで読み直す。 */
  encodingReopenGroup: string;
  /** 1チップ内の第2群: 次に保存するときの文字コードを変える。 */
  encodingSaveGroup: string;
  /**
   * 文字コードチップの select は**これから行う操作**を選ぶ面（アクション選択）で、
   * 現在値はチップの表示が示す。ここはその select の aria-label。
   */
  encodingActionLabel: string;
  /** まだ操作を選んでいない中立の表示（selected は常にこれ）。 */
  encodingActionPlaceholder: string;
  find: string;
  findInActiveFile: string;
  findOptions: string;
  go: string;
  goToLine: string;
  inlineCode: string;
  inlineCodeTitle: string;
  invalidRegex: string;
  line: string;
  lineEnding: string;
  lineEndings: string;
  next: string;
  noMatches: string;
  noSearch: string;
  previous: string;
  regex: string;
  replace: string;
  replacePlaceholder: string;
  replaceOne: string;
  replaceAll: string;
  searchActiveFile: string;
  word: string;
};

export function getEditorChromeCopy(lang: MenuLanguage): EditorChromeCopy {
  if (isKanaStyle(lang)) {
    return {
      caseSensitive: "おほもじ",
      closeSearch: "さがしをとぢる",
      encoding: "ふみのかきかた",
      encodingChipTitle: "よみなほす かきかたと、つぎに ほぞんする かきかたを えらびます。",
      encodingReopenBlocked: "よみなほすには、さきに ほぞんするか、すててください。",
      encodingReopenGroup: "この かきかたで よみなほす",
      encodingSaveGroup: "ほぞんする かきかたを かへる",
      encodingActionLabel: "もじこーどの そうさ",
      encodingActionPlaceholder: "そうさを えらぶ",
      find: "さがす",
      findInActiveFile: "いまのふみをさがす",
      findOptions: "さがしのおこのみ",
      go: "ゆく",
      goToLine: "くだりへゆく",
      inlineCode: "こーど",
      inlineCodeTitle: "こーど (Command+E)",
      invalidRegex: "正規表現がただしくありません",
      line: "くだり",
      lineEnding: "かへり",
      lineEndings: "かへりのしるし",
      next: "つぎへ",
      noMatches: "あたりなし",
      noSearch: "さがしなし",
      previous: "まえへ",
      regex: "正規表現",
      replace: "おきかへ",
      replacePlaceholder: "おきかへるもじ",
      replaceOne: "おきかへ",
      replaceAll: "すべておきかへ",
      searchActiveFile: "いまのふみをさがす",
      word: "ことば",
    };
  }

  return isJapaneseMenuLanguage(lang)
    ? {
        caseSensitive: "大文字",
        closeSearch: "検索を閉じる",
        encoding: "文字コード",
        encodingChipTitle: "このファイルを読み直す文字コードと、次に保存するときの文字コードを選びます。",
        encodingReopenBlocked: "読み直すには、未保存の編集を保存するか、破棄してください。",
        encodingReopenGroup: "この文字コードで読み直す",
        encodingSaveGroup: "保存する文字コードを変える",
        encodingActionLabel: "文字コードの操作",
        encodingActionPlaceholder: "操作を選ぶ",
        find: "検索",
        findInActiveFile: "アクティブファイル内を検索",
        findOptions: "検索オプション",
        go: "移動",
        goToLine: "指定行へ移動",
        inlineCode: "インラインコード",
        inlineCodeTitle: "インラインコード (Command+E)",
        invalidRegex: "正規表現が無効です",
        line: "行",
        lineEnding: "改行",
        lineEndings: "改行コード",
        next: "次へ",
        noMatches: "一致なし",
        noSearch: "検索なし",
        previous: "前へ",
        regex: "正規表現",
        replace: "置換",
        replacePlaceholder: "置換する文字列",
        replaceOne: "置換",
        replaceAll: "すべて置換",
        searchActiveFile: "アクティブファイルを検索",
        word: "単語",
      }
    : {
        caseSensitive: "Case",
        closeSearch: "Close search",
        encoding: "Encoding",
        encodingChipTitle: "Choose the encoding used to re-read this file, and the encoding used the next time it is saved.",
        encodingReopenBlocked: "Save or discard unsaved changes before re-reading the file.",
        encodingReopenGroup: "Re-read the file as",
        encodingSaveGroup: "Use when saving",
        encodingActionLabel: "Encoding actions",
        encodingActionPlaceholder: "Choose an action",
        find: "Find",
        findInActiveFile: "Find in active file",
        findOptions: "Find options",
        go: "Go",
        goToLine: "Go to line",
        inlineCode: "Inline code",
        inlineCodeTitle: "Inline code (Command+E)",
        invalidRegex: "Invalid regex",
        line: "Line",
        lineEnding: "Line",
        lineEndings: "Line endings",
        next: "Next",
        noMatches: "No matches",
        noSearch: "No search",
        previous: "Prev",
        regex: "Regex",
        replace: "Replace",
        replacePlaceholder: "Replace with",
        replaceOne: "Replace",
        replaceAll: "Replace all",
        searchActiveFile: "Search active file",
        word: "Word",
      };
}
