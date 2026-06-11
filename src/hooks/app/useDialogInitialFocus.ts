import { useEffect } from "react";

type FocusableRef = {
  current: { focus: () => void } | null;
};

type UseDialogInitialFocusOptions = {
  appCloseCancelButtonRef: FocusableRef;
  closeTabCancelButtonRef: FocusableRef;
  // v0.18 accessibility follow-up: the move-to-trash dialog
  // also gets initial focus on its Cancel button. The trash
  // flow is destructive and the only two buttons are Confirm
  // (which runs the irreversible Tauri command) and Cancel,
  // so landing on Cancel is the same safe default that the
  // v0.7 dirty-tab / app-close dialogs use.
  moveTrashCancelButtonRef: FocusableRef;
  pendingAppClose: boolean;
  pendingCloseTabOpen: boolean;
  pendingTrashOpen: boolean;
  preferencesCloseButtonRef: FocusableRef;
  preferencesOpen: boolean;
};

export function useDialogInitialFocus({
  appCloseCancelButtonRef,
  closeTabCancelButtonRef,
  moveTrashCancelButtonRef,
  pendingAppClose,
  pendingCloseTabOpen,
  pendingTrashOpen,
  preferencesCloseButtonRef,
  preferencesOpen,
}: UseDialogInitialFocusOptions) {
  useEffect(() => {
    if (pendingCloseTabOpen) {
      closeTabCancelButtonRef.current?.focus();
      return;
    }

    if (pendingAppClose) {
      appCloseCancelButtonRef.current?.focus();
      return;
    }

    // The move-to-trash dialog is rendered between the close
    // dialogs and the preferences dialog in `AppOverlays`, so
    // its initial-focus branch sits at the same level of the
    // chain. In practice only one of these booleans is true
    // at a time, but the explicit `return`s keep the chain
    // readable if a future flow ever overlaps them.
    if (pendingTrashOpen) {
      moveTrashCancelButtonRef.current?.focus();
      return;
    }

    if (preferencesOpen) {
      preferencesCloseButtonRef.current?.focus();
    }
  }, [
    appCloseCancelButtonRef,
    closeTabCancelButtonRef,
    moveTrashCancelButtonRef,
    pendingAppClose,
    pendingCloseTabOpen,
    pendingTrashOpen,
    preferencesCloseButtonRef,
    preferencesOpen,
  ]);
}
