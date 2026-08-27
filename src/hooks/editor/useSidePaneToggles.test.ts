import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSidePaneToggles } from "./useSidePaneToggles";
import type { EditorTab } from "../../types";

function makeTab(): EditorTab {
  return {
    contents: "draft",
    encoding: "utf-8",
    error: null,
    externalFingerprint: null,
    fingerprint: "fingerprint",
    id: "/workspace/a.md",
    sessionId: "/workspace/a.md",
    ignoredExternalFingerprint: null,
    large_file_warning: false,
    lastSavedContents: "disk",
    lastSavedEncoding: "utf-8",
    lastSavedLineEnding: "lf",
    line_ending: "lf",
    modified_ms: null,
    name: "a.md",
    path: "/workspace/a.md",
    saveStatus: "idle",
    size: 5,
  };
}

describe("useSidePaneToggles", () => {
  it("opens Diff when the side pane is flagged open but not showing (Reference covering)", () => {
    const setRightPaneMode = vi.fn();
    const setSidePaneOpen = vi.fn();
    const { result } = renderHook(() =>
      useSidePaneToggles({
        activeTab: makeTab(),
        setPreviewVisible: vi.fn(),
        setRightPaneMode,
        setSidePaneOpen,
        sidePaneMode: null,
        sidePaneOpen: true,
      }),
    );

    act(() => {
      result.current.toggleDiffPane();
    });

    expect(setRightPaneMode).toHaveBeenCalledWith("compare");
    expect(setSidePaneOpen).toHaveBeenCalledWith(true);
    expect(setSidePaneOpen).not.toHaveBeenCalledWith(false);
  });

  it("hides Diff only when that pane is actually showing", () => {
    const setSidePaneOpen = vi.fn();
    const { result } = renderHook(() =>
      useSidePaneToggles({
        activeTab: makeTab(),
        setPreviewVisible: vi.fn(),
        setRightPaneMode: vi.fn(),
        setSidePaneOpen,
        sidePaneMode: "compare",
        sidePaneOpen: true,
      }),
    );

    act(() => {
      result.current.toggleDiffPane();
    });

    expect(setSidePaneOpen).toHaveBeenCalledWith(false);
  });
});
