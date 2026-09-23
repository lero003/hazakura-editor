import { isJapaneseMenuLanguage, type MenuLanguage } from "../../types";
import { isKanaStyle } from "./_helpers";

// Hazakura Local Assist is an Assist Surface provider class, not a
// CLI-agent provider. The copy in this file describes the
// narrow document-help surface and the runtime availability
// states. Wording is conservative: every unavailable / disabled
// / unsupported state is read as "this won't work right now" and
// never implies a problem the user has to fix; the user is
// never asked to take a side-effect action on the message itself.
// See docs/apple-local-assist-v0.12-design-review.md.

export type AppleAssistCopy = {
  featureName: string;
  commandCategory: string;
  generationInProgressTitle: string;
  generationInProgressMessage: string;
  summarizeLabel: string;
  summarizeHint: string;
  rephraseLabel: string;
  rephraseHint: string;
  availabilityAvailable: string;
  availabilityUnavailablePrefix: string;
  availabilityDisabled: string;
  availabilityUnsupported: string;
};

export function getAppleAssistCopy(lang: MenuLanguage): AppleAssistCopy {
  if (isKanaStyle(lang)) {
    return {
      featureName: "はざくら ろーかる あしす と (この Mac のみ)",
      commandCategory: "はざくら ろーかる あしす と",
      generationInProgressTitle: "はざくら ろーかる あしす とが せいせいちゅうです",
      generationInProgressMessage:
        "せいせいが おわると へんしゅう できます。ほんぶんは みえますが、いまは かきかえ できません。",
      summarizeLabel: "せんたくはんいを ようやく",
      summarizeHint:
        "あっぷる の この Mac の きのうで えらんだ ぶんしょうを ようやく します。さぶんを みてから つかいます。",
      rephraseLabel: "せんたくはんいを かきかえ",
      rephraseHint:
        "あっぷる の この Mac の きのうで えらんだ ぶんしょうを かきかえ します。さぶんを みてから つかいます。",
      availabilityAvailable: "この Mac で はざくら ろーかる あしす とが つかえます。",
      availabilityUnavailablePrefix:
        "はざくら ろーかる あしす とは いま つかえません: ",
      availabilityDisabled: "Apple Intelligence の もでるは つかえません。つかえる Core AI もでるを えらべます。",
      availabilityUnsupported:
        "はざくら ろーかる あしす とは この はんきょうで ひょうじ できません。",
    };
  }

  return isJapaneseMenuLanguage(lang)
    ? {
        featureName: "Hazakura Local Assist (この Mac のみ)",
        commandCategory: "Hazakura Local Assist",
        generationInProgressTitle: "Hazakura Local Assist が生成中です",
        generationInProgressMessage:
          "生成が終わると編集できます。本文は見えますが、いまは書き込めません。",
        summarizeLabel: "選択範囲を要約",
        summarizeHint:
          "選択中のオンデバイスモデルで文章を要約します。差分を確認してから明示的に適用してください。",
        rephraseLabel: "選択範囲を言い換え",
        rephraseHint:
          "選択中のオンデバイスモデルで文章を言い換えます。差分を確認してから明示的に適用してください。",
        availabilityAvailable: "この Mac で Hazakura Local Assist が使えます。",
        availabilityUnavailablePrefix:
          "Hazakura Local Assist は現在使えません: ",
        availabilityDisabled:
          "Apple Intelligenceモデルは利用できません。モデル管理で利用可能なCore AIモデルを選べます。",
        availabilityUnsupported:
          "Hazakura Local Assist はこの環境では使えません。",
      }
    : {
        featureName: "Hazakura Local Assist (on-device)",
        commandCategory: "Hazakura Local Assist",
        generationInProgressTitle: "Hazakura Local Assist is generating",
        generationInProgressMessage:
          "Editing resumes when generation finishes. The document stays visible, but you cannot type yet.",
        summarizeLabel: "Summarize selection",
        summarizeHint:
          "Generate a summary of the selected text using the selected on-device model. Output is never auto-applied; review the diff before applying it explicitly.",
        rephraseLabel: "Rephrase selection",
        rephraseHint:
          "Generate a rephrasing of the selected text using the selected on-device model. Output is never auto-applied; review the diff before applying it explicitly.",
        availabilityAvailable: "Hazakura Local Assist is available on this Mac.",
        availabilityUnavailablePrefix:
          "Hazakura Local Assist is currently unavailable: ",
        availabilityDisabled:
          "The Apple Intelligence model is unavailable. You can select an available Core AI model in model management.",
        availabilityUnsupported:
          "Hazakura Local Assist is not supported in this environment.",
      };
}
