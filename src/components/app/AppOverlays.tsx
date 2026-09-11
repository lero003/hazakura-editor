import { HtmlExportSettingsDialog } from "./HtmlExportSettingsDialog";
import { ExportFormatNav, type ExportFormatId } from "./ExportFormatNav";
import { exportFormatSwitchPlan } from "./exportFormatSwitch";
import type { useExportDrafts } from "../../hooks/document/useExportDrafts";
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
import { OkfReviewPanel } from "../okf/OkfReviewPanel";
import type { OkfReviewResult } from "../../features/okf";
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
import { AssistDiscardConfirmDialog } from "./AssistDiscardConfirmDialog";
import { EpubExportSettingsDialog } from "./EpubExportSettingsDialog";
import { PdfExportSettingsDialog } from "./PdfExportSettingsDialog";
import { RestoreFromBackupDialog } from "../backup/RestoreFromBackupDialog";
import type { AutoBackupEntry } from "../../lib/tauri/autoBackup";
import type { AutoBackupRestoreCopy } from "../../lib/locale/autoBackup";
import type { WorkspaceFileOpsCopy } from "../../lib/locale/workspaceFileOps";
import type { EpubExportSettings } from "../../features/document/epubExport";
import type { PdfMarginPreset } from "../../features/document/pdfExport";
import type { DocumentExportScope } from "../../features/document/exportScope";
import type {
  HtmlExportRequest,
  EpubExportRequest,
  PdfExportRequest,
} from "../../hooks/document/useDocumentExport";

