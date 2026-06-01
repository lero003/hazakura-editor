import { useEffect } from "react";

type TimerRef = {
  current: number | null;
};

type UsePreviewCleanupOptions = {
  previewScrollFrameRef: TimerRef;
  scrollHudHideTimerRef: TimerRef;
};

export function usePreviewCleanup({
  previewScrollFrameRef,
  scrollHudHideTimerRef,
}: UsePreviewCleanupOptions) {
  useEffect(
    () => () => {
      if (previewScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(previewScrollFrameRef.current);
      }

      if (scrollHudHideTimerRef.current !== null) {
        window.clearTimeout(scrollHudHideTimerRef.current);
      }
    },
    [previewScrollFrameRef, scrollHudHideTimerRef],
  );
}
