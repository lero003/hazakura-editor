import { useEffect } from "react";
import { trapFocusInElement } from "../focusTrap";
import { isImeComposing } from "../keyboard";

type RefValue<T> = {
  current: T | null;
};

type UseModalKeyboardGuardOptions = {
  appCloseDialogRef: RefValue<HTMLElement>;
  closeTabDialogRef: RefValue<HTMLElement>;
  modalOpen: boolean;
  onCancelAppClose: () => void;
  onCancelTabClose: () => void;
  onClosePreferences: () => void;
  pendingAppClose: boolean;
  pendingCloseTabOpen: boolean;
  preferencesDialogRef: RefValue<HTMLElement>;
  preferencesOpen: boolean;
};

export function useModalKeyboardGuard({
  appCloseDialogRef,
  closeTabDialogRef,
  modalOpen,
  onCancelAppClose,
  onCancelTabClose,
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

        if (pendingCloseTabOpen) {
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
    modalOpen,
    onCancelAppClose,
    onCancelTabClose,
    onClosePreferences,
    pendingAppClose,
    pendingCloseTabOpen,
    preferencesDialogRef,
    preferencesOpen,
  ]);
}
