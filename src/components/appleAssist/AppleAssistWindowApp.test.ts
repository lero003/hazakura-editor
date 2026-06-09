import { describe, expect, it } from "vitest";
import {
  classifyApplyError,
  getAppleAssistWindowCopy,
  type AppleAssistWindowCopy,
  type OperationFeedbackKind,
} from "./AppleAssistWindowApp";

// v0.12.x Apple Local Assist copy + error classification.
//
// `getAppleAssistWindowCopy` is the single source of truth for
// the 3-language UI strings the Apple Assist window renders,
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
  "refreshDocumentButton",
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
  "feedbackEmpty",
  "feedbackEntry",
];

const PRESET_IDS = ["tidy", "natural", "continue", "proofread", "rewrite-section"];

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
        expect(copy.refreshDocumentButton).toMatch(/\S/);
        expect(copy.targetReadFailed).toMatch(/\S/);
      });

      it("exposes the same preset ids in every language", () => {
        const ids = copy.presets.map((preset) => preset.id);
        expect(ids).toEqual(PRESET_IDS);
      });

      it("uses the language's expected `applyButton`", () => {
        if (lang === "ja") {
          expect(copy.applyButton).toBe("適用");
        } else if (lang === "kana") {
          expect(copy.applyButton).toBe("つかう");
        } else {
          expect(copy.applyButton).toBe("Apply");
        }
      });

      it("labels the mode as Alpha in every language", () => {
        expect(copy.modeLabel).toBe("Alpha");
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

  it("uses different default apply buttons per language (no en bleed-through)", () => {
    const en = getAppleAssistWindowCopy("en").applyButton;
    const ja = getAppleAssistWindowCopy("ja").applyButton;
    const kana = getAppleAssistWindowCopy("kana").applyButton;
    expect(new Set([en, ja, kana]).size).toBe(3);
  });

  it("uses different refreshDocumentButton labels per language (no en bleed-through)", () => {
    const en = getAppleAssistWindowCopy("en").refreshDocumentButton;
    const ja = getAppleAssistWindowCopy("ja").refreshDocumentButton;
    const kana = getAppleAssistWindowCopy("kana").refreshDocumentButton;
    expect(new Set([en, ja, kana]).size).toBe(3);
    // The English copy must not accidentally leak into the
    // Japanese / kana refresh button label.
    expect(ja).not.toMatch(/^Refresh document$/);
    expect(kana).not.toMatch(/^Refresh document$/);
  });

  it("uses different targetReadFailed messages per language (no en bleed-through)", () => {
    const en = getAppleAssistWindowCopy("en").targetReadFailed;
    const ja = getAppleAssistWindowCopy("ja").targetReadFailed;
    const kana = getAppleAssistWindowCopy("kana").targetReadFailed;
    expect(new Set([en, ja, kana]).size).toBe(3);
  });

  it("never accidentally leaks English into the `emptyRequestError`", () => {
    const en = getAppleAssistWindowCopy("en").emptyRequestError;
    const ja = getAppleAssistWindowCopy("ja").emptyRequestError;
    const kana = getAppleAssistWindowCopy("kana").emptyRequestError;
    // `en` is expected to be English; `ja` and `kana` must
    // not start with the English lead-in "Type a rough".
    expect(en).toMatch(/^Type a rough/);
    expect(ja.startsWith("Type a rough")).toBe(false);
    expect(kana.startsWith("Type a rough")).toBe(false);
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
    expect(ja.unsupportedStatus).toMatch(/macOS 26|Apple Intelligence/);
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
      new Error("Apple Assist target text no longer matches the active buffer."),
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
