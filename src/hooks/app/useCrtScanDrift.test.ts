import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCrtScanDrift } from "./useCrtScanDrift";

function mockMatchMedia(reduceMotion: boolean) {
  const mql: Partial<MediaQueryList> = {
    matches: reduceMotion,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
  };
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockReturnValue(mql),
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.documentElement.style.setProperty("--crt-mx", "");
  document.documentElement.style.setProperty("--crt-my", "");
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: undefined,
  });
});

describe("useCrtScanDrift", () => {
  it("does nothing when the theme is not active", () => {
    mockMatchMedia(false);
    const setInterval = vi.spyOn(window, "setInterval");
    renderHook(() => useCrtScanDrift(false));
    expect(setInterval).not.toHaveBeenCalled();
    expect(document.documentElement.style.getPropertyValue("--crt-mx")).toBe("");
  });

  it("does nothing under prefers-reduced-motion", () => {
    mockMatchMedia(true);
    const setInterval = vi.spyOn(window, "setInterval");
    renderHook(() => useCrtScanDrift(true));
    expect(setInterval).not.toHaveBeenCalled();
  });

  it("drifts slowly instead of following the pointer", () => {
    mockMatchMedia(false);
    const addEventListener = vi.spyOn(window, "addEventListener");
    renderHook(() => useCrtScanDrift(true));

    // ポインタには追従しない（旧 useCrtMouseTracking の再発防止）。
    expect(addEventListener).not.toHaveBeenCalledWith(
      "mousemove",
      expect.anything(),
      expect.anything(),
    );

    const first = document.documentElement.style.getPropertyValue("--crt-mx");
    expect(Number(first)).toBeGreaterThanOrEqual(0.08);
    expect(Number(first)).toBeLessThanOrEqual(0.92);
    expect(document.documentElement.style.getPropertyValue("--crt-my")).toBe(
      "0.5",
    );

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    const later = Number(
      document.documentElement.style.getPropertyValue("--crt-mx"),
    );
    expect(later).toBeGreaterThanOrEqual(0.08);
    expect(later).toBeLessThanOrEqual(0.92);
    expect(later).not.toBe(Number(first));
  });

  it("resets the variables on cleanup", () => {
    mockMatchMedia(false);
    const { unmount } = renderHook(() => useCrtScanDrift(true));
    document.documentElement.style.setProperty("--crt-mx", "0.9");
    unmount();
    expect(document.documentElement.style.getPropertyValue("--crt-mx")).toBe(
      "0.5",
    );
    expect(document.documentElement.style.getPropertyValue("--crt-my")).toBe(
      "0.5",
    );
  });
});
