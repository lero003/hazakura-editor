import { describe, expect, it } from "vitest";
import { referenceCompareCopy } from "./referenceCompare";

describe("referenceCompareCopy accessibility labels", () => {
  it("keeps the narrow-focus toolbar named in every supported language", () => {
    expect(referenceCompareCopy("en").narrowFocusLabel).toBe("Reference focus");
    expect(referenceCompareCopy("ja").narrowFocusLabel).toBe("参照表示の対象");
    expect(referenceCompareCopy("kana").narrowFocusLabel).toBe(
      "さんしょうひょうじの たいしょう",
    );
    expect(referenceCompareCopy("en").loadingPage).toBe("Loading page");
    expect(referenceCompareCopy("ja").loadingPage).toBe("ページを読み込み中");
    expect(referenceCompareCopy("kana").loadingPage).toBe(
      "ページを よみこみちゅう",
    );
  });

  it("exposes the same copy keys across languages", () => {
    const keys = Object.keys(referenceCompareCopy("en")).sort();
    for (const language of ["ja", "kana"] as const) {
      expect(Object.keys(referenceCompareCopy(language)).sort()).toEqual(keys);
    }
  });
});
