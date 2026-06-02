import type { Dispatch, SetStateAction } from "react";
import type { EditorPaneHandle, MarkdownFormat } from "../components/EditorPane";
import type {
  EditorSettings,
  PreferencesDialogMode,
} from "../types";
import { useDialogInitialFocus } from "./useDialogInitialFocus";
import { useExternalChangeChecks } from "./document/useExternalChangeChecks";
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
  dirtyTabCount: number;
  editorPaneRef: RefValue<EditorPaneHandle>;
  findInputRef: RefValue<HTMLInputElement>;
  findVisible: boolean;
  modalOpen: boolean;
  onApplyMarkdownFormat: (format: MarkdownFormat) => void;
  onCancelAppClose: () => void;
  onCancelTabClose: () => void;
  onCheckTabForExternalChange: (tabId: string) => unknown;
  onCloseFindAndFocusEditor: () => void;
  onClosePreferences: () => void;
  onCloseSelectedImagePreview: () => void;
  onCreateNewFile: () => unknown;
  onFocusAdjacentTab: (direction: TabFocusDirection) => void;
  onFocusEditorSoon: () => void;
  onNeedsWindowCloseConfirmation: () => void;
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
  dirtyTabCount,
  editorPaneRef,
  findInputRef,
  findVisible,
  modalOpen,
  onApplyMarkdownFormat,
  onCancelAppClose,
  onCancelTabClose,
  onCheckTabForExternalChange,
  onCloseFindAndFocusEditor,
  onClosePreferences,
  onCloseSelectedImagePreview,
  onCreateNewFile,
  onFocusAdjacentTab,
  onFocusEditorSoon,
  onNeedsWindowCloseConfirmation,
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
    modalOpen,
    onCancelAppClose,
    onCancelTabClose,
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
