import { useEffect } from "react";
import { onCurrentWindowCloseRequested } from "../../lib/tauri";

type RefValue<T> = {
  current: T;
};

type UseWindowCloseConfirmationOptions = {
  allowWindowCloseRef: RefValue<boolean>;
  dirtyTabCount: number;
  onNeedsConfirmation: () => void;
};

export function useWindowCloseConfirmation({
  allowWindowCloseRef,
  dirtyTabCount,
  onNeedsConfirmation,
}: UseWindowCloseConfirmationOptions) {
  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | null = null;

    void onCurrentWindowCloseRequested((event) => {
      if (allowWindowCloseRef.current || dirtyTabCount === 0) {
        return;
      }

      event.preventDefault();
      onNeedsConfirmation();
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
  }, [allowWindowCloseRef, dirtyTabCount, onNeedsConfirmation]);
}
