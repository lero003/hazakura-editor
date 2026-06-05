import { describe, expect, it } from "vitest";
import { getLModeCopy } from "./lMode";

describe("getLModeCopy", () => {
  it("returns English strings when language is en", () => {
    const copy = getLModeCopy("en");
    expect(copy.preferenceLabel).toBe("L Mode");
    expect(copy.paletteCommand).toBe("Toggle L Mode");
    expect(copy.exitPillLabel).toBe("Exit L Mode");
  });

  it("returns Japanese strings when language is ja", () => {
    const copy = getLModeCopy("ja");
    expect(copy.preferenceLabel).toBe("えるモード");
    expect(copy.paletteCommand).toBe("えるモード切替");
    expect(copy.exitPillLabel).toBe("えるモード終了");
  });

  it("returns kana strings when language is kana", () => {
    const copy = getLModeCopy("kana");
    expect(copy.preferenceLabel).toBe("えるもーど");
    expect(copy.paletteCommand).toBe("えるモードきりかえ");
    expect(copy.exitPillLabel).toBe("えるもーどしゅうりょう");
  });

  it("always exposes the same set of keys across languages", () => {
    for (const lang of ["en", "ja", "kana"] as const) {
      const copy = getLModeCopy(lang);
      expect(Object.keys(copy).sort()).toEqual([
        "actionRailLabel",
        "appleAssistReviewBarCloseLabel",
        "appleAssistReviewBarCloseTitle",
        "appleAssistReviewBarDiscardLabel",
        "appleAssistReviewBarDiscardTitle",
        "appleAssistReviewBarEmptyDiffLabel",
        "appleAssistReviewBarLabel",
        "appleAssistReviewBarOpenDiffLabel",
        "appleAssistReviewBarTitle",
        "emptyPlaceholderHint",
        "emptyPlaceholderText",
        "exitPillLabel",
        "exitPillTitle",
        "featureDescription",
        "paletteCommand",
        "preferenceHint",
        "preferenceLabel",
        "statusBarAppleAssistLabel",
        "statusBarAppleAssistTitle",
        "statusBarReviewChangesLabel",
        "statusBarReviewChangesTitle",
        "statusBarWorkspaceLabel",
        "statusBarWorkspaceTitle",
        "typewriterPreferenceHint",
        "typewriterPreferenceLabel",
      ]);
    }
  });

  it("returns the typewriter preference label and hint for each language", () => {
    expect(getLModeCopy("en").typewriterPreferenceLabel).toBe("Typewriter mode");
    expect(getLModeCopy("ja").typewriterPreferenceLabel).toBe(
      "タイプライターモード",
    );
    expect(getLModeCopy("kana").typewriterPreferenceLabel).toBe(
      "たいぷらいたーもーど",
    );
  });

  it("returns localized empty placeholder text", () => {
    expect(getLModeCopy("en").emptyPlaceholderText).toBe("Start writing…");
    expect(getLModeCopy("ja").emptyPlaceholderText).toBe("書き始める…");
    expect(getLModeCopy("kana").emptyPlaceholderText).toBe("かきはじめる…");
  });
});
