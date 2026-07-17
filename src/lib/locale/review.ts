import { isJapaneseMenuLanguage, type MenuLanguage } from "../../types";
import { isKanaStyle } from "./_helpers";

// Per-area locale module for the change-review / diff surfaces.
// The Hazakura Local Assist review bar copy used to live on `LModeCopy`
// (because the bar borrows the L Mode palette and tone), and the diff
// column labels were module-private inside `useCompareExecution.ts`.
// Both are gathered here so the review surface has a single locale home,
// matching the existing per-area module pattern (appleAssist, reviewDesk,
// recovery). Wording is unchanged from the prior inline definitions.

export type ReviewCopy = {
  // AppleAssistReviewBar (moved from LModeCopy).
  appleAssistReviewBarLabel: string;
  appleAssistReviewBarTitle: string;
  appleAssistReviewBarOpenDiffLabel: string;
  appleAssistReviewBarCloseDiffLabel: string;
  appleAssistReviewBarAcceptLabel: string;
  appleAssistReviewBarAcceptTitle: string;
  appleAssistReviewBarDiscardLabel: string;
  appleAssistReviewBarDiscardTitle: string;
  /** Visible short note that Accept keeps the buffer dirty / unsaved. */
  appleAssistReviewBarUnsavedNote: string;
  appleAssistReviewBarEmptyDiffLabel: string;
  // ai-edit-vs-buffer column labels (moved from AppleAssistReviewBar locals).
  appleAssistReviewBarBeforeLabel: string;
  appleAssistReviewBarAfterLabel: string;
  // ChangeReviewView (moved from inline three-way expressions).
  changesTitle: string;
  additions: string;
  removed: string;
  summary: string;
  to: string;
  close: string;
  applyBackup: string;
  table: string;
  // Stale-review banner (change-review right pane).
  staleHeading: string;
  staleReasonBufferEdited: string;
  staleReasonTabSwitched: string;
  staleReasonTabClosed: string;
};

export type CompareColumnKey =
  | "disk"
  | "editor"
  | "draft"
  | "buffer"
  | "backup"
  | "center"
  | "right"
  | "source"
  | "target";

export function compareColumnLabel(
  menuLanguage: MenuLanguage,
  key: CompareColumnKey,
): string {
  if (isKanaStyle(menuLanguage)) {
    switch (key) {
      case "disk":
        return "でぃすく";
      case "editor":
        return "えでぃた";
      case "draft":
        return "したがき";
      case "buffer":
        return "えでぃた";
      case "backup":
        return "ばっくあっぷ";
      case "center":
        return "まんなか";
      case "right":
        return "みぎ";
      case "source":
        return "くらべもと";
      case "target":
        return "くらべさき";
    }
  }
  if (isJapaneseMenuLanguage(menuLanguage)) {
    switch (key) {
      case "disk":
        return "ディスク";
      case "editor":
        return "エディタ";
      case "draft":
        return "下書き";
      case "buffer":
        return "エディタ";
      case "backup":
        return "バックアップ";
      case "center":
        return "中央";
      case "right":
        return "右";
      case "source":
        return "比較元";
      case "target":
        return "比較先";
    }
  }
  switch (key) {
    case "disk":
      return "Disk";
    case "editor":
      return "Editor";
    case "draft":
      return "Draft";
    case "buffer":
      return "Editor";
    case "backup":
      return "Backup";
    case "center":
      return "Center";
    case "right":
      return "Right";
    case "source":
      return "Source";
    case "target":
      return "Target";
  }
}

export function compareMissingSelectionMessage(menuLanguage: MenuLanguage): string {
  if (isKanaStyle(menuLanguage)) {
    return "くらべもとと くらべさき ふたつの ふみを えらんで ください。";
  }
  if (isJapaneseMenuLanguage(menuLanguage)) {
    return "比較元と比較先の2つのテキストファイルを選んでください。";
  }
  return "Choose both a source and target text file before comparing.";
}

export function compareSameFileMessage(menuLanguage: MenuLanguage): string {
  if (isKanaStyle(menuLanguage)) {
    return "くらべもとと くらべさきには べつの ふみを えらんで ください。";
  }
  if (isJapaneseMenuLanguage(menuLanguage)) {
    return "比較元と比較先には別のファイルを選んでください。";
  }
  return "Choose different files for the source and target.";
}

