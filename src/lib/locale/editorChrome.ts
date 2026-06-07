import { isJapaneseMenuLanguage, type MenuLanguage } from "../../types";
import { isKanaStyle } from "./_helpers";

export type EditorChromeCopy = {
  caseSensitive: string;
  closeSearch: string;
  encoding: string;
  encodings: string;
  find: string;
  findInActiveFile: string;
  findOptions: string;
  inlineCode: string;
  inlineCodeTitle: string;
  invalidRegex: string;
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
      encodings: "ふみのかきかた",
      find: "さがす",
      findInActiveFile: "いまのふみをさがす",
      findOptions: "さがしのおこのみ",
      inlineCode: "こーど",
      inlineCodeTitle: "こーど (Command+E)",
      invalidRegex: "正規表現がただしくありません",
      lineEnding: "かへり",
      lineEndings: "かへりのしるし",
      next: "つぎへ",
      noMatches: "あたりなし",
      noSearch: "さがしなし",
      previous: "まへへ",
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
        encodings: "文字コード",
        find: "検索",
        findInActiveFile: "アクティブファイル内を検索",
        findOptions: "検索オプション",
        inlineCode: "インラインコード",
        inlineCodeTitle: "インラインコード (Command+E)",
        invalidRegex: "正規表現が無効です",
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
        encodings: "Encodings",
        find: "Find",
        findInActiveFile: "Find in active file",
        findOptions: "Find options",
        inlineCode: "Inline code",
        inlineCodeTitle: "Inline code (Command+E)",
        invalidRegex: "Invalid regex",
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
