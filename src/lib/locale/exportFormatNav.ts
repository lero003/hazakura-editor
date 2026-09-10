import type { MenuLanguage } from "../../types";

/**
 * 書き出しの形式ナビ（画面11）。
 *
 * 3つのコマンド（EPUB / PDF / HTML）はそのまま残し、**共通のダイアログ枠**に
 * 形式を選ぶ入口を置く。切替は各形式の既存の準備処理を呼ぶだけで、新しい
 * 書き出し経路は作らない。
 */
export type ExportFormatNavCopy = {
  groupLabel: string;
  epub: string;
  pdf: string;
  html: string;
};

const ja: ExportFormatNavCopy = {
  groupLabel: "書き出す形式",
  epub: "電子書籍（EPUB）",
  pdf: "PDF",
  html: "HTML",
};

const kana: ExportFormatNavCopy = {
  groupLabel: "かきだす しき",
  epub: "でんし しょせき（EPUB）",
  pdf: "PDF",
  html: "HTML",
};

const en: ExportFormatNavCopy = {
  groupLabel: "Export format",
  epub: "E-book (EPUB)",
  pdf: "PDF",
  html: "HTML",
};

export function getExportFormatNavCopy(
  language: MenuLanguage,
): ExportFormatNavCopy {
  if (language === "kana") return kana;
  if (language === "ja") return ja;
  return en;
}
