import { describe, expect, it } from "vitest";
import {
  READING_CLEAR_INNER,
  READING_CLEAR_OUTER,
  SCENE_PETAL_COUNT,
  centerClearFactor,
  createScenePetals,
  edohiganBranchSway,
  edohiganWind,
  scenePetalTargetCount,
} from "./edohiganScene";

describe("edohigan 3D petal model", () => {
  it("returns the same petals for the same intensity", () => {
    expect(createScenePetals("normal")).toEqual(createScenePetals("normal"));
  });

  it("keeps the surviving petals in their places when the quality tier drops", () => {
    // 段が落ちたときに花が「別の配置へ飛ぶ」と、演出ではなく不具合に見える。
    const full = createScenePetals("dramatic", 0);
    const reduced = createScenePetals("dramatic", 3);
    expect(reduced.length).toBeLessThan(full.length);
    expect(reduced).toEqual(full.slice(0, reduced.length));
  });

  it("opens with the near band so the foreground survives a downgrade", () => {
    const petals = createScenePetals("normal", 0);
    expect(petals[0].depth01).toBeGreaterThan(0.7);
    const firstThree = new Set(petals.slice(0, 3).map((petal) => Math.round(petal.depth01 * 10)));
    expect(firstThree.size).toBe(3);
  });

  it("turns the whole model off for the off intensity", () => {
    expect(createScenePetals("off")).toEqual([]);
    expect(scenePetalTargetCount("off", 0)).toBe(0);
  });

  it("fits the fixed instanced-attribute budget", () => {
    for (const intensity of ["subtle", "normal", "dramatic"] as const) {
      expect(SCENE_PETAL_COUNT[intensity]).toBeLessThanOrEqual(96);
      expect(SCENE_PETAL_COUNT[intensity]).toBeGreaterThan(0);
    }
  });

  it("counts up with intensity and down with quality", () => {
    expect(scenePetalTargetCount("subtle", 1)).toBeLessThan(scenePetalTargetCount("normal", 1));
    expect(scenePetalTargetCount("normal", 1)).toBeLessThan(scenePetalTargetCount("dramatic", 1));
    expect(scenePetalTargetCount("normal", 3)).toBeLessThan(scenePetalTargetCount("normal", 0));
  });
});

describe("edohigan shared wind", () => {
  it("stays in 0..1 and actually moves", () => {
    const samples = Array.from({ length: 480 }, (_, index) => edohiganWind(index * 0.25));
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...samples)).toBeLessThanOrEqual(1);
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(0.4);
  });

  it("moves the branch less than one degree", () => {
    const degrees = Array.from(
      { length: 200 },
      (_, index) => (Math.abs(edohiganBranchSway(index * 0.4)) * 180) / Math.PI,
    );
    expect(Math.max(...degrees)).toBeLessThan(1);
  });
});

describe("reading column protection", () => {
  it("removes near petals from the centre and only fades far ones", () => {
    expect(centerClearFactor(0.5, 0.9)).toBe(0);
    expect(centerClearFactor(0.5, 0.12)).toBeGreaterThan(0.4);
    expect(centerClearFactor(0.02, 0.9)).toBe(1);
  });

  it("keeps the clear band narrower than the outer margins", () => {
    expect(READING_CLEAR_INNER).toBeLessThan(READING_CLEAR_OUTER);
    expect(READING_CLEAR_OUTER).toBeLessThan(0.35);
  });
});
