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
