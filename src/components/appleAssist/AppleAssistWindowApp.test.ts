import { describe, expect, it } from "vitest";
import {
  classifyApplyError,
  getApplyStatusPresentation,
  getAppleAssistWindowCopy,
  type AppleAssistWindowCopy,
  type OperationFeedbackKind,
} from "./AppleAssistWindowApp";

// v0.12.x Hazakura Local Assist copy + error classification.
//
// `getAppleAssistWindowCopy` is the single source of truth for
// the 3-language UI strings the Hazakura Local Assist window renders,
// and `classifyApplyError` turns raw Rust / Foundation Models
// error messages into localized, actionable text. The tests
// below pin both: any rename, accidental English leak, or
// reordering of the `AppleAssistWindowCopy` shape surfaces
// here. The full prose is not asserted word-for-word — that
// would couple the test to the Japanese phrasing and make
// routine copy edits need a test rewrite. Instead, the
// tests pin:
//   - every required string key is present in each language
//   - the error classifier routes each known error family
//     to the matching localized string
//   - the unknown-error fallback preserves the raw message
//     so the user can still report it
//   - the language-specific copy never accidentally falls
//     back to the English string

const REQUIRED_KEYS: ReadonlyArray<keyof AppleAssistWindowCopy> = [
  "activeDocument",
  "appliedStatus",
  "applyButton",
  "availableDisclosure",
  "contextTooLongError",
  "disabledStatus",
  "emptyRequestError",
  "failedStatus",
  "generatingButton",
  "generatingChange",
  "generatingInMain",
  "guardrailError",
  "localRuntimeUnavailable",
  "longRunningStatus",
  "modeLabel",
  "noActiveDocument",
  "noTarget",
  "placeholder",
  "presets",
  "presetsLabel",
  "readyStatus",
  "roughRequestLabel",
  "selectionTooLongError",
  "sendingRequest",
  "subtitle",
  "targetReadFailed",
  "targetStaleError",
  "tauriUnavailableError",
  "targetBlock",
  "targetDocument",
  "targetLabel",
  "targetParagraph",
  "targetSection",
  "targetSelection",
  "throttledError",
  "unknownError",
  "unsupportedStatus",
  "workingLocally",
  // v0.17 operation-feedback panel. The keys are the
  // minimum required to render the panel; the
  // `feedbackEntry` function shape is exercised in a
  // separate test below.
  "feedbackHeading",
  "feedbackDescription",
  "feedbackEmpty",
  "feedbackEntry",
];

const PRESET_IDS = [
  "proofread_only",
  "rewrite_natural",
  "summarize",
  "translate",
  "continue_ideas",
  "shorten",
  "review_section",
];

const FEEDBACK_KINDS: ReadonlyArray<OperationFeedbackKind> = [
  "ready",
  "target-acquired",
  "request-sent",
  "generation-started",
  "applied",
  "failed",
  "unavailable",
];

