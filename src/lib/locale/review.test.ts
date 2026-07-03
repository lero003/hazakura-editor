import { describe, expect, it } from "vitest";
import { getReviewCopy } from "./review";

describe("getReviewCopy", () => {
  it("uses explicit accept and discard decisions for Local Assist review", () => {
    expect(getReviewCopy("en")).toMatchObject({
      appleAssistReviewBarAcceptLabel: "Accept",
      appleAssistReviewBarDiscardLabel: "Discard",
    });
    expect(getReviewCopy("ja")).toMatchObject({
      appleAssistReviewBarAcceptLabel: "採用",
      appleAssistReviewBarDiscardLabel: "破棄",
    });
    expect(getReviewCopy("kana")).toMatchObject({
      appleAssistReviewBarAcceptLabel: "さいよう",
      appleAssistReviewBarDiscardLabel: "はき",
    });
  });

  it("always exposes the same set of keys across languages", () => {
    const keys = Object.keys(getReviewCopy("en")).sort();
    for (const lang of ["ja", "kana"] as const) {
      expect(Object.keys(getReviewCopy(lang)).sort()).toEqual(keys);
    }
  });

  it("provides ai-edit-vs-buffer column labels for each language", () => {
    expect(getReviewCopy("en").appleAssistReviewBarBeforeLabel).toBe("Before");
    expect(getReviewCopy("en").appleAssistReviewBarAfterLabel).toBe("After");
    expect(getReviewCopy("ja").appleAssistReviewBarBeforeLabel).toBe("変更前");
    expect(getReviewCopy("ja").appleAssistReviewBarAfterLabel).toBe("変更後");
    expect(getReviewCopy("kana").appleAssistReviewBarBeforeLabel).toBe(
      "もとの ぶん",
    );
    expect(getReviewCopy("kana").appleAssistReviewBarAfterLabel).toBe(
      "へんこうご",
    );
  });
});
