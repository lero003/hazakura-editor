import { describe, expect, it } from "vitest";
import { appleAssistTargetExcerpt } from "./appleAssistText";

describe("appleAssistTargetExcerpt", () => {
  it("flattens line breaks and repeated spaces into one line", () => {
    expect(appleAssistTargetExcerpt("朝の  余白\n\nまだ  風は冷たい")).toBe("朝の 余白 まだ 風は冷たい");
  });

  it("keeps short text untouched", () => {
    expect(appleAssistTargetExcerpt("短い文")).toBe("短い文");
  });

  it("truncates long text with a trailing ellipsis", () => {
    const excerpt = appleAssistTargetExcerpt("あ".repeat(200), 60);
    expect(excerpt).toHaveLength(61);
    expect(excerpt.endsWith("…")).toBe(true);
  });

  it("returns an empty string for whitespace-only text", () => {
    expect(appleAssistTargetExcerpt("  \n\t ")).toBe("");
  });
});
