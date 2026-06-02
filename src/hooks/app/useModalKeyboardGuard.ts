import { useEffect } from "react";
import { trapFocusInElement } from "../../lib/focusTrap";
import { isImeComposing } from "../../lib/keyboard";

type RefValue<T> = {
  current: T | null;
};

type UseModalKeyboardGuardOptions = {
  appCloseDialogRef: RefValue<HTMLElement>;
  closeTabDialogRef: RefValue<HTMLElement>;
  commandPaletteVisible: boolean;
  modalOpen: boolean;
  onCancelAppClose: () => void;
  onCancelTabClose: () => void;
  onCloseCommandPalette: () => void;
  onClosePreferences: () => void;
  pendingAppClose: boolean;
  pendingCloseTabOpen: boolean;
  preferencesDialogRef: RefValue<HTMLElement>;
  preferencesOpen: boolean;
};

export function useModalKeyboardGuard({
  appCloseDialogRef,
  closeTabDialogRef,
  commandPaletteVisible,
  modalOpen,
  onCancelAppClose,
  onCancelTabClose,
  onCloseCommandPalette,
  onClosePreferences,
  pendingAppClose,
  pendingCloseTabOpen,
  preferencesDialogRef,
  preferencesOpen,
}: UseModalKeyboardGuardOptions) {
  useEffect(() => {
    if (!modalOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isImeComposing(event)) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();

        // The command palette is the most-recent / topmost modal
        // surface in the v0.8 daily-editor layer; it should close
        // before any other modal priority is checked.
        if (commandPaletteVisible) {
          onCloseCommandPalette();
        } else if (pendingCloseTabOpen) {
          onCancelTabClose();
        } else if (pendingAppClose) {
          onCancelAppClose();
        } else if (preferencesOpen) {
          onClosePreferences();
        }
      }

      if (event.key === "Tab") {
        trapFocusInElement(
          pendingCloseTabOpen
            ? closeTabDialogRef.current
            : pendingAppClose
              ? appCloseDialogRef.current
              : preferencesDialogRef.current,
          event,
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [
    appCloseDialogRef,
    closeTabDialogRef,
    commandPaletteVisible,
    modalOpen,
    onCancelAppClose,
    onCancelTabClose,
    onCloseCommandPalette,
    onClosePreferences,
    pendingAppClose,
    pendingCloseTabOpen,
    preferencesDialogRef,
    preferencesOpen,
  ]);
}
