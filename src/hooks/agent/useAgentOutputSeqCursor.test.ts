import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAgentOutputSeqCursor } from "./useAgentOutputSeqCursor";

describe("useAgentOutputSeqCursor", () => {
  it("returns undefined before any seq has been seen", () => {
    const { result } = renderHook(() => useAgentOutputSeqCursor("session-a"));

    expect(result.current.getLastSeenSeq()).toBeUndefined();
  });

  it("advances the cursor to the highest seen seq", () => {
    const { result } = renderHook(() => useAgentOutputSeqCursor("session-a"));

    act(() => {
      result.current.updateLastSeenSeq(5);
    });
    expect(result.current.getLastSeenSeq()).toBe(5);

    act(() => {
      result.current.updateLastSeenSeq(10);
    });
    expect(result.current.getLastSeenSeq()).toBe(10);
  });

  it("ignores non-advancing seq updates", () => {
    const { result } = renderHook(() => useAgentOutputSeqCursor("session-a"));

    act(() => {
      result.current.updateLastSeenSeq(7);
      result.current.updateLastSeenSeq(3);
      result.current.updateLastSeenSeq(7);
    });

    expect(result.current.getLastSeenSeq()).toBe(7);
  });

  it("resets the cursor to undefined when the reset key changes", () => {
    const { result, rerender } = renderHook(
      ({ key }: { key: unknown }) => useAgentOutputSeqCursor(key),
      { initialProps: { key: "session-a" as unknown } },
    );

    act(() => {
      result.current.updateLastSeenSeq(42);
    });
    expect(result.current.getLastSeenSeq()).toBe(42);

    rerender({ key: "session-b" });

    expect(result.current.getLastSeenSeq()).toBeUndefined();
  });

  it("does not reset the cursor when the reset key stays the same", () => {
    const { result, rerender } = renderHook(
      ({ key }: { key: unknown }) => useAgentOutputSeqCursor(key),
      { initialProps: { key: "session-a" as unknown } },
    );

    act(() => {
      result.current.updateLastSeenSeq(99);
    });
    rerender({ key: "session-a" });

    expect(result.current.getLastSeenSeq()).toBe(99);
  });
});
