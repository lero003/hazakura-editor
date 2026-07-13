import { describe, expect, it } from "vitest";
import { getAppleAssistCopy } from "./appleAssist";

describe("getAppleAssistCopy", () => {
  it("returns English strings when language is en", () => {
    const copy = getAppleAssistCopy("en");
    expect(copy.featureName).toBe("Hazakura Local Assist (on-device)");
    expect(copy.commandCategory).toBe("Hazakura Local Assist");
    expect(copy.generationInProgressTitle).toBe(
      "Hazakura Local Assist is generating",
    );
    expect(copy.generationInProgressMessage).toBe(
      "The document remains visible, but editing is paused.",
    );
    expect(copy.summarizeLabel).toBe("Summarize selection");
    expect(copy.rephraseLabel).toBe("Rephrase selection");
  });

  it("returns Japanese strings when language is ja", () => {
    const copy = getAppleAssistCopy("ja");
    expect(copy.featureName).toBe("Hazakura Local Assist (この Mac のみ)");
    expect(copy.commandCategory).toBe("Hazakura Local Assist");
    expect(copy.generationInProgressTitle).toBe(
      "Hazakura Local Assist が生成中です",
    );
    expect(copy.generationInProgressMessage).toBe(
      "本文は表示できますが、編集は一時停止しています。",
    );
    expect(copy.summarizeLabel).toBe("選択範囲を要約");
    expect(copy.rephraseLabel).toBe("選択範囲を言い換え");
  });

  it("returns kana strings when language is kana", () => {
    const copy = getAppleAssistCopy("kana");
    expect(copy.featureName).toBe("はざくら ろーかる あしす と (この Mac のみ)");
    expect(copy.commandCategory).toBe("はざくら ろーかる あしす と");
    expect(copy.generationInProgressTitle).toBe(
      "はざくら ろーかる あしす とが せいせいちゅうです",
    );
    expect(copy.summarizeLabel).toBe("せんたくはんいを ようやく");
    expect(copy.rephraseLabel).toBe("せんたくはんいを かきかえ");
  });

  it("exposes the same set of keys across languages", () => {
    for (const lang of ["en", "ja", "kana"] as const) {
      const copy = getAppleAssistCopy(lang);
      expect(Object.keys(copy).sort()).toEqual([
        "availabilityAvailable",
        "availabilityDisabled",
        "availabilityUnavailablePrefix",
        "availabilityUnsupported",
        "commandCategory",
        "featureName",
        "generationInProgressMessage",
        "generationInProgressTitle",
        "rephraseHint",
        "rephraseLabel",
        "summarizeHint",
        "summarizeLabel",
      ]);
    }
  });

  it("names Hazakura Local Assist as a per-Mac feature in every language", () => {
    // "on-device" / "この Mac のみ" / "この Mac" must appear in
    // each language so the user never confuses this with a
    // network-backed assistant. The en variant uses
    // "(on-device)" and the kana variant uses "この Mac" wording.
    expect(getAppleAssistCopy("en").featureName).toContain("on-device");
    expect(getAppleAssistCopy("ja").featureName).toContain("この Mac のみ");
    expect(getAppleAssistCopy("kana").featureName).toContain("この Mac");
  });

  it("disclaims auto-apply in the operation hints", () => {
    // The hint must never read as "this will change your file".
    // Both operations must direct the user to review changes before
    // applying them explicitly.
    for (const lang of ["en", "ja", "kana"] as const) {
      const copy = getAppleAssistCopy(lang);
      expect(copy.summarizeHint).toMatch(/diff|差分|さぶん/);
      expect(copy.rephraseHint).toMatch(/diff|差分|さぶん/);
    }
  });
});
