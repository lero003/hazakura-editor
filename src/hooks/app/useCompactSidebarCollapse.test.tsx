import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useCompactSidebarCollapse } from "./useCompactSidebarCollapse";
import { COMPACT_SIDEBAR_MAX_WIDTH } from "../../features/workspace/compactSidebar";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** 幅を切り替えられる matchMedia を用意し、変更を購読側へ通知する。 */
function stubViewport(initialCompact: boolean) {
  const listeners = new Set<() => void>();
  let compact = initialCompact;
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      // matches は生きたゲッターにする（スプレッドで値を焼き込むと resize が伝わらない）。
      get matches() {
        return compact;
      },
      media: query,
      onchange: null,
      addListener: (fn: () => void) => listeners.add(fn),
      removeListener: (fn: () => void) => listeners.delete(fn),
      addEventListener: (_type: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_type: string, fn: () => void) => listeners.delete(fn),
      dispatchEvent: () => true,
    })),
  );
  return {
    resizeTo(next: boolean) {
      compact = next;
      listeners.forEach((fn) => fn());
    },
  };
}

describe("useCompactSidebarCollapse", () => {
  it("folds the sidebar on a narrow window and opens it on toggle", () => {
    stubViewport(true);
    const { result } = renderHook(() => useCompactSidebarCollapse());
    expect(result.current.compactWidth).toBe(true);
    expect(result.current.collapsed).toBe(true);

    act(() => result.current.toggle());
    expect(result.current.collapsed).toBe(false);
  });

  it("returns to that width's default after a resize", () => {
    const viewport = stubViewport(true);
    const { result } = renderHook(() => useCompactSidebarCollapse());
    act(() => result.current.toggle());
    expect(result.current.collapsed).toBe(false);

    // 狭いまま→広い: 明示選択を解除し、広い幅の既定（開く）へ。
    act(() => viewport.resizeTo(false));
    expect(result.current.compactWidth).toBe(false);
    expect(result.current.collapsed).toBe(false);

    // 広いまま→狭い: 幅の既定（畳む）へ。
    act(() => viewport.resizeTo(true));
    expect(result.current.collapsed).toBe(true);
  });

  it("keeps the collapsed state out of persistence", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    stubViewport(true);
    const { result } = renderHook(() => useCompactSidebarCollapse());
    act(() => result.current.toggle());
    act(() => result.current.setCollapsed(true));
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });

  it("does nothing when the platform has no matchMedia", () => {
    vi.stubGlobal("matchMedia", undefined);
    const { result } = renderHook(() => useCompactSidebarCollapse());
    expect(result.current.compactWidth).toBe(false);
    expect(result.current.collapsed).toBe(false);
  });
});
