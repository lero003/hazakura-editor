import {
  isJapaneseMenuLanguage,
  type CandidateInputSource,
  type MenuLanguage,
} from "../../types";
import { isKanaStyle } from "./_helpers";

export type ReviewDeskCopy = {
  candidateApplyButton: string;
  candidateApplyButtonTitle: string;
  candidateApplyDisabledHint: string;
  candidateApplyWillMarkUnsaved: string;
  candidateClearButton: string;
  candidateClearButtonTitle: string;
  candidateColumnLeft: string;
  candidateColumnRight: string;
  candidateCompareButton: string;
  candidateCompareButtonTitle: string;
  candidateCompareDisabledHint: string;
  candidateEmptyHeading: string;
  candidateEmptyHint: string;
  candidateImportFileButton: string;
  candidateImportFileButtonBusy: string;
  candidateImportFileButtonTitle: string;
  candidateImportFileDisabledHint: string;
  candidateInputHint: string;
  candidateInputLabel: string;
  candidateInputPlaceholder: string;
  candidatePreviewBufferAtCompareLabel: string;
  candidatePreviewBufferAtCompareText: (lines: number, chars: number) => string;
  candidatePreviewCandidateSizeLabel: string;
  candidatePreviewCandidateSizeText: (lines: number, chars: number) => string;
  candidatePreviewComparedAtLabel: string;
  candidatePreviewEmpty: string;
  candidatePreviewSourceLabel: string;
  candidatePreviewTargetLabel: string;
  candidatePreviewTitle: string;
  candidateSourceManual: string;
  candidateSourceAppleAssist: string;
  candidateSourceFile: (name: string) => string;
  candidateSourceFileEdited: (name: string) => string;
  candidateStaleActionReCompare: string;
  candidateStaleHeading: string;
  candidateStaleReasonBufferEdited: string;
  candidateStaleReasonNoActiveTab: string;
  candidateStaleReasonTabSwitched: (label: string | null) => string;
  close: string;
  closeTitle: string;
  emptyBody: string;
  emptyIntro: string;
  entryButton: string;
  entryButtonTitle: string;
  futureSlotHint: string;
  surfaceLabel: string;
  title: string;
};

export const CANDIDATE_FILE_IMPORT_NO_ACTIVE_TAB_ERROR =
  "Candidate file import failed: no active editor tab.";
export const CANDIDATE_FILE_IMPORT_NEWER_REQUEST_ERROR =
  "Candidate file import ignored: a newer import request is active.";
export const CANDIDATE_FILE_IMPORT_NO_CURRENT_TAB_ERROR =
  "Candidate file import ignored: there is no active editor tab.";
export const CANDIDATE_FILE_IMPORT_TAB_CHANGED_ERROR =
  "Candidate file import ignored: the active editor tab changed.";
export const CANDIDATE_FILE_IMPORT_BUFFER_CHANGED_ERROR =
  "Candidate file import ignored: the editor buffer changed.";
export const CANDIDATE_FILE_IMPORT_FAILED_PREFIX =
  "Candidate file import failed: ";

export function formatCandidateFileImportFailure(detail: string): string {
  return `${CANDIDATE_FILE_IMPORT_FAILED_PREFIX}${detail}`;
}

export function formatCandidateInputSourceLabel(
  source: CandidateInputSource,
  copy: ReviewDeskCopy,
): string {
  if (source.kind === "file") {
    return source.edited
      ? copy.candidateSourceFileEdited(source.name)
      : copy.candidateSourceFile(source.name);
  }
  return copy.candidateSourceManual;
}

