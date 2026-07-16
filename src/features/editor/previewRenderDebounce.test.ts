import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PREVIEW_RENDER_DEBOUNCE_HUGE_MS,
  PREVIEW_RENDER_DEBOUNCE_LARGE_MS,
  PREVIEW_RENDER_DEBOUNCE_MS,
  PREVIEW_RENDER_HUGE_CHARS,
  PREVIEW_RENDER_IDLE_TIMEOUT_MS,
  PREVIEW_RENDER_LARGE_CHARS,
  previewRenderDebounceMs,
  schedulePreviewRender,
} from "./previewRenderDebounce";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("previewRenderDebounceMs", () => {
  it("keeps the default debounce for ordinary documents", () => {
    expect(previewRenderDebounceMs(0)).toBe(PREVIEW_RENDER_DEBOUNCE_MS);
    expect(previewRenderDebounceMs(PREVIEW_RENDER_LARGE_CHARS - 1)).toBe(
      PREVIEW_RENDER_DEBOUNCE_MS,
    );
  });

  it("lengthens the debounce for long and very long documents", () => {
    expect(previewRenderDebounceMs(PREVIEW_RENDER_LARGE_CHARS)).toBe(
      PREVIEW_RENDER_DEBOUNCE_LARGE_MS,
    );
    expect(previewRenderDebounceMs(PREVIEW_RENDER_HUGE_CHARS)).toBe(
      PREVIEW_RENDER_DEBOUNCE_HUGE_MS,
    );
  });
});

describe("schedulePreviewRender", () => {
  it("debounces, yields a frame, then runs the callback", () => {
    vi.useFakeTimers();
    const frameCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      frameCallbacks.push(cb);
      return frameCallbacks.length;
    });
    // Force the non-idle path so the test does not depend on ric support.
    const ric = window.requestIdleCallback;
    // @ts-expect-error -- test isolation
    window.requestIdleCallback = undefined;

    const callback = vi.fn();
    schedulePreviewRender(callback, { sourceLength: 100 });

    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(PREVIEW_RENDER_DEBOUNCE_MS - 1);
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(callback).not.toHaveBeenCalled();
    expect(frameCallbacks).toHaveLength(1);

    frameCallbacks[0]?.(0);
    expect(callback).toHaveBeenCalledTimes(1);

    window.requestIdleCallback = ric;
  });

  it("runs immediate paints after one animation frame without the typing delay", () => {
    vi.useFakeTimers();
    const frameCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      frameCallbacks.push(cb);
      return frameCallbacks.length;
    });

    const callback = vi.fn();
    schedulePreviewRender(callback, { immediate: true, sourceLength: 50_000 });

    vi.advanceTimersByTime(0);
    expect(callback).not.toHaveBeenCalled();
    frameCallbacks[0]?.(0);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("uses requestIdleCallback with a bounded timeout for deferred paints", () => {
    vi.useFakeTimers();
    const frameCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      frameCallbacks.push(cb);
      return frameCallbacks.length;
    });
    const idleCallbacks: Array<{
      cb: IdleRequestCallback;
      options?: IdleRequestOptions;
    }> = [];
    // jsdom may not define ric; install a stub we can spy through.
    window.requestIdleCallback = ((
      cb: IdleRequestCallback,
      options?: IdleRequestOptions,
    ) => {
      idleCallbacks.push({ cb, options });
      return idleCallbacks.length;
    }) as typeof window.requestIdleCallback;
    window.cancelIdleCallback = (() => {}) as typeof window.cancelIdleCallback;

    const callback = vi.fn();
    schedulePreviewRender(callback, { sourceLength: 100 });
    vi.advanceTimersByTime(PREVIEW_RENDER_DEBOUNCE_MS);
    frameCallbacks[0]?.(0);

    expect(callback).not.toHaveBeenCalled();
    expect(idleCallbacks).toHaveLength(1);
    expect(idleCallbacks[0]?.options?.timeout).toBe(
      PREVIEW_RENDER_IDLE_TIMEOUT_MS,
    );

    idleCallbacks[0]?.cb({
      didTimeout: false,
      timeRemaining: () => 10,
    } as IdleDeadline);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("cancels pending timeout, rAF, and idle work", () => {
    vi.useFakeTimers();
    const frameCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      frameCallbacks.push(cb);
      return frameCallbacks.length;
    });
    const idleCallbacks: IdleRequestCallback[] = [];
    const cancelIdle = vi.fn();
    window.requestIdleCallback = ((cb: IdleRequestCallback) => {
      idleCallbacks.push(cb);
      return idleCallbacks.length;
    }) as typeof window.requestIdleCallback;
    window.cancelIdleCallback =
      cancelIdle as typeof window.cancelIdleCallback;

    const callback = vi.fn();
    const cancel = schedulePreviewRender(callback, { sourceLength: 100 });
    vi.advanceTimersByTime(PREVIEW_RENDER_DEBOUNCE_MS);
    frameCallbacks[0]?.(0);
    expect(idleCallbacks).toHaveLength(1);

    cancel();
    expect(cancelIdle).toHaveBeenCalled();
    idleCallbacks[0]?.({
      didTimeout: false,
      timeRemaining: () => 10,
    } as IdleDeadline);
    expect(callback).not.toHaveBeenCalled();
  });
});
