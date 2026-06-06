import { isJapaneseMenuLanguage, type MenuLanguage } from "../../types";
import { isKanaStyle } from "./_helpers";

// Apple Local Assist is an Assist Surface provider class, not a
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
      featureName: "あっぷる ろーかる あしす と (この Mac のみ)",
      commandCategory: "あっぷる ろーかる あしす と",
      summarizeLabel: "せんたくはんいを ようやく",
      summarizeHint:
        "あっぷる の この Mac の きのうで えらんだ ぶんしょうを ようやく します。さぶんを みてから つかいます。",
      rephraseLabel: "せんたくはんいを かきかえ",
      rephraseHint:
        "あっぷる の この Mac の きのうで えらんだ ぶんしょうを かきかえ します。さぶんを みてから つかいます。",
      availabilityAvailable: "この Mac で あっぷる ろーかる あしす とが つかえます。",
      availabilityUnavailablePrefix:
        "あっぷる ろーかる あしす とは いま つかえません: ",
      availabilityDisabled: "あっぷる ろーかる あしす とは この せっしょで むこうです。",
      availabilityUnsupported:
        "あっぷる ろーかる あしす とは この はんきょうで ひょうじ できません。",
    };
  }

  return isJapaneseMenuLanguage(lang)
    ? {
        featureName: "Apple Local Assist (この Mac のみ)",
        commandCategory: "Apple Local Assist",
        summarizeLabel: "選択範囲を要約",
        summarizeHint:
          "Apple のオンデバイス機能で、選択した文章を要約します。差分を確認してから明示的に適用してください。",
        rephraseLabel: "選択範囲を言い換え",
        rephraseHint:
          "Apple のオンデバイス機能で、選択した文章を別の表現に書き換えます。差分を確認してから明示的に適用してください。",
        availabilityAvailable: "この Mac で Apple Local Assist が使えます。",
        availabilityUnavailablePrefix:
          "Apple Local Assist は現在使えません: ",
        availabilityDisabled:
          "Apple Local Assist はこのアプリセッションでは無効です。",
        availabilityUnsupported:
          "Apple Local Assist はこの環境では使えません。",
      }
    : {
        featureName: "Apple Local Assist (on-device)",
        commandCategory: "Apple Local Assist",
        summarizeLabel: "Summarize selection",
        summarizeHint:
          "Generate a summary of the selected text using Apple's on-device model. Output is never auto-applied; review the diff before applying it explicitly.",
        rephraseLabel: "Rephrase selection",
        rephraseHint:
          "Generate a rephrasing of the selected text using Apple's on-device model. Output is never auto-applied; review the diff before applying it explicitly.",
        availabilityAvailable: "Apple Local Assist is available on this Mac.",
        availabilityUnavailablePrefix:
          "Apple Local Assist is currently unavailable: ",
        availabilityDisabled:
          "Apple Local Assist is disabled in this app session.",
        availabilityUnsupported:
          "Apple Local Assist is not supported in this environment.",
      };
}
