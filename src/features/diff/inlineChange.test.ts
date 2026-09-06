import { describe, expect, it } from "vitest";
import { describeInlineChange } from "./inlineChange";

describe("bounded inline change envelope", () => {
  it("highlights a single Japanese character rather than the whole paragraph", () => {
    expect(describeInlineChange("桜が咲く。", "桜も咲く。")).toEqual({ prefix: "桜", removed: "が", added: "も", suffix: "咲く。" });
  });
  it("keeps grapheme clusters intact", () => {
    expect(describeInlineChange("A👩‍💻B", "A👩‍🎨B")).toEqual({ prefix: "A", removed: "👩‍💻", added: "👩‍🎨", suffix: "B" });
  });
  it("preserves whitespace, Markdown punctuation and insertion-only changes", () => {
    expect(describeInlineChange("# Title", "## Title")).toEqual({ prefix: "#", removed: "", added: "#", suffix: " Title" });
    expect(describeInlineChange("body  ", "body ")).toEqual({ prefix: "body ", removed: " ", added: "", suffix: "" });
  });
  it.each([["", "new"], ["old", ""], ["same", "same"], ["aXbYc", "aPbQc"], ["x".repeat(8001), "y"]])("reconstructs both exact inputs (%#)", (before, after) => {
    const result = describeInlineChange(before, after);
    expect(result.prefix + result.removed + result.suffix).toBe(before);
    expect(result.prefix + result.added + result.suffix).toBe(after);
  });
});
