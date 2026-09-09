import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { usePreviewSurface } from "./usePreviewSurface";
import type { RightPaneMode } from "../../types";

describe("usePreviewSurface", () => {
  it.each([null, "ebook", "preview"] as const)("coordinates focus, Reference and the existing toggle from %s", (mode) => {
    const togglePreviewPane = vi.fn();
    const leaveReference = vi.fn();
    const { result, rerender } = renderHook(({ sidePaneMode }: { sidePaneMode: RightPaneMode | null }) =>
      usePreviewSurface({ sidePaneMode, togglePreviewPane, leaveReference }),
      { initialProps: { sidePaneMode: mode as RightPaneMode | null } });
    act(() => result.current.togglePreviewSurface());
    expect(result.current.compactPreviewFocus).toBe(mode === "preview" ? "editor" : "preview");
    expect(leaveReference).toHaveBeenCalledOnce();
    expect(togglePreviewPane).toHaveBeenCalledOnce();
    act(() => result.current.setCompactPreviewFocus("editor"));
    rerender({ sidePaneMode: null });
    act(() => result.current.togglePreviewSurface());
    expect(result.current.compactPreviewFocus).toBe("preview");
  });
});
