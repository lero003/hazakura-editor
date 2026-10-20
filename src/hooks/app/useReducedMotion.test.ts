import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useReducedMotion } from "./useReducedMotion";

type Listener = (event: MediaQueryListEvent) => void;

function mockMatchMedia(initial: boolean) {
  const listeners = new Set<Listener>();
  const mql = {
    matches: initial,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addEventListener: (_: string, listener: Listener) => {
      listeners.add(listener);
    },
    removeEventListener: (_: string, listener: Listener) => {
      listeners.delete(listener);
    },
    addListener: (listener: Listener) => {
      listeners.add(listener);
    },
    removeListener: (listener: Listener) => {
      listeners.delete(listener);
    },
    dispatchEvent: () => true,
  } as unknown as MediaQueryList;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockReturnValue(mql),
  });
  return {
    emit(next: boolean) {
      (mql as { matches: boolean }).matches = next;
      for (const listener of listeners) {
        listener({ matches: next } as MediaQueryListEvent);
      }
    },
    listenerCount: () => listeners.size,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: undefined,
  });
});

describe("useReducedMotion", () => {
  it("reads the initial OS preference", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it("follows a change while the app is open", () => {
    const media = mockMatchMedia(false);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
    act(() => media.emit(true));
    expect(result.current).toBe(true);
    act(() => media.emit(false));
    expect(result.current).toBe(false);
  });

  it("removes the change listener on cleanup", () => {
    const media = mockMatchMedia(false);
    const { unmount } = renderHook(() => useReducedMotion());
    expect(media.listenerCount()).toBe(1);
    unmount();
    expect(media.listenerCount()).toBe(0);
  });
});
