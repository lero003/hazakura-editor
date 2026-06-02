import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
} from "react";
import type { EditorPaneHandle } from "../../components/editor/EditorPane";
import { closeCurrentWindow } from "../../tauri";
import type { PreferencesDialogMode } from "../../types";

type UseWindowDialogActionsOptions = {
  editorPaneRef: RefObject<EditorPaneHandle | null>;
  setGlobalError: Dispatch<SetStateAction<string | null>>;
  setPendingAppClose: Dispatch<SetStateAction<boolean>>;
  setPendingCloseTabId: Dispatch<SetStateAction<string | null>>;
  setPreferencesDialogMode: Dispatch<
    SetStateAction<PreferencesDialogMode | null>
  >;
  setStatus: Dispatch<SetStateAction<string>>;
};

export function useWindowDialogActions({
  editorPaneRef,
  setGlobalError,
  setPendingAppClose,
  setPendingCloseTabId,
  setPreferencesDialogMode,
  setStatus,
}: UseWindowDialogActionsOptions) {
  const focusEditorSoon = useCallback(() => {
    window.requestAnimationFrame(() => {
      editorPaneRef.current?.focus();
    });
  }, [editorPaneRef]);

  const cancelPendingTabClose = useCallback(() => {
    setPendingCloseTabId(null);
    setStatus("Close cancelled");
    focusEditorSoon();
  }, [focusEditorSoon, setPendingCloseTabId, setStatus]);

  const cancelPendingAppClose = useCallback(() => {
    setPendingAppClose(false);
    setStatus("Close cancelled");
    focusEditorSoon();
  }, [focusEditorSoon, setPendingAppClose, setStatus]);

  const closePreferencesFromKeyboard = useCallback(() => {
    setPreferencesDialogMode(null);
    focusEditorSoon();
  }, [focusEditorSoon, setPreferencesDialogMode]);

  const requestAppCloseConfirmation = useCallback(() => {
    setPendingAppClose(true);
    setStatus("Close needs confirmation");
  }, [setPendingAppClose, setStatus]);

  const requestWindowClose = useCallback(async () => {
    setStatus("Closing window...");

    try {
      await closeCurrentWindow();
    } catch (err) {
      setGlobalError(`Close failed: ${String(err)}`);
      setStatus("Close failed");
    }
  }, [setGlobalError, setStatus]);

  return {
    cancelPendingAppClose,
    cancelPendingTabClose,
    closePreferencesFromKeyboard,
    focusEditorSoon,
    requestAppCloseConfirmation,
    requestWindowClose,
  };
}
