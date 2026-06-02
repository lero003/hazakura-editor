import type { Dispatch, SetStateAction } from "react";
import type { EditorPaneHandle, MarkdownFormat } from "../../components/editor/EditorPane";
import type {
  EditorSettings,
  PreferencesDialogMode,
} from "../../types";
import { useDialogInitialFocus } from "./useDialogInitialFocus";
import { useExternalChangeChecks } from "../document/useExternalChangeChecks";
import { useGlobalKeyboardShortcuts } from "./useGlobalKeyboardShortcuts";
import { useModalKeyboardGuard } from "./useModalKeyboardGuard";
import { useWindowCloseConfirmation } from "./useWindowCloseConfirmation";

type RefValue<T> = {
  current: T | null;
};

type BooleanRef = {
  current: boolean;
};

type TabFocusDirection = "next" | "previous";

type UseAppKeyboardFocusEffectsOptions = {
  activeAgentSession: boolean;
  activeTabId: string | null;
  agentUiSuspendedRef: BooleanRef;
  allowWindowCloseRef: BooleanRef;
  appCloseCancelButtonRef: RefValue<{ focus: () => void }>;
  appCloseDialogRef: RefValue<HTMLElement>;
  closeTabCancelButtonRef: RefValue<{ focus: () => void }>;
  closeTabDialogRef: RefValue<HTMLElement>;
  commandPaletteVisible: boolean;
  dirtyTabCount: number;
  editorPaneRef: RefValue<EditorPaneHandle>;
  findInputRef: RefValue<HTMLInputElement>;
  findVisible: boolean;
  modalOpen: boolean;
  onApplyMarkdownFormat: (format: MarkdownFormat) => void;
  onCancelAppClose: () => void;
  onCancelTabClose: () => void;
  onCheckTabForExternalChange: (tabId: string) => unknown;
  onCloseCommandPalette: () => void;
  onCloseFindAndFocusEditor: () => void;
  onClosePreferences: () => void;
  onCloseSelectedImagePreview: () => void;
  onCreateNewFile: () => unknown;
  onFocusAdjacentTab: (direction: TabFocusDirection) => void;
  onFocusEditorSoon: () => void;
  onNeedsWindowCloseConfirmation: () => void;
  onOpenCommandPalette: () => void;
  onOpenFile: () => unknown;
  onOpenWorkspace: () => unknown;
  onRequestCloseTab: (tabId: string) => void;
  onRequestWindowClose: () => unknown;
  onSaveActiveTab: () => unknown;
  onSaveActiveTabAs: () => unknown;
  onToggleReviewDesk: () => void;
  pendingAppClose: boolean;
  pendingCloseTabOpen: boolean;
  preferencesCloseButtonRef: RefValue<{ focus: () => void }>;
  preferencesDialogRef: RefValue<HTMLElement>;
  preferencesOpen: boolean;
  selectedImageOpen: boolean;
  setEditorSettings: Dispatch<SetStateAction<EditorSettings>>;
  setFindVisible: Dispatch<SetStateAction<boolean>>;
  setPreferencesDialogMode: Dispatch<SetStateAction<PreferencesDialogMode | null>>;
  setPreviewVisible: Dispatch<SetStateAction<boolean>>;
  setStatus: Dispatch<SetStateAction<string>>;
};

export function useAppKeyboardFocusEffects({
  activeAgentSession,
  activeTabId,
  agentUiSuspendedRef,
  allowWindowCloseRef,
  appCloseCancelButtonRef,
  appCloseDialogRef,
  closeTabCancelButtonRef,
  closeTabDialogRef,
  commandPaletteVisible,
  dirtyTabCount,
  editorPaneRef,
  findInputRef,
  findVisible,
  modalOpen,
  onApplyMarkdownFormat,
  onCancelAppClose,
  onCancelTabClose,
  onCheckTabForExternalChange,
  onCloseCommandPalette,
  onCloseFindAndFocusEditor,
  onClosePreferences,
  onCloseSelectedImagePreview,
  onCreateNewFile,
  onFocusAdjacentTab,
  onFocusEditorSoon,
  onNeedsWindowCloseConfirmation,
  onOpenCommandPalette,
  onOpenFile,
  onOpenWorkspace,
  onRequestCloseTab,
  onRequestWindowClose,
  onSaveActiveTab,
  onSaveActiveTabAs,
  onToggleReviewDesk,
  pendingAppClose,
  pendingCloseTabOpen,
  preferencesCloseButtonRef,
  preferencesDialogRef,
  preferencesOpen,
  selectedImageOpen,
  setEditorSettings,
  setFindVisible,
  setPreferencesDialogMode,
  setPreviewVisible,
  setStatus,
}: UseAppKeyboardFocusEffectsOptions) {
  // The command palette is a modal-shaped surface: it captures
  // global input while open, so any other shortcut should be
  // ignored. Combine the palette-visible flag with the existing
  // `modalOpen` (preferences / dirty-tab / app-close dialogs) so
  // the global shortcut handler bails out and the modal Esc / Tab
  // guard fires. The individual flags are still threaded through
  // so the guard can prioritise palette > close-tab > app-close
  // > preferences when multiple are open.
  const anyModalOpen = modalOpen || commandPaletteVisible;

  useWindowCloseConfirmation({
    allowWindowCloseRef,
    dirtyTabCount,
    onNeedsConfirmation: onNeedsWindowCloseConfirmation,
  });

  useExternalChangeChecks({
    activeAgentSession,
    activeTabId,
    agentUiSuspendedRef,
    onCheckTabForExternalChange,
  });

  useModalKeyboardGuard({
    appCloseDialogRef,
    closeTabDialogRef,
    commandPaletteVisible,
    modalOpen: anyModalOpen,
    onCancelAppClose,
    onCancelTabClose,
    onCloseCommandPalette,
    onClosePreferences,
    pendingAppClose,
    pendingCloseTabOpen,
    preferencesDialogRef,
    preferencesOpen,
  });

  useGlobalKeyboardShortcuts({
    activeTabId,
    editorPaneRef,
    findInputRef,
    findVisible,
    modalOpen: anyModalOpen,
    onApplyMarkdownFormat,
    onCloseFindAndFocusEditor,
    onCloseSelectedImagePreview,
    onCreateNewFile,
    onFocusAdjacentTab,
    onFocusEditorSoon,
    onOpenCommandPalette,
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
  });

  useDialogInitialFocus({
    appCloseCancelButtonRef,
    closeTabCancelButtonRef,
    pendingAppClose,
    pendingCloseTabOpen,
    preferencesCloseButtonRef,
    preferencesOpen,
  });
}
