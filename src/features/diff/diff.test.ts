import { describe, expect, it } from "vitest";
import { buildLineDiff } from "./diff";

describe("buildLineDiff", () => {
  it("allows moderately long prose comparisons above the old one-million line product cap", () => {
    const lines = Array.from(
      { length: 1_100 },
      (_, index) => `Paragraph ${index + 1}: ${"text ".repeat(20)}`,
    );
    const left = lines.join("\n");
    const revisedLines = [...lines];
    revisedLines[1_099] = "Paragraph 1100: revised ending";
    const right = revisedLines.join("\n");

    const diff = buildLineDiff(left, right);

    expect(diff.additions).toBe(1);
    expect(diff.removals).toBe(1);
  });

  it("still stops comparisons that are too large for the current preview algorithm", () => {
    const left = Array.from({ length: 2_001 }, (_, index) => `left ${index}`).join(
      "\n",
    );
    const right = Array.from(
      { length: 2_001 },
      (_, index) => `right ${index}`,
    ).join("\n");

    expect(() => buildLineDiff(left, right)).toThrow(
      "Compare stopped because these files are too large for the comparison preview.",
    );
  });
});
