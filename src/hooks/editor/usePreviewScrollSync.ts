import { type RefObject, useCallback, useRef, useState } from "react";
import {
  clampScrollRatio,
  useMarkdownHeadingContext,
} from "../document/useDocumentOutline";
import { isPreviewSelectionGesture } from "../../components/editor/preview/previewPaintStability";
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
  // スクロールバーのドラッグは連続イベントで数十ms〜数秒続く。editor→preview の
  // ガード解除を固定 80ms にすると、ドラッグが続く間にガードが切れ、キューに残った
  // プレビュー側の古いエコーが編集位置を上書きする（最下部まで引いたのに少し上へ
  // 戻る症状）。preview 側と同じく、連続イベントで自己延長する。
  const editorGuardTimerRef = useRef<number | null>(null);
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

  // 編集側が同期元の間、ガードを自己延長する。書き込みの有無とは切り離し、
  // 「編集側の操作が続いているか」だけで延長する。
  const armEditorGuard = useCallback(() => {
    if (editorGuardTimerRef.current !== null) {
      window.clearTimeout(editorGuardTimerRef.current);
    }

    scrollSyncSourceRef.current = "editor";
    editorGuardTimerRef.current = window.setTimeout(() => {
      editorGuardTimerRef.current = null;
      if (scrollSyncSourceRef.current === "editor") {
        scrollSyncSourceRef.current = null;
      }
    }, SCROLL_SYNC_GUARD_RELEASE_MS);
  }, []);

  // 反対ペインで本物のユーザー操作（ホイール・ポインタ・キー）が始まったら、
  // その向きの所有権を手放す。JS が書いた位置のエコーと、ユーザーの操作を
  // 分けるための入口。ガード中に届いた新しい操作を捨てないために必要。
  const releaseEditorGuard = useCallback(() => {
    if (editorGuardTimerRef.current !== null) {
      window.clearTimeout(editorGuardTimerRef.current);
      editorGuardTimerRef.current = null;
    }
    if (scrollSyncSourceRef.current === "editor") {
      scrollSyncSourceRef.current = null;
    }
  }, []);

  const releasePreviewGuard = useCallback(() => {
    if (previewGuardTimerRef.current !== null) {
      window.clearTimeout(previewGuardTimerRef.current);
      previewGuardTimerRef.current = null;
    }
    if (scrollSyncSourceRef.current === "preview") {
      scrollSyncSourceRef.current = null;
    }
  }, []);

  usePreviewCleanup({
    editorGuardTimerRef,
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

      // rAF を待っている間にプレビュー側が書き込みを始めていたら、この古い
      // 書き込みは降りる（先頭のチェックだけでは後追いのエコーを止められない）。
      if (scrollSyncSourceRef.current === "preview") {
        return;
      }

      const previewPane = previewPaneRef.current;

      if (!previewPane || isPreviewSelectionGesture(previewPane)) {
        return;
      }

      // 同期先に書き込む必要がなくても、編集側が操作を続けている間は所有権を延長する。
      // 書き込み差分が 10px 未満のときにガードが切れ、古いプレビュー エコーが
      // 本文位置を上書きするのを防ぐ。
      armEditorGuard();

      const scrollableHeight = previewPane.scrollHeight - previewPane.clientHeight;
      const nextScrollTop = scrollableHeight <= 0 ? 0 : scrollableHeight * ratio;

      if (
        Math.abs(previewPane.scrollTop - nextScrollTop) >=
        SCROLL_SYNC_TOLERANCE_PX
      ) {
        previewPane.scrollTop = nextScrollTop;
      }
    });
  }, [armEditorGuard, previewPaneRef, showScrollPositionHud]);

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

      // rAF 待ちの間に編集側がスクロール（ドラッグ等）を始めていたら、
      // プレビューの古い比率で編集位置を書き戻さない。
      if (scrollSyncSourceRef.current === "editor") {
        return;
      }

      const currentPreviewPane = previewPaneRef.current;
      if (!currentPreviewPane || isPreviewSelectionGesture(currentPreviewPane)) {
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
    releaseEditorGuard,
    releasePreviewGuard,
    scrollHudContext: scrollHudHeadingContext,
    scrollHudLine,
    scrollHudVisible: scrollHud.visible,
    syncEditorScroll,
    syncPreviewScroll,
  };
}
