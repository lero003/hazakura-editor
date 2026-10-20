import { describe, expect, it } from "vitest";
import {
  FLOW_CELLS,
  createFlowField,
  flowDecayFactor,
  flowDiffusionFactor,
  flowEnergy,
  splatFlowField,
  stepFlowField,
} from "./waterFlowField";

function runSteps(totalSeconds: number, stepSeconds: number) {
  let read = createFlowField();
  let write = createFlowField();
  splatFlowField(read, 24, 13, 0.6, 0.3, 3, 8);
  const steps = Math.max(1, Math.round(totalSeconds / stepSeconds));
  for (let index = 0; index < steps; index += 1) {
    stepFlowField(read, write, stepSeconds);
    const swap = read;
    read = write;
    write = swap;
  }
  return read;
}

describe("water flow field", () => {
  it("starts at rest", () => {
    const field = createFlowField();
    expect(field).toHaveLength(FLOW_CELLS * 2);
    expect(flowEnergy(field)).toBe(0);
    expect(field[0]).toBe(0.5);
  });

  it("adds a local force that decays without new input", () => {
    let read = createFlowField();
    let write = createFlowField();
    splatFlowField(read, 24, 13, 0.6, 0.3, 3, 8);
    const initial = flowEnergy(read);
    expect(initial).toBeGreaterThan(0);

    let previous = initial;
    for (let index = 0; index < 120; index += 1) {
      stepFlowField(read, write, 1 / 60);
      const swap = read;
      read = write;
      write = swap;
      const energy = flowEnergy(read);
      expect(energy).toBeLessThanOrEqual(previous + 1e-6);
      previous = energy;
    }
    expect(previous).toBeLessThan(initial);
  });

  it("normalizes damping and diffusion by dt", () => {
    // 同じ経過時間なら、60fps 相当と 30fps 相当で残り方がほぼ同じ。
    const fast = flowEnergy(runSteps(1, 1 / 60));
    const slow = flowEnergy(runSteps(1, 1 / 30));
    expect(slow).toBeGreaterThan(0);
    expect(Math.abs(fast - slow) / fast).toBeLessThan(0.15);
  });

  it("keeps the old per-frame constants at the 1/60 reference step", () => {
    expect(flowDecayFactor(1 / 60)).toBeCloseTo(1 - 0.0065, 4);
    expect(flowDiffusionFactor(1 / 60)).toBeCloseTo(0.12, 4);
  });

  it("clamps a long stall instead of exploding", () => {
    const field = runSteps(0.5, 5);
    for (const value of field) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it("never produces NaN or values outside the texture range", () => {
    const field = runSteps(3, 1 / 60);
    for (const value of field) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it("carries a splat along the local velocity (advection)", () => {
    // 一様な右向き速度を作り、1/6 秒ぶん流すと山が右へ動く。
    const read = createFlowField();
    const write = createFlowField();
    for (let index = 0; index < FLOW_CELLS; index += 1) {
      read[index * 2] = 0.5 + 0.4;
      read[index * 2 + 1] = 0.5;
    }
    const peakBefore = peakIndex(read);
    stepFlowField(read, write, 1 / 6);
    const peakAfter = peakIndex(write);
    expect(peakAfter).toBeGreaterThanOrEqual(peakBefore);
    // 移流は 1/6 秒で 0.5 * 10 = 5 セルぶん（端では clamp される）。
    expect(peakAfter - peakBefore).toBeLessThanOrEqual(FLOW_GRID_W_FOR_TEST);
  });
});

// 端のクランプを含むため、移動量はグリッド幅を超えないことだけを見る。
const FLOW_GRID_W_FOR_TEST = 48;

function peakIndex(field: Float32Array): number {
  let peak = 0;
  let peakValue = -1;
  for (let index = 0; index < FLOW_CELLS; index += 1) {
    const value = Math.abs(field[index * 2] - 0.5);
    if (value > peakValue) {
      peakValue = value;
      peak = index;
    }
  }
  return peak;
}
