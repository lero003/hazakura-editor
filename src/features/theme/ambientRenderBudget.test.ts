import { describe, expect, it } from "vitest";
import {
  ambientDevicePixelRatioCap,
  ambientMinFrameIntervalMs,
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
