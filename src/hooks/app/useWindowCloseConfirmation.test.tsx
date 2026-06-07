import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useWindowCloseConfirmation } from "./useWindowCloseConfirmation";
import { onCurrentWindowCloseRequested } from "../../lib/tauri";

// v0.15 macOS close-flow regression test (round 3).
//
// On macOS the red button is the "close this window"
// affordance, not "quit the app" (`Cmd+Q` is the app-quit
// affordance, which Tauri fires `RunEvent::ExitRequested`
// for by default). Once the frontend intercepts
// `CloseRequested` with `preventDefault`, the NSApplication
// records the request as "rejected" and re-issuing
// `WebviewWindow::close()` / `WebviewWindow::destroy()`
// through the JS bridge is unreliable. The reliable
// teardown is the Rust `hide_main_window` command, which
// calls `WebviewWindow::hide()` → `NSWindow.orderOut:`
// directly, bypassing both the `windowShouldClose:`
// delegate and the `RunEvent::Exit` path.
//
// These tests pin that contract:
//   - the handler always `preventDefault()`s the close
//     request (so the macOS-side reject state is owned
//     and predictable, never leaked to the user),
//   - on a clean close (no dirty tabs) the hook routes the
//     teardown through `hideMainWindow`,
//   - after the user picked Save / Discard
//     (`allowWindowCloseRef.current === true`) the same
//     `hideMainWindow` path is taken,
//   - on a dirty close the hook surfaces the dialog via
//     `onNeedsConfirmation` and does NOT call
//     `hideMainWindow` (the dialog callback owns the final
//     dispatch from `useTabCloseFlow`).

type CloseHandler = Parameters<typeof onCurrentWindowCloseRequested>[0];

const closeHandlers: CloseHandler[] = [];
const tauriWindow = vi.hoisted(() => ({
  hideMainWindow: vi.fn(async () => {}),
}));

vi.mock("../../lib/tauri", () => ({
  hideMainWindow: tauriWindow.hideMainWindow,
  onCurrentWindowCloseRequested: vi.fn(async (handler: CloseHandler) => {
    closeHandlers.push(handler);
    return () => {};
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
    tauriWindow.hideMainWindow.mockClear();
    vi.mocked(onCurrentWindowCloseRequested).mockClear();
  });

  it("preventDefaults every close request and asks for confirmation when tabs are dirty", async () => {
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
    // Dirty path: the dialog callback owns the final
    // dispatch, so `hideMainWindow` must NOT fire from the
    // hook itself.
    expect(tauriWindow.hideMainWindow).not.toHaveBeenCalled();
  });

  it("uses the latest dirty count without re-registering the native listener", async () => {
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
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    // Clean state must dispatch `hideMainWindow` to actually
    // hide the window on macOS.
    expect(tauriWindow.hideMainWindow).toHaveBeenCalledTimes(1);
    expect(onNeedsConfirmation).not.toHaveBeenCalled();
  });

  it("dispatches `hideMainWindow` after the app explicitly permits window shutdown", async () => {
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

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(tauriWindow.hideMainWindow).toHaveBeenCalledTimes(1);
    expect(onNeedsConfirmation).not.toHaveBeenCalled();
  });
});
