import { describe, expect, it } from "vitest";
import { computeWindowedLineRange } from "./windowedTextLines";

describe("computeWindowedLineRange", () => {
  it("returns empty for empty content", () => {
    expect(computeWindowedLineRange(0, 0, 400, 20)).toEqual({
      start: 0,
      end: 0,
      total: 0,
    });
  });

  it("keeps small documents fully in the window", () => {
    const range = computeWindowedLineRange(50, 0, 400, 20, 200, 40);
    expect(range.start).toBe(0);
    expect(range.end).toBe(50);
    expect(range.total).toBe(50);
  });

  it("windows long documents around the viewport", () => {
    const range = computeWindowedLineRange(5000, 2000, 400, 20, 200, 40);
    expect(range.total).toBe(5000);
    expect(range.end - range.start).toBeLessThanOrEqual(200 + 80);
    expect(range.start).toBeGreaterThan(0);
    expect(range.end).toBeLessThan(5000);
  });
});
