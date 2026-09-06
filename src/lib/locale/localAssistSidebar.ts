import type { MenuLanguage } from "../../types";

const en = {
  title: "Local Assist", close: "Close Local Assist", page: "Page (open document)", openPage: "Open another document…",
  noPage: "Open a text document to begin.", scope: "Editing target", selection: "Editor selection", lines: "Line range", document: "Whole document",
  firstLine: "First line", lastLine: "Last line", lineUnit: "lines", chars: "characters", pin: "Check and pin target", reset: "Choose a new target",
  selectionHint: "Select text in the editor. The target is pinned when you send the first request.",
  lineHint: "Source line numbers, not visually wrapped rows. Up to 4,000 characters.",
  documentHint: "Whole document, up to 4,000 characters. Longer documents are not silently truncated.",
  pinned: "Pinned original", targetChanged: "The original target changed. Choose a new target before continuing.",
  chat: "Revision conversation", empty: "Describe how to revise this text. Each proposal can be refined before applying it.",
  composer: "Revision request", placeholder: "For example: shorten this without changing the meaning", send: "Create proposal", refine: "Refine proposal", stop: "Stop generation",
  pending: "Generating a proposal…", completed: "Proposal ready below. The document is unchanged.", failed: "No new proposal was created. Check the target or try again.",
  cancelled: "Generation stopped. The document is unchanged.", applied: "Proposal applied. Save separately; use ⌘Z to undo.", discarded: "Proposal discarded. The document is unchanged.",
  shuttingDown: "Waiting for the current generation to stop…", model: "Apple Intelligence · On-device", checking: "Checking Apple Intelligence availability…",
  unavailable: "Apple Intelligence is not available. Check support and model readiness in macOS Settings.",
  privacy: "Only this document's bounded target and nearby context are used. No cloud fallback; nothing is applied automatically.",
  noSelection: "Select text in the editor, or choose a line range or the whole document.", invalidLines: "Enter valid source line numbers within this document.",
  emptyTarget: "The target has no text.", tooLong: "Choose at most 4,000 characters. The target has not been truncated.", editorChanged: "The editor and selected page do not match yet. Select the text again.",
  requestLong: "Keep each request within 1,000 characters.", missingHandler: "The editor is not ready. Close and reopen Local Assist.",
  missingProposal: "The previous proposal is no longer available. Choose a new target to restart this conversation.",
  longProposal: "This proposal exceeds 4,000 characters and cannot be refined in one request. Review and apply it, then select a shorter range, or discard it.",
  foreign: "Review or discard the existing proposal below before starting another conversation.",
  resetQuestion: "Discard this conversation and any unapplied proposal, then choose a new target? Your document will not change.",
  confirmReset: "Discard and choose again", keep: "Keep working", presets: "Request examples", requestHint: "⌘Enter to send; Enter for a new line. This is a revision conversation, not general chat.",
};
type Copy = { [Key in keyof typeof en]: string };
const ja: Copy = {
  title: "Local Assist", close: "Local Assistを閉じる", page: "ページ（開いている文書）", openPage: "別の文書を開く…",
  noPage: "テキスト文書を開くと始められます。", scope: "編集する範囲", selection: "本文の選択", lines: "行を指定", document: "文書全体",
  firstLine: "開始行", lastLine: "終了行", lineUnit: "行", chars: "文字", pin: "対象を確認して固定", reset: "対象を選び直す",
  selectionHint: "本文で範囲を選んでください。最初の送信時に対象を固定します。",
  lineHint: "折り返しではなく、元の文章の行番号です。対象は4,000文字まで。",
  documentHint: "文書全体を対象にします。4,000文字を超える場合、勝手に切り捨てません。",
  pinned: "固定した元の文章", targetChanged: "対象の文章が変わりました。対象を選び直してから続けてください。",
  chat: "推敲の会話", empty: "この文章をどう直したいか、短く伝えてください。生成した案には追加の依頼ができます。",
  composer: "文章への依頼", placeholder: "例：意味を変えず、もう少し短くして", send: "案を作る", refine: "案をさらに直す", stop: "生成を止める",
  pending: "案を作っています…", completed: "下に案ができました。本文はまだ変わっていません。", failed: "新しい案は作れませんでした。対象を確認するか、もう一度依頼してください。",
  cancelled: "生成を止めました。本文は変わっていません。", applied: "文書へ反映しました。保存は別操作です。⌘Zで戻せます。", discarded: "案を破棄しました。本文は変わっていません。",
  shuttingDown: "生成の終了処理を待っています…", model: "Apple Intelligence · このMacで処理", checking: "Apple Intelligenceの利用可否を確認しています…",
  unavailable: "Apple Intelligenceを利用できません。macOSの設定で対応状況とモデルの準備を確認してください。",
  privacy: "この文書の選んだ範囲と周辺の文脈だけを使います。クラウドへの切り替え・自動反映はしません。",
  noSelection: "本文で範囲を選ぶか、「行を指定」「文書全体」を選んでください。", invalidLines: "この文書に存在する行番号を、開始行から終了行の順で入力してください。",
  emptyTarget: "対象に文章がありません。", tooLong: "対象を4,000文字以内にしてください。文章は切り捨てていません。", editorChanged: "ページとエディタの内容が一致しません。本文で範囲を選び直してください。",
  requestLong: "一度の依頼は1,000文字以内にしてください。", missingHandler: "エディタの準備ができていません。Local Assistを開き直してください。",
  missingProposal: "前の案を確認できません。対象を選び直して、この会話を始め直してください。",
  longProposal: "案が4,000文字を超えているため、追加依頼はできません。確認して反映後に短い範囲を選び直すか、案を破棄してください。",
  foreign: "別の会話で作った案があります。下の案を反映または破棄してから、新しく依頼してください。",
  resetQuestion: "この会話と未反映の案を破棄して、対象を選び直しますか？ 本文は変わりません。",
  confirmReset: "破棄して選び直す", keep: "このまま続ける", presets: "依頼の例", requestHint: "⌘Enterで送信、Enterで改行。文章を直すための会話です。",
};
// Kana mode retains its existing gentle Japanese register without leaking English UI copy.
export function getLocalAssistSidebarCopy(language: MenuLanguage): Copy {
  if (language === "en") return en;
  if (language === "kana") return { ...ja, page: "ページ（ひらいている ふみ）", scope: "なおす はんい", selection: "ほんぶんの せんたく", lines: "ぎょうを えらぶ", document: "ふみ ぜんたい", send: "あんを つくる", refine: "あんを さらに なおす", stop: "つくるのを とめる", chat: "すいこうの かいわ" };
  return ja;
}
