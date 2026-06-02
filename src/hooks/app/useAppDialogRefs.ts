import { useRef } from "react";
import type { EditorTab, PreferencesDialogMode } from "../../types";

type UseAppDialogRefsOptions = {
  pendingAppClose: boolean;
  pendingCloseTab: EditorTab | null;
  preferencesDialogMode: PreferencesDialogMode | null;
};

export function useAppDialogRefs({
  pendingAppClose,
  pendingCloseTab,
  preferencesDialogMode,
}: UseAppDialogRefsOptions) {
  const closeTabDialogRef = useRef<HTMLElement | null>(null);
  const appCloseDialogRef = useRef<HTMLElement | null>(null);
  const preferencesDialogRef = useRef<HTMLElement | null>(null);
  const closeTabCancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const appCloseCancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const preferencesCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const allowWindowCloseRef = useRef(false);
  const discardingWindowCloseRef = useRef(false);
  const pendingCloseTabOpen = pendingCloseTab !== null;
  const preferencesOpen = preferencesDialogMode !== null;
  const modalOpen = pendingCloseTabOpen || pendingAppClose || preferencesOpen;

  return {
    allowWindowCloseRef,
    appCloseCancelButtonRef,
    appCloseDialogRef,
    closeTabCancelButtonRef,
    closeTabDialogRef,
    discardingWindowCloseRef,
    modalOpen,
    pendingCloseTabOpen,
    preferencesCloseButtonRef,
    preferencesDialogRef,
    preferencesOpen,
  };
}
