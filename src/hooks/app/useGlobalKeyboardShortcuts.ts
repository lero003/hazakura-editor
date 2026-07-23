import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { EditorPaneHandle, MarkdownFormat } from "../../components/editor/EditorPane";
import {
  isCommandAltArrowShortcut,
  isCommandAltShortcut,
  isCommandShiftShortcut,
  isCommandShortcut,
  isEditorKeyboardTarget,
  isImeComposing,
} from "../../lib/keyboard";
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
  globalSearchVisible: boolean;
  modalOpen: boolean;
  onApplyMarkdownFormat: (format: MarkdownFormat) => void;
  onCloseFindAndFocusEditor: () => void;
  onCloseSelectedImagePreview: () => void;
  onCreateNewFile: () => unknown;
  onFocusAdjacentTab: (direction: TabFocusDirection) => void;
  onFocusEditorSoon: () => void;
  onOpenCommandPalette: () => void;
  onOpenFile: () => unknown;
  onOpenGlobalSearch: () => void;
  onOpenWorkspace: () => unknown;
  onRequestCloseTab: (tabId: string) => void;
  onRequestWindowClose: () => unknown;
  onSaveActiveTab: () => unknown;
  onSaveActiveTabAs: () => unknown;
  /** Prefer this over flipping lModeEnabled directly (Markdown-only gate). */
  onToggleLMode?: () => void;
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
  globalSearchVisible,
  modalOpen,
  onApplyMarkdownFormat,
  onCloseFindAndFocusEditor,
  onCloseSelectedImagePreview,
  onCreateNewFile,
  onFocusAdjacentTab,
  onFocusEditorSoon,
  onOpenCommandPalette,
  onOpenFile,
  onOpenGlobalSearch,
  onOpenWorkspace,
  onRequestCloseTab,
  onRequestWindowClose,
  onSaveActiveTab,
  onSaveActiveTabAs,
  onToggleLMode,
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

      // The whole-book Reader is rendered above the editor but owns a
      // separate, bounded search corpus. Route Cmd+F to that visible surface
      // so the hidden editor find bar does not consume navigation commands.
      if (isCommandShortcut(event, "f")) {
        const readerSearch = globalThis.document.querySelector<HTMLInputElement>(
          "input[data-book-reader-search='true']",
        );
        if (readerSearch) {
          event.preventDefault();
          readerSearch.focus();
          readerSearch.select();
          return;
        }
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

      if (isCommandShiftShortcut(event, "p")) {
        // Command palette launcher. Gated on `!modalOpen` (already
        // checked at the top of the handler) so the palette is
        // never opened on top of a confirmation dialog, preferences
        // dialog, or the dirty-tab / app-close prompts. While the
        // palette is open the `commandPaletteVisible` flag is
        // included in `modalOpen` and the rest of the shortcuts
        // are no-ops; the palette handles its own keyboard input.
        event.preventDefault();
        onOpenCommandPalette();
        return;
      }

      if (isCommandShiftShortcut(event, "f")) {
        // Find-in-Files launcher. Sits next to the palette
        // shortcut on the keyboard (Cmd+Shift+F) so the muscle
        // memory mirrors the standard editor / IDE mapping. The
        // `globalSearchVisible` flag is folded into `modalOpen`
        // below, so the modal Esc / Tab guard already handles
        // priority and the rest of the shortcuts are no-ops while
        // the search modal is open.
        event.preventDefault();
        onOpenGlobalSearch();
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
        // Reserved to avoid WebView reload; the retired Review Desk
        // no longer opens from this shortcut.
        event.preventDefault();
        return;
      }

      if (isCommandShiftShortcut(event, "l")) {
        // L Mode (えるモード) toggle. Cmd+Shift+L was free in the
        // existing map. IME composition and modal open are already
        // bailed out at the top of this handler. Markdown-only gate
        // lives in onToggleLMode when provided.
        event.preventDefault();
        if (onToggleLMode) {
          onToggleLMode();
        } else {
          setEditorSettings((current) => ({
            ...current,
            lModeEnabled: !current.lModeEnabled,
          }));
        }
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
    globalSearchVisible,
    modalOpen,
    onApplyMarkdownFormat,
    onCloseFindAndFocusEditor,
    onCloseSelectedImagePreview,
    onCreateNewFile,
    onFocusAdjacentTab,
    onFocusEditorSoon,
    onOpenCommandPalette,
    onOpenFile,
    onOpenGlobalSearch,
    onOpenWorkspace,
    onRequestCloseTab,
    onRequestWindowClose,
    onSaveActiveTab,
    onSaveActiveTabAs,
    selectedImageOpen,
    setEditorSettings,
    setFindVisible,
    setPreferencesDialogMode,
    setPreviewVisible,
    setStatus,
  ]);
}
