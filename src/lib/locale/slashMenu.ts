import { isJapaneseMenuLanguage, type MenuLanguage } from "../../types";
import { isKanaStyle } from "./_helpers";

export type SlashMenuCopy = {
  agentBadge: string;
  categoryAgent: string;
  categoryMarkdown: string;
  categoryReview: string;
  categoryShortcut: string;
  empty: string;
  markdownBadge: string;
  reviewBadge: string;
  shortcutBadge: string;
};

export function getSlashMenuCopy(lang: MenuLanguage): SlashMenuCopy {
  if (isKanaStyle(lang)) {
    return {
      agentBadge: "Agent",
      categoryAgent: "えーじぇんとのわざ",
      categoryMarkdown: "Markdown のかたまり",
      categoryReview: "れびゅーのつくゑ",
      categoryShortcut: "ちかみち",
      empty: "あふすらっしゅこまんどはありません",
      markdownBadge: "Md",
      reviewBadge: "みる",
      shortcutBadge: "Key",
    };
  }

  return isJapaneseMenuLanguage(lang)
    ? {
        agentBadge: "Agent",
        categoryAgent: "エージェントコマンド",
        categoryMarkdown: "Markdown ブロック",
        categoryReview: "レビューデスク",
        categoryShortcut: "ショートカット",
        empty: "一致するスラッシュコマンドがありません",
        markdownBadge: "Md",
        reviewBadge: "確認",
        shortcutBadge: "Key",
      }
    : {
        agentBadge: "Agent",
        categoryAgent: "Agent commands",
        categoryMarkdown: "Markdown blocks",
        categoryReview: "Review Desk",
        categoryShortcut: "Shortcuts",
        empty: "No matching slash command",
        markdownBadge: "Md",
        reviewBadge: "Rv",
        shortcutBadge: "Key",
      };
}
