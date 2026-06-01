import type {
  Dispatch,
  RefObject,
  SetStateAction,
} from "react";
import type {
  AgentWorkbenchCopy,
  PreferencesCopy,
  RecoveryCopy,
} from "../locale";
import type {
  AgentWorkbenchProvider,
  AgentWorkbenchSession,
  WorkspaceTreeEntry,
} from "../tauri";
import type {
  CompareAnchor,
  DraftRecord,
  EditorSettings,
  EditorTab,
  MenuLanguage,
  PreferencesDialogMode,
  ThemePreference,
  WorkspaceContextMenuState,
} from "../types";
import { agentSessionStateLabel, providerLabel } from "../utils";
import { QuickOpen } from "./QuickOpen";
import { WorkspaceContextMenu } from "./WorkspaceContextMenu";
import { AppCloseDialog, DirtyTabCloseDialog } from "./CloseDialogs";
import { PreferencesDialog } from "./PreferencesDialog";
import { SettingsPreferencesPane } from "./SettingsPreferencesPane";
import { AgentWorkbenchPreferencesPane } from "./AgentWorkbenchPreferencesPane";

type AppOverlaysProps = {
  activeAgentSession: boolean;
  activeTab: EditorTab | null;
  agentSession: AgentWorkbenchSession | null;
  agentWorkbenchActive: boolean;
  agentWorkbenchConsent: boolean;
  agentWorkbenchCopy: AgentWorkbenchCopy;
  agentWorkbenchPreference: boolean;
  agentWorkbenchProvider: AgentWorkbenchProvider;
  agentWorkbenchRestartRequired: boolean;
  appCloseCancelButtonRef: RefObject<HTMLButtonElement | null>;
  appCloseDialogRef: RefObject<HTMLElement | null>;
  appRestartPending: boolean;
  cancelPendingAppClose: () => void;
  cancelPendingTabClose: () => void;
  clearCompareSource: () => void;
  closePreferencesFromKeyboard: () => void;
  closeQuickOpen: () => void;
  closeTabCancelButtonRef: RefObject<HTMLButtonElement | null>;
  closeTabDialogRef: RefObject<HTMLElement | null>;
  closeTabNow: (tabId: string) => void;
  closeWorkspaceContextMenu: () => void;
  compareAnchor: CompareAnchor | null;
  compareWorkspaceFiles: (file: CompareAnchor) => void | Promise<void>;
  copyWorkspaceFullPath: (file: CompareAnchor) => void | Promise<void>;
  dirtyTabCount: number;
  discardAllAndCloseWindow: () => void;
  editorSettings: EditorSettings;
  menuLanguage: MenuLanguage;
  openWorkspaceFile: (path: string) => void | Promise<void>;
  pendingAppClose: boolean;
  pendingCloseTab: EditorTab | null;
  preferencesCloseButtonRef: RefObject<HTMLButtonElement | null>;
  preferencesCopy: PreferencesCopy;
  preferencesDialogMode: PreferencesDialogMode | null;
  preferencesDialogRef: RefObject<HTMLElement | null>;
  preferencesOpen: boolean;
  previewVisible: boolean;
  quickOpenVisible: boolean;
  recoveryCopy: RecoveryCopy;
  revealWorkspacePath: (file: CompareAnchor) => void | Promise<void>;
  restartAppForAgentMode: () => void | Promise<void>;
  saveAllAndCloseWindow: () => void;
  saveAndClosePendingTab: () => void;
  sendWorkspacePathToAgent: (file: CompareAnchor) => void | Promise<void>;
  setAgentWorkbenchConsent: (acknowledged: boolean) => void;
  setAgentWorkbenchPreference: (enabled: boolean) => void;
  setAgentWorkbenchProvider: (provider: AgentWorkbenchProvider) => void;
  setCompareSource: (file: CompareAnchor) => void;
  setCompareTargetFile: (file: CompareAnchor) => void;
  setEditorSettings: Dispatch<SetStateAction<EditorSettings>>;
  setMenuLanguage: (language: MenuLanguage) => void;
  setPreviewVisible: (visible: boolean) => void;
  setThemePreference: (theme: ThemePreference) => void;
  themePreference: ThemePreference;
  workspaceContextMenu: WorkspaceContextMenuState | null;
  workspaceRootPath: string | null;
  workspaceTree: WorkspaceTreeEntry | null;
};

