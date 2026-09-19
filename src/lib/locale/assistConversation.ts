import type { MenuLanguage } from "../../types";
import { isKanaStyle } from "./_helpers";

export function getAssistConversationCopy(language: MenuLanguage) {
  if (isKanaStyle(language)) return {
    review: "この ていあんを みる", reviewOpening: "ほんたいで ひらいています…",
    reviewUnavailable: "ていあんを ひらけませんでした。ほんたいの ふみと がめんを たしかめてください。",
    boundary: "このMacで しょり・じどう はんえい／ほぞん なし",
    chat: "かいわ", details: "つかいかた・りよう じょうけん", target: "たいしょう",
    noDocument: "ふみ みせんたく", empty: "ぶんを えらび、したの らんから おねがいしてください。", composer: "おねがい",
    pinned: "たいしょう こてい", chooseModel: "モデルを えらぶ",
    checking: "りようできるか かくにんしています…",
    disabled: "アシストせっていで ゆうこうにし、アプリを ひらきなおしてください。",
    unsupported: "このMacでは つかえません。「つかいかた」で りようじょうけんを かくにんしてください。",
    unavailable: "いまは つかえません。Apple Intelligenceの せっていを かくにんしてください。",
    scope: { selection: "えらんだ ぶん", paragraph: "だんらく", block: "コード", section: "しょう", document: "ふみぜんたい" },
    characters: (count: number) => `${count}もじ`,
  };
  if (language === "en") return {
    review: "Review this proposal", reviewOpening: "Opening in main…",
    reviewUnavailable: "Could not open this proposal. Check the document and screen in the main window.",
    boundary: "On this Mac · No automatic apply or save",
    chat: "Conversation", details: "Usage and requirements", target: "Target",
    noDocument: "No document selected", empty: "Select some text, then write your request below.", composer: "Request",
    pinned: "Target pinned", chooseModel: "Choose model",
    checking: "Checking availability…",
    disabled: "Enable Local Assist in Assist Settings, then restart the app.",
    unsupported: "Unavailable on this Mac. Open Usage and requirements to check compatibility.",
    unavailable: "Temporarily unavailable. Check Apple Intelligence settings.",
    scope: { selection: "Selection", paragraph: "Paragraph", block: "Code block", section: "Section", document: "Document" },
    characters: (count: number) => `${count} chars`,
  };
  return {
    review: "差分を確認", reviewOpening: "本体で開いています…",
    reviewUnavailable: "提案を開けませんでした。本体の文書と画面を確認してください。",
    boundary: "このMac内で処理・自動反映／自動保存なし",
    chat: "会話", details: "使い方・利用条件", target: "対象",
    noDocument: "文書未選択", empty: "文章を選び、下の欄から依頼してください。", composer: "依頼",
    pinned: "対象を固定", chooseModel: "モデルを選択",
    checking: "利用できるか確認しています…",
    disabled: "アシスト設定で有効にし、アプリを再起動してください。",
    unsupported: "このMacでは利用できません。「使い方・利用条件」で対応環境を確認してください。",
    unavailable: "現在利用できません。Apple Intelligenceの設定を確認してください。",
    scope: { selection: "選択範囲", paragraph: "段落", block: "コード", section: "章", document: "文書全体" },
    characters: (count: number) => `${count}文字`,
  };
}