export function getReviewCopy(lang: MenuLanguage): ReviewCopy {
  if (isKanaStyle(lang)) {
    return {
      appleAssistReviewBarLabel: "Hazakura Local Assist が ほんぶんを へんこうしました",
      appleAssistReviewBarTitle:
        "さぶんを かくにんして さいよう か はき を えらんでください",
      appleAssistReviewBarOpenDiffLabel: "さぶんを ひらく",
      appleAssistReviewBarCloseDiffLabel: "さぶんを とぢる",
      appleAssistReviewBarAcceptLabel: "さいよう",
      appleAssistReviewBarAcceptTitle:
        "へんこうを のこして れびゅーを おえます。ほぞんは まだ おこないません",
      appleAssistReviewBarDiscardLabel: "はき",
      appleAssistReviewBarDiscardTitle: "へんこうを もとに もどして はきします",
      appleAssistReviewBarUnsavedNote: "まだ ほぞん されていません",
      appleAssistReviewBarEmptyDiffLabel: "さぶんが ありません",
      appleAssistReviewBarBeforeLabel: "もとの ぶん",
      appleAssistReviewBarAfterLabel: "へんこうご",
      changesTitle: "へんこう かくにん",
      additions: "ついかぎょう",
      removed: "さくじょぎょう",
      summary: "くらべの がいよう",
      to: "と",
      close: "とぢる",
      applyBackup: "この ばっくあっぷに もどす",
      table: "へんこう かくにん",
      staleHeading: "この さぶんは ふるい です",
      staleReasonBufferEdited: "さぶんを ひらいてから ほんぶんが かわりました",
      staleReasonTabSwitched: "べつの ふみに きりかわりました",
      staleReasonTabClosed: "この ふみは とぢられました",
    };
  }

  return isJapaneseMenuLanguage(lang)
    ? {
        appleAssistReviewBarLabel: "Hazakura Local Assist が本文を変更しました",
        appleAssistReviewBarTitle: "差分を確認して採用または破棄を選んでください",
        appleAssistReviewBarOpenDiffLabel: "差分を開く",
        appleAssistReviewBarCloseDiffLabel: "差分を閉じる",
        appleAssistReviewBarAcceptLabel: "採用",
        appleAssistReviewBarAcceptTitle:
          "変更を残してレビューを終了します。保存はまだ行われません",
        appleAssistReviewBarDiscardLabel: "破棄",
        appleAssistReviewBarDiscardTitle: "変更を元に戻して破棄します",
        appleAssistReviewBarUnsavedNote: "まだ保存されていません",
        appleAssistReviewBarEmptyDiffLabel: "差分がありません",
        appleAssistReviewBarBeforeLabel: "変更前",
        appleAssistReviewBarAfterLabel: "変更後",
        changesTitle: "変更確認",
        additions: "追加行",
        removed: "削除行",
        summary: "比較の概要",
        to: "と",
        close: "閉じる",
        applyBackup: "このバックアップを復元",
        table: "変更確認",
        staleHeading: "この差分は古くなっています",
        staleReasonBufferEdited: "差分を開いてから本文が変更されました",
        staleReasonTabSwitched: "別のファイルに切り替わりました",
        staleReasonTabClosed: "このファイルは閉じられました",
      }
    : {
        appleAssistReviewBarLabel: "Hazakura Local Assist changed your text",
        appleAssistReviewBarTitle: "Review or discard the pending AI edit",
        appleAssistReviewBarOpenDiffLabel: "Open diff",
        appleAssistReviewBarCloseDiffLabel: "Close diff",
        appleAssistReviewBarAcceptLabel: "Accept",
        appleAssistReviewBarAcceptTitle:
          "Keep the edit and finish review. The document is not saved yet",
        appleAssistReviewBarDiscardLabel: "Discard",
        appleAssistReviewBarDiscardTitle: "Revert the buffer and clear the review",
        appleAssistReviewBarUnsavedNote: "Not saved yet",
        appleAssistReviewBarEmptyDiffLabel: "No diff to show",
        appleAssistReviewBarBeforeLabel: "Before",
        appleAssistReviewBarAfterLabel: "After",
        changesTitle: "Change review",
        additions: "Added lines",
        removed: "Removed lines",
        summary: "Comparison summary",
        to: "to",
        close: "Close",
        applyBackup: "Restore this backup",
        table: "Change review",
        staleHeading: "This diff is stale",
        staleReasonBufferEdited:
          "The document changed after this diff was opened",
        staleReasonTabSwitched: "A different file became active",
        staleReasonTabClosed: "This file was closed",
      };
}
