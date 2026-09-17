import { useEffect } from "react";

type TimerRef = {
  current: number | null;
};

type UsePreviewCleanupOptions = {
  editorGuardTimerRef: TimerRef;
  previewScrollFrameRef: TimerRef;
  scrollHudHideTimerRef: TimerRef;
};

export function usePreviewCleanup({
  editorGuardTimerRef,
  previewScrollFrameRef,
  scrollHudHideTimerRef,
}: UsePreviewCleanupOptions) {
  useEffect(
    () => () => {
      if (editorGuardTimerRef.current !== null) {
        window.clearTimeout(editorGuardTimerRef.current);
      }

      if (previewScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(previewScrollFrameRef.current);
      }

      if (scrollHudHideTimerRef.current !== null) {
        window.clearTimeout(scrollHudHideTimerRef.current);
      }
    },
    [editorGuardTimerRef, previewScrollFrameRef, scrollHudHideTimerRef],
  );
}
