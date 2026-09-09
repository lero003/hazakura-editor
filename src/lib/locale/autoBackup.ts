import type { MenuLanguage } from "../../types";
import { isJapaneseMenuLanguage } from "../../types";
import { isKanaStyle } from "./_helpers";

export type AutoBackupRestoreCopy = {
  applyButton: string;
  compareButton: string;
  selectionHint: string;
  loadingMessage: string;
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
      compareButton: "いまの ふみと くらべる",
      selectionHint: "えらぶと いまの へんしゅうとの ちがいを ひらきます。はんえいは かくにんした あと。じどうで ほぞんしません。",
      loadingMessage: "ばっくあっぷを よみこんでいます…",
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
      compareButton: "現在の編集と比較",
      selectionHint: "選ぶと現在の編集との比較を開きます。反映は確認したあと。自動では保存しません。",
      loadingMessage: "バックアップを読み込んでいます…",
      closeButton: "閉じる",
      emptyMessage:
        "このファイルの自動バックアップはまだありません。",
      loadErrorPrefix: "バックアップの読み込みに失敗しました:",
      title: "自動バックアップから復元",
    };
  }
  return {
    applyButton: "Restore this backup",
    compareButton: "Compare with current edits",
    selectionHint: "Choose a backup to compare with your current edits. Apply only after review. Nothing is saved automatically.",
    loadingMessage: "Loading backups…",
    closeButton: "Close",
    emptyMessage: "No auto-backups for this file yet.",
    loadErrorPrefix: "Could not load backups:",
    title: "Restore from auto-backup",
  };
}
