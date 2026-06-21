import { describe, expect, it } from "vitest";
import {
  buildApplyEvent,
  buildAssistantInstruction,
  resolveRoughIntent,
  type RoughPreset,
} from "./instruction";
import type {
  AppleAssistApplyEvent,
  AppleAssistTargetSnapshot,
} from "../../types";

// Hazakura Local Assist rough-request instruction builder.
//
// The presets below mirror the three-language preset list in
// `getAppleAssistWindowCopy`. The tests pin:
//   - `resolveRoughIntent` returns the matching preset id for
//     each known Japanese phrase, and null for free-form
//     prompts or empty input.
//   - `buildAssistantInstruction` prepends the right intent
//     hint for each preset, preserves the original Japanese
//     phrase verbatim, and passes free-form requests through
//     unchanged.

const JA_PRESETS: ReadonlyArray<RoughPreset> = [
  { id: "tidy", prompt: "整えて" },
  { id: "natural", prompt: "自然にして" },
  { id: "continue", prompt: "続きを書いて" },
  { id: "proofread", prompt: "校正して" },
  { id: "rewrite-section", prompt: "この章を直して" },
];

const EN_PRESETS: ReadonlyArray<RoughPreset> = [
  { id: "tidy", prompt: "Make it cleaner" },
  { id: "natural", prompt: "Make it sound natural" },
  { id: "continue", prompt: "Continue this" },
  { id: "proofread", prompt: "Proofread this" },
  { id: "rewrite-section", prompt: "Rewrite this section" },
];

describe("resolveRoughIntent", () => {
  it("matches each Japanese preset prompt to its id", () => {
    expect(resolveRoughIntent("整えて", JA_PRESETS)).toBe("tidy");
    expect(resolveRoughIntent("自然にして", JA_PRESETS)).toBe("natural");
    expect(resolveRoughIntent("続きを書いて", JA_PRESETS)).toBe("continue");
    expect(resolveRoughIntent("校正して", JA_PRESETS)).toBe("proofread");
    expect(resolveRoughIntent("この章を直して", JA_PRESETS)).toBe(
      "rewrite-section",
    );
  });

  it("matches each English preset prompt to its id", () => {
    expect(resolveRoughIntent("Make it cleaner", EN_PRESETS)).toBe("tidy");
    expect(resolveRoughIntent("Make it sound natural", EN_PRESETS)).toBe(
      "natural",
    );
    expect(resolveRoughIntent("Continue this", EN_PRESETS)).toBe("continue");
    expect(resolveRoughIntent("Proofread this", EN_PRESETS)).toBe("proofread");
    expect(resolveRoughIntent("Rewrite this section", EN_PRESETS)).toBe(
      "rewrite-section",
    );
  });

  it("returns null for a free-form request that is not a preset", () => {
    expect(resolveRoughIntent("もっとカジュアルに", JA_PRESETS)).toBeNull();
    expect(resolveRoughIntent("Add a short summary", EN_PRESETS)).toBeNull();
  });

  it("returns null for an empty or whitespace-only request", () => {
    expect(resolveRoughIntent("", JA_PRESETS)).toBeNull();
    expect(resolveRoughIntent("   ", JA_PRESETS)).toBeNull();
    expect(resolveRoughIntent("\n\t", EN_PRESETS)).toBeNull();
  });

  it("ignores leading and trailing whitespace on the request", () => {
    expect(resolveRoughIntent("  整えて  ", JA_PRESETS)).toBe("tidy");
  });

  it("returns null when the request contains a preset prompt as a substring", () => {
    // The user typed extra text around the preset phrase, so it
    // is a free-form request, not a pure preset match.
    expect(resolveRoughIntent("整えて、もっと軽く", JA_PRESETS)).toBeNull();
  });
});

describe("buildAssistantInstruction", () => {
  it("prepends the tidy hint for the tidy preset", () => {
    const out = buildAssistantInstruction("整えて", JA_PRESETS);
    expect(out).toMatch(/^Light cleanup/);
    expect(out).toMatch(/User request: 整えて$/);
  });

  it("prepends the natural hint for the natural preset", () => {
    const out = buildAssistantInstruction("自然にして", JA_PRESETS);
    expect(out).toMatch(/^Rephrase for natural prose/);
    expect(out).toMatch(/User request: 自然にして$/);
  });

  it("prepends the continue hint for the continue preset", () => {
    const out = buildAssistantInstruction("続きを書いて", JA_PRESETS);
    expect(out).toMatch(/^Continue writing 1-3 sentences/);
    expect(out).toMatch(/User request: 続きを書いて$/);
  });

  it("prepends the proofread hint for the proofread preset", () => {
    const out = buildAssistantInstruction("校正して", JA_PRESETS);
    expect(out).toMatch(/^Proofread:/);
    expect(out).toMatch(/User request: 校正して$/);
  });

  it("prepends the rewrite-section hint for the rewrite-section preset", () => {
    const out = buildAssistantInstruction("この章を直して", JA_PRESETS);
    expect(out).toMatch(/^Rewrite this section/);
    expect(out).toMatch(/User request: この章を直して$/);
  });

  it("keeps the original Japanese phrase verbatim inside the payload", () => {
    const out = buildAssistantInstruction("校正して", JA_PRESETS);
    expect(out).toMatch(/User request: 校正して/);
    // The English intent hint is a label, not a replacement.
    expect(out).not.toMatch(/User request: Proofread/);
  });

  it("passes a free-form Japanese request through unchanged", () => {
    const custom = "もっとカジュアルに";
    expect(buildAssistantInstruction(custom, JA_PRESETS)).toBe(custom);
  });

  it("passes a free-form English request through unchanged", () => {
    const custom = "Add a short summary";
    expect(buildAssistantInstruction(custom, EN_PRESETS)).toBe(custom);
  });

  it("returns the empty string for an empty request", () => {
    expect(buildAssistantInstruction("", JA_PRESETS)).toBe("");
  });

  it("returns the trimmed whitespace-only request as-is", () => {
    // `resolveRoughIntent` trims first, so a whitespace-only
    // request becomes an empty string.
    expect(buildAssistantInstruction("   ", JA_PRESETS)).toBe("");
  });
});

