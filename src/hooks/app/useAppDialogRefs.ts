import { useRef } from "react";
import type { EditorTab, PreferencesDialogMode } from "../../types";

type UseAppDialogRefsOptions = {
  pendingAppClose: boolean;
  pendingCloseTab: EditorTab | null;
  // v0.18 accessibility follow-up: the move-to-trash dialog
  // now owns a dialog ref and a cancel button ref, mirroring
  // the v0.7-era close / app-close dialogs. The pool no longer
  // needs to know about `pendingTrash` (the workspace file-ops
  // state) — the controller composes the final `modalOpen`
  // and forwards `pendingTrashOpen` to the keyboard guard and
  // the focus hook so this pool can stay decoupled from the
  // workspace hook type and destructured-order.
  preferencesDialogMode: PreferencesDialogMode | null;
};

export function useAppDialogRefs({
  pendingAppClose,
  pendingCloseTab,
  preferencesDialogMode,
}: UseAppDialogRefsOptions) {
  const closeTabDialogRef = useRef<HTMLElement | null>(null);
  const appCloseDialogRef = useRef<HTMLElement | null>(null);
  const epubExportDialogRef = useRef<HTMLElement | null>(null);
  const pdfExportDialogRef = useRef<HTMLElement | null>(null);
  const moveTrashDialogRef = useRef<HTMLElement | null>(null);
  const preferencesDialogRef = useRef<HTMLElement | null>(null);
  const closeTabCancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const appCloseCancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const epubExportCancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const pdfExportCancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const moveTrashCancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const preferencesCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const allowWindowCloseRef = useRef(false);
  const discardingWindowCloseRef = useRef(false);
  const pendingCloseTabOpen = pendingCloseTab !== null;
  const preferencesOpen = preferencesDialogMode !== null;
  // v0.7-era modal surface. The v0.18 move-to-trash dialog is
  // composed in by the controller before the keyboard guard
  // runs (see `useAppShellController.keyboardFocus.modalOpen`).
  const modalOpen = pendingCloseTabOpen || pendingAppClose || preferencesOpen;

  return {
    allowWindowCloseRef,
    appCloseCancelButtonRef,
    appCloseDialogRef,
    closeTabCancelButtonRef,
    closeTabDialogRef,
    discardingWindowCloseRef,
    epubExportCancelButtonRef,
    epubExportDialogRef,
    modalOpen,
    moveTrashCancelButtonRef,
    moveTrashDialogRef,
    pendingCloseTabOpen,
    pdfExportCancelButtonRef,
    pdfExportDialogRef,
    preferencesCloseButtonRef,
    preferencesDialogRef,
    preferencesOpen,
  };
}
