import { describe, expect, it } from "vitest";
import { getLModeCopy } from "./lMode";

describe("getLModeCopy", () => {
  it("returns English strings when language is en", () => {
    const copy = getLModeCopy("en");
    expect(copy.preferenceLabel).toBe("L Mode");
    expect(copy.paletteCommand).toBe("Toggle L Mode");
    expect(copy.exitPillLabel).toBe("Edit mode");
  });

  it("returns Japanese strings when language is ja", () => {
    const copy = getLModeCopy("ja");
    expect(copy.preferenceLabel).toBe("えるモード");
    expect(copy.paletteCommand).toBe("えるモード切替");
    expect(copy.exitPillLabel).toBe("編集モードへ");
  });

  it("returns kana strings when language is kana", () => {
    const copy = getLModeCopy("kana");
    expect(copy.preferenceLabel).toBe("えるもーど");
    expect(copy.paletteCommand).toBe("えるモードきりかえ");
    expect(copy.exitPillLabel).toBe("へんしゅうへ");
  });

  it("always exposes the same set of keys across languages", () => {
    for (const lang of ["en", "ja", "kana"] as const) {
      const copy = getLModeCopy(lang);
      expect(Object.keys(copy).sort()).toEqual([
        "actionRailAppleAssistShortLabel",
        "actionRailAppleAssistTooltip",
        "actionRailLabel",
        "actionRailReviewChangesShortLabel",
        "actionRailReviewChangesTooltip",
        "actionRailTypewriterShortLabel",
        "actionRailTypewriterTooltip",
        "appleAssistReviewBarCloseDiffLabel",
        "appleAssistReviewBarCloseLabel",
        "appleAssistReviewBarCloseTitle",
        "appleAssistReviewBarDiscardLabel",
        "appleAssistReviewBarDiscardTitle",
        "appleAssistReviewBarEmptyDiffLabel",
        "appleAssistReviewBarLabel",
        "appleAssistReviewBarOpenDiffLabel",
        "appleAssistReviewBarTitle",
        "changeReviewSheetCloseLabel",
        "changeReviewSheetCloseTitle",
        "changeReviewSheetLabel",
        "changeReviewSheetTitle",
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
        "unsavedIndicatorLabel",
        "workspaceOverlayCloseLabel",
        "workspaceOverlayLabel",
        "workspaceToggleLabel",
        "workspaceToggleTitle",
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

  it("returns a non-empty tooltip for every action rail button in every language", () => {
    for (const lang of ["en", "ja", "kana"] as const) {
      const copy = getLModeCopy(lang);
      expect(copy.actionRailAppleAssistTooltip, `apple assist for ${lang}`)
        .toMatch(/\S/);
      expect(copy.actionRailTypewriterTooltip, `typewriter for ${lang}`)
        .toMatch(/\S/);
      expect(copy.actionRailReviewChangesTooltip, `review changes for ${lang}`)
        .toMatch(/\S/);
    }
  });

  it("keeps the three action rail tooltips distinct per language", () => {
    for (const lang of ["en", "ja", "kana"] as const) {
      const copy = getLModeCopy(lang);
      const tips = new Set([
        copy.actionRailAppleAssistTooltip,
        copy.actionRailTypewriterTooltip,
        copy.actionRailReviewChangesTooltip,
      ]);
      expect(tips.size, `tooltip collapse for ${lang}`).toBe(3);
    }
  });

  it("does not bleed English into the ja or kana action rail tooltips", () => {
    const en = getLModeCopy("en");
    const ja = getLModeCopy("ja");
    const kana = getLModeCopy("kana");
    expect(ja.actionRailAppleAssistTooltip).not.toBe(
      en.actionRailAppleAssistTooltip,
    );
    expect(kana.actionRailAppleAssistTooltip).not.toBe(
      en.actionRailAppleAssistTooltip,
    );
    expect(ja.actionRailTypewriterTooltip).not.toBe(
      en.actionRailTypewriterTooltip,
    );
    expect(kana.actionRailTypewriterTooltip).not.toBe(
      en.actionRailTypewriterTooltip,
    );
    expect(ja.actionRailReviewChangesTooltip).not.toBe(
      en.actionRailReviewChangesTooltip,
    );
    expect(kana.actionRailReviewChangesTooltip).not.toBe(
      en.actionRailReviewChangesTooltip,
    );
  });
});
