import { useEffect, useRef } from "react";
import { hideMainWindow, onCurrentWindowCloseRequested } from "../../lib/tauri";

type RefValue<T> = {
  current: T;
};

type UseWindowCloseConfirmationOptions = {
  allowWindowCloseRef: RefValue<boolean>;
  dirtyTabCount: number;
  onNeedsConfirmation: () => void;
};

// v0.15 macOS close-flow fix (round 3).
//
// On macOS the red button is the "close this window"
// affordance, not "quit the app". The flow is:
//   - clean (no dirty tabs) → preventDefault, then
//     `hideMainWindow` (Rust `WebviewWindow::hide()` →
//     `NSWindow.orderOut:` directly, bypassing the
//     `windowShouldClose:` gate and the `RunEvent::Exit`
//     path). The .app stays alive on the Dock.
//   - `allowWindowCloseRef.current === true` (set after the
//     user picked Save / Discard) → same path: preventDefault
//     and `hideMainWindow`.
//   - dirty → preventDefault, surface the save / discard /
//     cancel dialog via `onNeedsConfirmation`. The dialog
//     callback then sets `allowWindowCloseRef` and calls
//     `hideMainWindow` itself (see `useTabCloseFlow`).
//
// `Cmd+Q` (app-quit) is NOT routed through this hook — Tauri
// fires `RunEvent::ExitRequested` for it and the .app exits
// without going through `useWindowCloseConfirmation`.
export function useWindowCloseConfirmation({
  allowWindowCloseRef,
  dirtyTabCount,
  onNeedsConfirmation,
}: UseWindowCloseConfirmationOptions) {
  const dirtyTabCountRef = useRef(dirtyTabCount);
  const onNeedsConfirmationRef = useRef(onNeedsConfirmation);

  useEffect(() => {
    dirtyTabCountRef.current = dirtyTabCount;
    onNeedsConfirmationRef.current = onNeedsConfirmation;
  }, [dirtyTabCount, onNeedsConfirmation]);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | null = null;

    void onCurrentWindowCloseRequested(async (event) => {
      // Always preventDefault. Re-issuing `Window::close()`
      // or `Window::destroy()` after a preventDefault-ed
      // close request is unreliable on macOS (the
      // NSApplication records it as rejected). The teardown
      // must go through `hideMainWindow`, which calls
      // `NSWindow.orderOut:` directly.
      event.preventDefault();

      if (allowWindowCloseRef.current || dirtyTabCountRef.current === 0) {
        // Clean state, or the user already confirmed a
        // Save / Discard choice in the dialog and a follow-up
        // close request arrived: hide the window.
        await hideMainWindow();
        return;
      }

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
  }, [allowWindowCloseRef]);
}
