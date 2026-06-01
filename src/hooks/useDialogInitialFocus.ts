import { useEffect } from "react";

type FocusableRef = {
  current: { focus: () => void } | null;
};

type UseDialogInitialFocusOptions = {
  appCloseCancelButtonRef: FocusableRef;
  closeTabCancelButtonRef: FocusableRef;
  pendingAppClose: boolean;
  pendingCloseTabOpen: boolean;
  preferencesCloseButtonRef: FocusableRef;
  preferencesOpen: boolean;
};

export function useDialogInitialFocus({
  appCloseCancelButtonRef,
  closeTabCancelButtonRef,
  pendingAppClose,
  pendingCloseTabOpen,
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

    if (preferencesOpen) {
      preferencesCloseButtonRef.current?.focus();
    }
  }, [
    appCloseCancelButtonRef,
    closeTabCancelButtonRef,
    pendingAppClose,
    pendingCloseTabOpen,
    preferencesCloseButtonRef,
    preferencesOpen,
  ]);
}