// v0.15 payload split.
//
// `buildApplyEvent` is the single place that decides which
// piece of the user's rough request travels on the
// user-facing `payload.request` versus the helper-side
// `payload.instruction`. The AI edit transaction, the main
// editor status message, and the Hazakura Local Assist review bar
// all read `payload.request`, so the original phrase must
// not be replaced by the annotated version. Only the
// helper (via `generateAppleAssistCandidate.instruction`)
// sees the annotated version. The tests below pin that
// contract: a preset match keeps the original phrase in
// `request` and puts the hint-prepended version in
// `instruction`, while a free-form request keeps the same
// string in both fields.

const SAMPLE_TARGET: AppleAssistTargetSnapshot = {
  kind: "selection",
  start: 0,
  end: 10,
  text: "target-text",
  label: "selection",
  activeDocumentPath: "/workspace/notes.md",
  activeDocumentName: "notes.md",
  capturedAtMs: 1,
};

describe("buildApplyEvent", () => {
  it("keeps the original Japanese phrase verbatim in `request`", () => {
    const event: AppleAssistApplyEvent = buildApplyEvent({
      request: "整えて",
      target: SAMPLE_TARGET,
      requestedAtMs: 123,
      presets: JA_PRESETS,
    });
    expect(event.request).toBe("整えて");
  });

  it("puts the hint-prepended instruction in `instruction` for a preset match", () => {
    const event = buildApplyEvent({
      request: "整えて",
      target: SAMPLE_TARGET,
      requestedAtMs: 123,
      presets: JA_PRESETS,
    });
    expect(event.instruction).toMatch(/^Light cleanup/);
    expect(event.instruction).toMatch(/User request: 整えて$/);
  });

  it("never lets the hint leak into `request`", () => {
    const event = buildApplyEvent({
      request: "校正して",
      target: SAMPLE_TARGET,
      requestedAtMs: 123,
      presets: JA_PRESETS,
    });
    expect(event.request).not.toMatch(/Proofread/);
    expect(event.request).not.toMatch(/User request:/);
    expect(event.request).not.toMatch(/^Light cleanup/);
  });

  it("keeps the same string in both fields for a free-form request", () => {
    const custom = "もっとカジュアルに";
    const event = buildApplyEvent({
      request: custom,
      target: SAMPLE_TARGET,
      requestedAtMs: 123,
      presets: JA_PRESETS,
    });
    expect(event.request).toBe(custom);
    expect(event.instruction).toBe(custom);
  });

  it("passes `requestedAtMs` and `target` through unchanged", () => {
    const event = buildApplyEvent({
      request: "整えて",
      target: SAMPLE_TARGET,
      requestedAtMs: 42,
      presets: JA_PRESETS,
    });
    expect(event.requestedAtMs).toBe(42);
    expect(event.target).toBe(SAMPLE_TARGET);
  });

  it("keeps `request` and `instruction` distinct for every preset", () => {
    for (const preset of JA_PRESETS) {
      const event = buildApplyEvent({
        request: preset.prompt,
        target: SAMPLE_TARGET,
        requestedAtMs: 0,
        presets: JA_PRESETS,
      });
      expect(event.request, `request for ${preset.id}`).toBe(preset.prompt);
      expect(
        event.instruction,
        `instruction differs from request for ${preset.id}`,
      ).not.toBe(event.request);
      // The hint must be the only thing that differs — the
      // user's phrase must be the suffix of the annotated
      // instruction so the helper can still anchor on it.
      expect(event.instruction, `instruction for ${preset.id}`).toMatch(
        new RegExp(`User request: ${preset.prompt}$`),
      );
    }
  });

  it("preserves a null target verbatim", () => {
    const event = buildApplyEvent({
      request: "整えて",
      target: null,
      requestedAtMs: 0,
      presets: JA_PRESETS,
    });
    expect(event.target).toBeNull();
  });
});