describe("getAppleAssistWindowCopy", () => {
  for (const lang of ["en", "ja", "kana"] as const) {
    describe(`${lang}`, () => {
      const copy = getAppleAssistWindowCopy(lang);

      it("exposes every required string key", () => {
        for (const key of REQUIRED_KEYS) {
          expect(copy[key], `key ${key} for ${lang}`).toBeDefined();
        }
      });

      it("renders function-shaped keys to non-empty strings", () => {
        expect(copy.activeDocument("notes.md")).toMatch(/\S/);
        expect(copy.appliedStatus("整えて")).toMatch(/\S/);
        expect(copy.generatingInMain("整えて")).toMatch(/\S/);
        expect(copy.localRuntimeUnavailable("Apple Intelligence is off"))
          .toMatch(/\S/);
        expect(copy.targetSelection(123)).toMatch(/\S/);
        expect(copy.targetParagraph(123)).toMatch(/\S/);
        expect(copy.targetBlock(123)).toMatch(/\S/);
        expect(copy.targetSection(123)).toMatch(/\S/);
        expect(copy.targetDocument(123)).toMatch(/\S/);
        expect(copy.targetLabel("H2 見出し")).toMatch(/\S/);
        expect(copy.unknownError("raw detail")).toMatch(/\S/);
        expect(copy.targetReadFailed).toMatch(/\S/);
      });

      it("exposes the same preset ids in every language", () => {
        const ids = copy.presets.map((preset) => preset.actionId);
        expect(ids).toEqual(PRESET_IDS);
      });

      it("exposes visible request text for every preset", () => {
        for (const preset of copy.presets) {
          expect(preset.requestText).toMatch(/\S/);
          expect(preset.requestText).not.toBe(preset.label);
        }
      });

      it("uses the language's expected `applyButton`", () => {
        if (lang === "ja") {
          expect(copy.applyButton).toBe("依頼する");
        } else if (lang === "kana") {
          expect(copy.applyButton).toBe("おねがいする");
        } else {
          expect(copy.applyButton).toBe("Send request");
        }
      });

      it("labels the mode as a preview instead of an experimental alpha", () => {
        expect(copy.modeLabel).toMatch(/Preview|プレビュー|ぷれびゅー/);
        expect(copy.modeLabel).not.toMatch(/Alpha|Experimental|実験/);
      });

      // v0.17 operation-feedback panel: every lifecycle
      // kind must produce a non-empty, language-localized
      // string. The exact wording is not pinned so routine
      // copy edits do not need a test rewrite; the
      // structural properties (non-empty, no obvious
      // safety keywords, no English bleed-through into
      // ja / kana) are.
      it("renders a non-empty string for every operation-feedback kind", () => {
        for (const kind of FEEDBACK_KINDS) {
          const payload =
            kind === "target-acquired"
              ? { targetKind: "selection" as const, targetChars: 142 }
              : undefined;
          const text = copy.feedbackEntry(kind, payload);
          expect(text, `${lang} kind ${kind}`).toMatch(/\S/);
        }
      });

      it("explains the request flow without turning the panel into a transcript", () => {
        expect(copy.feedbackDescription).toMatch(/\S/);
        expect(copy.feedbackDescription).not.toMatch(
          /transcript|prompt|response|reasoning|chain of thought/i,
        );
        if (lang === "ja") {
          expect(copy.feedbackDescription).toMatch(/依頼ごと|対象確認|差分/);
          expect(copy.availableDisclosure).toMatch(/未保存|差分|外部 AI/);
        }
        if (lang === "en") {
          expect(copy.feedbackDescription).toMatch(/Each request|unsaved|save/);
          expect(copy.availableDisclosure).toMatch(/external AI service/);
        }
      });

      it("keeps footer status copy short instead of echoing long request text", () => {
        const longRequest =
          "この依頼文は長くてもフッターの高さを変えないための確認文です";
        expect(copy.appliedStatus(longRequest)).not.toContain(longRequest);
        expect(copy.generatingInMain(longRequest)).not.toContain(longRequest);
      });

      it("keeps the target-acquired entry to a kind + character count (no document body, no path, no transcript)", () => {
        const text = copy.feedbackEntry("target-acquired", {
          targetKind: "selection",
          targetChars: 142,
        });
        expect(text).not.toContain("/Users/");
        expect(text).not.toMatch(/transcript|prompt|response|reasoning|chain of thought/i);
      });

      it("never accidentally leaks English into the feedback panel for ja / kana", () => {
        if (lang === "en") {
          return;
        }
        for (const kind of FEEDBACK_KINDS) {
          const payload =
            kind === "target-acquired"
              ? { targetKind: "selection" as const, targetChars: 142 }
              : undefined;
          const text = copy.feedbackEntry(kind, payload);
          expect(text, `${lang} kind ${kind}`).not.toMatch(/^Ready\./);
          expect(text, `${lang} kind ${kind}`).not.toMatch(/^Request sent/);
          expect(text, `${lang} kind ${kind}`).not.toMatch(/^Local generation started/);
          expect(text, `${lang} kind ${kind}`).not.toMatch(/^Applied as/);
          expect(text, `${lang} kind ${kind}`).not.toMatch(/^Failed\./);
        }
      });
    });
  }

  it("uses Hazakura Local Assist as the user-facing feature name", () => {
    const combined = JSON.stringify(getAppleAssistWindowCopy("en"));

    expect(combined).toContain("Hazakura Local Assist");
    expect(combined).not.toContain("Apple Local Assist");
  });

  it("does not expose alpha or experimental wording in user-facing window copy", () => {
    for (const lang of ["en", "ja", "kana"] as const) {
      const combined = JSON.stringify(getAppleAssistWindowCopy(lang));
      expect(combined).not.toMatch(/Alpha|Experimental|実験/);
    }
  });

  it("uses different default apply buttons per language (no en bleed-through)", () => {
    const en = getAppleAssistWindowCopy("en").applyButton;
    const ja = getAppleAssistWindowCopy("ja").applyButton;
    const kana = getAppleAssistWindowCopy("kana").applyButton;
    expect(new Set([en, ja, kana]).size).toBe(3);
  });

  it("uses different targetReadFailed messages per language (no en bleed-through)", () => {
    const en = getAppleAssistWindowCopy("en").targetReadFailed;
    const ja = getAppleAssistWindowCopy("ja").targetReadFailed;
    const kana = getAppleAssistWindowCopy("kana").targetReadFailed;
    expect(new Set([en, ja, kana]).size).toBe(3);
  });

  it("does not expose a manual target refresh label because apply re-reads the target", () => {
    expect("refreshDocumentButton" in getAppleAssistWindowCopy("ja")).toBe(false);
  });

  it("never accidentally leaks English into the `emptyRequestError`", () => {
    const en = getAppleAssistWindowCopy("en").emptyRequestError;
    const ja = getAppleAssistWindowCopy("ja").emptyRequestError;
    const kana = getAppleAssistWindowCopy("kana").emptyRequestError;
    // `en` is expected to be English; `ja` and `kana` must
    // not start with the English lead-in.
    expect(en).toMatch(/^Type a request/);
    expect(ja.startsWith("Type a request")).toBe(false);
    expect(kana.startsWith("Type a request")).toBe(false);
  });

  it("keeps the error copy actionable (mentions the cap or the recovery action)", () => {
    const en = getAppleAssistWindowCopy("en");
    expect(en.selectionTooLongError).toMatch(/4000/);
    expect(en.contextTooLongError).toMatch(/8000/);
    expect(en.disabledStatus).toMatch(/Preferences/);
    expect(en.unsupportedStatus).toMatch(/macOS 26/);
    expect(en.guardrailError).toMatch(/guardrail|refused/i);
    expect(en.throttledError).toMatch(/rate|busy/i);

    const ja = getAppleAssistWindowCopy("ja");
    expect(ja.selectionTooLongError).toMatch(/4000/);
    expect(ja.contextTooLongError).toMatch(/8000/);
    expect(ja.disabledStatus).toMatch(/Preferences|Assist Surface/);
    expect(ja.unsupportedStatus).toMatch(/macOS 26|M1|Apple Intelligence|対応言語/);
  });
});

