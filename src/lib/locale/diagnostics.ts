import { isJapaneseMenuLanguage, type MenuLanguage } from "../../types";
import { isKanaStyle } from "./_helpers";

export type DiagnosticsPaneCopy = {
  actionLabel: string;
  copied: string;
  copyFailed: string;
  copy: string;
  json: string;
  refresh: string;
  unavailable: string;
};

export function getDiagnosticsPaneCopy(
  lang: MenuLanguage,
): DiagnosticsPaneCopy {
  if (isKanaStyle(lang)) {
    return {
      actionLabel: "しんだんの そうさ",
      copied: "コピーしました",
      copyFailed: "コピーできませんでした",
      copy: "コピー",
      json: "しんだん JSON",
      refresh: "さいど よみこむ",
      unavailable: "しんだん スナップショットが とれません。",
    };
  }

  return isJapaneseMenuLanguage(lang)
    ? {
        actionLabel: "診断の操作",
        copied: "コピーしました",
        copyFailed: "コピーできませんでした",
        copy: "コピー",
        json: "診断JSON",
        refresh: "再読み込み",
        unavailable: "診断スナップショットが取得できません。",
      }
    : {
        actionLabel: "Diagnostics actions",
        copied: "Copied",
        copyFailed: "Copy failed",
        copy: "Copy",
        json: "Diagnostics JSON",
        refresh: "Refresh",
        unavailable: "Snapshot unavailable.",
      };
}
