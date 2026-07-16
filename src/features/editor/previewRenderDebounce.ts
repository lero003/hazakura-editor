// Preview / e-book re-render scheduling.
//
// Continuous typing must not run marked + DOMPurify on the main thread every
// keystroke. We keep the live-preview feel by:
// 1. painting the first view of a document immediately (after one rAF yield),
// 2. debouncing subsequent paints, with a slightly longer wait for long docs,
// 3. yielding to the browser (rAF + idle) so editor input frames stay smooth.
// When typing pauses, the idle timeout still commits within a bounded window.

export const PREVIEW_RENDER_DEBOUNCE_MS = 200;
/** Long manuscripts (~20k+ characters): a bit more batching while typing. */
export const PREVIEW_RENDER_DEBOUNCE_LARGE_MS = 360;
/** Very long manuscripts (~80k+ characters). */
export const PREVIEW_RENDER_DEBOUNCE_HUGE_MS = 480;

export const PREVIEW_RENDER_LARGE_CHARS = 20_000;
export const PREVIEW_RENDER_HUGE_CHARS = 80_000;

/** Max wait after debounce before forcing the idle-scheduled paint. */
export const PREVIEW_RENDER_IDLE_TIMEOUT_MS = 120;

export type SchedulePreviewRenderOptions = {
  /**
   * First paint for a document / pane open. Skips the typing debounce and the
   * idle wait so opening Preview stays snappy; still yields one animation frame
   * so the shell can paint chrome first.
   */
  immediate?: boolean;
  /** Used only when `immediate` is false, to pick an adaptive debounce. */
  sourceLength?: number;
};

export function previewRenderDebounceMs(sourceLength = 0): number {
  if (sourceLength >= PREVIEW_RENDER_HUGE_CHARS) {
    return PREVIEW_RENDER_DEBOUNCE_HUGE_MS;
  }
  if (sourceLength >= PREVIEW_RENDER_LARGE_CHARS) {
    return PREVIEW_RENDER_DEBOUNCE_LARGE_MS;
  }
  return PREVIEW_RENDER_DEBOUNCE_MS;
}

export function schedulePreviewRender(
  callback: () => void,
  options?: SchedulePreviewRenderOptions,
): () => void {
  const immediate = options?.immediate === true;
  const delay = immediate
    ? 0
    : previewRenderDebounceMs(options?.sourceLength ?? 0);

  let timeoutHandle: number | null = null;
  let rafHandle: number | null = null;
  let idleHandle: number | null = null;
  let cancelled = false;

  const clearIdle = () => {
    if (
      idleHandle !== null &&
      typeof window.cancelIdleCallback === "function"
    ) {
      window.cancelIdleCallback(idleHandle);
    }
    idleHandle = null;
  };

  const clearRaf = () => {
    if (rafHandle !== null) {
      window.cancelAnimationFrame(rafHandle);
    }
    rafHandle = null;
  };

  const runCallback = () => {
    if (cancelled) {
      return;
    }
    callback();
  };

  const scheduleAfterFrame = () => {
    if (cancelled) {
      return;
    }
    rafHandle = window.requestAnimationFrame(() => {
      rafHandle = null;
      if (cancelled) {
        return;
      }

      // First paint should not wait for idle; updates may, but always
      // complete within PREVIEW_RENDER_IDLE_TIMEOUT_MS.
      const ric = window.requestIdleCallback;
      if (!immediate && typeof ric === "function") {
        idleHandle = ric(
          () => {
            idleHandle = null;
            runCallback();
          },
          { timeout: PREVIEW_RENDER_IDLE_TIMEOUT_MS },
        );
        return;
      }

      runCallback();
    });
  };

  timeoutHandle = window.setTimeout(() => {
    timeoutHandle = null;
    scheduleAfterFrame();
  }, delay);

  return () => {
    cancelled = true;
    if (timeoutHandle !== null) {
      window.clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }
    clearRaf();
    clearIdle();
  };
}
