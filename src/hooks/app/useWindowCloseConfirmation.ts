import { useEffect, useRef } from "react";
import { onCurrentWindowCloseRequested } from "../../lib/tauri";

type RefValue<T> = {
  current: T;
};

type UseWindowCloseConfirmationOptions = {
  allowWindowCloseRef: RefValue<boolean>;
  dirtyTabCount: number;
  onNeedsConfirmation: () => void;
};

// v0.15 close-flow fix.
//
// The previous shape always called `event.preventDefault()`
// and then re-issued a window destruction
// (`destroyCurrentWindow()`) on the next macOS event loop
// tick. On macOS, once the original close request has
// been preventDefault-ed it is recorded as "rejected" and
// the subsequent `destroy()` command does not actually
// close the NSWindow — the .app stays open with
// `windowShouldClose: prevented close` in the log and the
// window count never drops from 1 to 0.
//
// The fix is to let the close request propagate when there
// is nothing for the user to confirm:
//   - clean state (no dirty tabs) → return without
//     preventDefault, so macOS closes the window directly
//   - `allowWindowCloseRef` is set (e.g. after the user
//     picked Save / Discard in the confirmation dialog) →
//     same path: return without preventDefault
//   - dirty state → preventDefault and surface the
//     confirmation dialog via `onNeedsConfirmation`; the
//     dialog then sets `allowWindowCloseRef` and re-issues
//     `closeCurrentWindow()` (or a destruction in the
//     discard / error path) so macOS sees a second, clean
//     close request it can act on.
//
// `destroyCurrentWindow` is no longer needed from this
// hook — the close request path itself is the right
// primitive once we stop preventDefault-ing it
// unconditionally. Callers that need a hard destruction
// (e.g. `useTabCloseFlow` after save/discard error recovery)
// still import it directly.
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
      // Only intercept the close when we actually need the
      // user to make a save / discard / cancel decision.
      // Letting the other paths return without
      // preventDefault lets macOS close the window directly.
      if (
        !allowWindowCloseRef.current &&
        dirtyTabCountRef.current > 0
      ) {
        event.preventDefault();
        onNeedsConfirmationRef.current();
        return;
      }
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
