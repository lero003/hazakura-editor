import { describe, expect, it } from "vitest";
import {
  MAX_TEXT_REFERENCE_CHARS,
  MAX_TEXT_REFERENCE_LINES,
  isTextReferenceWithinBudget,
} from "./textReferenceBudget";

describe("isTextReferenceWithinBudget", () => {
  it("accepts the long-reference smoke boundary", () => {
    expect(isTextReferenceWithinBudget(Array.from({ length: 5_000 }, () => "日本語の長い行").join("\n"))).toBe(true);
  });

  it("rejects text beyond the character budget", () => {
    expect(isTextReferenceWithinBudget("a".repeat(MAX_TEXT_REFERENCE_CHARS + 1))).toBe(false);
  });

  it("rejects text beyond the logical-line budget", () => {
    expect(isTextReferenceWithinBudget("\n".repeat(MAX_TEXT_REFERENCE_LINES))).toBe(false);
  });
});
