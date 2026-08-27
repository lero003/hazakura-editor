import type { Dispatch, SetStateAction } from "react";

/**
 * The right column is one surface: Reference XOR Preview / e-book /
 * Outline / Diff. Opening the side pane hides Reference (session stays
 * loaded). Closing the side pane does not discard or restore Reference.
 */
export function bindExclusiveSidePaneOpen(
  setSidePaneOpen: Dispatch<SetStateAction<boolean>>,
  hideReference: () => void,
): Dispatch<SetStateAction<boolean>> {
  return (update) => {
    if (typeof update === "function") {
      setSidePaneOpen((prev) => {
        const next = update(prev);
        if (next) {
          hideReference();
        }
        return next;
      });
      return;
    }
    if (update) {
      hideReference();
    }
    setSidePaneOpen(update);
  };
}
