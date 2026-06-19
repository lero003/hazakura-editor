import { useState, type ComponentProps } from "react";
import type {
  AmbientIntensity,
  CompareCase,
  CompareViewState,
  EditorSettings,
  EditorTab,
  MenuLanguage,
  ResolvedTheme,
  ReviewSurface as ReviewSurfaceKind,
} from "../../types";
import type { ChangeReviewSnapshot } from "../../hooks/diff/useCompareExecution";
import type { LModeCopy, ReviewDeskCopy } from "../../lib/locale";
import type { ReviewDeskMode } from "../../types";
import { AmbientBackground, type AmbientMode } from "./AmbientBackground";
import { AppDocumentFeedback } from "./AppDocumentFeedback";
import { AppOverlays } from "./AppOverlays";
import { AppStatusBar } from "./AppStatusBar";
import { AppTopChrome } from "./AppTopChrome";
import { AppWorkspace } from "./AppWorkspace";
import { LModeActionRail } from "./LModeActionRail";
import { LModeExitPill } from "./LModeExitPill";
import { LModeWindowDragBand } from "./LModeWindowDragBand";
import { AppleAssistReviewBar } from "./AppleAssistReviewBar";
import { ReviewSurface } from "../review/ReviewSurface";

export type AppShellProps = Omit<
  ComponentProps<typeof AppTopChrome>,
  "onEditorSettingsChange"
> &
  ComponentProps<typeof AppDocumentFeedback> &
  ComponentProps<typeof AppWorkspace> &
  ComponentProps<typeof AppStatusBar> &
  ComponentProps<typeof AppOverlays> & {
    activeTab: EditorTab | null;
    ambientIntensity: AmbientIntensity;
    candidateCompareCase: CompareCase | null;
    candidateCompareView: CompareViewState | null;
    candidateErrorMessage: string | null;
    candidateInputText: string;
    clearCandidate: () => void;
    editorSettings: EditorSettings;
    lModeCopy: LModeCopy;
    lModeEnabled: boolean;
    menuLanguage: MenuLanguage;
    onApplyManualCandidate: (
      candidateText: string,
      documentTabId: string,
      documentContents: string,
    ) => void;
    onCloseReviewDesk: () => void;
    onDiscardAppleAssistEdit: (tabId: string, before: string) => void;
    onExitLModeToWorkspace: () => void;
    onOpenAppleAssistFromLMode: () => void;
    onReviewChangesFromLMode: () => Promise<ChangeReviewSnapshot | null>;
    onToggleLMode: () => void;
    resolvedTheme: ResolvedTheme;
    reviewDeskCopy: ReviewDeskCopy;
    reviewDeskMode: ReviewDeskMode;
    reviewSurface: ReviewSurfaceKind;
    runCandidateCompare: (params: {
      bufferContents: string;
      documentTabId: string;
      documentPath: string;
      documentLabel: string;
      leftColumnLabel: string;
      rightColumnLabel: string;
      candidateSourceLabel: string;
      candidateText: string;
    }) => { ok: true } | { ok: false; error: string };
    setCandidateInputText: (value: string) => void;
  };

