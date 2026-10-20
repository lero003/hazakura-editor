import { describe, expect, it } from "vitest";
import {
  ambientQualityDprCap,
  ambientQualityFrameIntervalMs,
  baseAmbientQualityTier,
  blendAmbientFrameTime,
  initialAmbientQualityState,
  updateAmbientQuality,
} from "./ambientQuality";

describe("ambientQuality", () => {
  it("maps intensity to the base tier (dramatic is the best allowed)", () => {
    expect(baseAmbientQualityTier("dramatic")).toBe(0);
    expect(baseAmbientQualityTier("normal")).toBe(1);
    expect(baseAmbientQualityTier("subtle")).toBe(2);
    expect(baseAmbientQualityTier("off")).toBe(3);
  });

  it("keeps DPR and frame budget identical to the intensity mapping at the base tier", () => {
    // Q-THM-1 の既存値を tier 経由でも再現する（実機で見え方を変えない）。
    expect(ambientQualityDprCap(0)).toBe(2);
    expect(ambientQualityDprCap(1)).toBe(2);
    expect(ambientQualityDprCap(2)).toBe(1.5);
    expect(ambientQualityDprCap(3)).toBe(1);
    expect(ambientQualityFrameIntervalMs(0)).toBe(0);
    expect(ambientQualityFrameIntervalMs(1)).toBeCloseTo(1000 / 60);
    expect(ambientQualityFrameIntervalMs(2)).toBeCloseTo(1000 / 30);
    expect(ambientQualityFrameIntervalMs(3)).toBeCloseTo(1000 / 30);
  });

  it("blends frame time into an EMA without jumping on one slow frame", () => {
    expect(blendAmbientFrameTime(16.7, 16.7)).toBeCloseTo(16.7);
    const afterOneSpike = blendAmbientFrameTime(16.7, 200);
    expect(afterOneSpike).toBeGreaterThan(16.7);
    expect(afterOneSpike).toBeLessThan(30);
  });

  it("downgrades only after a sustained slow stretch", () => {
    let state = initialAmbientQualityState("dramatic");
    // EMA がしきい値を超えるまでの助走（4 フレーム）。
    for (let i = 0; i < 4; i++) {
      state = updateAmbientQuality(state, 40);
    }
    expect(state.tier).toBe(0);
    // しきい値超えが 89 フレーム続いても落ちない（単発のスパイクで品質を落とさない）。
    for (let i = 0; i < 88; i++) {
      state = updateAmbientQuality(state, 40);
    }
    expect(state.framesAbove).toBe(89);
    expect(state.tier).toBe(0);
    state = updateAmbientQuality(state, 40);
    expect(state.tier).toBe(1);
  });

  it("recovers only after a long stable stretch and never above the base tier", () => {
    let state = initialAmbientQualityState("normal");
    for (let i = 0; i < 93; i++) {
      state = updateAmbientQuality(state, 40);
    }
    expect(state.tier).toBe(2);
    for (let i = 0; i < 600; i++) {
      state = updateAmbientQuality(state, 8);
    }
    expect(state.tier).toBe(2);
    for (let i = 0; i < 50; i++) {
      state = updateAmbientQuality(state, 8);
    }
    expect(state.tier).toBe(1);
    // base tier (normal=1) より上へは戻らない。
    for (let i = 0; i < 2000; i++) {
      state = updateAmbientQuality(state, 8);
    }
    expect(state.tier).toBe(1);
  });

  it("recovers on a stable 60Hz display after a temporary slowdown", () => {
    let state = initialAmbientQualityState("normal");
    for (let i = 0; i < 93; i++) {
      state = updateAmbientQuality(state, 40);
    }
    expect(state.tier).toBe(2);
    for (let i = 0; i < 750; i++) {
      state = updateAmbientQuality(state, 1000 / 60);
    }
    expect(state.tier).toBe(1);
  });

  it("resets the counters when frame time is in the stable band", () => {
    let state = initialAmbientQualityState("dramatic");
    for (let i = 0; i < 50; i++) {
      state = updateAmbientQuality(state, 40);
    }
    expect(state.framesAbove).toBeGreaterThan(40);
    for (let i = 0; i < 60; i++) {
      state = updateAmbientQuality(state, 19);
    }
    expect(state.emaMs).toBeLessThan(20);
    expect(state.framesAbove).toBe(0);
    expect(state.framesBelow).toBe(0);
  });
});
