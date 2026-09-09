import type { MenuLanguage } from "../../types";
import { isKanaStyle } from "./_helpers";

export function getCompactViewCopy(language: MenuLanguage) {
  if (isKanaStyle(language)) {
    return { label: "ぶんしょの ひょうじ", edit: "へんしゅう", preview: "ぷれびゅー" };
  }
  if (language === "ja") {
    return { label: "文書の表示", edit: "編集", preview: "プレビュー" };
  }
  return { label: "Document view", edit: "Edit", preview: "Preview" };
}