export function AppShell(props: AppShellProps) {
  const ambientMode = isAmbientMode(props.resolvedTheme) ? props.resolvedTheme : null;
  const [workspaceSidebarCollapsed, setWorkspaceSidebarCollapsed] =
    useState(false);

  return (
    <main className="app-shell">
      {ambientMode ? (
        <AmbientBackground
          intensity={props.ambientIntensity}
          mode={ambientMode}
        />
      ) : null}
      <AppTopChrome
        {...props}
        onEditorSettingsChange={props.setEditorSettings}
      />
      <AppDocumentFeedback {...props} />
      {props.reviewSurface !== null ? (
        <ReviewSurface
          activeTab={props.activeTab}
          candidateCompareCase={props.candidateCompareCase}
          candidateCompareView={props.candidateCompareView}
          candidateErrorMessage={props.candidateErrorMessage}
          candidateInputText={props.candidateInputText}
          clearCandidate={props.clearCandidate}
          editorSettings={props.editorSettings}
          editorTheme={props.editorTheme}
          menuLanguage={props.menuLanguage}
          onApplyCandidate={props.onApplyManualCandidate}
          onClose={props.onCloseReviewDesk}
          reviewDeskCopy={props.reviewDeskCopy}
          reviewDeskMode={props.reviewDeskMode}
          runCandidateCompare={props.runCandidateCompare}
          setCandidateInputText={props.setCandidateInputText}
        />
      ) : (
        <AppWorkspace
          {...props}
          onWorkspaceSidebarCollapsedChange={setWorkspaceSidebarCollapsed}
          workspaceSidebarCollapsedOverride={workspaceSidebarCollapsed}
        />
      )}
      <AppStatusBar {...props} />
      <AppOverlays {...props} />
      <AppleAssistReviewBar
        activeTabId={props.activeTabId}
        copy={props.lModeCopy}
        diffInitiallyOpen={props.editorSettings.appleAssistDiffInitiallyOpen}
        menuLanguage={props.menuLanguage}
        onDiscard={props.onDiscardAppleAssistEdit}
      />
      {props.lModeEnabled ? (
        <>
          <LModeWindowDragBand />
          <LModeExitPill
            copy={props.lModeCopy}
            onExit={props.onToggleLMode}
          />
          <LModeActionRail
            activeDirty={props.activeDirty}
            activeDocumentPath={props.activeTab?.path ?? null}
            assistSurfaceActive={props.assistSurfaceActive}
            copy={props.lModeCopy}
            dirtyLabel={props.dirtyLabel}
            menuLanguage={props.menuLanguage}
            onOpenAppleAssistWindow={props.onOpenAppleAssistFromLMode}
            onReviewChanges={props.onReviewChangesFromLMode}
            onToggleTypewriterMode={() =>
              props.setEditorSettings((current) => ({
                ...current,
                lModeTypewriter: !current.lModeTypewriter,
              }))
            }
            reviewChangesAvailable={props.activeDirty}
            typewriterModeEnabled={props.editorSettings.lModeTypewriter}
            workspaceSidebarProps={{
              activePath: props.selectedImage?.path ?? props.activeTab?.path ?? null,
              compareSelectionEnabled: props.sidePaneMode === "compare",
              compareSourcePath: props.compareAnchor?.path ?? null,
              compareTargetPath: props.compareTarget?.path ?? null,
              copy: props.safeEditorCopy,
              fileOpsCopy: props.fileOpsCopy,
              onCreateFile: () => {
                if (props.workspaceRootPath) {
                  void props.createFile(props.workspaceRootPath);
                }
              },
              onCreateFolder: () => {
                if (props.workspaceRootPath) {
                  void props.createFolder(props.workspaceRootPath);
                }
              },
              onLoadDirectory: props.loadWorkspaceDirectory,
              onMoveEntry: props.onMoveEntry,
              onMoveToTrash: props.onMoveToTrash,
              onOpenContextMenu: props.openWorkspaceContextMenu,
              onOpenRootContextMenu: props.openRootWorkspaceContextMenu,
              onOpenFile: (path) => void props.openWorkspaceFile(path),
              onOpenWorkspace: () => void props.openWorkspace(),
              onClearCompareSelection: () => {
                props.clearCompareSource();
                props.clearCompareTarget();
              },
              onSelectCompareFile: props.selectWorkspaceCompareFile,
              onSubmitRename: props.onSubmitRename,
              renamingPath: props.renamingPath,
              requestRename: props.requestRename,
              workspaceRootPath: props.workspaceRootPath,
              workspaceTree: props.workspaceTree,
            }}
          />
        </>
      ) : null}
    </main>
  );
}

function isAmbientMode(theme: ResolvedTheme): theme is AmbientMode {
  return theme === "sakura" || theme === "yakou" || theme === "shokou";
}
