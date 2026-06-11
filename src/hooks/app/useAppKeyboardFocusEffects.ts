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
  // v0.18 accessibility follow-up: the move-to-trash dialog
  // joins the central focus and keyboard guard alongside the
  // dirty-tab / app-close / preferences dialogs. `modalOpen`
  // and the per-dialog focus targets must reach both
  // `useDialogInitialFocus` and `useModalKeyboardGuard` here
  // so the trash dialog can land focus on Cancel, trap Tab,
  // and route Esc back to `cancelPendingTrash`.
  moveTrashCancelButtonRef: RefValue<{ focus: () => void }>;
  moveTrashDialogRef: RefValue<HTMLElement>;
  commandPaletteVisible: boolean;
  dirtyTabCount: number;
  editorPaneRef: RefValue<EditorPaneHandle>;
  findInputRef: RefValue<HTMLInputElement>;
  findVisible: boolean;
  globalSearchVisible: boolean;
  modalOpen: boolean;
  onApplyMarkdownFormat: (format: MarkdownFormat) => void;
  onCancelAppClose: () => void;
  onCancelPendingTrash: () => void;
  onCancelTabClose: () => void;
  onCheckTabForExternalChange: (tabId: string) => unknown;
  onCloseCommandPalette: () => void;
  onCloseFindAndFocusEditor: () => void;
  onCloseGlobalSearch: () => void;
  onClosePreferences: () => void;
  onCloseSelectedImagePreview: () => void;
  onCreateNewFile: () => unknown;
  onFocusAdjacentTab: (direction: TabFocusDirection) => void;
  onFocusEditorSoon: () => void;
  onNeedsWindowCloseConfirmation: () => void;
  onOpenCommandPalette: () => void;
  onOpenFile: () => unknown;
  onOpenGlobalSearch: () => void;
  onOpenWorkspace: () => unknown;
  onRequestCloseTab: (tabId: string) => void;
  onRequestWindowClose: () => unknown;
  onSaveActiveTab: () => unknown;
  onSaveActiveTabAs: () => unknown;
  pendingAppClose: boolean;
  pendingCloseTabOpen: boolean;
  pendingTrashOpen: boolean;
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
  moveTrashCancelButtonRef,
  moveTrashDialogRef,
  commandPaletteVisible,
  dirtyTabCount,
  editorPaneRef,
  findInputRef,
  findVisible,
  globalSearchVisible,
  modalOpen,
  onApplyMarkdownFormat,
  onCancelAppClose,
  onCancelPendingTrash,
  onCancelTabClose,
  onCheckTabForExternalChange,
  onCloseCommandPalette,
  onCloseFindAndFocusEditor,
  onCloseGlobalSearch,
  onClosePreferences,
  onCloseSelectedImagePreview,
  onCreateNewFile,
  onFocusAdjacentTab,
  onFocusEditorSoon,
  onNeedsWindowCloseConfirmation,
  onOpenCommandPalette,
  onOpenFile,
  onOpenGlobalSearch,
  onOpenWorkspace,
  onRequestCloseTab,
  onRequestWindowClose,
  onSaveActiveTab,
  onSaveActiveTabAs,
  pendingAppClose,
  pendingCloseTabOpen,
  pendingTrashOpen,
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
  // The command palette and global search are modal-shaped
  // surfaces: each captures global input while open, so any
  // other shortcut should be ignored. Combine the visible flags
  // with the existing `modalOpen` (preferences / dirty-tab /
  // app-close dialogs) so the global shortcut handler bails
  // out and the modal Esc / Tab guard fires. The individual
  // flags are still threaded through so the guard can
  // prioritise palette > search > close-tab > app-close >
  // preferences when multiple are open.
  const anyModalOpen = modalOpen || commandPaletteVisible || globalSearchVisible;

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
    globalSearchVisible,
    modalOpen: anyModalOpen,
    moveTrashDialogRef,
    onCancelAppClose,
    onCancelPendingTrash,
    onCancelTabClose,
    onCloseCommandPalette,
    onCloseGlobalSearch,
    onClosePreferences,
    pendingAppClose,
    pendingCloseTabOpen,
    pendingTrashOpen,
    preferencesDialogRef,
    preferencesOpen,
  });

  useGlobalKeyboardShortcuts({
    activeTabId,
    editorPaneRef,
    findInputRef,
    findVisible,
    globalSearchVisible,
    modalOpen: anyModalOpen,
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
  });

  useDialogInitialFocus({
    appCloseCancelButtonRef,
    closeTabCancelButtonRef,
    moveTrashCancelButtonRef,
    pendingAppClose,
    pendingCloseTabOpen,
    pendingTrashOpen,
    preferencesCloseButtonRef,
    preferencesOpen,
  });
}
