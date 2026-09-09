import type { MenuLanguage } from "../../types";
export function imagePreviewCopy(language: MenuLanguage) {
  if (language === "kana") return { readOnly: "よみとりせんよう", loading: "がぞうを よみこんでいます…",
    failed: "がぞうを ひょうじできません。ファイルを えらびなおしてください。", dimensions: "がぞうの おおきさ" };
  if (language === "ja") return { readOnly: "読み取り専用", loading: "画像を読み込んでいます…",
    failed: "画像を表示できません。ファイルを選び直してください。", dimensions: "画像の実寸" };
  return { readOnly: "Read only", loading: "Loading image…", failed: "Could not display this image. Select the file again.", dimensions: "Image dimensions" };
}
