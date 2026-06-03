import type {
  Dispatch,
  RefObject,
  SetStateAction,
} from "react";
import type {
  AgentWorkbenchCopy,
  PreferencesCopy,
  RecoveryCopy,
} from "../../lib/locale";
import type {
  AgentWorkbenchProvider,
  AgentWorkbenchSession,
  WorkspaceTreeEntry,
} from "../../lib/tauri";
import type {
  CompareAnchor,
  DraftRecord,
  EditorSettings,
  EditorTab,
  MenuLanguage,
  PreferencesDialogMode,
  ThemePreference,
  WorkspaceContextMenuState,
} from "../../types";
import type { Command } from "../../hooks/commandPalette/useCommandPalette";
import type {
  GlobalSearchRow,
  GlobalSearchSummary,
} from "../../hooks/globalSearch/useGlobalSearch";
import { agentSessionStateLabel, providerLabel } from "../../features/agent/agentWorkbench";
import { QuickOpen } from "../editor/QuickOpen";
import { CommandPalette } from "../commandPalette/CommandPalette";
import { GlobalSearch } from "../globalSearch/GlobalSearch";
import { WorkspaceContextMenu } from "../workspace/WorkspaceContextMenu";
import { AppCloseDialog, DirtyTabCloseDialog } from "./CloseDialogs";
import { PreferencesDialog } from "./PreferencesDialog";
import { SettingsPreferencesPane } from "./SettingsPreferencesPane";
import { AgentWorkbenchPreferencesPane } from "../agent/AgentWorkbenchPreferencesPane";
import { RenameWarnDialog, type RenameWarningKind } from "./RenameWarnDialog";
import type { WorkspaceFileOpsCopy } from "../../lib/locale/workspaceFileOps";

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
  commandPaletteVisible: boolean;
  commandPaletteActiveIndex: number;
  commandPaletteQuery: string;
  closeCommandPalette: () => void;
  globalSearchVisible: boolean;
  globalSearchActiveIndex: number;
  globalSearchQuery: string;
  globalSearchRows: GlobalSearchRow[];
  globalSearchError: string | null;
  globalSearching: boolean;
  globalSearchSummary: GlobalSearchSummary | null;
  onCloseGlobalSearch: () => void;
  onOpenGlobalSearch: () => void;
  onRunGlobalSearchMatch: (row: GlobalSearchRow) => void;
  onSetGlobalSearchActiveIndex: (index: number) => void;
  onSetGlobalSearchQuery: (query: string) => void;
  compareAnchor: CompareAnchor | null;
  compareWorkspaceFiles: (file: CompareAnchor) => void | Promise<void>;
  copyWorkspaceFullPath: (file: CompareAnchor) => void | Promise<void>;
  cancelPendingRename: () => void;
  confirmPendingRename: () => void;
  createFile: (parentPath: string) => Promise<void> | void;
  createFolder: (parentPath: string) => Promise<void> | void;
  dirtyTabCount: number;
  discardAllAndCloseWindow: () => void;
  editorSettings: EditorSettings;
  fileOpsCopy: WorkspaceFileOpsCopy;
  filteredCommands: Command[];
  menuLanguage: MenuLanguage;
  onOpenCommandPalette: () => void;
  onRunCommand: (command: Command) => void;
  openWorkspaceFile: (path: string) => void | Promise<void>;
  pendingAppClose: boolean;
  pendingCloseTab: EditorTab | null;
  pendingRenameWarning: RenameWarningKind | null;
  preferencesCloseButtonRef: RefObject<HTMLButtonElement | null>;
  preferencesCopy: PreferencesCopy;
  preferencesDialogMode: PreferencesDialogMode | null;
  preferencesDialogRef: RefObject<HTMLElement | null>;
  preferencesOpen: boolean;
  previewVisible: boolean;
  quickOpenVisible: boolean;
  recoveryCopy: RecoveryCopy;
  revealWorkspacePath: (file: CompareAnchor) => void | Promise<void>;
  renameWorkspacePath: (srcPath: string, newName: string) => void;
  requestRename: (path: string) => void;
  restartAppForAgentMode: () => void | Promise<void>;
  saveAllAndCloseWindow: () => void;
  saveAndClosePendingTab: () => void;
  sendWorkspacePathToAgent: (file: CompareAnchor) => void | Promise<void>;
  setAgentWorkbenchConsent: (acknowledged: boolean) => void;
  setAgentWorkbenchPreference: (enabled: boolean) => void;
  setAgentWorkbenchProvider: (provider: AgentWorkbenchProvider) => void;
  setCompareSource: (file: CompareAnchor) => void;
  setCompareTargetFile: (file: CompareAnchor) => void;
  setCommandPaletteActiveIndex: (index: number) => void;
  setCommandPaletteQuery: (query: string) => void;
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
  commandPaletteActiveIndex,
  commandPaletteQuery,
  commandPaletteVisible,
  closeCommandPalette,
  globalSearchVisible,
  globalSearchActiveIndex,
  globalSearchQuery,
  globalSearchRows,
  globalSearchError,
  globalSearching,
  globalSearchSummary,
  onCloseGlobalSearch,
  onOpenGlobalSearch,
  onRunGlobalSearchMatch,
  onSetGlobalSearchActiveIndex,
  onSetGlobalSearchQuery,
  compareAnchor,
  compareWorkspaceFiles,
  copyWorkspaceFullPath,
  createFile,
  createFolder,
  dirtyTabCount,
  discardAllAndCloseWindow,
  editorSettings,
  fileOpsCopy,
  filteredCommands,
  menuLanguage,
  onOpenCommandPalette,
  onRunCommand,
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
  renameWorkspacePath,
  requestRename,
  restartAppForAgentMode,
  saveAllAndCloseWindow,
  saveAndClosePendingTab,
  sendWorkspacePathToAgent,
  setAgentWorkbenchConsent,
  setAgentWorkbenchPreference,
  setAgentWorkbenchProvider,
  setCompareSource,
  setCompareTargetFile,
  setCommandPaletteActiveIndex,
  setCommandPaletteQuery,
  setEditorSettings,
  setMenuLanguage,
  setPreviewVisible,
  setThemePreference,
  themePreference,
  workspaceContextMenu,
  workspaceRootPath,
  workspaceTree,
  cancelPendingRename,
  confirmPendingRename,
  pendingRenameWarning,
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

      {pendingRenameWarning ? (
        <RenameWarnDialog
          copy={fileOpsCopy}
          onCancel={cancelPendingRename}
          onConfirm={() => void confirmPendingRename()}
          warningKind={pendingRenameWarning}
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

      {commandPaletteVisible ? (
        <CommandPalette
          activeIndex={commandPaletteActiveIndex}
          commands={filteredCommands}
          query={commandPaletteQuery}
          onClose={closeCommandPalette}
          onRun={onRunCommand}
          onSetActiveIndex={setCommandPaletteActiveIndex}
          onSetQuery={setCommandPaletteQuery}
        />
      ) : null}

      {globalSearchVisible ? (
        <GlobalSearch
          activeIndex={globalSearchActiveIndex}
          menuLanguage={menuLanguage}
          onClose={onCloseGlobalSearch}
          onRun={onRunGlobalSearchMatch}
          onSetActiveIndex={onSetGlobalSearchActiveIndex}
          onSetQuery={onSetGlobalSearchQuery}
          query={globalSearchQuery}
          rows={globalSearchRows}
          searchError={globalSearchError}
          searching={globalSearching}
          summary={globalSearchSummary}
          workspaceOpen={workspaceRootPath !== null}
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
          fileOpsCopy={fileOpsCopy}
          menuLanguage={menuLanguage}
          onClearCompareSource={clearCompareSource}
          onClose={closeWorkspaceContextMenu}
          onCompare={() => void compareWorkspaceFiles(workspaceContextMenu)}
          onCreateFileHere={() => {
            const parent = workspaceContextMenu.path;
            closeWorkspaceContextMenu();
            void createFile(parent);
          }}
          onCreateFolderHere={() => {
            const parent = workspaceContextMenu.path;
            closeWorkspaceContextMenu();
            void createFolder(parent);
          }}
          onOpen={() => {
            closeWorkspaceContextMenu();
            void openWorkspaceFile(workspaceContextMenu.path);
          }}
          onCopyFullPath={() => void copyWorkspaceFullPath(workspaceContextMenu)}
          onRename={() => {
            const path = workspaceContextMenu.path;
            closeWorkspaceContextMenu();
            // Start the inline rename. The commit is wired through
            // `renameWorkspacePath` which lives in AppWorkspace's
            // tree prop chain. AppOverlays fires the request side
            // here and the tree owns the actual input lifecycle.
            requestRename(path);
          }}
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
