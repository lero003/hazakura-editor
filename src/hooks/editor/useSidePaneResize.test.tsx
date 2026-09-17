import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WORKSPACE_PANE_LAYOUT_STORAGE_KEY } from "../../types";
import { readWorkspacePaneLayout } from "../../features/workspace/paneLayout";
import { useSidePaneResize } from "./useSidePaneResize";

describe("useSidePaneResize", () => {
  beforeEach(() => window.localStorage.clear());

  it("restores and persists the normal side-pane width", () => {
    window.localStorage.setItem(
      WORKSPACE_PANE_LAYOUT_STORAGE_KEY,
      JSON.stringify({ previewColumnPercent: 58 }),
    );
    const { result } = renderHook(() =>
      useSidePaneResize({ sidePaneMode: "preview", sidePaneVisible: true }),
    );

    expect(result.current.previewColumnPercent).toBe(58);
    expect(result.current.editorPreviewGridStyle?.gridTemplateColumns).toContain(
      "58%",
    );

    act(() => {
      result.current.handlePreviewResizeKeyDown({
        key: "ArrowRight",
        preventDefault: vi.fn(),
      } as never);
    });

    expect(result.current.previewColumnPercent).toBe(53);
    expect(readWorkspacePaneLayout().previewColumnPercent).toBe(53);
  });

  it("keeps a 6px resizer column between the editor and the right pane", () => {
    const { result } = renderHook(() =>
      useSidePaneResize({ sidePaneMode: "preview", sidePaneVisible: true }),
    );

    // つかむ幅はこの 6px + `.pane-resizer::before` の右 4px = 10px。
    // 左への張り出しは編集面のスクロールバーを奪うため禁止
    // （src/styles/workspaceCss.test.ts が固定）。
    expect(
      result.current.editorPreviewGridStyle?.gridTemplateColumns,
    ).toContain(" 6px ");
  });
});