export function localizeCandidateFileImportError(
  rawMessage: string,
  menuLanguage: MenuLanguage,
): string {
  if (
    rawMessage.includes("too large for the comparison preview") ||
    rawMessage.includes("comparison preview")
  ) {
    if (isKanaStyle(menuLanguage)) {
      return "くらべるには おおきすぎます";
    }
    if (isJapaneseMenuLanguage(menuLanguage)) {
      return "現在のバッファと候補ファイルの差分が大きすぎるため、比較できません。";
    }
    return "The buffer and candidate file combination is too large to diff.";
  }

  if (menuLanguage === "en") {
    return rawMessage;
  }

  if (rawMessage === CANDIDATE_FILE_IMPORT_NO_ACTIVE_TAB_ERROR) {
    return isKanaStyle(menuLanguage)
      ? "候補ふぁいるを読むには、てきすとをひらいてください。"
      : "候補ファイルを読み込むには、エディタでテキストファイルを開いてください。";
  }
  if (rawMessage === CANDIDATE_FILE_IMPORT_NEWER_REQUEST_ERROR) {
    return isKanaStyle(menuLanguage)
      ? "新しい読みこみが始まったため、前の候補ふぁいるは読みこみませんでした。"
      : "新しい読み込み操作が始まったため、前の候補ファイル取り込みを無視しました。";
  }
  if (rawMessage === CANDIDATE_FILE_IMPORT_NO_CURRENT_TAB_ERROR) {
    return isKanaStyle(menuLanguage)
      ? "読みこみ中にふみがとぢられたため、候補ふぁいるは読みこめませんでした。"
      : "読み込み中に対象タブが閉じられたため、候補ファイルの取り込みを中止しました。";
  }
  if (rawMessage === CANDIDATE_FILE_IMPORT_TAB_CHANGED_ERROR) {
    return isKanaStyle(menuLanguage)
      ? "読みこみ中に別のふみへ移ったため、候補ふぁいるは読みこめませんでした。"
      : "読み込み中に対象タブが変わったため、候補ファイルの取り込みを中止しました。";
  }
  if (rawMessage === CANDIDATE_FILE_IMPORT_BUFFER_CHANGED_ERROR) {
    return isKanaStyle(menuLanguage)
      ? "読みこみ中にふみが変わったため、候補ふぁいるは読みこめませんでした。"
      : "読み込み中にバッファが変更されたため、候補ファイルの取り込みを中止しました。";
  }
  if (rawMessage.startsWith(CANDIDATE_FILE_IMPORT_FAILED_PREFIX)) {
    const detail = rawMessage.slice(CANDIDATE_FILE_IMPORT_FAILED_PREFIX.length);
    return isKanaStyle(menuLanguage)
      ? `候補ふぁいるを読みこめませんでした: ${detail}`
      : `候補ファイルを読み込めませんでした: ${detail}`;
  }

  return rawMessage;
}

