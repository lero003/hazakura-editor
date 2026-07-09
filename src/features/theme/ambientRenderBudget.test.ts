import { describe, expect, it } from "vitest";
import {
  ambientDevicePixelRatioCap,
  ambientMinFrameIntervalMs,
  resolveAmbientDevicePixelRatio,
} from "./ambientRenderBudget";

describe("ambientRenderBudget (Q-THM-1)", () => {
  it("caps DPR higher only for dramatic", () => {
    expect(ambientDevicePixelRatioCap("dramatic")).toBe(2);
    expect(ambientDevicePixelRatioCap("normal")).toBe(1.5);
    expect(ambientDevicePixelRatioCap("subtle")).toBe(1.25);
    expect(resolveAmbientDevicePixelRatio("normal", 3)).toBe(1.5);
    expect(resolveAmbientDevicePixelRatio("dramatic", 3)).toBe(2);
  });

  it("throttles frames outside dramatic", () => {
    expect(ambientMinFrameIntervalMs("dramatic")).toBe(0);
    expect(ambientMinFrameIntervalMs("normal")).toBeCloseTo(1000 / 30);
    expect(ambientMinFrameIntervalMs("subtle")).toBeCloseTo(1000 / 24);
  });
});