describe("classifyApplyError", () => {
  const copy = getAppleAssistWindowCopy("ja");

  it("routes the Rust 'Selected text exceeds' message to selectionTooLongError", () => {
    const message = classifyApplyError(
      new Error(
        "Selected text exceeds the maximum length of 4000 characters.",
      ),
      copy,
    );
    expect(message).toBe(copy.selectionTooLongError);
    expect(message).toMatch(/4000/);
  });

  it("routes the Rust 'Document context exceeds' message to contextTooLongError", () => {
    const message = classifyApplyError(
      new Error(
        "Document context exceeds the maximum length of 8000 characters.",
      ),
      copy,
    );
    expect(message).toBe(copy.contextTooLongError);
    expect(message).toMatch(/8000/);
  });

  it("routes the Foundation Models 'exceededContextWindowSize' to contextTooLongError", () => {
    const message = classifyApplyError(
      new Error(
        "Foundation Models input is too large for this request. exceededContextWindowSize(...)",
      ),
      copy,
    );
    expect(message).toBe(copy.contextTooLongError);
  });

  it("routes a stale-target message to targetStaleError", () => {
    const message = classifyApplyError(
      new Error("Hazakura Local Assist target text no longer matches the active buffer."),
      copy,
    );
    expect(message).toBe(copy.targetStaleError);
  });

  it("routes a guardrail message to guardrailError", () => {
    const message = classifyApplyError(
      new Error("Apple Foundation Models refused this request (guardrail)."),
      copy,
    );
    expect(message).toBe(copy.guardrailError);
  });

  it("routes a throttled message to throttledError", () => {
    const message = classifyApplyError(
      new Error("Apple Foundation Models is rate limited. Try again shortly."),
      copy,
    );
    expect(message).toBe(copy.throttledError);
  });

  it("falls back to unknownError with the raw message preserved", () => {
    const message = classifyApplyError(
      new Error("Some unexpected future error: xyz"),
      copy,
    );
    expect(message).toBe(copy.unknownError("Some unexpected future error: xyz"));
    expect(message).toMatch(/Some unexpected future error: xyz/);
  });

  it("accepts non-Error values (string, undefined, object) without throwing", () => {
    expect(() => classifyApplyError("just a string", copy)).not.toThrow();
    expect(() => classifyApplyError(undefined, copy)).not.toThrow();
    expect(() => classifyApplyError({ code: "weird" }, copy)).not.toThrow();
    const message = classifyApplyError("just a string", copy);
    expect(message).toBe(copy.unknownError("just a string"));
  });

  it("uses the English copy when run against the en bundle", () => {
    const en = getAppleAssistWindowCopy("en");
    const message = classifyApplyError(
      new Error("Selected text exceeds the maximum length of 4000 characters."),
      en,
    );
    expect(message).toBe(en.selectionTooLongError);
    expect(message).toMatch(/4000/);
  });
});

describe("getApplyStatusPresentation", () => {
  const copy = getAppleAssistWindowCopy("en");

  it("keeps failed event detail in error only so the footer does not duplicate it", () => {
    const raw =
      "Hazakura Local Assist generation failed: Foundation Models input is too large for this request. Try a smaller selection.";

    const presentation = getApplyStatusPresentation(
      {
        phase: "failed",
        message: raw,
        request: "Make this more natural.",
        emittedAtMs: 1,
      },
      copy,
    );

    expect(presentation.status).toBe(copy.failedStatus);
    expect(presentation.status).not.toBe(raw);
    expect(presentation.error).toBe(raw);
    expect(presentation.feedbackKind).toBe("failed");
  });

  it("keeps completed events as a short success status without an error", () => {
    const presentation = getApplyStatusPresentation(
      {
        phase: "completed",
        message: "Hazakura Local Assist applied: Rewrite",
        request: "Rewrite",
        emittedAtMs: 1,
        shouldApplyToDocument: true,
      },
      copy,
    );

    expect(presentation.status).toBe(copy.appliedStatus("Rewrite"));
    expect(presentation.error).toBeNull();
    expect(presentation.feedbackKind).toBe("applied");
  });
});