export function getReviewDeskCopy(lang: MenuLanguage): ReviewDeskCopy {
  if (isKanaStyle(lang)) {
    return {
      candidateApplyButton: "うつす",
      candidateApplyButtonTitle: "手動候補をいまのたぶへうつす",
      candidateApplyDisabledHint:
        "うつすには、えでぃたたぶと候補のしたみが必要です。",
      candidateApplyWillMarkUnsaved:
        "うつすと、いまのふみが候補におきかえられ、ほぞんするまでは未保存です。",
      candidateClearButton: "けす",
      candidateClearButtonTitle: "候補入力としたみをけす",
      candidateColumnLeft: "いまのふみ",
      candidateColumnRight: "候補",
      candidateCompareButton: "くらべる",
      candidateCompareButtonTitle: "いまのふみと候補をくらべる",
      candidateCompareDisabledHint:
        "くらべるには、えでぃたでてきすとをひらき、候補を入れてください。",
      candidateEmptyHeading: "くらべるふみがありません",
      candidateEmptyHint:
        "れびゅーのつくゑは、えでぃたでてきすとをひらいているときだけ使えます。",
      candidateImportFileButton: "ふぁいるから読む",
      candidateImportFileButtonBusy: "読みこみ中",
      candidateImportFileButtonTitle:
        "Markdown / てきすとふぁいるを候補として読みこみ、いまのふみとくらべる",
      candidateImportFileDisabledHint:
        "読みこむには、えでぃたでてきすとをひらいてください。",
      candidateInputHint:
        "くらべたい候補てきすとをここへ貼り付けます。",
      candidateInputLabel: "候補てきすと",
      candidateInputPlaceholder: "ここへ候補てきすとを貼り付けてください…",
      candidatePreviewBufferAtCompareLabel: "くらべたときのふみ",
      candidatePreviewBufferAtCompareText: (lines, chars) =>
        `${lines} くだり / ${chars} もじ`,
      candidatePreviewCandidateSizeLabel: "候補のおおきさ",
      candidatePreviewCandidateSizeText: (lines, chars) =>
        `${lines} くだり / ${chars} もじ`,
      candidatePreviewComparedAtLabel: "くらべたじこく",
      candidatePreviewEmpty:
        "くらべるを押すと、いまのふみと候補のちがひをここにしめします。",
      candidatePreviewSourceLabel: "候補元",
      candidatePreviewTargetLabel: "あたらしいふみ",
      candidatePreviewTitle: "候補のしたみ",
      candidateSourceManual: "手で貼り付け",
      candidateSourceAppleAssist: "あっぷる あしす と (この Mac のみ)",
      candidateSourceFile: (name) => `ふぁいる読みこみ: ${name}`,
      candidateSourceFileEdited: (name) =>
        `ふぁいる読みこみ（てなおし済み）: ${name}`,
      candidateStaleActionReCompare: "もういちどくらべる",
      candidateStaleHeading: "したみがふるくなっています",
      candidateStaleReasonBufferEdited:
        "くらべたあと、いまのふみがかきかえられたため、したみが今とあっていません。",
      candidateStaleReasonNoActiveTab:
        "くらべたふみがとぢられたため、したみはもうつかえません。",
      candidateStaleReasonTabSwitched: (label) =>
        label !== null
          ? `いまは「${label}」がひらいています。いまのふみで、もういちどくらべてください。`
          : "別のふみがひらいています。いまのふみで、もういちどくらべてください。",
      close: "とぢる",
      closeTitle: "れびゅーのつくゑをとぢる",
      emptyBody:
        "いまは候補てきすとを貼り付け、ひらいているえでぃた内容とくらべられます。",
      emptyIntro:
        "れびゅーのつくゑは、候補てきすとを保存前にたしかめるところです。",
      entryButton: "れびゅー",
      entryButtonTitle: "れびゅーのつくゑ",
      futureSlotHint:
        "AI 候補などの前に、まず手動候補を明示的にくらべます。",
      surfaceLabel: "れびゅーのつくゑ",
      title: "れびゅーのつくゑ",
    };
  }

  return isJapaneseMenuLanguage(lang)
    ? {
        candidateApplyButton: "候補を適用",
        candidateApplyButtonTitle:
          "手動候補を現在のタブのバッファへ適用",
        candidateApplyDisabledHint:
          "適用するには、エディタタブと候補プレビューが必要です。",
        candidateApplyWillMarkUnsaved:
          "適用すると現在のバッファが置き換えられ、保存するまで未保存です。",
        candidateClearButton: "クリア",
        candidateClearButtonTitle: "候補入力とプレビューを消去",
        candidateColumnLeft: "現在のバッファ",
        candidateColumnRight: "手動候補",
        candidateCompareButton: "比較",
        candidateCompareButtonTitle: "現在のバッファと手動候補を比較",
        candidateCompareDisabledHint:
          "比較するには、エディタでテキストファイルを開き、候補テキストを入力してください。",
        candidateEmptyHeading: "比較できるエディタタブがありません",
        candidateEmptyHint:
          "レビューデスクの手動候補レビューは、エディタでテキストを開いているときだけ使えます。",
        candidateImportFileButton: "ファイルから読み込む",
        candidateImportFileButtonBusy: "読み込み中",
        candidateImportFileButtonTitle:
          "Markdown / テキストファイルを候補として読み込み、現在のバッファと比較",
        candidateImportFileDisabledHint:
          "読み込むには、エディタでテキストファイルを開いてください。",
        candidateInputHint:
          "比較したい候補テキスト（AI 出力、レビューメモ、別バージョンなど）をここに貼り付けます。",
        candidateInputLabel: "手動候補テキスト",
        candidateInputPlaceholder:
          "ここに候補テキストを貼り付けてください…",
        candidatePreviewBufferAtCompareLabel: "比較時点のバッファ",
        candidatePreviewBufferAtCompareText: (lines, chars) =>
          `${lines} 行 / ${chars} 文字`,
        candidatePreviewCandidateSizeLabel: "候補サイズ",
        candidatePreviewCandidateSizeText: (lines, chars) =>
          `${lines} 行 / ${chars} 文字`,
        candidatePreviewComparedAtLabel: "比較時刻",
        candidatePreviewEmpty:
          "比較ボタンを押すと、現在のバッファと手動候補の差分プレビューがここに表示されます。",
        candidatePreviewSourceLabel: "候補元",
        candidatePreviewTargetLabel: "保存先",
        candidatePreviewTitle: "手動候補プレビュー",
        candidateSourceManual: "手動貼り付け",
        candidateSourceAppleAssist: "Apple Local Assist (この Mac のみ)",
        candidateSourceFile: (name) => `ファイル読み込み: ${name}`,
        candidateSourceFileEdited: (name) =>
          `ファイル読み込み（編集済み）: ${name}`,
        candidateStaleActionReCompare: "再比較",
        candidateStaleHeading: "プレビューが古くなっています",
        candidateStaleReasonBufferEdited:
          "比較後にバッファが編集されたため、プレビューが現在の状態と一致していません。",
        candidateStaleReasonNoActiveTab:
          "比較したタブが閉じられたため、プレビューはもう使えません。",
        candidateStaleReasonTabSwitched: (label) =>
          label !== null
            ? `現在は「${label}」が開かれています。現在のタブに対して再比較してください。`
            : "別のタブが開かれています。現在のタブに対して再比較してください。",
        close: "閉じる",
        closeTitle: "レビューデスクを閉じる",
        emptyBody:
          "現在は手動候補テキストを貼り付けて、開いているエディタ内容と比較できます。ファイル比較やディスクとの差分確認は、引き続き差分 / 変更確認の既存ルートから使います。",
        emptyIntro:
          "レビューデスクは、候補テキストを保存前に確認してからバッファへ適用するためのレビュー画面です。",
        entryButton: "レビューデスク",
        entryButtonTitle: "レビューデスク",
        futureSlotHint:
          "AI 候補や他のレビュー経路を扱う前に、まず手動貼り付け候補を明示的に比較・適用します。",
        surfaceLabel: "レビューデスク",
        title: "レビューデスク",
      }
    : {
        candidateApplyButton: "Apply candidate",
        candidateApplyButtonTitle:
          "Apply the manual candidate to the current tab buffer",
        candidateApplyDisabledHint:
          "Open an editor tab and render a candidate preview to enable Apply.",
        candidateApplyWillMarkUnsaved:
          "Apply replaces the current buffer; the file remains unsaved until you save it.",
        candidateClearButton: "Clear",
        candidateClearButtonTitle: "Discard candidate input and preview",
        candidateColumnLeft: "Current buffer",
        candidateColumnRight: "Manual candidate",
        candidateCompareButton: "Compare",
        candidateCompareButtonTitle:
          "Compare the current buffer with the manual candidate",
        candidateCompareDisabledHint:
          "Open a text file in the editor and paste a candidate to enable Compare.",
        candidateEmptyHeading: "No editor tab is open to compare",
        candidateEmptyHint:
          "The Review Desk manual candidate review is only available while a text file is open in the editor.",
        candidateImportFileButton: "Import file",
        candidateImportFileButtonBusy: "Importing",
        candidateImportFileButtonTitle:
          "Import a Markdown / text file as a candidate and compare it with the current buffer",
        candidateImportFileDisabledHint:
          "Open a text file in the editor to import a candidate file.",
        candidateInputHint:
          "Paste a candidate snapshot (AI output, review notes, an alternate draft) to compare against the current buffer.",
        candidateInputLabel: "Manual candidate text",
        candidateInputPlaceholder: "Paste candidate text here…",
        candidatePreviewBufferAtCompareLabel: "Buffer at compare",
        candidatePreviewBufferAtCompareText: (lines, chars) =>
          `${lines} lines / ${chars} chars`,
        candidatePreviewCandidateSizeLabel: "Candidate size",
        candidatePreviewCandidateSizeText: (lines, chars) =>
          `${lines} lines / ${chars} chars`,
        candidatePreviewComparedAtLabel: "Compared at",
        candidatePreviewEmpty:
          "Press Compare to render a diff preview of the current buffer and the manual candidate here.",
        candidatePreviewSourceLabel: "Source",
        candidatePreviewTargetLabel: "Target",
        candidatePreviewTitle: "Manual candidate preview",
        candidateSourceManual: "Manual paste",
        candidateSourceAppleAssist: "Apple Local Assist (on-device)",
        candidateSourceFile: (name) => `File import: ${name}`,
        candidateSourceFileEdited: (name) => `File import (edited): ${name}`,
        candidateStaleActionReCompare: "Re-run Compare",
        candidateStaleHeading: "Preview is out of date",
        candidateStaleReasonBufferEdited:
          "The buffer was edited after Compare, so the preview no longer matches the current state.",
        candidateStaleReasonNoActiveTab:
          "The compared tab is no longer open, so the preview can no longer be applied.",
        candidateStaleReasonTabSwitched: (label) =>
          label !== null
            ? `The active tab is now "${label}". Re-run Compare to refresh the preview for the active tab.`
            : "A different tab is active. Re-run Compare to refresh the preview for the active tab.",
        close: "Close",
        closeTitle: "Close Review Desk",
        emptyBody:
          "For now, paste manual candidate text here to compare it with the open editor buffer. File comparisons and disk-change reviews still use the existing Diff / Review changes routes.",
        emptyIntro:
          "Review Desk is a review surface for checking candidate text before applying it to the buffer.",
        entryButton: "Review Desk",
        entryButtonTitle: "Review Desk",
        futureSlotHint:
          "Manual pasted candidates are explicit first; AI candidates and other review routes can connect later without bypassing review.",
        surfaceLabel: "Review Desk",
        title: "Review Desk",
      };
}
