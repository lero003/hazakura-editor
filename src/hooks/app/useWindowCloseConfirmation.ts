import { useEffect, useRef } from "react";
import { hideMainWindow, onCurrentWindowCloseRequested } from "../../lib/tauri";

type RefValue<T> = {
  current: T;
};

type UseWindowCloseConfirmationOptions = {
  allowWindowCloseRef: RefValue<boolean>;
  dirtyTabCount: number;
  onNeedsConfirmation: () => void;
  // Called right before the window is hidden on the clean close
  // path. Used to stop an in-flight Hazakura Local Assist
  // generation so the helper is not left running behind a hidden
  // window. Best-effort: if it throws, the hide still proceeds.
  onBeforeHide?: () => Promise<void> | void;
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
  onBeforeHide,
}: UseWindowCloseConfirmationOptions) {
  const dirtyTabCountRef = useRef(dirtyTabCount);
  const onNeedsConfirmationRef = useRef(onNeedsConfirmation);
  const onBeforeHideRef = useRef(onBeforeHide);

  useEffect(() => {
    dirtyTabCountRef.current = dirtyTabCount;
    onNeedsConfirmationRef.current = onNeedsConfirmation;
    onBeforeHideRef.current = onBeforeHide;
  }, [dirtyTabCount, onNeedsConfirmation, onBeforeHide]);

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
        // close request arrived: hide the window. Stop any
        // in-flight Local Assist generation first so the
        // helper is not left running behind a hidden window.
        await onBeforeHideRef.current?.();
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
