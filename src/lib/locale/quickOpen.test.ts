import { describe, expect, it } from "vitest";
import { getQuickOpenCopy } from "./quickOpen";

describe("getQuickOpenCopy", () => {
  it("states loaded-tree scope without claiming a whole-workspace index", () => {
    for (const lang of ["en", "ja", "kana"] as const) {
      const copy = getQuickOpenCopy(lang);
      expect(copy.scopeHint.length).toBeGreaterThan(10);
      expect(copy.treePartialHint.length).toBeGreaterThan(10);
      expect(copy.resultCapHint(100, 250)).toMatch(/100/);
      expect(copy.resultCapHint(100, 250)).toMatch(/250/);
    }
  });

  it("localizes the dialog title", () => {
    expect(getQuickOpenCopy("en").dialogLabel).toBe("Quick Open");
    expect(getQuickOpenCopy("ja").dialogLabel).toBe("クイックオープン");
    expect(getQuickOpenCopy("kana").dialogLabel).toContain("ふみ");
  });
});
