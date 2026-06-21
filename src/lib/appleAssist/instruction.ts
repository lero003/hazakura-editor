import type {
  AppleAssistApplyEvent,
  AppleAssistTargetSnapshot,
  MenuLanguage,
} from "../../types";
import type { AppleAssistOperation } from "../tauri/appleAssist";

export type LocalAssistActionId =
  | "proofread_only"
  | "rewrite_natural"
  | "shorten"
  | "summarize"
  | "translate"
  | "continue_ideas"
  | "review_section";

export type LocalAssistAction = {
  id: LocalAssistActionId;
  operation: AppleAssistOperation;
  shouldApplyToDocument: boolean;
  label: Record<MenuLanguage, string>;
  requestText: string;
};

export type LocalAssistPreset = {
  actionId: LocalAssistActionId;
  label: string;
  requestText: string;
};

export const LOCAL_ASSIST_ACTIONS: ReadonlyArray<LocalAssistAction> = [
  {
    id: "proofread_only",
    operation: "proofread",
    shouldApplyToDocument: true,
    label: {
      en: "Proofread only",
      ja: "校正だけ",
      kana: "こうせいだけ",
    },
    requestText:
      "誤字脱字、助詞、明らかな文法ミス、表記ゆれだけを修正してください。意味、文体、構成、Markdown構造は変えないでください。",
  },
  {
    id: "rewrite_natural",
    operation: "rephrase",
    shouldApplyToDocument: true,
    label: {
      en: "Natural",
      ja: "読みやすく",
      kana: "よみやすく",
    },
    requestText:
      "原文の意味と温度感を保ったまま、不自然な言い回し、冗長な表現、読みづらい文だけを軽く整えてください。新しい情報は追加しないでください。",
  },
  {
    id: "summarize",
    operation: "summarize",
    shouldApplyToDocument: true,
    label: {
      en: "Summary",
      ja: "要約",
      kana: "ようやく",
    },
    requestText:
      "本文の内容を3〜5行で要約してください。推測や新情報は追加しないでください。",
  },
  {
    id: "translate",
    operation: "rephrase",
    shouldApplyToDocument: true,
    label: {
      en: "Translate",
      ja: "翻訳",
      kana: "ほんやく",
    },
    requestText:
      "Markdown構造、リンク、コードブロック、引用、フロントマター、固有名詞を可能な限り保持したまま、自然な翻訳文を作成してください。意味を補いすぎないでください。翻訳先言語の指定がない場合は、日本語文なら英語、英語文なら日本語を候補にしてください。",
  },
  {
    id: "continue_ideas",
    operation: "rephrase",
    shouldApplyToDocument: true,
    label: {
      en: "Next ideas",
      ja: "続きの案",
      kana: "つづきのあん",
    },
    requestText:
      "本文に直接続けられる文章案を作成してください。原文の方向性から外れないでください。",
  },
  {
    id: "shorten",
    operation: "rephrase",
    shouldApplyToDocument: true,
    label: {
      en: "Shorten",
      ja: "短くする",
      kana: "みじかく",
    },
    requestText:
      "原文の主張と重要なニュアンスを保ったまま、全体を簡潔にしてください。Markdown構造、リンク、コード、引用は保持してください。",
  },
  {
    id: "review_section",
    operation: "rephrase",
    shouldApplyToDocument: true,
    label: {
      en: "Section review",
      ja: "章レビュー",
      kana: "しょうれびゅー",
    },
    requestText:
      "読みにくい箇所、重複、流れの悪さを直した章の改稿案を作成してください。原文の意味とMarkdown構造をできるだけ保持してください。",
  },
];

export const APPLY_LOCAL_ASSIST_ACTION_IDS: ReadonlyArray<LocalAssistActionId> =
  [
    "proofread_only",
    "rewrite_natural",
    "summarize",
    "translate",
    "continue_ideas",
    "shorten",
    "review_section",
  ];

export const LOCAL_ASSIST_VISIBLE_PRESET_IDS: ReadonlyArray<LocalAssistActionId> =
  [
    "proofread_only",
    "summarize",
    "translate",
    "continue_ideas",
    "shorten",
  ];

export function getLocalAssistAction(actionId: LocalAssistActionId): LocalAssistAction {
  const action = LOCAL_ASSIST_ACTIONS.find((candidate) => candidate.id === actionId);
  if (!action) {
    throw new Error(`Unknown Hazakura Local Assist action: ${actionId}`);
  }
  return action;
}

export function isLocalAssistActionId(value: unknown): value is LocalAssistActionId {
  return (
    typeof value === "string" &&
    LOCAL_ASSIST_ACTIONS.some((action) => action.id === value)
  );
}

export function resolveLocalAssistActionId(
  label: string,
  presets: ReadonlyArray<LocalAssistPreset>,
): LocalAssistActionId {
  const trimmed = label.trim();
  const preset = presets.find(
    (candidate) =>
      candidate.label === trimmed || candidate.requestText.trim() === trimmed,
  );
  return preset?.actionId ?? "rewrite_natural";
}

export type BuildApplyEventInput = {
  actionId: LocalAssistActionId;
  requestText: string;
  target: AppleAssistTargetSnapshot | null;
  requestedAtMs: number;
};

export function buildApplyEvent({
  actionId,
  requestText,
  target,
  requestedAtMs,
}: BuildApplyEventInput): AppleAssistApplyEvent {
  const action = getLocalAssistAction(actionId);
  const trimmedRequest = requestText.trim();
  return {
    actionId,
    additionalRequest: trimmedRequest,
    request: trimmedRequest || action.requestText,
    requestedAtMs,
    shouldApplyToDocument: action.shouldApplyToDocument,
    target,
  };
}
