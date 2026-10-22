import { describe, expect, it } from "vitest";
import {
  DAWN_SKY,
  NEAR_BAND_THRESHOLD,
  READING_CLEAR_INNER,
  READING_CLEAR_OUTER,
  SCENE_PETAL_COUNT,
  centerClearFactor,
  createBokehPetals,
  createScenePetals,
  edohiganBranchSway,
  edohiganWind,
  scenePetalTargetCount,
  splitPetalBands,
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

describe("paper-front and paper-back petal bands", () => {
  it("draws every petal exactly once across the two layers", () => {
    const petals = createScenePetals("dramatic", 1);
    const { backdrop, foreground } = splitPetalBands(petals);
    expect(backdrop.length + foreground.length).toBe(petals.length);
    const indexes = [...backdrop, ...foreground].map((petal) => petal.index).sort((a, b) => a - b);
    expect(indexes).toEqual(petals.map((petal) => petal.index).sort((a, b) => a - b));
  });

  it("keeps only the near band in front of the paper", () => {
    const { backdrop, foreground } = splitPetalBands(createScenePetals("dramatic", 1));
    expect(foreground.length).toBeGreaterThan(0);
    expect(backdrop.length).toBeGreaterThan(foreground.length);
    for (const petal of foreground) {
      expect(petal.depth01).toBeGreaterThanOrEqual(NEAR_BAND_THRESHOLD);
    }
    for (const petal of backdrop) {
      expect(petal.depth01).toBeLessThan(NEAR_BAND_THRESHOLD);
    }
  });
});

describe("dawn sky palette", () => {
  it("keeps every stop inside 0..1", () => {
    for (const color of Object.values(DAWN_SKY)) {
      expect(color).toHaveLength(3);
      for (const channel of color) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(1);
      }
    }
  });

  it("is brighter at the horizon than at the zenith", () => {
    const luma = (color: readonly number[]) =>
      color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722;
    expect(luma(DAWN_SKY.horizon)).toBeGreaterThan(luma(DAWN_SKY.zenith));
  });
});

describe("foreground bokeh", () => {
  it("is deterministic and stays faint", () => {
    const first = createBokehPetals(6);
    expect(createBokehPetals(6)).toEqual(first);
    expect(first).toHaveLength(6);
    for (const item of first) {
      expect(item.opacity).toBeLessThan(0.11);
      expect(item.size).toBeGreaterThan(0);
    }
  });
});
