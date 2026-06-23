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

    expect(setScrollRatio).toHaveBeenCalledWith(0.5, expect.any(Number));
    expect(result.current.scrollHudVisible).toBe(true);
    expect(result.current.scrollHudLine).toBe(6);
    expect(result.current.scrollHudContext.current?.text).toBe("Chapter Two");
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
