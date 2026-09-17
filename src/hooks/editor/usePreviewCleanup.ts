import { useEffect } from "react";

type TimerRef = {
  current: number | null;
};

type UsePreviewCleanupOptions = {
  editorGuardTimerRef: TimerRef;
  editorScrollFrameRef: TimerRef;
  previewGuardTimerRef: TimerRef;
  previewScrollFrameRef: TimerRef;
  scrollHudHideTimerRef: TimerRef;
};

export function usePreviewCleanup({
  editorGuardTimerRef,
  editorScrollFrameRef,
  previewGuardTimerRef,
  previewScrollFrameRef,
  scrollHudHideTimerRef,
}: UsePreviewCleanupOptions) {
  useEffect(
    () => () => {
      if (editorGuardTimerRef.current !== null) {
        window.clearTimeout(editorGuardTimerRef.current);
      }

      if (previewGuardTimerRef.current !== null) {
        window.clearTimeout(previewGuardTimerRef.current);
      }

      if (editorScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(editorScrollFrameRef.current);
      }

      if (previewScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(previewScrollFrameRef.current);
      }

      if (scrollHudHideTimerRef.current !== null) {
        window.clearTimeout(scrollHudHideTimerRef.current);
      }
    },
    [
      editorGuardTimerRef,
      editorScrollFrameRef,
      previewGuardTimerRef,
      previewScrollFrameRef,
      scrollHudHideTimerRef,
    ],
  );
}
