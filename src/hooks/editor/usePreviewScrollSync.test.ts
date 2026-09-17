import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePreviewScrollSync } from "./usePreviewScrollSync";
import type { EditorTab, MarkdownHeading } from "../../types";

afterEach(() => {
  vi.useRealTimers();
});

describe("usePreviewScrollSync", () => {
  it("updates the scroll HUD line when the preview scrolls the editor", () => {
    vi.useFakeTimers();
    const frameCallbacks: FrameRequestCallback[] = [];
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        frameCallbacks.push(callback);
        return frameCallbacks.length;
      });

    const setScrollRatio = vi.fn(() => true);
    const previewPane = createPreviewPane({
      clientHeight: 500,
      scrollHeight: 1500,
      scrollTop: 500,
    });
    const headings: MarkdownHeading[] = [
      { level: 1, line: 1, text: "Chapter One" },
      { level: 2, line: 6, text: "Chapter Two" },
    ];

    const { result } = renderHook(() =>
      usePreviewScrollSync({
        activeDocumentLineCount: 11,
        activeTab: { path: "/workspace/book.md" } as EditorTab,
        documentHeadings: headings,
        editorPaneRef: { current: { setScrollRatio } },
        previewPaneRef: { current: previewPane },
      }),
    );

    act(() => {
      result.current.syncEditorScroll();
    });

    // v0.34: syncEditorScroll は rAF で間引かれるため、コールバックを進める。
    act(() => {
      frameCallbacks.forEach((callback) => callback(0));
    });

    expect(setScrollRatio).toHaveBeenCalledWith(0.5, expect.any(Number));
    expect(result.current.scrollHudVisible).toBe(true);
    expect(result.current.scrollHudLine).toBe(6);
    expect(result.current.scrollHudContext.current?.text).toBe("Chapter Two");

    requestAnimationFrameSpy.mockRestore();
  });

  it("keeps the preview guard alive while syncEditorScroll fires continuously (inertial scroll)", () => {
    vi.useFakeTimers();
    const frameCallbacks: FrameRequestCallback[] = [];
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        frameCallbacks.push(callback);
        return frameCallbacks.length;
      });

    const setScrollRatio = vi.fn(() => true);
    const previewPane = createPreviewPane({
      clientHeight: 500,
      scrollHeight: 1500,
      scrollTop: 0,
    });

    const { result } = renderHook(() =>
      usePreviewScrollSync({
        activeDocumentLineCount: 11,
        activeTab: { path: "/workspace/book.md" } as EditorTab,
        documentHeadings: [],
        editorPaneRef: { current: { setScrollRatio } },
        previewPaneRef: { current: previewPane },
      }),
    );

    // 慣性スクロールを模倣: 連続して syncEditorScroll を発火させる。
    // 各呼び出しで rAF を進め、ガードタイマーを自己延長する。
    for (let i = 0; i < 5; i += 1) {
      previewPane.scrollTop = 100 * (i + 1);
      act(() => {
        result.current.syncEditorScroll();
      });
      act(() => {
        const pending = [...frameCallbacks];
        frameCallbacks.length = 0;
        pending.forEach((callback) => callback(0));
      });
      // ガードタイマー（150ms）より前に進めても、まだ解除されない。
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // 慣性継続中は editor→preview の書き戻しがブロックされるべき。
      act(() => {
        result.current.syncPreviewScroll(0.5);
      });
      // syncPreviewScroll は preview ガードによって早期リターンし、
      // プレビューの scrollTop を書き換えない。
      expect(previewPane.scrollTop).toBe(100 * (i + 1));
    }

    // 慣性停止後、ガードタイマーが切れると editor→preview が再び動く。
    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => {
      result.current.syncPreviewScroll(0.5);
    });
    expect(previewPane.scrollTop).toBe(500);

    requestAnimationFrameSpy.mockRestore();
  });

  it("keeps the editor guard alive while syncPreviewScroll fires continuously (scrollbar drag)", () => {
    vi.useFakeTimers();
    const frameCallbacks: FrameRequestCallback[] = [];
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        frameCallbacks.push(callback);
        return frameCallbacks.length;
      });

    const setScrollRatio = vi.fn(() => true);
    const previewPane = createPreviewPane({
      clientHeight: 500,
      scrollHeight: 1500,
      scrollTop: 0,
    });

    const { result } = renderHook(() =>
      usePreviewScrollSync({
        activeDocumentLineCount: 11,
        activeTab: { path: "/workspace/book.md" } as EditorTab,
        documentHeadings: [],
        editorPaneRef: { current: { setScrollRatio } },
        previewPaneRef: { current: previewPane },
      }),
    );

    // スクロールバーのドラッグを模倣: 編集側が連続して比率を書き込み続ける。
    // 固定 80ms の解除だと、ドラッグが続く間にガードが切れ、キューに残った
    // プレビューの古いエコーが編集位置を上書きする（最下部で少し戻る症状）。
    for (let i = 0; i < 5; i += 1) {
      act(() => {
        result.current.syncPreviewScroll(0.1 * (i + 1));
      });
      act(() => {
        const pending = [...frameCallbacks];
        frameCallbacks.length = 0;
        pending.forEach((callback) => callback(0));
      });
      // ガードタイマー（150ms）より前に進めても、まだ解除されない。
      act(() => {
        vi.advanceTimersByTime(100);
      });

      act(() => {
        result.current.syncEditorScroll();
      });
      act(() => {
        const pending = [...frameCallbacks];
        frameCallbacks.length = 0;
        pending.forEach((callback) => callback(0));
      });
      // ドラッグ継続中はプレビュー発の書き戻しが編集位置を動かさない。
      expect(setScrollRatio).not.toHaveBeenCalled();
    }

    // ドラッグが止まってガードが切れると、プレビュー発の同期が再び通る。
    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => {
      result.current.syncEditorScroll();
    });
    act(() => {
      const pending = [...frameCallbacks];
      frameCallbacks.length = 0;
      pending.forEach((callback) => callback(0));
    });
    expect(setScrollRatio).toHaveBeenCalled();

    requestAnimationFrameSpy.mockRestore();
  });

  it("hands scroll ownership over when the opposite pane gets a user gesture", () => {
    vi.useFakeTimers();
    const frameCallbacks: FrameRequestCallback[] = [];
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        frameCallbacks.push(callback);
        return frameCallbacks.length;
      });

    const setScrollRatio = vi.fn(() => true);
    const previewPane = createPreviewPane({
      clientHeight: 500,
      scrollHeight: 1500,
      scrollTop: 0,
    });

    const { result } = renderHook(() =>
      usePreviewScrollSync({
        activeDocumentLineCount: 11,
        activeTab: { path: "/workspace/book.md" } as EditorTab,
        documentHeadings: [],
        editorPaneRef: { current: { setScrollRatio } },
        previewPaneRef: { current: previewPane },
      }),
    );
    const flushFrames = () => {
      act(() => {
        const pending = [...frameCallbacks];
        frameCallbacks.length = 0;
        pending.forEach((callback) => callback(0));
      });
    };

    // 編集側が駆動してガードが張られる。
    act(() => {
      result.current.syncPreviewScroll(0.5);
    });
    flushFrames();
    expect(previewPane.scrollTop).toBe(500);

    // ガード中はプレビュー発の同期を捨てる（JS が書いた位置のエコー）。
    act(() => {
      result.current.syncEditorScroll();
    });
    flushFrames();
    expect(setScrollRatio).not.toHaveBeenCalled();

    // ユーザーがプレビューを操作したら所有権を渡す。以後のプレビュー発は反映される。
    act(() => {
      result.current.releaseEditorGuard();
    });
    act(() => {
      result.current.syncEditorScroll();
    });
    flushFrames();
    expect(setScrollRatio).toHaveBeenCalledWith(0.5, expect.any(Number));

    requestAnimationFrameSpy.mockRestore();
  });

  it("keeps the editor guard even when the preview write stays under the tolerance", () => {
    vi.useFakeTimers();
    const frameCallbacks: FrameRequestCallback[] = [];
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        frameCallbacks.push(callback);
        return frameCallbacks.length;
      });

    const setScrollRatio = vi.fn(() => true);
    // 可動域 10000px。比率の小さな変化では書き込み差分が 10px に届かない。
    const previewPane = createPreviewPane({
      clientHeight: 500,
      scrollHeight: 10500,
      scrollTop: 5000,
    });

    const { result } = renderHook(() =>
      usePreviewScrollSync({
        activeDocumentLineCount: 11,
        activeTab: { path: "/workspace/book.md" } as EditorTab,
        documentHeadings: [],
        editorPaneRef: { current: { setScrollRatio } },
        previewPaneRef: { current: previewPane },
      }),
    );

    act(() => {
      result.current.syncPreviewScroll(0.5005);
    });
    act(() => {
      const pending = [...frameCallbacks];
      frameCallbacks.length = 0;
      pending.forEach((callback) => callback(0));
    });
    // 書き込みは不要（差分 5px）でも、所有権は編集側のまま延長される。
    expect(previewPane.scrollTop).toBe(5000);

    act(() => {
      result.current.syncEditorScroll();
    });
    act(() => {
      const pending = [...frameCallbacks];
      frameCallbacks.length = 0;
      pending.forEach((callback) => callback(0));
    });
    expect(setScrollRatio).not.toHaveBeenCalled();

    requestAnimationFrameSpy.mockRestore();
  });

  it("hands the other direction over when the editor gets a user gesture", () => {
    vi.useFakeTimers();
    const frameCallbacks: FrameRequestCallback[] = [];
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        frameCallbacks.push(callback);
        return frameCallbacks.length;
      });

    const setScrollRatio = vi.fn(() => true);
    const previewPane = createPreviewPane({
      clientHeight: 500,
      scrollHeight: 1500,
      scrollTop: 500,
    });

    const { result } = renderHook(() =>
      usePreviewScrollSync({
        activeDocumentLineCount: 11,
        activeTab: { path: "/workspace/book.md" } as EditorTab,
        documentHeadings: [],
        editorPaneRef: { current: { setScrollRatio } },
        previewPaneRef: { current: previewPane },
      }),
    );
    const flushFrames = () => {
      act(() => {
        const pending = [...frameCallbacks];
        frameCallbacks.length = 0;
        pending.forEach((callback) => callback(0));
      });
    };

    // プレビュー側が駆動してガードが張られる。
    act(() => {
      result.current.syncEditorScroll();
    });
    flushFrames();
    expect(setScrollRatio).toHaveBeenCalled();

    // ガード中なので編集側からの書き戻しは捨てる。
    act(() => {
      result.current.syncPreviewScroll(0);
    });
    flushFrames();
    expect(previewPane.scrollTop).toBe(500);

    // ユーザーが編集面を操作したら所有権を渡す。
    act(() => {
      result.current.releasePreviewGuard();
    });
    act(() => {
      result.current.syncPreviewScroll(0);
    });
    flushFrames();
    expect(previewPane.scrollTop).toBe(0);

    requestAnimationFrameSpy.mockRestore();
  });

  it("invalidates a queued sync frame when the user switches panes", () => {
    vi.useFakeTimers();
    const frames = new Map<number, FrameRequestCallback>();
    let nextFrameId = 0;
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        nextFrameId += 1;
        frames.set(nextFrameId, callback);
        return nextFrameId;
      });
    const cancelAnimationFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation((handle: number) => {
        frames.delete(handle);
      });

    const setScrollRatio = vi.fn(() => true);
    const previewPane = createPreviewPane({
      clientHeight: 500,
      scrollHeight: 1500,
      scrollTop: 300,
    });

    const { result } = renderHook(() =>
      usePreviewScrollSync({
        activeDocumentLineCount: 11,
        activeTab: { path: "/workspace/book.md" } as EditorTab,
        documentHeadings: [],
        editorPaneRef: { current: { setScrollRatio } },
        previewPaneRef: { current: previewPane },
      }),
    );
    const flushFrames = () => {
      const pending = [...frames.values()];
      frames.clear();
      act(() => {
        pending.forEach((callback) => callback(0));
      });
    };

    // 本文 400 をプレビューへ書く rAF を予約したまま実行しない。
    act(() => {
      result.current.syncPreviewScroll(0.4);
    });
    const staleFrame = [...frames.values()][0];
    expect(staleFrame).toBeDefined();

    // ユーザーがプレビューを操作して所有権を移す（予約は失効する）。
    act(() => {
      result.current.releaseEditorGuard();
    });
    previewPane.scrollTop = 600;

    // 失効した予約が遅れて動いても、プレビューを古い 400 へ戻さない。
    act(() => {
      staleFrame(0);
    });
    expect(previewPane.scrollTop).toBe(600);

    // 新しい操作側（プレビュー）の同期は生きている。
    act(() => {
      result.current.syncEditorScroll();
    });
    flushFrames();
    expect(setScrollRatio).toHaveBeenCalledWith(0.6, expect.any(Number));
    expect(previewPane.scrollTop).toBe(600);

    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
  });

  it("does not move Preview scroll while the user is selecting text in the pane", () => {
    vi.useFakeTimers();
    const frameCallbacks: FrameRequestCallback[] = [];
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        frameCallbacks.push(callback);
        return frameCallbacks.length;
      });

    const previewPane = createPreviewPane({
      clientHeight: 500,
      scrollHeight: 1500,
      scrollTop: 120,
    });
    const paragraph = document.createElement("p");
    paragraph.textContent = "Selectable preview text";
    previewPane.append(paragraph);
    document.body.append(previewPane);
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);

    const { result } = renderHook(() =>
      usePreviewScrollSync({
        activeDocumentLineCount: 11,
        activeTab: { path: "/workspace/book.md" } as EditorTab,
        documentHeadings: [],
        editorPaneRef: { current: { setScrollRatio: vi.fn(() => true) } },
        previewPaneRef: { current: previewPane },
      }),
    );

    act(() => {
      result.current.syncPreviewScroll(0.5);
    });
    act(() => {
      frameCallbacks.forEach((callback) => callback(0));
    });

    expect(previewPane.scrollTop).toBe(120);

    window.getSelection()?.removeAllRanges();
    previewPane.remove();
    requestAnimationFrameSpy.mockRestore();
  });

  it("does not sync either direction during an in-progress Preview pointer gesture", () => {
    vi.useFakeTimers();
    const frameCallbacks: FrameRequestCallback[] = [];
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        frameCallbacks.push(callback);
        return frameCallbacks.length;
      });

    const setScrollRatio = vi.fn(() => true);
    const previewPane = createPreviewPane({
      clientHeight: 500,
      scrollHeight: 1500,
      scrollTop: 120,
    });
    previewPane.setAttribute("data-preview-selecting", "");

    const { result } = renderHook(() =>
      usePreviewScrollSync({
        activeDocumentLineCount: 11,
        activeTab: { path: "/workspace/book.md" } as EditorTab,
        documentHeadings: [],
        editorPaneRef: { current: { setScrollRatio } },
        previewPaneRef: { current: previewPane },
      }),
    );

    act(() => {
      result.current.syncPreviewScroll(0.5);
    });
    act(() => {
      frameCallbacks.forEach((callback) => callback(0));
    });
    expect(previewPane.scrollTop).toBe(120);

    frameCallbacks.length = 0;
    act(() => {
      result.current.syncEditorScroll();
    });
    act(() => {
      frameCallbacks.forEach((callback) => callback(0));
    });
    expect(setScrollRatio).not.toHaveBeenCalled();

    requestAnimationFrameSpy.mockRestore();
  });
});

function createPreviewPane({
  clientHeight,
  scrollHeight,
  scrollTop,
}: {
  clientHeight: number;
  scrollHeight: number;
  scrollTop: number;
}) {
  const previewPane = document.createElement("div");
  Object.defineProperty(previewPane, "clientHeight", {
    configurable: true,
    value: clientHeight,
  });
  Object.defineProperty(previewPane, "scrollHeight", {
    configurable: true,
    value: scrollHeight,
  });
  previewPane.scrollTop = scrollTop;
  return previewPane;
}
