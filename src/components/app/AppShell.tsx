import { useMemo, useState, type ComponentProps } from "react";
import type {
  AmbientIntensity,
  EditorSettings,
  EditorTab,
  MenuLanguage,
  ResolvedTheme,
} from "../../types";
import type { ChangeReviewSnapshot } from "../../hooks/diff/useCompareExecution";
import type { LModeCopy } from "../../lib/locale";
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
import { getWorkspaceTabMarkerPaths } from "../../features/editor/editorTabs";

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
    editorSettings: EditorSettings;
    lModeCopy: LModeCopy;
    lModeEnabled: boolean;
    menuLanguage: MenuLanguage;
    onDiscardAppleAssistEdit: (
      tabId: string,
      before: string,
      after: string,
    ) => void;
    onConfirmPendingAssistDiscard: () => void;
    onCancelPendingAssistDiscard: () => void;
    pendingAssistDiscard: { sessionId: string; beforeBuffer: string } | null;
    onExitLModeToWorkspace: () => void;
    onOpenAppleAssistFromLMode: () => void;
    onReviewChangesFromLMode: () => Promise<ChangeReviewSnapshot | null>;
    onToggleLMode: () => void;
    resolvedTheme: ResolvedTheme;
  };

export function AppShell(props: AppShellProps) {
  const ambientMode = isAmbientMode(props.resolvedTheme) ? props.resolvedTheme : null;
  const [workspaceSidebarCollapsed, setWorkspaceSidebarCollapsed] =
    useState(false);
  const workspaceTabMarkers = useMemo(
    () => getWorkspaceTabMarkerPaths(props.tabs, props.workspaceRootPath),
    [props.tabs, props.workspaceRootPath],
  );

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
      <AppWorkspace
        {...props}
        onWorkspaceSidebarCollapsedChange={setWorkspaceSidebarCollapsed}
        workspaceSidebarCollapsedOverride={workspaceSidebarCollapsed}
      />
      <AppStatusBar {...props} />
      <AppOverlays {...props} />
      <AppleAssistReviewBar
        activeTabSessionId={props.activeTab?.sessionId ?? null}
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
              dirtyFilePaths: workspaceTabMarkers.dirtyFilePaths,
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
              openFilePaths: workspaceTabMarkers.openFilePaths,
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
