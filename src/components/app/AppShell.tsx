import { useEffect, useMemo, useState, type ComponentProps } from "react";
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
import { CrtBootSequence } from "./CrtBootSequence";
import { CrtShaderOverlay } from "./CrtShaderOverlay";
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

/**
 * CRT テーマ用: mousemove を CSS 変数 (--crt-mx / --crt-my) に変換する。
 * 0..1 に正規化したマウス座標を :root に書き込み、app-shell.css の
 * text-shadow 色収差とビネットがマウスで悪化するようにする。
 * - crtMode && !prefers-reduced-motion のときだけリスナを起動。
 * - rAF スロットルで書き込み頻度を抑える。
 * - クリーンアップで変数を中央値 (0.5) に戻し、他テーマへ持ち越さない。
 */
function useCrtMouseTracking(enabled: boolean) {
  useEffect(() => {
    if (!enabled) {
      return;
    }
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const root = document.documentElement;
    let frame = 0;
    let pending: { x: number; y: number } | null = null;

    const flush = () => {
      frame = 0;
      if (!pending) {
        return;
      }
      const { x, y } = pending;
      pending = null;
      root.style.setProperty("--crt-mx", x.toFixed(3));
      root.style.setProperty("--crt-my", y.toFixed(3));
    };

    const onMove = (event: MouseEvent) => {
      pending = {
        x: event.clientX / Math.max(window.innerWidth, 1),
        y: event.clientY / Math.max(window.innerHeight, 1),
      };
      if (frame === 0) {
        frame = window.requestAnimationFrame(flush);
      }
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
      // 他テーマへ持ち越さないよう中央値に戻す
      root.style.setProperty("--crt-mx", "0.5");
      root.style.setProperty("--crt-my", "0.5");
    };
  }, [enabled]);
}

export function AppShell(props: AppShellProps) {
  const ambientMode = isAmbientMode(props.resolvedTheme) ? props.resolvedTheme : null;
  const crtMode = props.resolvedTheme === "crt";
  useCrtMouseTracking(crtMode);
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
      {crtMode ? (
        <>
          <CrtBootSequence
            intensity={props.ambientIntensity}
            trigger={crtMode}
          />
          <CrtShaderOverlay intensity={props.ambientIntensity} />
          <div className="crt-overlay" aria-hidden="true" />
        </>
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
