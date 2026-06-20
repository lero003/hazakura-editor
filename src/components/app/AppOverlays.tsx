import type {
  Dispatch,
  RefObject,
  SetStateAction,
} from "react";
import type {
  AgentWorkbenchCopy,
  LModeCopy,
  PreferencesCopy,
  RecoveryCopy,
} from "../../lib/locale";
import type {
  AgentWorkbenchProvider,
  AgentWorkbenchSession,
  AppleAssistAvailability,
  WorkspaceTreeEntry,
} from "../../lib/tauri";
import type {
  AssistSurfacePreference,
  CompareAnchor,
  DraftRecord,
  EditorSettings,
  EditorTab,
  MenuLanguage,
  PreferencesDialogMode,
  ThemePreference,
  WorkspaceContextMenuState,
} from "../../types";
import type { TabContextMenuState } from "../editor/TabContextMenu";
import type { Command } from "../../hooks/commandPalette/useCommandPalette";
import type {
  GlobalSearchRow,
  GlobalSearchSummary,
} from "../../hooks/globalSearch/useGlobalSearch";
import { agentSessionStateLabel, providerLabel } from "../../features/agent/agentWorkbench";
import { QuickOpen } from "../editor/QuickOpen";
import { CommandPalette } from "../commandPalette/CommandPalette";
import { GlobalSearch } from "../globalSearch/GlobalSearch";
import { TabContextMenu } from "../editor/TabContextMenu";
import { WorkspaceContextMenu } from "../workspace/WorkspaceContextMenu";
import { AppCloseDialog, DirtyTabCloseDialog } from "./CloseDialogs";
import { PreferencesDialog } from "./PreferencesDialog";
import { SettingsPreferencesPane } from "./SettingsPreferencesPane";
import { PrivacyPreferencesPane } from "./PrivacyPreferencesPane";
import { DiagnosticsPane } from "./DiagnosticsPane";
import { helpDocsByMode, isHelpDocumentDialogMode } from "./helpDocs";
import { AgentWorkbenchPreferencesPane } from "../agent/AgentWorkbenchPreferencesPane";
import { RenameWarnDialog, type RenameWarningKind } from "./RenameWarnDialog";
import { MoveToTrashConfirmDialog } from "./MoveToTrashConfirmDialog";
import { EpubExportSettingsDialog } from "./EpubExportSettingsDialog";
import { RestoreFromBackupDialog } from "../backup/RestoreFromBackupDialog";
import type { AutoBackupEntry } from "../../lib/tauri/autoBackup";
import type { AutoBackupRestoreCopy } from "../../lib/locale/autoBackup";
import type { WorkspaceFileOpsCopy } from "../../lib/locale/workspaceFileOps";
import type { EpubExportSettings } from "../../features/document/epubExport";
import type { EpubExportRequest } from "../../hooks/document/useDocumentExport";

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
  appleAssistAvailability: AppleAssistAvailability;
  assistSurfaceActive: AssistSurfacePreference;
  assistSurfacePreference: AssistSurfacePreference;
  appCloseCancelButtonRef: RefObject<HTMLButtonElement | null>;
  appCloseDialogRef: RefObject<HTMLElement | null>;
  moveTrashCancelButtonRef: RefObject<HTMLButtonElement | null>;
  moveTrashDialogRef: RefObject<HTMLElement | null>;
  appRestartPending: boolean;
  autoBackupRestoreCopy: AutoBackupRestoreCopy;
  autoBackupRestoreEntries: AutoBackupEntry[];
  autoBackupRestoreError: string | null;
  autoBackupRestoreLoading: boolean;
  cancelPendingAppClose: () => void;
  cancelPendingTabClose: () => void;
  clearCompareSource: () => void;
  closePreferencesFromKeyboard: () => void;
  closeQuickOpen: () => void;
  closeTabCancelButtonRef: RefObject<HTMLButtonElement | null>;
  closeTabContextMenu: () => void;
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
  cancelPendingTrash: () => void;
  confirmPendingTrash: () => void;
  createFile: (parentPath: string) => Promise<void> | void;
  createFolder: (parentPath: string) => Promise<void> | void;
  dirtyTabCount: number;
  discardAllAndCloseWindow: () => void;
  editorSettings: EditorSettings;
  epubExportRequest: EpubExportRequest | null;
  fileOpsCopy: WorkspaceFileOpsCopy;
  filteredCommands: Command[];
  menuLanguage: MenuLanguage;
  onCancelEpubBetaExport: () => void;
  onConfirmEpubBetaExport: (settings: EpubExportSettings) => void | Promise<void>;
  onOpenCommandPalette: () => void;
  onRunCommand: (command: Command) => void;
  openWorkspaceFile: (path: string) => void | Promise<void>;
  pendingAppClose: boolean;
  pendingCloseTab: EditorTab | null;
  pendingRenameWarning: RenameWarningKind | null;
  onCloseRestoreBackupDialog: () => void;
  onSelectAutoBackupEntry: (entry: AutoBackupEntry) => void | Promise<void>;
  pendingTrash: {
    srcPath: string;
    name: string;
    isDirectory: boolean;
  } | null;
  preferencesCloseButtonRef: RefObject<HTMLButtonElement | null>;
  preferencesCopy: PreferencesCopy;
  preferencesDialogMode: PreferencesDialogMode | null;
  preferencesDialogRef: RefObject<HTMLElement | null>;
  preferencesOpen: boolean;
  previewVisible: boolean;
  setPreferencesDialogMode: (mode: PreferencesDialogMode) => void;
  quickOpenVisible: boolean;
  recoveryCopy: RecoveryCopy;
  lModeCopy: LModeCopy;
  restoreBackupDialogOpen: boolean;
  revealWorkspacePath: (file: CompareAnchor) => void | Promise<void>;
  renameWorkspacePath: (srcPath: string, newName: string) => void;
  requestRename: (path: string) => void;
  requestTrashWorkspacePath: (
    path: string,
    name: string,
    isDirectory: boolean,
  ) => void;
  restartAppForAgentMode: () => void | Promise<void>;
  saveAllAndCloseWindow: () => void;
  saveAndClosePendingTab: () => void;
  sendWorkspacePathToAgent: (file: CompareAnchor) => void | Promise<void>;
  setAgentWorkbenchConsent: (acknowledged: boolean) => void;
  setAgentWorkbenchPreference: (enabled: boolean) => void;
  setAgentWorkbenchProvider: (provider: AgentWorkbenchProvider) => void;
  setAssistSurfacePreference: (surface: AssistSurfacePreference) => void;
  setCompareSource: (file: CompareAnchor) => void;
  setCompareTargetFile: (file: CompareAnchor) => void;
  setCommandPaletteActiveIndex: (index: number) => void;
  setCommandPaletteQuery: (query: string) => void;
  setEditorSettings: Dispatch<SetStateAction<EditorSettings>>;
  setMenuLanguage: (language: MenuLanguage) => void;
  setPreviewVisible: (visible: boolean) => void;
  setThemePreference: (theme: ThemePreference) => void;
  tabContextMenu: TabContextMenuState | null;
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
  appleAssistAvailability,
  assistSurfaceActive,
  assistSurfacePreference,
  appCloseCancelButtonRef,
  appCloseDialogRef,
  moveTrashCancelButtonRef,
  moveTrashDialogRef,
  appRestartPending,
  autoBackupRestoreCopy,
  autoBackupRestoreEntries,
  autoBackupRestoreError,
  autoBackupRestoreLoading,
  cancelPendingAppClose,
  cancelPendingTabClose,
  clearCompareSource,
  closePreferencesFromKeyboard,
  closeQuickOpen,
  closeTabCancelButtonRef,
  closeTabContextMenu,
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
  epubExportRequest,
  fileOpsCopy,
  filteredCommands,
  menuLanguage,
  onCancelEpubBetaExport,
  onConfirmEpubBetaExport,
  onOpenCommandPalette,
  onRunCommand,
  openWorkspaceFile,
  pendingAppClose,
  pendingCloseTab,
  preferencesCloseButtonRef,
  onCloseRestoreBackupDialog,
  onSelectAutoBackupEntry,
  preferencesCopy,
  preferencesDialogMode,
  preferencesDialogRef,
  preferencesOpen,
  previewVisible,
  setPreferencesDialogMode,
  quickOpenVisible,
  recoveryCopy,
  lModeCopy,
  restoreBackupDialogOpen,
  revealWorkspacePath,
  renameWorkspacePath,
  requestRename,
  requestTrashWorkspacePath,
  restartAppForAgentMode,
  saveAllAndCloseWindow,
  saveAndClosePendingTab,
  sendWorkspacePathToAgent,
  setAgentWorkbenchConsent,
  setAgentWorkbenchPreference,
  setAgentWorkbenchProvider,
  setAssistSurfacePreference,
  setCompareSource,
  setCompareTargetFile,
  setCommandPaletteActiveIndex,
  setCommandPaletteQuery,
  setEditorSettings,
  setMenuLanguage,
  setPreviewVisible,
  setThemePreference,
  tabContextMenu,
  themePreference,
  workspaceContextMenu,
  workspaceRootPath,
  workspaceTree,
  cancelPendingRename,
  confirmPendingRename,
  cancelPendingTrash,
  confirmPendingTrash,
  pendingRenameWarning,
  pendingTrash,
}: AppOverlaysProps) {
  const activeHelpDoc =
    preferencesDialogMode && isHelpDocumentDialogMode(preferencesDialogMode)
      ? helpDocsByMode[preferencesDialogMode]
      : null;

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

      {pendingTrash ? (
        <MoveToTrashConfirmDialog
          cancelButtonRef={moveTrashCancelButtonRef}
          copy={fileOpsCopy}
          dialogRef={moveTrashDialogRef}
          isDirectory={pendingTrash.isDirectory}
          menuLanguage={menuLanguage}
          name={pendingTrash.name}
          onCancel={cancelPendingTrash}
          onConfirm={() => void confirmPendingTrash()}
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

      {epubExportRequest ? (
        <EpubExportSettingsDialog
          documentName={epubExportRequest.documentName}
          initialSettings={epubExportRequest.settings}
          menuLanguage={menuLanguage}
          onCancel={onCancelEpubBetaExport}
          onConfirm={(settings) => void onConfirmEpubBetaExport(settings)}
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
              : activeHelpDoc
                ? activeHelpDoc.title
                : preferencesCopy.settingsTitle
          }
        >
          {preferencesDialogMode === "agent" ? (
            <AgentWorkbenchPreferencesPane
              active={agentWorkbenchActive}
              activeSession={activeAgentSession}
              appleAssistAvailability={appleAssistAvailability}
              assistSurfaceActive={assistSurfaceActive}
              assistSurfacePreference={assistSurfacePreference}
              consent={agentWorkbenchConsent}
              copy={agentWorkbenchCopy}
              modePreference={agentWorkbenchPreference}
              onConsentChange={setAgentWorkbenchConsent}
              onModePreferenceChange={setAgentWorkbenchPreference}
              onProviderChange={setAgentWorkbenchProvider}
              onRestart={() => void restartAppForAgentMode()}
              onAssistSurfacePreferenceChange={setAssistSurfacePreference}
              provider={agentWorkbenchProvider}
              providerLabel={providerLabel(agentWorkbenchProvider)}
              restartPending={appRestartPending}
              restartRequired={agentWorkbenchRestartRequired}
              sessionLabel={agentSessionStateLabel(agentSession, menuLanguage)}
              workspaceRootPath={workspaceRootPath}
            />
          ) : preferencesDialogMode === "diagnostics" ? (
            <DiagnosticsPane
              appleLocalAssistAvailable={
                appleAssistAvailability.kind === "available"
              }
              autoBackupEnabled={editorSettings.autoBackupEnabled}
              lModeEnabled={editorSettings.lModeEnabled}
              theme={themePreference}
              wrapLines={editorSettings.wrapLines}
            />
          ) : activeHelpDoc ? (
            <PrivacyPreferencesPane doc={activeHelpDoc} />
          ) : (
            <SettingsPreferencesPane
              copy={preferencesCopy}
              editorSettings={editorSettings}
              lModeCopy={lModeCopy}
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

      {restoreBackupDialogOpen && activeTab ? (
        <RestoreFromBackupDialog
          copy={autoBackupRestoreCopy}
          entries={autoBackupRestoreEntries}
          error={autoBackupRestoreError}
          fileLabel={activeTab.name}
          loading={autoBackupRestoreLoading}
          onClose={onCloseRestoreBackupDialog}
          onSelect={(entry) => void onSelectAutoBackupEntry(entry)}
        />
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
          onMoveToTrash={() => {
            const path = workspaceContextMenu.path;
            const isDirectory = workspaceContextMenu.kind === "directory";
            closeWorkspaceContextMenu();
            requestTrashWorkspacePath(path, workspaceContextMenu.name, isDirectory);
          }}
        />
      ) : null}

      {tabContextMenu ? (
        <TabContextMenu
          anchor={tabContextMenu}
          menuLanguage={menuLanguage}
          onClose={closeTabContextMenu}
          onRename={() => {
            const path = tabContextMenu.path;
            closeTabContextMenu();
            // Same rename lifecycle as the workspace context
            // menu: AppOverlays fires `requestRename` and the
            // tree owns the input. The tree will re-render the
            // matching file row into the rename input state.
            requestRename(path);
          }}
        />
      ) : null}
    </>
  );
}
