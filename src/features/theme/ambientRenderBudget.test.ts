import { describe, expect, it } from "vitest";
import {
  ambientDevicePixelRatioCap,
  ambientMinFrameIntervalMs,
  nextElapsedSeconds,
  resolveAmbientDevicePixelRatio,
} from "./ambientRenderBudget";

describe("ambientRenderBudget (Q-THM-1)", () => {
  it("caps DPR one step lower per intensity below dramatic", () => {
    // 実機フィードバック（第2弾）: 抑えすぎで「攻めたテーマなのにつまらない」と
    // 感じられたため、DPR cap を一段だけ戻した（normal 1.5→2 / subtle 1.25→1.5）。
    // フレーム間引きは据え置き（負荷の主因はそちら）。
    expect(ambientDevicePixelRatioCap("dramatic")).toBe(2);
    expect(ambientDevicePixelRatioCap("normal")).toBe(2);
    expect(ambientDevicePixelRatioCap("subtle")).toBe(1.5);
    expect(ambientDevicePixelRatioCap("off")).toBe(1);
    // Retina でも cap 以上には描かない（3 を渡しても cap で止まる）。
    expect(resolveAmbientDevicePixelRatio("normal", 3)).toBe(2);
    expect(resolveAmbientDevicePixelRatio("subtle", 3)).toBe(1.5);
    expect(resolveAmbientDevicePixelRatio("dramatic", 3)).toBe(2);
  });

  it("throttles frames outside dramatic", () => {
    // 実機要望（第10報）: 演出が見えないほど間引かれていたため一段戻した
    // （normal は 60fps。dramatic は据え置きで毎フレーム）。
    expect(ambientMinFrameIntervalMs("dramatic")).toBe(0);
    expect(ambientMinFrameIntervalMs("normal")).toBeCloseTo(1000 / 60);
    expect(ambientMinFrameIntervalMs("subtle")).toBeCloseTo(1000 / 30);
    // off でも描画を止めるだけで、上限は subtle と同じ扱い（既存の落ち方を維持）。
    expect(ambientMinFrameIntervalMs("off")).toBeCloseTo(1000 / 30);
  });
});

describe("nextElapsedSeconds", () => {
  it("accumulates only while running", () => {
    expect(nextElapsedSeconds(0, 16.7, true)).toBeCloseTo(0.0167);
    // hidden / blur 中は時間を進めない。復帰時に水が別時刻へ飛ばない。
    expect(nextElapsedSeconds(12.5, 16.7, false)).toBe(12.5);
    expect(nextElapsedSeconds(12.5, 10_000, false)).toBe(12.5);
  });

  it("clamps a long stall so a resumed tab does not jump the scene", () => {
    expect(nextElapsedSeconds(3, 5_000, true)).toBeCloseTo(3.05);
  });

  it("ignores non-finite frame times instead of poisoning the clock", () => {
    expect(nextElapsedSeconds(3, Number.NaN, true)).toBe(3);
    expect(nextElapsedSeconds(3, Number.POSITIVE_INFINITY, true)).toBe(3);
  });
});
