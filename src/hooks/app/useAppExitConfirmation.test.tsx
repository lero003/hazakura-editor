import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAppExitConfirmation } from "./useAppExitConfirmation";
import { exitApp } from "../../lib/tauri/window";
import { listen } from "@tauri-apps/api/event";

// v0.17 app-store-quality: save-restore-regression slice 1.4
// — `Cmd+Q` / Quit menu dirty-state guard.
//
// The Rust run loop's `RunEvent::ExitRequested` arm
// prevents the bare exit, then emits
// `APP_EXIT_REQUESTED_EVENT` to the main window. This hook
// is the receiving end. It mirrors
// `useWindowCloseConfirmation` (clean → fast path, dirty →
// `onNeedsConfirmation` so the controller can flip a ref
// and reuse the existing `AppCloseDialog`). The tests below
// pin the four contracts that data-loss prevention at this
// layer depends on:
//   - dirty → `exitApp` is NOT called, the shared ref is
//     flipped, `onNeedsConfirmation` is fired,
//   - clean → `exitApp` is called and `onNeedsConfirmation`
//     is NOT fired,
//   - the listener is registered once even as the dirty
//     count changes (the latest count is read through a
//     ref, like the window-close hook),
//   - the listener is unhooked on unmount so a re-mount
//     does not stack two `APP_EXIT_REQUESTED_EVENT`
//     handlers (which would double-fire `exitApp`).

type ExitListener = Parameters<typeof listen>[1];

const tauriWindow = vi.hoisted(() => ({
  exitApp: vi.fn(async () => {}),
}));

const exitListeners: ExitListener[] = [];

vi.mock("../../lib/tauri/window", () => ({
  exitApp: tauriWindow.exitApp,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (eventName: string, handler: ExitListener) => {
    void eventName;
    exitListeners.push(handler);
    return () => {};
  }),
}));

function setup(
  overrides: Partial<Parameters<typeof useAppExitConfirmation>[0]> = {},
) {
  const props: Parameters<typeof useAppExitConfirmation>[0] = {
    appExitInProgressRef: { current: false },
    dirtyTabCount: 0,
    onNeedsConfirmation: vi.fn(),
    ...overrides,
  };

  return {
    props,
    ...renderHook(() => useAppExitConfirmation(props)),
  };
}

describe("useAppExitConfirmation", () => {
  afterEach(() => {
    exitListeners.length = 0;
    tauriWindow.exitApp.mockClear();
    vi.mocked(listen).mockClear();
  });

  it("surfaces the close dialog and does not exit when tabs are dirty", () => {
    const appExitInProgressRef = { current: false };
    const onNeedsConfirmation = vi.fn();
    const { result } = setup({
      appExitInProgressRef,
      dirtyTabCount: 2,
      onNeedsConfirmation,
    });
    void result;

    void exitListeners[0]?.({} as never);

    // The ref is flipped BEFORE the dialog is surfaced so
    // the Save All / Discard All handlers take the
    // `exitApp` path, not the `hideMainWindow` path.
    expect(appExitInProgressRef.current).toBe(true);
    expect(onNeedsConfirmation).toHaveBeenCalledTimes(1);
    // The fast-path `exitApp` must NOT fire on the dirty
    // route — the dialog owns the final decision.
    expect(tauriWindow.exitApp).not.toHaveBeenCalled();
  });

  it("exits the app immediately when no tabs are dirty", () => {
    const appExitInProgressRef = { current: false };
    const onBeforeExit = vi.fn();
    const onNeedsConfirmation = vi.fn();
    const { result } = setup({
      appExitInProgressRef,
      dirtyTabCount: 0,
      onBeforeExit,
      onNeedsConfirmation,
    });
    void result;

    void exitListeners[0]?.({} as never);

    // Clean path: the user explicitly asked to quit, no
    // unsaved buffer to lose. The ref stays false (no
    // dialog needed) and we tear down via the Rust
    // `exit_app` command.
    expect(appExitInProgressRef.current).toBe(false);
    expect(onNeedsConfirmation).not.toHaveBeenCalled();
    expect(onBeforeExit).toHaveBeenCalledTimes(1);
    expect(onBeforeExit.mock.invocationCallOrder[0]).toBeLessThan(
      tauriWindow.exitApp.mock.invocationCallOrder[0],
    );
    expect(tauriWindow.exitApp).toHaveBeenCalledTimes(1);
  });

  it("uses the latest dirty count without re-registering the native listener", () => {
    const appExitInProgressRef = { current: false };
    const onNeedsConfirmation = vi.fn();
    const props = {
      appExitInProgressRef,
      dirtyTabCount: 1,
      onNeedsConfirmation,
    };

    const { rerender } = renderHook(
      ({ appExitInProgressRef: ref, dirtyTabCount, onNeedsConfirmation }) =>
        useAppExitConfirmation({
          appExitInProgressRef: ref,
          dirtyTabCount,
          onNeedsConfirmation,
        }),
      { initialProps: props },
    );

    rerender({ ...props, dirtyTabCount: 0 });
    void exitListeners[0]?.({} as never);

    // The native listener is wired up exactly once across
    // the dirty-count re-render. If a future refactor
    // adds `dirtyTabCount` to the effect deps, the second
    // render would register a duplicate and the next
    // `Cmd+Q` would call `exitApp` twice.
    expect(listen).toHaveBeenCalledTimes(1);
    // The latest count (0) wins, so the clean path fires
    // even though the first render passed `dirtyTabCount: 1`.
    expect(tauriWindow.exitApp).toHaveBeenCalledTimes(1);
    expect(onNeedsConfirmation).not.toHaveBeenCalled();
  });

  it("unhooks the listener on unmount so a re-mount does not stack handlers", async () => {
    const unlisten = vi.fn();
    exitListeners.length = 0;
    vi.mocked(listen).mockImplementationOnce(async () => unlisten);

    const { unmount } = setup();
    unmount();
    // The effect schedules `listen(...).then(...)` on the
    // microtask queue. The cleanup runs synchronously on
    // unmount and flips the `cancelled` flag (but the
    // captured `unlisten` ref is still null at that point,
    // so the cleanup's own `unlisten?.()` is a no-op).
    // The teardown path that actually invokes the
    // returned unlisten function lives inside the
    // `.then()` callback, which fires on the next
    // microtask tick. `act` flushes both the unmount and
    // the queued microtasks so the assertion below sees
    // the post-teardown state.
    await act(async () => {
      await Promise.resolve();
    });

    // The returned unlisten function from `listen` must be
    // invoked on teardown. Without this, reloading the
    // main window would stack a fresh handler on top of
    // the previous one and `Cmd+Q` would surface the
    // dialog twice (or, on a clean state, call `exitApp`
    // twice and log a confusing IPC trace).
    expect(unlisten).toHaveBeenCalledTimes(1);
  });
});
