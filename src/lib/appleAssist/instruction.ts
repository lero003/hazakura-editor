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
      "誤字脱字、助詞、文法ミス、表記ゆれだけ直してください。意味、文体、Markdown構造は保ってください。",
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
      "意味を変えずに、読みやすい自然な文にしてください。新しい情報は足さないでください。",
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
      "本文を3〜5行で要約してください。推測や新しい情報は足さないでください。",
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
      "翻訳してください。Markdown構造、リンク、コードブロック、引用、フロントマター、固有名詞はできるだけ保持してください。",
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
      "本文に自然に続く文章を書いてください。方向性を変えないでください。",
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
      "意味を保ったまま短くしてください。Markdown構造、リンク、コード、引用は保ってください。",
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
      "読みにくい箇所、重複、流れを直してください。意味とMarkdown構造は保ってください。",
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
  requestId: string;
  actionId: LocalAssistActionId;
  requestText: string;
  target: AppleAssistTargetSnapshot | null;
  requestedAtMs: number;
};

export function buildApplyEvent({
  requestId,
  actionId,
  requestText,
  target,
  requestedAtMs,
}: BuildApplyEventInput): AppleAssistApplyEvent {
  const action = getLocalAssistAction(actionId);
  const trimmedRequest = requestText.trim();
  return {
    requestId,
    actionId,
    additionalRequest: trimmedRequest,
    request: trimmedRequest || action.requestText,
    requestedAtMs,
    shouldApplyToDocument: action.shouldApplyToDocument,
    target,
  };
}
