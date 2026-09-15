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
      actionLabel: "コピー そうさ",
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
        actionLabel: "コピー操作",
        copied: "コピーしました",
        copyFailed: "コピーできませんでした",
        copy: "コピー",
        json: "診断JSON",
        refresh: "再読み込み",
        unavailable: "診断スナップショットが取得できません。",
      }
    : {
        actionLabel: "Copy action",
        copied: "Copied",
        copyFailed: "Copy failed",
        copy: "Copy",
        json: "Diagnostics JSON",
        refresh: "Refresh",
        unavailable: "Snapshot unavailable.",
      };
}
