import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useTauriSubscription } from "./useTauriSubscription";

// The hook owns exactly one lifecycle contract: the unlisten handle is released
// once, whether it resolves before or after cleanup. The listener hooks moved
// onto this contract, so guard it directly.

describe("useTauriSubscription", () => {
  it("releases the handle on unmount when it resolves first", async () => {
    const unlisten = vi.fn();
    const { unmount } = renderHook(() =>
      useTauriSubscription(() => Promise.resolve(unlisten), []),
    );

    await Promise.resolve();
    expect(unlisten).not.toHaveBeenCalled();

    unmount();
    expect(unlisten).toHaveBeenCalledTimes(1);
  });

  it("releases a handle that resolves after cleanup", async () => {
    const unlisten = vi.fn();
    let resolveHandle: (handle: () => void) => void = () => {};
    const pending = new Promise<() => void>((resolve) => {
      resolveHandle = resolve;
    });

    const { unmount } = renderHook(() =>
      useTauriSubscription(() => pending, []),
    );

    unmount();
    expect(unlisten).not.toHaveBeenCalled();

    resolveHandle(unlisten);
    await pending;
    await Promise.resolve();
    expect(unlisten).toHaveBeenCalledTimes(1);
  });

  it("does not subscribe while disabled", () => {
    const subscribe = vi.fn(() => Promise.resolve(vi.fn()));
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useTauriSubscription(subscribe, [enabled], { enabled }),
      { initialProps: { enabled: false } },
    );

    expect(subscribe).not.toHaveBeenCalled();

    rerender({ enabled: true });
    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it("releases the previous handle when dependencies change", async () => {
    const first = vi.fn();
    const second = vi.fn();
    const subscribe = vi
      .fn<() => Promise<() => void>>()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second);

    const { rerender } = renderHook(
      ({ key }: { key: string }) => useTauriSubscription(subscribe, [key]),
      { initialProps: { key: "a" } },
    );

    await Promise.resolve();
    rerender({ key: "b" });
    await Promise.resolve();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
    expect(subscribe).toHaveBeenCalledTimes(2);
  });

  it("ignores non-function resolutions", async () => {
    const { unmount } = renderHook(() =>
      useTauriSubscription(() => null, []),
    );

    await Promise.resolve();
    expect(() => unmount()).not.toThrow();
  });
});
