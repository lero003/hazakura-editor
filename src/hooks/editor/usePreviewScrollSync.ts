import { type RefObject, useCallback, useRef, useState } from "react";
import {
  clampScrollRatio,
  useMarkdownHeadingContext,
} from "../document/useDocumentOutline";
import { usePreviewCleanup } from "./usePreviewCleanup";
import {
  SCROLL_SYNC_TOLERANCE_PX,
  type EditorTab,
  type MarkdownHeading,
} from "../../types";
import { isMarkdownDocumentPath } from "../../lib/utils";

type EditorScrollTarget = {
  setScrollRatio: (ratio: number, tolerancePx: number) => boolean;
};

type UsePreviewScrollSyncOptions = {
  activeDocumentLineCount: number;
  activeTab: EditorTab | null;
  documentHeadings: MarkdownHeading[];
  editorPaneRef: RefObject<EditorScrollTarget | null>;
  previewPaneRef: RefObject<HTMLDivElement | null>;
};

export function usePreviewScrollSync({
  activeDocumentLineCount,
  activeTab,
  documentHeadings,
  editorPaneRef,
  previewPaneRef,
}: UsePreviewScrollSyncOptions) {
  const [scrollHud, setScrollHud] = useState({
    ratio: 0,
    visible: false,
  });
  const previewScrollFrameRef = useRef<number | null>(null);
  const scrollHudHideTimerRef = useRef<number | null>(null);
  const scrollSyncSourceRef = useRef<"editor" | "preview" | null>(null);
  const scrollHudLine = Math.min(
    activeDocumentLineCount,
    Math.max(1, Math.round(1 + scrollHud.ratio * (activeDocumentLineCount - 1))),
  );
  const scrollHudHeadingContext = useMarkdownHeadingContext(
    documentHeadings,
    scrollHudLine,
  );

  usePreviewCleanup({
    previewScrollFrameRef,
    scrollHudHideTimerRef,
  });

  const showScrollPositionHud = useCallback(
    (ratio: number) => {
      if (
        !activeTab ||
        !isMarkdownDocumentPath(activeTab.path) ||
        documentHeadings.length === 0
      ) {
        return;
      }

      if (scrollHudHideTimerRef.current !== null) {
        window.clearTimeout(scrollHudHideTimerRef.current);
      }

      setScrollHud({
        ratio: clampScrollRatio(ratio),
        visible: true,
      });

      scrollHudHideTimerRef.current = window.setTimeout(() => {
        scrollHudHideTimerRef.current = null;
        setScrollHud((current) => ({ ...current, visible: false }));
      }, 1400);
    },
    [activeTab, documentHeadings.length],
  );

  const syncPreviewScroll = useCallback((ratio: number) => {
    if (scrollSyncSourceRef.current === "preview") {
      return;
    }

    showScrollPositionHud(ratio);

    if (previewScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(previewScrollFrameRef.current);
    }

    previewScrollFrameRef.current = window.requestAnimationFrame(() => {
      previewScrollFrameRef.current = null;

      const previewPane = previewPaneRef.current;

      if (!previewPane) {
        return;
      }

      const scrollableHeight = previewPane.scrollHeight - previewPane.clientHeight;
      const nextScrollTop = scrollableHeight <= 0 ? 0 : scrollableHeight * ratio;

      if (
        Math.abs(previewPane.scrollTop - nextScrollTop) >=
        SCROLL_SYNC_TOLERANCE_PX
      ) {
        scrollSyncSourceRef.current = "editor";
        previewPane.scrollTop = nextScrollTop;
        window.setTimeout(() => {
          if (scrollSyncSourceRef.current === "editor") {
            scrollSyncSourceRef.current = null;
          }
        }, 80);
      }
    });
  }, [previewPaneRef, showScrollPositionHud]);

  const syncEditorScroll = useCallback(() => {
    if (scrollSyncSourceRef.current === "editor") {
      return;
    }

    const previewPane = previewPaneRef.current;

    if (!previewPane) {
      return;
    }

    const scrollableHeight = previewPane.scrollHeight - previewPane.clientHeight;
    const ratio =
      scrollableHeight <= 0 ? 0 : previewPane.scrollTop / scrollableHeight;

    scrollSyncSourceRef.current = "preview";
    const didSync = editorPaneRef.current?.setScrollRatio(
      ratio,
      SCROLL_SYNC_TOLERANCE_PX,
    );

    if (didSync) {
      window.setTimeout(() => {
        if (scrollSyncSourceRef.current === "preview") {
          scrollSyncSourceRef.current = null;
        }
      }, 80);
      return;
    }

    scrollSyncSourceRef.current = null;
  }, [editorPaneRef, previewPaneRef]);

  return {
    scrollHudContext: scrollHudHeadingContext,
    scrollHudLine,
    scrollHudVisible: scrollHud.visible,
    syncEditorScroll,
    syncPreviewScroll,
  };
}
