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
});
