import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  THEME_SWITCH_MS,
  THEME_SWITCH_REDUCED_MS,
  useThemeTransition,
} from "./useThemeTransition";

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
  delete document.documentElement.dataset.themeSwitching;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: undefined,
  });
});

describe("useThemeTransition", () => {
  it("does not flag the initial theme", () => {
    mockMatchMedia(false);
    renderHook(() => useThemeTransition("light"));
    expect(document.documentElement.dataset.themeSwitching).toBeUndefined();
  });

  it("flags a switch for the crossfade window and then clears it", () => {
    mockMatchMedia(false);
    const { rerender } = renderHook(
      ({ theme }: { theme: string }) => useThemeTransition(theme),
      { initialProps: { theme: "light" } },
    );

    rerender({ theme: "dark" });
    expect(document.documentElement.dataset.themeSwitching).toBe("true");

    act(() => {
      vi.advanceTimersByTime(THEME_SWITCH_MS);
    });
    expect(document.documentElement.dataset.themeSwitching).toBeUndefined();
  });

  it("keeps the reduced-motion window short", () => {
    mockMatchMedia(true);
    const { rerender } = renderHook(
      ({ theme }: { theme: string }) => useThemeTransition(theme),
      { initialProps: { theme: "light" } },
    );

    rerender({ theme: "dark" });
    act(() => {
      vi.advanceTimersByTime(THEME_SWITCH_REDUCED_MS);
    });
    expect(document.documentElement.dataset.themeSwitching).toBeUndefined();
    expect(THEME_SWITCH_REDUCED_MS).toBeLessThan(THEME_SWITCH_MS);
  });

  it("does not re-flag when the same theme is re-applied", () => {
    mockMatchMedia(false);
    const { rerender } = renderHook(
      ({ theme }: { theme: string }) => useThemeTransition(theme),
      { initialProps: { theme: "light" } },
    );
    rerender({ theme: "dark" });
    act(() => {
      vi.advanceTimersByTime(THEME_SWITCH_MS);
    });
    rerender({ theme: "dark" });
    expect(document.documentElement.dataset.themeSwitching).toBeUndefined();
  });
});
