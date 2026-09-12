import { beforeEach, describe, expect, it } from "vitest";
import { WORKSPACE_PANE_LAYOUT_STORAGE_KEY } from "../../types";
import {
  DEFAULT_REFERENCE_COLUMN_PERCENT,
  DEFAULT_WORKSPACE_SIDEBAR_WIDTH,
  MAX_WORKSPACE_SIDEBAR_WIDTH,
  MIN_WORKSPACE_SIDEBAR_WIDTH,
  readWorkspacePaneLayout,
  resizeRightPanePercent,
  resizeWorkspaceSidebarWidth,
  updateStoredWorkspacePaneLayout,
} from "./paneLayout";

describe("workspace pane layout", () => {
  beforeEach(() => window.localStorage.clear());

  it("keeps the sidebar minimum wide enough for its header row", () => {
    // 実機指摘（第15報）: 最小まで狭めるとワークスペースのヘッダー（「WORKSPACE」の見出し＋
    // 新規/開く/ゴミ箱）が数px 溢れて左が隠れていた。実測で約199px 必要なので、
    // 言語・フォント差の余裕を見て下限は 216px 以上にする。
    expect(MIN_WORKSPACE_SIDEBAR_WIDTH).toBeGreaterThanOrEqual(216);
    expect(MIN_WORKSPACE_SIDEBAR_WIDTH).toBeLessThan(DEFAULT_WORKSPACE_SIDEBAR_WIDTH);
  });

  it("uses quiet defaults when no layout has been saved", () => {
    expect(readWorkspacePaneLayout()).toEqual({
      previewColumnPercent: 42,
      referenceColumnPercent: DEFAULT_REFERENCE_COLUMN_PERCENT,
      workspaceSidebarWidth: DEFAULT_WORKSPACE_SIDEBAR_WIDTH,
    });
  });

  it("clamps persisted values and repairs malformed fields independently", () => {
    window.localStorage.setItem(
      WORKSPACE_PANE_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        previewColumnPercent: 999,
        referenceColumnPercent: "broken",
        workspaceSidebarWidth: 12,
      }),
    );

    expect(readWorkspacePaneLayout()).toEqual({
      previewColumnPercent: 75,
      referenceColumnPercent: DEFAULT_REFERENCE_COLUMN_PERCENT,
      workspaceSidebarWidth: MIN_WORKSPACE_SIDEBAR_WIDTH,
    });
  });

  it("falls back without throwing when stored JSON is corrupt", () => {
    window.localStorage.setItem(WORKSPACE_PANE_LAYOUT_STORAGE_KEY, "{");

    expect(readWorkspacePaneLayout().workspaceSidebarWidth).toBe(
      DEFAULT_WORKSPACE_SIDEBAR_WIDTH,
    );
  });

  it("updates one pane without erasing the other saved widths", () => {
    updateStoredWorkspacePaneLayout({ previewColumnPercent: 55 });
    updateStoredWorkspacePaneLayout({ workspaceSidebarWidth: 360 });

    expect(readWorkspacePaneLayout()).toEqual({
      previewColumnPercent: 55,
      referenceColumnPercent: DEFAULT_REFERENCE_COLUMN_PERCENT,
      workspaceSidebarWidth: 360,
    });
  });

  it("derives bounded sidebar and right-pane sizes from pointer positions", () => {
    expect(resizeWorkspaceSidebarWidth(100, 340)).toBe(240);
    expect(resizeWorkspaceSidebarWidth(100, -100)).toBe(
      MIN_WORKSPACE_SIDEBAR_WIDTH,
    );
    expect(resizeWorkspaceSidebarWidth(100, 999)).toBe(
      MAX_WORKSPACE_SIDEBAR_WIDTH,
    );

    expect(resizeRightPanePercent({ left: 100, right: 900, clientX: 500 })).toBe(
      50,
    );
    expect(resizeRightPanePercent({ left: 100, right: 900, clientX: 890 })).toBe(
      25,
    );
  });
});
