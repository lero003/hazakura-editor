import { useEffect, useRef } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { exitApp } from "../../lib/tauri/window";
import { APP_EXIT_REQUESTED_EVENT } from "../../types";

type RefValue<T> = {
  current: T;
};

type UseAppExitConfirmationOptions = {
  // Set to true by this hook before the dialog is surfaced;
  // read by `useTabCloseFlow.saveAllAndCloseWindow` /
  // `discardAllAndCloseWindow` to swap the final action
  // from `hideMainWindow` to `exitApp`. Reset to false in
  // the cancel / save / discard paths so a subsequent
  // window-close red-button click does not accidentally
  // exit the app. The ref is owned by the app-shell
  // controller so its lifetime matches the window's.
  appExitInProgressRef: RefValue<boolean>;
  dirtyTabCount: number;
  // Wraps `requestAppCloseConfirmation` in the controller
  // (it sets the ref + calls the existing pendingAppClose
  // setter). Called on a dirty-state exit request so the
  // existing `AppCloseDialog` is shown — Save All /
  // Discard All / Cancel map to the same handlers the
  // window-close path uses, with the ref deciding whether
  // the final action is `exitApp` or `hideMainWindow`.
  onNeedsConfirmation: () => void;
  onBeforeExit?: () => void;
};

// v0.17 app-store-quality: save-restore-regression slice 1.4
// — macOS `Cmd+Q` / Quit menu dirty-state guard.
//
// The Rust run loop catches `RunEvent::ExitRequested` (fired
// by the macOS Quit menu item and `Cmd+Q`; Tauri 2 does not
// give the JS side a window-style `onCloseRequested` for
// app-level exit) and routes it here via
// `APP_EXIT_REQUESTED_EVENT`. The handler mirrors
// `useWindowCloseConfirmation`:
//
//   - clean (0 dirty tabs) → invoke the Rust `exit_app`
//     command, which uses `std::process::exit(0)` to bypass
//     the `RunEvent::ExitRequested` re-trigger,
//   - dirty → flag the controller via the shared ref and
//     surface the existing `AppCloseDialog` through
//     `onNeedsConfirmation`. The dialog's Save All / Discard
//     All handlers check the ref and call `exitApp` instead
//     of `hideMainWindow`. Cancel resets the ref so a later
//     window-close red-button click does not silently exit.
//
// The listener is registered once (the effect's deps are
// stable refs / the runtime boolean, not `dirtyTabCount`);
// the latest dirty count is read through `dirtyTabCountRef`,
// same shape as the window-close hook.
export function useAppExitConfirmation({
  appExitInProgressRef,
  dirtyTabCount,
  onBeforeExit,
  onNeedsConfirmation,
}: UseAppExitConfirmationOptions) {
  const dirtyTabCountRef = useRef(dirtyTabCount);
  const onBeforeExitRef = useRef(onBeforeExit);
  const onNeedsConfirmationRef = useRef(onNeedsConfirmation);

  useEffect(() => {
    dirtyTabCountRef.current = dirtyTabCount;
    onBeforeExitRef.current = onBeforeExit;
    onNeedsConfirmationRef.current = onNeedsConfirmation;
  }, [dirtyTabCount, onBeforeExit, onNeedsConfirmation]);

  useEffect(() => {
    let cancelled = false;
    let unlisten: UnlistenFn | null = null;

    void listen(APP_EXIT_REQUESTED_EVENT, () => {
      if (cancelled) {
        return;
      }

      if (dirtyTabCountRef.current === 0) {
        // Clean state: the user explicitly chose to quit
        // the app, nothing in the buffer would be lost.
        // Go straight to the Rust `exit_app` command.
        onBeforeExitRef.current?.();
        void exitApp();
        return;
      }

      // Dirty: surface the existing AppCloseDialog. The
      // controller's `onNeedsConfirmation` wrapper flips
      // the ref first so the save / discard handlers end
      // with `exitApp` instead of `hideMainWindow`.
      appExitInProgressRef.current = true;
      onNeedsConfirmationRef.current();
    }).then((nextUnlisten) => {
      if (cancelled) {
        nextUnlisten();
        return;
      }

      unlisten = nextUnlisten;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [appExitInProgressRef]);
}
