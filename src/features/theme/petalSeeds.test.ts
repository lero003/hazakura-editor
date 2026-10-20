import { describe, expect, it } from "vitest";
import { PETAL_COUNT, createPetalSeeds } from "./petalSeeds";

describe("petal seeds", () => {
  it.each([
    ["subtle", 6],
    ["normal", 14],
    ["dramatic", 22],
    ["off", 0],
  ] as const)("%s yields the contract petal count", (intensity, count) => {
    expect(PETAL_COUNT[intensity]).toBe(count);
    expect(createPetalSeeds(intensity)).toHaveLength(count);
  });

  it("is deterministic for the same intensity", () => {
    expect(createPetalSeeds("normal")).toEqual(createPetalSeeds("normal"));
  });

  it("spreads petals across all three depth bands", () => {
    const depths = new Set(createPetalSeeds("normal").map((seed) => seed.depth));
    expect([...depths].sort()).toEqual(["far", "mid", "near"]);
  });

  it("keeps every petal inside its parameter bounds", () => {
    for (const seed of createPetalSeeds("dramatic")) {
      expect(seed.leftPercent).toBeGreaterThanOrEqual(0);
      expect(seed.leftPercent).toBeLessThan(100);
      expect(seed.sizePx).toBeGreaterThan(0);
      expect(seed.opacity).toBeGreaterThan(0);
      expect(seed.opacity).toBeLessThanOrEqual(0.8);
      expect(seed.blurPx).toBeGreaterThanOrEqual(0);
      expect(seed.swayPx).toBeGreaterThan(0);
      expect(seed.swayPx).toBeLessThan(40);
      expect(seed.rollDeg).toBeGreaterThan(0);
      expect(seed.rollDeg).toBeLessThan(24);
      expect(seed.fallDelaySeconds).toBeLessThanOrEqual(0);
      expect(seed.swayDelaySeconds).toBeLessThanOrEqual(0);
    }
  });

  it("keeps the fall, sway and flip periods off a common multiple", () => {
    // 整数比だと、いずれ全員が同じ姿勢に戻って「機械的に同期した」動きに見える。
    const seeds = createPetalSeeds("dramatic");
    const falls = seeds.map((seed) => seed.fallSeconds);
    expect(new Set(falls.map((value) => value.toFixed(3))).size).toBe(falls.length);
    for (let i = 1; i < seeds.length; i += 1) {
      const ratio = seeds[i].fallSeconds / seeds[i - 1].fallSeconds;
      expect(Math.abs(ratio - Math.round(ratio))).toBeGreaterThan(0.02);
      const swayRatio = seeds[i].swaySeconds / seeds[i - 1].swaySeconds;
      expect(Math.abs(swayRatio - Math.round(swayRatio))).toBeGreaterThan(0.02);
    }
  });

  it("scales depth as aerial perspective", () => {
    const seeds = createPetalSeeds("normal");
    const byDepth = (depth: string) =>
      seeds.filter((seed) => seed.depth === depth);
    const near = byDepth("near")[0];
    const far = byDepth("far")[0];
    // 遠い花弁は 小さい・淡い・ぼける・遅い。
    expect(far.sizePx).toBeLessThan(near.sizePx);
    expect(far.opacity).toBeLessThan(near.opacity);
    expect(far.blurPx).toBeGreaterThan(near.blurPx);
    expect(far.fallSeconds).toBeGreaterThan(near.fallSeconds);
  });
});
