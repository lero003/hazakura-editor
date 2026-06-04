import type { MenuLanguage } from "../../types";
import { isJapaneseMenuLanguage } from "../../types";
import { isKanaStyle } from "./_helpers";

export type AutoBackupRestoreCopy = {
  applyButton: string;
  closeButton: string;
  emptyMessage: string;
  loadErrorPrefix: string;
  title: string;
};

export function getAutoBackupRestoreCopy(
  lang: MenuLanguage,
): AutoBackupRestoreCopy {
  if (isKanaStyle(lang)) {
    return {
      applyButton: "この ばっくあっぷに もどす",
      closeButton: "とぢる",
      emptyMessage:
        "この ふみの ばっくあっぷは まだ ありません。",
      loadErrorPrefix: "ばっくあっぷを よみこめません:",
      title: "ばっくあっぷから ふくげん",
    };
  }
  if (isJapaneseMenuLanguage(lang)) {
    return {
      applyButton: "このバックアップを復元",
      closeButton: "閉じる",
      emptyMessage:
        "このファイルの自動バックアップはまだありません。",
      loadErrorPrefix: "バックアップの読み込みに失敗しました:",
      title: "自動バックアップから復元",
    };
  }
  return {
    applyButton: "Restore this backup",
    closeButton: "Close",
    emptyMessage: "No auto-backups for this file yet.",
    loadErrorPrefix: "Could not load backups:",
    title: "Restore from auto-backup",
  };
}
