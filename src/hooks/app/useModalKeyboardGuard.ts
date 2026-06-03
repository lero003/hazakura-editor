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
  globalSearchVisible: boolean;
  modalOpen: boolean;
  onCancelAppClose: () => void;
  onCancelTabClose: () => void;
  onCloseCommandPalette: () => void;
  onCloseGlobalSearch: () => void;
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
  globalSearchVisible,
  modalOpen,
  onCancelAppClose,
  onCancelTabClose,
  onCloseCommandPalette,
  onCloseGlobalSearch,
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

        // The command palette and global search are the
        // most-recent / topmost modal surfaces in the v0.8
        // daily-editor layer; they should close before any
        // other modal priority is checked. The palette is
        // checked first so a user that opened palette over
        // search can close them one at a time with Esc.
        if (commandPaletteVisible) {
          onCloseCommandPalette();
        } else if (globalSearchVisible) {
          onCloseGlobalSearch();
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
    globalSearchVisible,
    modalOpen,
    onCancelAppClose,
    onCancelTabClose,
    onCloseCommandPalette,
    onCloseGlobalSearch,
    onClosePreferences,
    pendingAppClose,
    pendingCloseTabOpen,
    preferencesDialogRef,
    preferencesOpen,
  ]);
}
