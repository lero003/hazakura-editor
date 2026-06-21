// Hazakura Local Assist rough-request instruction builder.
//
// The Hazakura Local Assist window's preset chips are short Japanese
// phrases ("整えて" / "自然にして" / "続きを書いて" /
// "校正して" / "この章を直して"), and the user can also type
// any free-form request. The on-device Foundation Models
// helper currently sees the short phrase plus the target text
// and has to guess which "light cleanup vs. proofread vs.
// rephrase vs. continue vs. rewrite" the user meant.
//
// This module annotates the request with a short, locale-
// stable intent hint for each known preset id so the helper
// sees both the user's rough phrase and a precise intent
// label. The original phrase is preserved verbatim so the
// model's response stays grounded in the Japanese context
// and the textarea still shows exactly what the user typed.
//
// v0.15 payload split: `buildAssistantInstruction` is only
// one half of the contract. The `AppleAssistApplyEvent`
// payload carries `request` (the original phrase that ends
// up in the AI edit transaction, the status message, and
// the Hazakura Local Assist review bar) separately from `instruction`
// (the helper-side annotated prompt). `buildApplyEvent`
// keeps that split in one place so the Hazakura Local Assist window
// cannot accidentally re-collapse the two fields and leak
// internal prompt text into user-facing surfaces.

import type {
  AppleAssistApplyEvent,
  AppleAssistTargetSnapshot,
} from "../../types";

const ROUGH_INTENT_HINTS: Record<string, string> = {
  "tidy":
    "Light cleanup: keep the meaning, remove obvious noise, fix spacing; do not rephrase broadly.",
  "natural":
    "Rephrase for natural prose: keep the meaning, prefer natural sentence breaks; do not shorten or summarize.",
  "continue":
    "Continue writing 1-3 sentences in the same style and tone; do not summarize the existing text.",
  "proofread":
    "Proofread: fix typos, punctuation, spacing, and obvious kanji conversion; do not change wording.",
  "rewrite-section":
    "Rewrite this section to be clearer while keeping the original meaning; do not change the topic or scope.",
};

export type RoughPreset = { id: string; prompt: string };

/**
 * Match a rough request against the available presets. Returns
 * the matching preset id when the request equals one of the
 * preset prompts (after trimming), otherwise null. Free-form
 * requests return null.
 */
export function resolveRoughIntent(
  prompt: string,
  presets: ReadonlyArray<RoughPreset>,
): string | null {
  const trimmed = prompt.trim();
  if (trimmed.length === 0) {
    return null;
  }
  for (const preset of presets) {
    if (preset.prompt === trimmed) {
      return preset.id;
    }
  }
  return null;
}

/**
 * Build the request string sent to the on-device helper. For
 * a preset match, the original phrase is preserved and a
 * short intent hint is prepended. For free-form requests, the
 * input is returned trimmed and unchanged. Empty input is
 * returned unchanged so the caller can still raise the empty
 * request error.
 */
export function buildAssistantInstruction(
  prompt: string,
  presets: ReadonlyArray<RoughPreset>,
): string {
  const trimmed = prompt.trim();
  if (trimmed.length === 0) {
    return trimmed;
  }
  const intentId = resolveRoughIntent(trimmed, presets);
  if (!intentId) {
    return trimmed;
  }
  const hint = ROUGH_INTENT_HINTS[intentId];
  if (!hint) {
    return trimmed;
  }
  return `${hint}\n\nUser request: ${trimmed}`;
}

export type BuildApplyEventInput = {
  request: string;
  target: AppleAssistTargetSnapshot | null;
  requestedAtMs: number;
  presets: ReadonlyArray<RoughPreset>;
};

/**
 * Build the `AppleAssistApplyEvent` payload, keeping the
 * user-facing `request` (the original rough phrase) separate
 * from the helper-side `instruction` (the annotated version
 * with the preset intent hint). The receiver is expected to
 * feed `instruction` into `generateAppleAssistCandidate`
 * and to surface `request` in the AI edit transaction, the
 * main editor status message, and the Hazakura Local Assist review
 * bar so the user only ever sees the phrase they typed.
 */
export function buildApplyEvent({
  request,
  target,
  requestedAtMs,
  presets,
}: BuildApplyEventInput): AppleAssistApplyEvent {
  return {
    request,
    instruction: buildAssistantInstruction(request, presets),
    requestedAtMs,
    target,
  };
}
