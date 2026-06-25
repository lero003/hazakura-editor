import { type RefObject, useCallback, useRef, useState } from "react";
import {
  clampScrollRatio,
  useMarkdownHeadingContext,
} from "../document/useDocumentOutline";
import { usePreviewCleanup } from "./usePreviewCleanup";
import {
  SCROLL_SYNC_GUARD_RELEASE_MS,
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
  // v0.34: 慣性スクロール（トラックパッド等）は高頻度で継続するため、ガード解除
  // タイマーを「連続イベントで自己延長」する。これにより慣性継続中は editor→preview
  // の書き戻しがブロックされ続け、OSの慣性位置とJSの同期位置が衝突しない。
  const previewGuardTimerRef = useRef<number | null>(null);
  // v0.34: syncEditorScroll を1フレームに1回に間引き、慣性スクロールの
  // 高頻度イベントでの scrollHeight 読み取り（強制リフロー）を抑制する。
  const editorScrollFrameRef = useRef<number | null>(null);
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

    // v0.34: 慣性スクロールでは毎フレーム以上の頻度で発火するため、
    // scrollHeight 読み取りと setScrollRatio を1フレームに1回に間引く。
    if (editorScrollFrameRef.current !== null) {
      return;
    }

    const previewPane = previewPaneRef.current;

    if (!previewPane) {
      return;
    }

    editorScrollFrameRef.current = window.requestAnimationFrame(() => {
      editorScrollFrameRef.current = null;

      const currentPreviewPane = previewPaneRef.current;
      if (!currentPreviewPane) {
        return;
      }

      const scrollableHeight =
        currentPreviewPane.scrollHeight - currentPreviewPane.clientHeight;
      const ratio =
        scrollableHeight <= 0
          ? 0
          : currentPreviewPane.scrollTop / scrollableHeight;

      showScrollPositionHud(ratio);

      // 既存の自己延長タイマーをクリアして再設定する。慣性スクロールのように
      // 連続的に syncEditorScroll が呼ばれ続ける間はガードが維持され、
      // editor→preview の書き戻しがOS慣性と衝突しない。慣性が止まって
      // SCROLL_SYNC_GUARD_RELEASE_MS 内に新たなイベントが来なければ解除される。
      if (previewGuardTimerRef.current !== null) {
        window.clearTimeout(previewGuardTimerRef.current);
      }

      scrollSyncSourceRef.current = "preview";
      const didSync = editorPaneRef.current?.setScrollRatio(
        ratio,
        SCROLL_SYNC_TOLERANCE_PX,
      );

      if (didSync) {
        previewGuardTimerRef.current = window.setTimeout(() => {
          previewGuardTimerRef.current = null;
          if (scrollSyncSourceRef.current === "preview") {
            scrollSyncSourceRef.current = null;
          }
        }, SCROLL_SYNC_GUARD_RELEASE_MS);
        return;
      }

      scrollSyncSourceRef.current = null;
    });
  }, [editorPaneRef, previewPaneRef, showScrollPositionHud]);

  return {
    scrollHudContext: scrollHudHeadingContext,
    scrollHudLine,
    scrollHudVisible: scrollHud.visible,
    syncEditorScroll,
    syncPreviewScroll,
  };
}
