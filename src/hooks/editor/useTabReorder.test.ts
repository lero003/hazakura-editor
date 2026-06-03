import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useTabReorder } from "./useTabReorder";

// `useTabReorder` owns the pointer-driven tab reorder interaction
// in the main window's tab bar. The DOM-heavy parts of the flow
// (pointer capture, `document.elementFromPoint`, getBoundingClientRect)
// still need real WebView fixtures; these tests cover the parts
// that are pure-state or pure-guard: the initial state surface, the
// left-click guard in `handleTabPointerDown` (which is the
// regression-prone area that previously swallowed tab-select clicks
// when capture was set on pointerdown), and the
// `shouldSuppressTabClick` ref toggle.

function makePointerEvent(
  init: Partial<{
    button: number;
    pointerId: number;
    clientX: number;
    clientY: number;
    target: EventTarget | null;
    currentTarget: EventTarget | null;
  }> = {},
) {
  const event = {
    button: 0,
    pointerId: 1,
    clientX: 0,
    clientY: 0,
    target: init.target ?? null,
    currentTarget: init.currentTarget ?? null,
    preventDefault: vi.fn(),
  };
  return event as unknown as Parameters<
    ReturnType<typeof useTabReorder>["handleTabPointerDown"]
  >[0];
}

describe("useTabReorder", () => {
  it("starts with no tab being dragged and no drag-over target", () => {
    const { result } = renderHook(() => useTabReorder(vi.fn()));

    expect(result.current.draggingTabId).toBeNull();
    expect(result.current.dragOverTabId).toBeNull();
    expect(result.current.shouldSuppressTabClick()).toBe(false);
  });

  it("returns the drag action surface", () => {
    const { result } = renderHook(() => useTabReorder(vi.fn()));

    expect(typeof result.current.handleTabPointerDown).toBe("function");
    expect(typeof result.current.handleTabPointerMove).toBe("function");
    expect(typeof result.current.finishTabPointerDrag).toBe("function");
    expect(typeof result.current.shouldSuppressTabClick).toBe("function");
  });

  it("ignores non-left-button pointerdowns (so middle/right clicks pass through)", () => {
    const { result } = renderHook(() => useTabReorder(vi.fn()));

    act(() => {
      result.current.handleTabPointerDown(
        makePointerEvent({ button: 2 }),
        "tab-a",
      );
    });

    // No drag was registered, so a follow-up click should not be
    // suppressed.
    expect(result.current.shouldSuppressTabClick()).toBe(false);
    expect(result.current.draggingTabId).toBeNull();
  });

  it("ignores pointerdowns that target a tab close button (so close clicks pass through)", () => {
    // The guard looks up the tree for `.tab-close`, so we wire a
    // fake currentTarget that reports one via `closest`.
    const closeButton = {
      closest: (selector: string) =>
        selector === ".tab-close" ? closeButton : null,
    } as unknown as Element;
    const { result } = renderHook(() => useTabReorder(vi.fn()));

    act(() => {
      result.current.handleTabPointerDown(
        makePointerEvent({ target: closeButton }),
        "tab-a",
      );
    });

    expect(result.current.shouldSuppressTabClick()).toBe(false);
    expect(result.current.draggingTabId).toBeNull();
  });

  it("clears drag state when finishTabPointerDrag runs without a capture target", () => {
    const { result } = renderHook(() => useTabReorder(vi.fn()));

    act(() => {
      result.current.finishTabPointerDrag(undefined);
    });

    expect(result.current.draggingTabId).toBeNull();
    expect(result.current.dragOverTabId).toBeNull();
  });
});
