import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { EditorPaneHandle, MarkdownFormat } from "../../components/editor/EditorPane";
import {
  isCommandAltArrowShortcut,
  isCommandAltShortcut,
  isCommandShiftShortcut,
  isCommandShortcut,
  isEditorKeyboardTarget,
  isImeComposing,
} from "../../keyboard";
import type { EditorSettings, PreferencesDialogMode } from "../../types";

type RefValue<T> = {
  current: T | null;
};

type TabFocusDirection = "next" | "previous";

type UseGlobalKeyboardShortcutsOptions = {
  activeTabId: string | null;
  editorPaneRef: RefValue<EditorPaneHandle>;
  findInputRef: RefValue<HTMLInputElement>;
  findVisible: boolean;
  modalOpen: boolean;
  onApplyMarkdownFormat: (format: MarkdownFormat) => void;
  onCloseFindAndFocusEditor: () => void;
  onCloseSelectedImagePreview: () => void;
  onCreateNewFile: () => unknown;
  onFocusAdjacentTab: (direction: TabFocusDirection) => void;
  onFocusEditorSoon: () => void;
  onOpenFile: () => unknown;
  onOpenWorkspace: () => unknown;
  onRequestCloseTab: (tabId: string) => void;
  onRequestWindowClose: () => unknown;
  onSaveActiveTab: () => unknown;
  onSaveActiveTabAs: () => unknown;
  onToggleReviewDesk: () => void;
  selectedImageOpen: boolean;
  setEditorSettings: Dispatch<SetStateAction<EditorSettings>>;
  setFindVisible: Dispatch<SetStateAction<boolean>>;
  setPreferencesDialogMode: Dispatch<SetStateAction<PreferencesDialogMode | null>>;
  setPreviewVisible: Dispatch<SetStateAction<boolean>>;
  setStatus: Dispatch<SetStateAction<string>>;
};

export function useGlobalKeyboardShortcuts({
  activeTabId,
  editorPaneRef,
  findInputRef,
  findVisible,
  modalOpen,
  onApplyMarkdownFormat,
  onCloseFindAndFocusEditor,
  onCloseSelectedImagePreview,
  onCreateNewFile,
  onFocusAdjacentTab,
  onFocusEditorSoon,
  onOpenFile,
  onOpenWorkspace,
  onRequestCloseTab,
  onRequestWindowClose,
  onSaveActiveTab,
  onSaveActiveTabAs,
  onToggleReviewDesk,
  selectedImageOpen,
  setEditorSettings,
  setFindVisible,
  setPreferencesDialogMode,
  setPreviewVisible,
  setStatus,
}: UseGlobalKeyboardShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isImeComposing(event)) {
        return;
      }

      if (modalOpen) {
        return;
      }

      if (event.key === "Escape" && findVisible) {
        event.preventDefault();
        onCloseFindAndFocusEditor();
        return;
      }

      if (isCommandShortcut(event, ",")) {
        event.preventDefault();
        setPreferencesDialogMode("settings");
        return;
      }

      if (isCommandAltShortcut(event, "p")) {
        event.preventDefault();
        setPreviewVisible((current) => !current);
        return;
      }

      if (isCommandAltShortcut(event, "w")) {
        event.preventDefault();
        setEditorSettings((current) => ({
          ...current,
          wrapLines: !current.wrapLines,
        }));
        return;
      }

      if (isCommandAltShortcut(event, "i")) {
        event.preventDefault();
        setEditorSettings((current) => ({
          ...current,
          showInvisibles: !current.showInvisibles,
        }));
        return;
      }

      if (isCommandShiftShortcut(event, "r")) {
        // Review Desk entry point. Cmd+Shift+R toggles the v0.7
        // review surface that replaces the editor area. IME
        // composition and modal open are already bailed out at the
        // top of this handler. See
        // docs/reviews/v0.7-review-desk-design-decisions.md (B-3, R-4).
        event.preventDefault();
        onToggleReviewDesk();
        return;
      }

      if (isCommandShiftShortcut(event, "w")) {
        event.preventDefault();
        void onRequestWindowClose();
        return;
      }

      if (isCommandShiftShortcut(event, "s")) {
        event.preventDefault();
        void onSaveActiveTabAs();
        return;
      }

      if (
        isEditorKeyboardTarget(event.target) &&
        isCommandShortcut(event, "b")
      ) {
        event.preventDefault();
        onApplyMarkdownFormat("bold");
        return;
      }

      if (
        isEditorKeyboardTarget(event.target) &&
        isCommandShortcut(event, "i")
      ) {
        event.preventDefault();
        onApplyMarkdownFormat("italic");
        return;
      }

      if (
        isEditorKeyboardTarget(event.target) &&
        isCommandShortcut(event, "e")
      ) {
        event.preventDefault();
        onApplyMarkdownFormat("code");
        return;
      }

      if (
        isEditorKeyboardTarget(event.target) &&
        isCommandShortcut(event, "k")
      ) {
        event.preventDefault();
        onApplyMarkdownFormat("link");
        return;
      }

      if (
        isEditorKeyboardTarget(event.target) &&
        isCommandShiftShortcut(event, "t")
      ) {
        event.preventDefault();
        editorPaneRef.current?.insertTable(3);
        return;
      }

      if (isCommandShortcut(event, "s")) {
        event.preventDefault();
        void onSaveActiveTab();
        return;
      }

      if (isCommandShortcut(event, "n")) {
        event.preventDefault();
        void onCreateNewFile();
        return;
      }

      if (isCommandShortcut(event, "f")) {
        event.preventDefault();
        setFindVisible(true);
        setTimeout(() => {
          findInputRef.current?.focus();
          findInputRef.current?.select();
        }, 50);
        return;
      }

      if (isCommandShortcut(event, "o")) {
        event.preventDefault();

        if (event.shiftKey) {
          void onOpenWorkspace();
        } else {
          void onOpenFile();
        }

        return;
      }

      if (isCommandAltArrowShortcut(event)) {
        event.preventDefault();
        onFocusAdjacentTab(event.key === "ArrowRight" ? "next" : "previous");
        return;
      }

      if (isCommandShortcut(event, "w")) {
        event.preventDefault();

        if (selectedImageOpen) {
          onCloseSelectedImagePreview();
        } else if (activeTabId) {
          onRequestCloseTab(activeTabId);
        } else {
          setStatus("No active tab to close");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [
    activeTabId,
    editorPaneRef,
    findInputRef,
    findVisible,
    modalOpen,
    onApplyMarkdownFormat,
    onCloseFindAndFocusEditor,
    onCloseSelectedImagePreview,
    onCreateNewFile,
    onFocusAdjacentTab,
    onFocusEditorSoon,
    onOpenFile,
    onOpenWorkspace,
    onRequestCloseTab,
    onRequestWindowClose,
    onSaveActiveTab,
    onSaveActiveTabAs,
    onToggleReviewDesk,
    selectedImageOpen,
    setEditorSettings,
    setFindVisible,
    setPreferencesDialogMode,
    setPreviewVisible,
    setStatus,
  ]);
}
