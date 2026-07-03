import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCrtMouseTracking } from "./useCrtMouseTracking";

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: undefined,
  });
  document.documentElement.style.setProperty("--crt-mx", "");
  document.documentElement.style.setProperty("--crt-my", "");
});

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

describe("useCrtMouseTracking", () => {
  beforeEach(() => {
    mockMatchMedia(false);
    // jsdom 既定の requestAnimationFrame (setTimeout ベース) を spy
    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
    vi.spyOn(window, "cancelAnimationFrame").mockReturnValue(undefined);
  });

  it("does nothing when disabled", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    renderHook(() => useCrtMouseTracking(false));

    expect(addSpy).not.toHaveBeenCalledWith(
      "mousemove",
      expect.anything(),
      expect.anything(),
    );
    // 変数は書き込まれない
    expect(document.documentElement.style.getPropertyValue("--crt-mx")).toBe("");
  });

  it("writes normalized mouse coords to CSS variables via rAF", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    renderHook(() => useCrtMouseTracking(true));

    // innerWidth/innerHeight は jsdom 既定値 (1024 x 768)
    const handlers = addSpy.mock.calls.filter(
      (call: unknown[]) => call[0] === "mousemove",
    );
    expect(handlers.length).toBe(1);
    const handler = handlers[0][1] as (e: MouseEvent) => void;

    act(() => {
      handler({ clientX: 512, clientY: 384 } as MouseEvent);
    });

    // rAF コールバックを即時実行
    const rafCalls = vi.mocked(window.requestAnimationFrame).mock.calls;
    expect(rafCalls.length).toBeGreaterThan(0);
    const rafCallback = rafCalls[0][0] as () => void;
    act(() => rafCallback());

    expect(document.documentElement.style.getPropertyValue("--crt-mx")).toBe(
      "0.500",
    );
    expect(document.documentElement.style.getPropertyValue("--crt-my")).toBe(
      "0.500",
    );
  });

  it("skips listener under prefers-reduced-motion", () => {
    mockMatchMedia(true);
    const addSpy = vi.spyOn(window, "addEventListener");

    renderHook(() => useCrtMouseTracking(true));

    expect(addSpy).not.toHaveBeenCalledWith(
      "mousemove",
      expect.anything(),
      expect.anything(),
    );
  });

  it("resets CSS variables to center on cleanup", () => {
    const { unmount } = renderHook(() => useCrtMouseTracking(true));
    document.documentElement.style.setProperty("--crt-mx", "0.9");
    document.documentElement.style.setProperty("--crt-my", "0.1");

    unmount();

    expect(document.documentElement.style.getPropertyValue("--crt-mx")).toBe(
      "0.5",
    );
    expect(document.documentElement.style.getPropertyValue("--crt-my")).toBe(
      "0.5",
    );
  });
});
