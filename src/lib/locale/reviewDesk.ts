import { isJapaneseMenuLanguage, type MenuLanguage } from "../../types";
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
  candidateInputHint: string;
  candidateInputLabel: string;
  candidateInputPlaceholder: string;
  candidatePreviewBufferAtCompareLabel: string;
  candidatePreviewBufferAtCompareText: (lines: number, chars: number) => string;
  candidatePreviewCandidateSizeLabel: string;
  candidatePreviewCandidateSizeText: (lines: number, chars: number) => string;
  candidatePreviewComparedAtLabel: string;
  candidatePreviewEmpty: string;
  candidatePreviewTargetLabel: string;
  candidatePreviewTitle: string;
  candidateSourceManual: string;
  candidateSourceAppleAssist: string;
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
      candidatePreviewTargetLabel: "あたらしいふみ",
      candidatePreviewTitle: "候補のしたみ",
      candidateSourceManual: "手で貼り付け",
      candidateSourceAppleAssist: "あっぷる あしす と (この Mac のみ)",
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
      entryButtonTitle: "れびゅーのつくゑをひらく (Cmd+Shift+R)",
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
        candidatePreviewTargetLabel: "保存先",
        candidatePreviewTitle: "手動候補プレビュー",
        candidateSourceManual: "手動貼り付け",
      candidateSourceAppleAssist: "Apple Local Assist (この Mac のみ)",
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
        entryButtonTitle: "レビューデスクを開く (Cmd+Shift+R)",
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
        candidatePreviewTargetLabel: "Target",
        candidatePreviewTitle: "Manual candidate preview",
        candidateSourceManual: "Manual paste",
      candidateSourceAppleAssist: "Apple Local Assist (on-device)",
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
        entryButtonTitle: "Open Review Desk (Cmd+Shift+R)",
        futureSlotHint:
          "Manual pasted candidates are explicit first; AI candidates and other review routes can connect later without bypassing review.",
        surfaceLabel: "Review Desk",
        title: "Review Desk",
      };
}
