import { useEffect } from "react";
import { trapFocusInElement } from "../../lib/focusTrap";
import { isImeComposing } from "../../lib/keyboard";

type RefValue<T> = {
  current: T | null;
};

type UseModalKeyboardGuardOptions = {
  appCloseDialogRef: RefValue<HTMLElement>;
  assistDiscardDialogRef: RefValue<HTMLElement>;
  closeTabDialogRef: RefValue<HTMLElement>;
  commandPaletteVisible: boolean;
  epubExportDialogRef: RefValue<HTMLElement>;
  epubExportSettingsOpen: boolean;
  pdfExportDialogRef: RefValue<HTMLElement>;
  pdfExportSettingsOpen: boolean;
  globalSearchVisible: boolean;
  okfReviewVisible: boolean;
  modalOpen: boolean;
  // v0.18 accessibility follow-up: the move-to-trash dialog
  // joins the Esc and Tab priority chain at the same level as
  // the dirty-tab / app-close dialogs. The Tauri trash command
  // is irreversible from the app's perspective, so Esc must
  // route to the same cancel handler the Cancel button uses.
  moveTrashDialogRef: RefValue<HTMLElement>;
  onCancelAppClose: () => void;
  onCancelAssistDiscard: () => void;
  onCancelEpubBetaExport: () => void;
  onCancelPdfExport: () => void;
  onCancelPendingTrash: () => void;
  onCancelTabClose: () => void;
  onCloseCommandPalette: () => void;
  onCloseGlobalSearch: () => void;
  onCloseOkfReview: () => void;
  onClosePreferences: () => void;
  pendingAppClose: boolean;
  pendingAssistDiscardOpen: boolean;
  pendingCloseTabOpen: boolean;
  pendingTrashOpen: boolean;
  preferencesDialogRef: RefValue<HTMLElement>;
  preferencesOpen: boolean;
};

export function useModalKeyboardGuard({
  appCloseDialogRef,
  assistDiscardDialogRef,
  closeTabDialogRef,
  commandPaletteVisible,
  epubExportDialogRef,
  epubExportSettingsOpen,
  pdfExportDialogRef,
  pdfExportSettingsOpen,
  globalSearchVisible,
  okfReviewVisible,
  modalOpen,
  moveTrashDialogRef,
  onCancelAppClose,
  onCancelAssistDiscard,
  onCancelEpubBetaExport,
  onCancelPdfExport,
  onCancelPendingTrash,
  onCancelTabClose,
  onCloseCommandPalette,
  onCloseGlobalSearch,
  onCloseOkfReview,
  onClosePreferences,
  pendingAppClose,
  pendingAssistDiscardOpen,
  pendingCloseTabOpen,
  pendingTrashOpen,
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
        // The move-to-trash dialog sits at the same level as
        // the close / app-close dialogs: it is a destructive
        // confirmation that must always be cancellable from
        // the keyboard regardless of which other modal
        // surface is open.
        if (commandPaletteVisible) {
          onCloseCommandPalette();
        } else if (globalSearchVisible) {
          onCloseGlobalSearch();
        } else if (okfReviewVisible) {
          onCloseOkfReview();
        } else if (pendingCloseTabOpen) {
          onCancelTabClose();
        } else if (pendingAppClose) {
          onCancelAppClose();
        } else if (pendingTrashOpen) {
          onCancelPendingTrash();
        } else if (pendingAssistDiscardOpen) {
          onCancelAssistDiscard();
        } else if (pdfExportSettingsOpen) {
          onCancelPdfExport();
        } else if (epubExportSettingsOpen) {
          onCancelEpubBetaExport();
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
              : pendingTrashOpen
                ? moveTrashDialogRef.current
                : pendingAssistDiscardOpen
                  ? assistDiscardDialogRef.current
                  : pdfExportSettingsOpen
                    ? pdfExportDialogRef.current
                  : epubExportSettingsOpen
                    ? epubExportDialogRef.current
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
    assistDiscardDialogRef,
    closeTabDialogRef,
    commandPaletteVisible,
    epubExportDialogRef,
    epubExportSettingsOpen,
    globalSearchVisible,
    okfReviewVisible,
    modalOpen,
    moveTrashDialogRef,
    onCancelAppClose,
    onCancelAssistDiscard,
    onCancelEpubBetaExport,
    onCancelPdfExport,
    onCancelPendingTrash,
    onCancelTabClose,
    onCloseCommandPalette,
    onCloseGlobalSearch,
    onCloseOkfReview,
    onClosePreferences,
    pendingAppClose,
    pendingAssistDiscardOpen,
    pendingCloseTabOpen,
    pendingTrashOpen,
    pdfExportDialogRef,
    pdfExportSettingsOpen,
    preferencesDialogRef,
    preferencesOpen,
  ]);
}
