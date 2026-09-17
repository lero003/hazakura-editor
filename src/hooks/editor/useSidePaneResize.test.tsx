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

    // これはスクロールバー回帰の主テストではなく、リサイザ列が 6px のままである
    // ことを固定するレイアウト構造の補助テスト。実際の当たり判定（つかむ幅は
    // 6px + `.pane-resizer::before` の右 4px）は
    // src/styles/workspaceCss.test.ts と
    // docs/reviews/2026-09-17-scrollbar-drag/README.md の実測が担保する。
    expect(
      result.current.editorPreviewGridStyle?.gridTemplateColumns,
    ).toContain(" 6px ");
  });
});
