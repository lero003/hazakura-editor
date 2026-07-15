import { isJapaneseMenuLanguage, type MenuLanguage } from "../../types";
import { formatSaveFailureMessage, formatTimestamp } from "./_helpers";

export type RecoveryCopy = {
  closeWithoutSaving: string;
  conflictActions: string;
  conflictDetail: string;
  conflictHeading: string;
  dismiss: string;
  discardDraft: string;
  /** Confirm before permanently discarding a recoverable draft. */
  discardDraftConfirm: string;
  draftActions: string;
  draftAvailable: (name: string) => string;
  errorActions: string;
  keepEditing: string;
  pathlessDraftAvailable: (name: string) => string;
  pathlessDraftDetail: string;
  pathlessDraftFallbackName: string;
  reopenFromDisk: string;
  reviewChanges: string;
  restoreDraft: string;
  saveErrorActions: string;
  saveFailure: string;
  savedLocally: (timestamp: number) => string;
  trySaveAgain: string;
};

export function getRecoveryCopy(lang: MenuLanguage): RecoveryCopy {
  return isJapaneseMenuLanguage(lang)
    ? {
        closeWithoutSaving: "保存せず閉じる",
        conflictActions: "外部変更の操作",
        conflictDetail:
          "別のアプリでこのファイルが変更された可能性があります。続ける方法を選ぶまで保存はできません。",
        conflictHeading: "ファイルが外部で変更されました",
        dismiss: "閉じる",
        discardDraft: "下書きを破棄",
        discardDraftConfirm:
          "この下書きを破棄しますか？破棄すると元に戻せません。",
        draftActions: "下書きの操作",
        draftAvailable: (name: string) => `${name} の未保存の下書きがあります。`,
        errorActions: "エラーの操作",
        keepEditing: "編集を続ける",
        pathlessDraftAvailable: (name: string) =>
          `「${name}」の保存前メモを復旧できます。`,
        pathlessDraftDetail:
          "まだファイルには書き込まれていません。復元するか破棄してください。",
        pathlessDraftFallbackName: "新規下書き",
        reopenFromDisk: "ディスクから再読み込み",
        reviewChanges: "変更を確認",
        restoreDraft: "下書きを復元",
        saveErrorActions: "保存エラーの操作",
        saveFailure:
          "保存に失敗しました。編集内容はエディタ内に残っています。ファイルやフォルダの問題を確認してから、もう一度保存してください。",
        savedLocally: (timestamp: number) =>
          `ローカル保存: ${formatTimestamp(timestamp)}`,
        trySaveAgain: "もう一度保存",
      }
    : {
        closeWithoutSaving: "Close without saving",
        conflictActions: "Conflict actions",
        conflictDetail:
          "This file may have been changed in another app. Saving stays paused until you choose how to continue.",
        conflictHeading: "File changed outside Hazakura",
        dismiss: "Dismiss",
        discardDraft: "Discard draft",
        discardDraftConfirm:
          "Discard this draft? This cannot be undone.",
        draftActions: "Draft actions",
        draftAvailable: (name: string) =>
          `Unsaved draft available for ${name}.`,
        errorActions: "Error actions",
        keepEditing: "Keep editing",
        pathlessDraftAvailable: (name: string) =>
          `Recoverable pre-save note “${name}” is available.`,
        pathlessDraftDetail:
          "Nothing has been written to a file yet. Restore it or discard it.",
        pathlessDraftFallbackName: "Untitled draft",
        reopenFromDisk: "Reopen from disk",
        reviewChanges: "Review changes",
        restoreDraft: "Restore draft",
        saveErrorActions: "Save error actions",
        saveFailure: formatSaveFailureMessage(),
        savedLocally: (timestamp: number) =>
          `Saved locally ${formatTimestamp(timestamp)}.`,
        trySaveAgain: "Try save again",
      };
}