type AppOverlaysProps = {
  activeAgentSession: boolean;
  activeTab: EditorTab | null;
  /**
   * 書き出しダイアログの入力草稿（画面11）。所有者は controller 側に置く ——
   * 「利用者のキャンセル（ボタン・Escape）」「確定」が同じ終了口を通るようにするため
   * （外部レビュー R3: ボタンだけが草稿を消していた）。
   */
  exportDrafts: ReturnType<typeof useExportDrafts>;
  /** 利用者のキャンセル（草稿も捨てる）。形式切替の内部キャンセルとは別。 */
  onEndEpubExportSession: () => void;
  onEndPdfExportSession: () => void;
  onEndHtmlExportSession: () => void;
  agentSession: AgentWorkbenchSession | null;
  agentWorkbenchActive: boolean;
  agentWorkbenchConsent: boolean;
  agentWorkbenchCopy: AgentWorkbenchCopy;
  agentWorkbenchPreference: boolean;
  agentWorkbenchProvider: AgentWorkbenchProvider;
  agentWorkbenchRestartRequired: boolean;
  appleAssistAvailability: AppleAssistAvailability;
  appleAssistAvailabilityProbed?: boolean;
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
  okfReviewVisible: boolean;
  okfScanning: boolean;
  okfCancelRequested: boolean;
  okfReviewResult: OkfReviewResult | null;
  okfReviewError: string | null;
  okfReviewRerunError: string | null;
  okfBundleRoot: string | null;
  isOkfPathDirty: (relativePath: string) => boolean;
  onCloseOkfReview: () => void;
  onCancelOkfReviewScan: () => void;
  onRerunOkfReview: () => void;
  onOpenOkfConcept: (relativePath: string, sourceOffset?: number) => void;
  onOpenOkfReview: (bundleRoot?: string | null) => void;
  compareAnchor: CompareAnchor | null;
  compareWorkspaceFiles: (file: CompareAnchor) => void | Promise<void>;
  copyWorkspaceFullPath: (file: CompareAnchor) => void | Promise<void>;
  cancelPendingRename: () => void;
  confirmPendingRename: () => void;
  cancelPendingTrash: () => void;
  confirmPendingTrash: () => void;
  createFile: (parentPath: string) => Promise<void> | void;
  createOkfScaffoldAt: (
    parentPath: string,
    templateId: "minimal" | "book-like",
  ) => Promise<void> | void;
  createFolder: (parentPath: string) => Promise<void> | void;
  dirtyTabCount: number;
  discardAllAndCloseWindow: () => void;
  editorSettings: EditorSettings;
  epubExportCancelButtonRef: RefObject<HTMLButtonElement | null>;
  epubExportDialogRef: RefObject<HTMLElement | null>;
  epubExportRequest: EpubExportRequest | null;
  pdfExportCancelButtonRef: RefObject<HTMLButtonElement | null>;
  pdfExportDialogRef: RefObject<HTMLElement | null>;
  pdfExportRequest: PdfExportRequest | null;
  htmlExportRequest?: HtmlExportRequest | null;
  htmlExportDialogRef?: RefObject<HTMLElement | null>;
  htmlExportCancelButtonRef?: RefObject<HTMLButtonElement | null>;
  onCancelHtmlExport?: () => void;
  onConfirmHtmlExport?: () => void | Promise<void>;
  fileOpsCopy: WorkspaceFileOpsCopy;
  filteredCommands: Command[];
  menuLanguage: MenuLanguage;
  onCancelEpubBetaExport: () => void;
  onCancelPdfExport: () => void;
  /** 書き出しの準備（各形式の既存の入口。形式ナビの切替もここを呼ぶ）。 */
  exportEpubBeta: () => void | Promise<void>;
  exportHtml: () => void | Promise<void>;
  exportPdf: () => void | Promise<void>;
  onConfirmEpubBetaExport: (
    settings: EpubExportSettings,
    scope?: DocumentExportScope,
  ) => void | Promise<void>;
  onConfirmPdfExport: (
    preset: PdfMarginPreset,
    scope?: DocumentExportScope,
  ) => void | Promise<void>;
  onOpenCommandPalette: () => void;
  onRunCommand: (command: Command) => void;
  openWorkspaceFile: (path: string) => unknown;
  importSourcePathAsMarkdownDraft: (path: string) => void | Promise<void>;
  openTextPathAsReference: (path: string) => void | Promise<void | boolean>;
  referenceCopy: import("../../lib/locale/referenceCompare").ReferenceCompareCopy;
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
  pendingAssistDiscard: { sessionId: string; beforeBuffer: string } | null;
  onConfirmPendingAssistDiscard: () => void;
  onCancelPendingAssistDiscard: () => void;
  assistDiscardCancelButtonRef: RefObject<HTMLButtonElement | null>;
  assistDiscardDialogRef: RefObject<HTMLElement | null>;
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
  appleAssistAvailabilityProbed,
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
  okfReviewVisible,
  okfScanning,
  okfCancelRequested,
  okfReviewResult,
  okfReviewError,
  okfReviewRerunError,
  okfBundleRoot,
  isOkfPathDirty,
  onCloseOkfReview,
  onCancelOkfReviewScan,
  onRerunOkfReview,
  onOpenOkfConcept,
  onOpenOkfReview,
  compareAnchor,
  compareWorkspaceFiles,
  copyWorkspaceFullPath,
  createFile,
  createFolder,
  createOkfScaffoldAt,
  dirtyTabCount,
  discardAllAndCloseWindow,
  editorSettings,
  epubExportCancelButtonRef,
  epubExportDialogRef,
  epubExportRequest,
  pdfExportCancelButtonRef,
  pdfExportDialogRef,
  pdfExportRequest,
  htmlExportRequest,
  htmlExportDialogRef,
  htmlExportCancelButtonRef,
  onCancelHtmlExport,
  onConfirmHtmlExport,
  fileOpsCopy,
  filteredCommands,
  menuLanguage,
  onCancelEpubBetaExport,
  onCancelPdfExport,
  onConfirmEpubBetaExport,
  onConfirmPdfExport,
  exportDrafts,
  // 利用者のキャンセルは草稿まで捨てる（外部レビュー R3）。形式切替は素の cancel を使う。
  onEndEpubExportSession,
  onEndPdfExportSession,
  onEndHtmlExportSession,
  exportEpubBeta,
  exportHtml,
  exportPdf,
  onOpenCommandPalette,
  onRunCommand,
  openWorkspaceFile,
  importSourcePathAsMarkdownDraft,
  openTextPathAsReference,
  referenceCopy,
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
  pendingAssistDiscard,
  onConfirmPendingAssistDiscard,
  onCancelPendingAssistDiscard,
  assistDiscardCancelButtonRef,
  assistDiscardDialogRef,
}: AppOverlaysProps) {
  // 形式ナビで行き来しても、一度の書き出し操作のあいだは入力と対象を保つ（画面11）。
  // 草稿の所有者は controller（書き出し操作の終了口を一本化するため。外部レビュー R3）。

  const activeHelpDoc =
    preferencesDialogMode && isHelpDocumentDialogMode(preferencesDialogMode)
      ? helpDocsByMode[preferencesDialogMode]
      : null;

  /**
   * 形式ナビ（画面11）。3つのコマンドはそのまま残し、開いているダイアログの枠に
   * 形式の入口を出す。切替は「いまのダイアログを閉じる → 選んだ形式の**既存の**
   * 準備処理を呼ぶ」だけで、新しい書き出し経路は作らない。
   */
  const renderExportFormatNav = (current: ExportFormatId) => (
    <ExportFormatNav
      format={current}
      menuLanguage={menuLanguage}
      onSelectFormat={(next) => {
        // 「閉じてから、選ばれた形式の既存の準備を呼ぶ」だけ（判断は純関数）。
        const plan = exportFormatSwitchPlan(current, next);
        if (!plan) return;
        if (plan.cancel === "epub") onCancelEpubBetaExport();
        else if (plan.cancel === "pdf") onCancelPdfExport();
        else onCancelHtmlExport?.();
        if (plan.start === "epub") void exportEpubBeta();
        else if (plan.start === "pdf") void exportPdf();
        else void exportHtml();
      }}
    />
  );

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

      {pendingAssistDiscard ? (
        <AssistDiscardConfirmDialog
          cancelButtonRef={assistDiscardCancelButtonRef}
          dialogRef={assistDiscardDialogRef}
          menuLanguage={menuLanguage}
          onCancel={onCancelPendingAssistDiscard}
          onConfirm={onConfirmPendingAssistDiscard}
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
          menuLanguage={menuLanguage}
          query={commandPaletteQuery}
          onClose={closeCommandPalette}
          onRun={onRunCommand}
          onSetActiveIndex={setCommandPaletteActiveIndex}
          onSetQuery={setCommandPaletteQuery}
        />
      ) : null}

      {globalSearchVisible ? (
        <GlobalSearch
          workspaceName={workspaceRootPath?.split(/[\\/]/).filter(Boolean).at(-1) ?? ""}
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

      {okfReviewVisible ? (
        <OkfReviewPanel
          bundleRoot={okfBundleRoot}
          cancelRequested={okfCancelRequested}
          error={okfReviewError}
          isPathDirty={isOkfPathDirty}
          menuLanguage={menuLanguage}
          onCancelScan={onCancelOkfReviewScan}
          onClose={onCloseOkfReview}
          onOpenConcept={onOpenOkfConcept}
          onRerun={onRerunOkfReview}
          result={okfReviewResult}
          rerunError={okfReviewRerunError}
          scanning={okfScanning}
          workspaceOpen={workspaceRootPath !== null}
        />
      ) : null}

      {epubExportRequest ? (
        <EpubExportSettingsDialog
          key={epubExportRequest.tabId}
          formatNav={renderExportFormatNav("epub")}
          bookAvailable={epubExportRequest.bookAvailable}
          cancelButtonRef={epubExportCancelButtonRef}
          dialogRef={epubExportDialogRef}
          documentName={epubExportRequest.documentName}
          hasUnsavedChanges={epubExportRequest.hasUnsavedChanges}
          initialScope={exportDrafts.drafts.scope ?? "document"}
          initialSettings={exportDrafts.drafts.epub ?? epubExportRequest.settings}
          onDraftChange={exportDrafts.rememberEpub}
          menuLanguage={menuLanguage}
          preflightByScope={epubExportRequest.preflightByScope}
          // キャンセル（ボタン・Escape）は controller が草稿の破棄まで含めて一本化した
          // ハンドラを受け取る（外部レビュー R3）。形式切替はこの下の renderExportFormatNav。
          onCancel={onEndEpubExportSession}
          onConfirm={(settings, scope) => {
            exportDrafts.clear();
            void onConfirmEpubBetaExport(settings, scope);
          }}
        />
      ) : null}

      {htmlExportRequest && htmlExportDialogRef && htmlExportCancelButtonRef && onCancelHtmlExport && onConfirmHtmlExport ? (
        <HtmlExportSettingsDialog request={htmlExportRequest} formatNav={renderExportFormatNav("html")} menuLanguage={menuLanguage}
          dialogRef={htmlExportDialogRef} cancelButtonRef={htmlExportCancelButtonRef}
          onCancel={onEndHtmlExportSession}
          onConfirm={() => { exportDrafts.clear(); return onConfirmHtmlExport(); }} />
      ) : null}
      {pdfExportRequest ? (
        <PdfExportSettingsDialog
          key={pdfExportRequest.tabId}
          formatNav={renderExportFormatNav("pdf")}
          bookAvailable={pdfExportRequest.bookAvailable}
          cancelButtonRef={pdfExportCancelButtonRef}
          dialogRef={pdfExportDialogRef}
          documentName={pdfExportRequest.documentName}
          hasUnsavedChanges={pdfExportRequest.hasUnsavedChanges}
          initialPreset={exportDrafts.drafts.pdf ?? pdfExportRequest.preset}
          initialScope={exportDrafts.drafts.scope ?? "document"}
          onDraftChange={exportDrafts.rememberPdf}
          menuLanguage={menuLanguage}
          preflightByScope={pdfExportRequest.preflightByScope}
          onCancel={onEndPdfExportSession}
          onConfirm={(preset, scope) => {
            exportDrafts.clear();
            void onConfirmPdfExport(preset, scope);
          }}
        />
      ) : null}

      {preferencesOpen && preferencesDialogMode ? (
        <PreferencesDialog
          closeButtonRef={preferencesCloseButtonRef}
          closeLabel={preferencesCopy.closeDialog}
          dialogRef={preferencesDialogRef}
          mode={preferencesDialogMode}
          onChangeMode={setPreferencesDialogMode}
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
            <PrivacyPreferencesPane key={activeHelpDoc.id} doc={activeHelpDoc} />
          ) : (
            <SettingsPreferencesPane
              appleAssistAvailability={appleAssistAvailability}
              appleAssistAvailabilityProbed={appleAssistAvailabilityProbed}
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
          kind={workspaceContextMenu.kind}
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
          onImportAsMarkdownDraft={() => {
            const path = workspaceContextMenu.path;
            closeWorkspaceContextMenu();
            void importSourcePathAsMarkdownDraft(path);
          }}
          onOpen={() => {
            closeWorkspaceContextMenu();
            void openWorkspaceFile(workspaceContextMenu.path);
          }}
          onOpenOkfReview={() => {
            const path = workspaceContextMenu.path;
            const kind = workspaceContextMenu.kind;
            closeWorkspaceContextMenu();
            if (kind === "directory" || kind === "root") {
              onOpenOkfReview(path);
            } else {
              onOpenOkfReview();
            }
          }}
          onCreateOkfScaffoldMinimal={() => {
            const parent = workspaceContextMenu.path;
            closeWorkspaceContextMenu();
            void createOkfScaffoldAt(parent, "minimal");
          }}
          onCreateOkfScaffoldBookLike={() => {
            const parent = workspaceContextMenu.path;
            closeWorkspaceContextMenu();
            void createOkfScaffoldAt(parent, "book-like");
          }}
          onOpenAsReference={() => {
            const path = workspaceContextMenu.path;
            closeWorkspaceContextMenu();
            void openTextPathAsReference(path);
          }}
          referenceCopy={referenceCopy}
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
          onOpenAsReference={() => {
            const path = tabContextMenu.path;
            closeTabContextMenu();
            void openTextPathAsReference(path);
          }}
          onRename={() => {
            const path = tabContextMenu.path;
            closeTabContextMenu();
            // Same rename lifecycle as the workspace context
            // menu: AppOverlays fires `requestRename` and the
            // tree owns the input. The tree will re-render the
            // matching file row into the rename input state.
            requestRename(path);
          }}
          openAsReferenceLabel={referenceCopy.openAsReference}
        />
      ) : null}
    </>
  );
}
