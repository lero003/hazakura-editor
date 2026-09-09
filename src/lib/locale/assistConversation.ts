import type { MenuLanguage } from "../../types";
import { isKanaStyle } from "./_helpers";

export function getAssistConversationCopy(language: MenuLanguage) {
  if (isKanaStyle(language)) return {
    title: "ことばを、ととのえる。", boundary: "このMacで しょり・じどう はんえい／ほぞん なし",
    chat: "かいわ", details: "つかいかた・りよう じょうけん", target: "たいしょう",
    noDocument: "ふみ みせんたく", empty: "ぶんを えらび、したの らんから おねがいしてください。", composer: "おねがい",
  };
  if (language === "en") return {
    title: "Refine your words.", boundary: "On this Mac · No automatic apply or save",
    chat: "Conversation", details: "Usage and requirements", target: "Target",
    noDocument: "No document selected", empty: "Select some text, then write your request below.", composer: "Request",
  };
  return {
    title: "ことばを、整える。", boundary: "このMac内で処理・自動反映／自動保存なし",
    chat: "会話", details: "使い方・利用条件", target: "対象",
    noDocument: "文書未選択", empty: "文章を選び、下の欄から依頼してください。", composer: "依頼",
  };
}
