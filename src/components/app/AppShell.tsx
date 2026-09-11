import { SaveConflictDialog } from "./SaveConflictDialog";
import { useLocalAssistReviewNavigation } from "../../hooks/editor/useLocalAssistReviewNavigation";
import { useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
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
import { EdohiganBootSequence } from "./EdohiganBootSequence";
import { EdohiganShaderOverlay } from "./EdohiganShaderOverlay";
import { ShinkaiBootSequence } from "./ShinkaiBootSequence";
import { ShinkaiShaderOverlay } from "./ShinkaiShaderOverlay";
import { AppDocumentFeedback } from "./AppDocumentFeedback";
import { AppOverlays } from "./AppOverlays";
import { AppStatusBar } from "./AppStatusBar";
import { AppPrimaryToolbar } from "./AppPrimaryToolbar";
import { resolveWorkspaceNavigation } from "../../features/workspace/workspaceNavigation";
import { AppTopChrome } from "./AppTopChrome";
import { AppWorkspace } from "./AppWorkspace";
import { LModeActionRail } from "./LModeActionRail";
import { LModeExitPill } from "./LModeExitPill";
import { LModeWindowDragBand } from "./LModeWindowDragBand";
import { AppleAssistReviewBar } from "./AppleAssistReviewBar";
import { LocalAssistProposalReview } from "./LocalAssistProposalReview";
import type { LocalAssistProposal } from "../../features/editor/localAssistProposal";
import { useLocalAssistProposal } from "../../hooks/editor/useLocalAssistProposal";
import { getWorkspaceTabMarkerPaths } from "../../features/editor/editorTabs";
import { useCompactSidebarCollapse } from "../../hooks/app/useCompactSidebarCollapse";
import { useCrtMouseTracking } from "../../hooks/app/useCrtMouseTracking";

export type AppShellProps = Omit<
  ComponentProps<typeof AppTopChrome>,
  "onEditorSettingsChange"
> &
  ComponentProps<typeof AppDocumentFeedback> &
  ComponentProps<typeof AppWorkspace> &
  ComponentProps<typeof AppStatusBar> &
  ComponentProps<typeof AppOverlays> & {
    conflictDialogTab?: EditorTab | null;
    dismissConflictDialog?: () => void;
    saveConflictAs?: () => Promise<void>;
    focusAfterTransientSurface?: () => void;
    activeTab: EditorTab | null;
    onSaveDocument: () => Promise<void>;
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
    onApplyLocalAssistProposal: (
      proposal: LocalAssistProposal,
    ) => Promise<{ ok: true } | { ok: false; error: string }>;
    onDiscardLocalAssistProposal: (proposal: LocalAssistProposal) => void;
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
  const crtMode = props.resolvedTheme === "crt";
  const shinkaiMode = props.resolvedTheme === "shinkai";
  const edohiganMode = props.resolvedTheme === "edohigan";
  useCrtMouseTracking(crtMode);
  // 狭い窓ではサイドバーを一時的に畳む（保存設定は持たない・モック23）。
  const {
    collapsed: workspaceSidebarCollapsed,
    toggle: toggleWorkspaceSidebar,
    setCollapsed: setWorkspaceSidebarCollapsed,
  } = useCompactSidebarCollapse();
  const [readingOverlayOpen, setReadingOverlayOpen] = useState(false);
  const proposalReviewRef = useRef<HTMLDivElement>(null);

  const chapterReviewRequestRef = useRef(0);
  const chapterReviewQueueRef = useRef<Promise<void>>(Promise.resolve());
  const workspaceTabMarkers = useMemo(
    () => getWorkspaceTabMarkerPaths(props.tabs, props.workspaceRootPath),
    [props.tabs, props.workspaceRootPath],
  );
  // v2.6 B2.1: when an unapplied proposal is pending, prioritize the new
  // proposal review over the post-apply Review Bar so the two floating
  // panels never overlap at the same corner.
  const pendingProposal = useLocalAssistProposal(
    props.activeTab?.sessionId ?? null,
  ).proposal;
  // 07(P1): 「提案がある」と「レビュー面を見せている」を分ける。提案は保持したまま
  // 面だけ閉じられるようにしないと、「書く」で編集へ戻ってもレビューが本文を覆い、
  // 見えていない本文へ入力が届いてしまう。
  const [proposalReviewHidden, setProposalReviewHidden] = useState(false);
  useEffect(() => {
    // 新しい提案が来たら、また見せる（閉じたままにしない）。
    setProposalReviewHidden(false);
  }, [pendingProposal?.requestId]);
  const proposalReviewVisible =
    !!pendingProposal && !pendingProposal.streaming && !proposalReviewHidden;

  const openComparison = props.compareView ? props.getCompareCaseByKey(props.compareView.caseKey) : undefined;
  const comparisonName = openComparison?.kind === "file"
    ? `${openComparison.anchor.name} ↔ ${openComparison.target.name}`
    : openComparison?.documentLabel;
  const navigation = resolveWorkspaceNavigation({
    hasDocument: !!props.activeTab, imageVisible: !!props.selectedImage,
    sidePaneMode: props.sidePaneMode, referenceVisible: props.referencePaneVisible,
    referenceLoaded: !!props.referenceLoaded, hasProposal: !!pendingProposal && !pendingProposal.streaming,
    canReviewDisk: !!props.activeTab?.path && props.activeDirty,
    hasComparison: !!openComparison && openComparison.kind !== "candidate",
  });
  /** 本文領域を見える状態にする（狭幅のcompact表示・参照表示・別ペインを畳む）。 */
  const revealEditorRegion = () => {
    props.onCompactPreviewFocusChange?.("editor");
    if (props.referencePaneVisible) props.onToggleReference();
    if (props.sidePaneMode === "ebook" || props.sidePaneMode === "compare") props.hideSidePane();
  };
  const navigateToEditor = () => {
    if (!navigation.canNavigate || readingOverlayOpen) return;
    // 編集へ戻るときは、レビュー面だけ閉じる（提案は保持。反映は利用者の操作）。
    setProposalReviewHidden(true);
    revealEditorRegion();
    requestAnimationFrame(() => props.editorPaneRef.current?.focus());
  };
  /**
   * 提案レビューを開く導線（07 P2）。**領域を開示してから**フォーカスする。
   * 狭幅でプレビューや参照を表示していると本文領域が `display: none` になり、
   * タブとDOMが存在しても「開けた」ことにならない。
   */
  const revealProposalReview = () => {
    setProposalReviewHidden(false);
    revealEditorRegion();
  };
  // 別窓からの「提案を見る」導線。領域を開示してからフォーカスする（07 P2）。
  useLocalAssistReviewNavigation({ tabs: props.tabs, activeTab: props.activeTab,
    blocked: readingOverlayOpen || !!props.selectedImage,
    onSelectTab: props.onSelectTab, hostRef: proposalReviewRef,
    onRevealRegion: revealProposalReview });
  const topChrome = <AppTopChrome {...props} primaryToolbarPresent={!props.lModeEnabled}
    onEditorSettingsChange={props.setEditorSettings} />;

  return (
    <main className="app-shell v3-shell">
      {ambientMode ? (
        <AmbientBackground
          intensity={props.ambientIntensity}
          mode={ambientMode}
        />
      ) : null}
      {crtMode ? (
        <>
          <CrtShaderOverlay intensity={props.ambientIntensity} />
          <div className="crt-overlay" aria-hidden="true" />
          {/* 起動シーケンスは前景スキャンライン (.crt-overlay) の上に
              重ねるため最後に置く。同じ z-index でも DOM 順でこちらが勝つ。 */}
          <CrtBootSequence
            intensity={props.ambientIntensity}
            trigger={crtMode}
          />
        </>
      ) : null}
      {shinkaiMode ? (
        <>
          <ShinkaiShaderOverlay intensity={props.ambientIntensity} />
          <div className="shinkai-overlay" aria-hidden="true" />
          {/* 起動シーケンスは前景オーバーレイ (.shinkai-overlay) の上に
              重ねるため最後に置く。同じ z-index でも DOM 順でこちらが勝つ。 */}
          <ShinkaiBootSequence
            intensity={props.ambientIntensity}
            trigger={shinkaiMode}
          />
        </>
      ) : null}
      {edohiganMode ? (
        <>
          <EdohiganShaderOverlay intensity={props.ambientIntensity} />
          <div className="edohigan-overlay" aria-hidden="true" />
          {/* 起動シーケンスは前景オーバーレイ (.edohigan-overlay) の上に
              重ねるため最後に置く。同じ z-index でも DOM 順でこちらが勝つ。 */}
          <EdohiganBootSequence
            intensity={props.ambientIntensity}
            trigger={edohiganMode}
          />
        </>
      ) : null}
      <div className="primary-toolbar-slot">
        {!props.lModeEnabled && <AppPrimaryToolbar
          documentName={props.selectedImage?.name ?? props.activeTab?.name ?? "Hazakura Editor"}
          workspaceName={props.workspaceRootPath?.split(/[\\/]/).filter(Boolean).at(-1) ?? ""}
          menuLanguage={props.menuLanguage}
          sidebarCollapsed={workspaceSidebarCollapsed}
          onToggleSidebar={toggleWorkspaceSidebar}
          canSave={navigation.canNavigate && !readingOverlayOpen && !props.appleAssistGenerationLock && props.activeTab?.saveStatus !== "saving"}
          saving={props.activeTab?.saveStatus === "saving"}
          onSave={() => { void props.onSaveDocument(); }}
          assistSurfaceActive={props.assistSurfaceActive}
          agentWorkbenchAvailable={props.agentWorkbenchAvailable}
          appleAssistAvailability={props.appleAssistAvailability}
          appleAssistAvailabilityProbed={props.appleAssistAvailabilityProbed}
          sidePaneCopy={props.sidePaneCopy}
          onOpenAppleAssistWindow={props.onOpenAppleAssistWindow}
          onOpenAgentWindow={props.onOpenAgentWindow}
          navigation={{ ...navigation, canNavigate: navigation.canNavigate && !readingOverlayOpen,
            mode: readingOverlayOpen ? "read" : navigation.mode,
            documentName: props.activeTab?.name ?? "", menuLanguage: props.menuLanguage,
            referenceName: props.referenceCompare?.reference.name, comparisonName,
            contextKey: JSON.stringify([props.activeTab?.sessionId, pendingProposal?.requestId,
              props.compareView?.caseKey, props.referenceCompare?.reference.path, props.referenceCompare?.sourceFingerprint]),
            onWrite: navigateToEditor,
            onRead: () => {
              if (navigation.canNavigate && !readingOverlayOpen && props.sidePaneMode !== "ebook") props.onToggleEbook();
            },
            onReview: (target) => {
              if (!navigation.canNavigate || readingOverlayOpen) return;
              if (target === "proposal") proposalReviewRef.current?.querySelector<HTMLElement>("[role=region]")?.focus();
              if (target === "disk" && props.activeTab) props.onReviewChanges(props.activeTab);
              if (target === "reference" && !props.referencePaneVisible) props.onToggleReference();
              if (target === "comparison" && props.sidePaneMode !== "compare") props.onToggleDiff();
            },
          }}
        />}
      </div>
      <AppDocumentFeedback {...props} />
      {/* Floating tabs must share the shell stacking context with the drag band. */}
      {props.lModeEnabled && !readingOverlayOpen ? topChrome : null}
      <AppWorkspace
        {...props}
        documentChrome={props.lModeEnabled ? null : topChrome}
        proposalReviewRef={proposalReviewRef}
        proposalReviewVisible={proposalReviewVisible}
        onReturnToEditing={() => setProposalReviewHidden(true)}
        onReadingOverlayChange={setReadingOverlayOpen}
        compactPreviewFocus={props.compactPreviewFocus}
        onCompactPreviewFocusChange={props.onCompactPreviewFocusChange}
        onWorkspaceSidebarCollapsedChange={setWorkspaceSidebarCollapsed}
        workspaceSidebarCollapsedOverride={workspaceSidebarCollapsed}
      />
      <AppStatusBar {...props} />
      <AppOverlays {...props} />
      {props.conflictDialogTab ? <SaveConflictDialog
        key={props.conflictDialogTab.sessionId}
        tab={props.conflictDialogTab} menuLanguage={props.menuLanguage}
        onBack={() => { props.dismissConflictDialog?.(); props.focusAfterTransientSurface?.(); }}
        onCompare={() => {
          props.dismissConflictDialog?.();
          props.focusAfterTransientSurface?.();
          props.reviewTabAgainstDisk(props.conflictDialogTab!);
        }}
        onSaveAs={() => {
          props.dismissConflictDialog?.();
          void props.saveConflictAs?.().finally(() => props.focusAfterTransientSurface?.());
        }}
      /> : null}
      {!pendingProposal ? (
        <AppleAssistReviewBar
          activeTabSessionId={props.activeTab?.sessionId ?? null}
          diffInitiallyOpen={props.editorSettings.appleAssistDiffInitiallyOpen}
          menuLanguage={props.menuLanguage}
          onDiscard={props.onDiscardAppleAssistEdit}
        />
      ) : null}
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
              bookScopeChapterRelativePaths: props.bookScopeChapterRelativePaths,
              bookScopeNodes: props.bookScopeNodes,
              bookScopeChapters: props.bookScopeChapters,
              bookScopeResolving: props.bookScopeResolving,
              bookScopeSuggesting: props.bookScopeSuggesting,
              bookScopeSuggestionError: props.bookScopeSuggestionError,
              bookScopeUnavailable: props.bookScopeUnavailable,
              compareSelectionEnabled: props.sidePaneMode === "compare",
              compareSourcePath: props.compareAnchor?.path ?? null,
              compareTargetPath: props.compareTarget?.path ?? null,
              copy: props.safeEditorCopy,
              dirtyFilePaths: workspaceTabMarkers.dirtyFilePaths,
              fileOpsCopy: props.fileOpsCopy,
              menuLanguage: props.menuLanguage,
              onCommitBookScope: props.commitBookScopeNodes,
              onCancelBookScopeSuggestion: props.cancelBookScopeSuggestion,
              onCreateBookScopeSuggestion: props.createBookScopeSuggestion,
              onExportBookRecipe: props.exportBookRecipe,
              onImportBookRecipeDraft: props.importBookRecipeDraft,
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
              onCreateOkfScaffoldMinimal: () => {
                if (props.workspaceRootPath) {
                  void props.createOkfScaffoldAt(
                    props.workspaceRootPath,
                    "minimal",
                  );
                }
              },
              onCreateOkfScaffoldBookLike: () => {
                if (props.workspaceRootPath) {
                  void props.createOkfScaffoldAt(
                    props.workspaceRootPath,
                    "book-like",
                  );
                }
              },
              onLoadDirectory: props.loadWorkspaceDirectory,
              onMoveEntry: props.onMoveEntry,
              onMoveToTrash: props.onMoveToTrash,
              onOpenContextMenu: props.openWorkspaceContextMenu,
              onOpenRootContextMenu: props.openRootWorkspaceContextMenu,
              onOpenFile: (path) => void props.openWorkspaceFile(path),
              onOpenWorkspace: () => void props.openWorkspace(),
              onReviewChapterChanges: (path) => {
                const request = chapterReviewRequestRef.current + 1;
                chapterReviewRequestRef.current = request;
                const openRequest = chapterReviewQueueRef.current.then(() =>
                  Promise.resolve(props.openFilePath(path)),
                );
                chapterReviewQueueRef.current = openRequest.then(
                  () => undefined,
                  () => undefined,
                );
                void openRequest.then(
                  (tab) => {
                    if (request === chapterReviewRequestRef.current && tab) {
                      props.reviewTabAgainstDisk(tab);
                    }
                  },
                  () => undefined,
                );
              },
              onRevalidateBookScope: props.revalidateBookScope,
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
  return theme === "yakou" || theme === "shokou";
}