export function AppOverlays({
  activeAgentSession,
  activeTab,
  agentSession,
  agentWorkbenchActive,
  agentWorkbenchConsent,
  agentWorkbenchCopy,
  agentWorkbenchPreference,
  agentWorkbenchProvider,
  agentWorkbenchRestartRequired,
  appCloseCancelButtonRef,
  appCloseDialogRef,
  appRestartPending,
  cancelPendingAppClose,
  cancelPendingTabClose,
  clearCompareSource,
  closePreferencesFromKeyboard,
  closeQuickOpen,
  closeTabCancelButtonRef,
  closeTabDialogRef,
  closeTabNow,
  closeWorkspaceContextMenu,
  compareAnchor,
  compareWorkspaceFiles,
  copyWorkspaceFullPath,
  dirtyTabCount,
  discardAllAndCloseWindow,
  editorSettings,
  menuLanguage,
  openWorkspaceFile,
  pendingAppClose,
  pendingCloseTab,
  preferencesCloseButtonRef,
  preferencesCopy,
  preferencesDialogMode,
  preferencesDialogRef,
  preferencesOpen,
  previewVisible,
  quickOpenVisible,
  recoveryCopy,
  revealWorkspacePath,
  restartAppForAgentMode,
  saveAllAndCloseWindow,
  saveAndClosePendingTab,
  sendWorkspacePathToAgent,
  setAgentWorkbenchConsent,
  setAgentWorkbenchPreference,
  setAgentWorkbenchProvider,
  setCompareSource,
  setCompareTargetFile,
  setEditorSettings,
  setMenuLanguage,
  setPreviewVisible,
  setThemePreference,
  themePreference,
  workspaceContextMenu,
  workspaceRootPath,
  workspaceTree,
}: AppOverlaysProps) {
  return (
    <>
      {pendingCloseTab ? (
        <DirtyTabCloseDialog
          cancelButtonRef={closeTabCancelButtonRef}
          dialogRef={closeTabDialogRef}
          menuLanguage={menuLanguage}
          onCancel={cancelPendingTabClose}
          onDiscard={() => closeTabNow(pendingCloseTab.id)}
          onSave={saveAndClosePendingTab}
          tab={pendingCloseTab}
        />
      ) : null}

      {pendingAppClose ? (
        <AppCloseDialog
          cancelButtonRef={appCloseCancelButtonRef}
          dialogRef={appCloseDialogRef}
          dirtyTabCount={dirtyTabCount}
          menuLanguage={menuLanguage}
          onCancel={cancelPendingAppClose}
          onDiscardAll={discardAllAndCloseWindow}
          onSaveAll={saveAllAndCloseWindow}
        />
      ) : null}

      {quickOpenVisible ? (
        <QuickOpen
          tree={workspaceTree}
          onOpenFile={openWorkspaceFile}
          onClose={closeQuickOpen}
          menuLanguage={menuLanguage}
        />
      ) : null}

      {preferencesOpen && preferencesDialogMode ? (
        <PreferencesDialog
          closeButtonRef={preferencesCloseButtonRef}
          closeLabel={preferencesCopy.closeDialog}
          dialogRef={preferencesDialogRef}
          mode={preferencesDialogMode}
          onClose={closePreferencesFromKeyboard}
          title={
            preferencesDialogMode === "agent"
              ? agentWorkbenchCopy.title
              : preferencesCopy.settingsTitle
          }
        >
          {preferencesDialogMode === "agent" ? (
            <AgentWorkbenchPreferencesPane
              active={agentWorkbenchActive}
              activeSession={activeAgentSession}
              consent={agentWorkbenchConsent}
              copy={agentWorkbenchCopy}
              modePreference={agentWorkbenchPreference}
              onConsentChange={setAgentWorkbenchConsent}
              onModePreferenceChange={setAgentWorkbenchPreference}
              onProviderChange={setAgentWorkbenchProvider}
              onRestart={() => void restartAppForAgentMode()}
              provider={agentWorkbenchProvider}
              providerLabel={providerLabel(agentWorkbenchProvider)}
              restartPending={appRestartPending}
              restartRequired={agentWorkbenchRestartRequired}
              sessionLabel={agentSessionStateLabel(agentSession, menuLanguage)}
              workspaceRootPath={workspaceRootPath}
            />
          ) : (
            <SettingsPreferencesPane
              copy={preferencesCopy}
              editorSettings={editorSettings}
              menuLanguage={menuLanguage}
              onEditorSettingsChange={setEditorSettings}
              onMenuLanguageChange={setMenuLanguage}
              onPreviewVisibleChange={setPreviewVisible}
              onThemePreferenceChange={setThemePreference}
              previewVisible={previewVisible}
              themePreference={themePreference}
            />
          )}
        </PreferencesDialog>
      ) : null}

      {workspaceContextMenu ? (
        <WorkspaceContextMenu
          anchor={workspaceContextMenu}
          activeTabPath={activeTab?.path ?? null}
          canSendToAgent={activeAgentSession}
          compareSource={compareAnchor}
          menuLanguage={menuLanguage}
          onClearCompareSource={clearCompareSource}
          onClose={closeWorkspaceContextMenu}
          onCompare={() => void compareWorkspaceFiles(workspaceContextMenu)}
          onOpen={() => {
            closeWorkspaceContextMenu();
            void openWorkspaceFile(workspaceContextMenu.path);
          }}
          onCopyFullPath={() => void copyWorkspaceFullPath(workspaceContextMenu)}
          onRevealInFinder={() => void revealWorkspacePath(workspaceContextMenu)}
          onSendFullPathToAgent={() =>
            void sendWorkspacePathToAgent(workspaceContextMenu)
          }
          onSetCompareSource={() => setCompareSource(workspaceContextMenu)}
          onSetCompareTarget={() => setCompareTargetFile(workspaceContextMenu)}
        />
      ) : null}
    </>
  );
}
