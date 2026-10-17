import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceAutoRefresh } from "./useWorkspaceAutoRefresh";

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("useWorkspaceAutoRefresh", () => {
  it("checks every 10 seconds and when focus returns", () => {
    vi.useFakeTimers();
    const refresh = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useWorkspaceAutoRefresh({ enabled: true, refresh, cancel: vi.fn() }));
    act(() => vi.advanceTimersByTime(9999));
    expect(refresh).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(refresh).toHaveBeenCalledTimes(1);
    act(() => window.dispatchEvent(new Event("focus")));
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("stops checks while hidden and checks when visibility returns", () => {
    vi.useFakeTimers();
    let visibility: DocumentVisibilityState = "visible";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
    const refresh = vi.fn().mockResolvedValue(undefined); const cancel = vi.fn();
    const hook = renderHook(() => useWorkspaceAutoRefresh({ enabled: true, refresh, cancel }));
    act(() => { visibility = "hidden"; document.dispatchEvent(new Event("visibilitychange")); vi.advanceTimersByTime(30_000); window.dispatchEvent(new Event("focus")); });
    expect(refresh).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalled();
    act(() => { visibility = "visible"; document.dispatchEvent(new Event("visibilitychange")); });
    expect(refresh).toHaveBeenCalledTimes(1);
    hook.unmount();
    act(() => vi.advanceTimersByTime(20_000));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("pauses for workspace file dialogs and resumes the timer afterwards", () => {
    vi.useFakeTimers();
    const refresh = vi.fn().mockResolvedValue(undefined); const cancel = vi.fn();
    const hook = renderHook(({ enabled }) => useWorkspaceAutoRefresh({ enabled, refresh, cancel }), { initialProps: { enabled: true } });
    hook.rerender({ enabled: false });
    act(() => { vi.advanceTimersByTime(20_000); window.dispatchEvent(new Event("focus")); });
    expect(refresh).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalled();
    hook.rerender({ enabled: true });
    act(() => vi.advanceTimersByTime(10_000));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
