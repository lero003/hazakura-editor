import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useWindowCloseConfirmation } from "./useWindowCloseConfirmation";
import { onCurrentWindowCloseRequested } from "../../lib/tauri";

type CloseHandler = Parameters<typeof onCurrentWindowCloseRequested>[0];

const closeHandlers: CloseHandler[] = [];
const unlisten = vi.fn();
const tauriWindow = vi.hoisted(() => ({
  destroyCurrentWindow: vi.fn(async () => {}),
}));

vi.mock("../../lib/tauri", () => ({
  destroyCurrentWindow: tauriWindow.destroyCurrentWindow,
  onCurrentWindowCloseRequested: vi.fn(async (handler: CloseHandler) => {
    closeHandlers.push(handler);
    return unlisten;
  }),
}));

function closeEvent() {
  return {
    preventDefault: vi.fn(),
  };
}

describe("useWindowCloseConfirmation", () => {
  afterEach(() => {
    closeHandlers.length = 0;
    tauriWindow.destroyCurrentWindow.mockClear();
    unlisten.mockClear();
    vi.mocked(onCurrentWindowCloseRequested).mockClear();
    vi.useRealTimers();
  });

  it("stops native window close and asks for confirmation when tabs are dirty", async () => {
    const onNeedsConfirmation = vi.fn();
    const event = closeEvent();

    renderHook(() =>
      useWindowCloseConfirmation({
        allowWindowCloseRef: { current: false },
        dirtyTabCount: 2,
        onNeedsConfirmation,
      }),
    );

    await closeHandlers[0]?.(event as never);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(onNeedsConfirmation).toHaveBeenCalledTimes(1);
  });

  it("uses the latest dirty count without re-registering the native listener", async () => {
    vi.useFakeTimers();
    const onNeedsConfirmation = vi.fn();
    const event = closeEvent();
    const props = {
      allowWindowCloseRef: { current: false },
      dirtyTabCount: 1,
      onNeedsConfirmation,
    };

    const { rerender } = renderHook(
      ({ allowWindowCloseRef, dirtyTabCount, onNeedsConfirmation }) =>
        useWindowCloseConfirmation({
          allowWindowCloseRef,
          dirtyTabCount,
          onNeedsConfirmation,
        }),
      { initialProps: props },
    );

    rerender({ ...props, dirtyTabCount: 0 });
    await closeHandlers[0]?.(event as never);

    expect(onCurrentWindowCloseRequested).toHaveBeenCalledTimes(1);
    // v0.15 close-flow fix: when the latest dirty count
    // drops to zero, the hook must let the close request
    // propagate to macOS without preventDefault. Re-issuing
    // a destroy command after a preventDefault-ed close
    // request does not actually close the NSWindow, so the
    // previous shape left the .app running with
    // `windowShouldClose: prevented close` in the log.
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(tauriWindow.destroyCurrentWindow).not.toHaveBeenCalled();
    expect(onNeedsConfirmation).not.toHaveBeenCalled();
  });

  it("lets the close request propagate after the app explicitly permits window shutdown", async () => {
    vi.useFakeTimers();
    const allowWindowCloseRef = { current: true };
    const onNeedsConfirmation = vi.fn();
    const event = closeEvent();

    renderHook(() =>
      useWindowCloseConfirmation({
        allowWindowCloseRef,
        dirtyTabCount: 1,
        onNeedsConfirmation,
      }),
    );

    await closeHandlers[0]?.(event as never);

    // v0.15 close-flow fix: once the app has explicitly
    // permitted window shutdown (e.g. after the user picked
    // Save / Discard in the confirmation dialog), the next
    // close request must reach macOS directly. Issuing a
    // destroy command after a preventDefault-ed close
    // request is unreliable on macOS.
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(tauriWindow.destroyCurrentWindow).not.toHaveBeenCalled();
    expect(onNeedsConfirmation).not.toHaveBeenCalled();
  });

  it("unlistens from the native close request on unmount", async () => {
    const { unmount } = renderHook(() =>
      useWindowCloseConfirmation({
        allowWindowCloseRef: { current: false },
        dirtyTabCount: 0,
        onNeedsConfirmation: vi.fn(),
      }),
    );

    unmount();
    await Promise.resolve();

    expect(unlisten).toHaveBeenCalledTimes(1);
  });
});
