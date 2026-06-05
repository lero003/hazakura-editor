import type { ComponentProps } from "react";
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
import { AppleAssistReviewBar } from "./AppleAssistReviewBar";
import { ReviewSurface } from "../review/ReviewSurface";

export type AppShellProps = ComponentProps<typeof AppTopChrome> &
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
    onReviewChangesFromLMode: () => void;
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
  return (
    <main className="app-shell">
      {ambientMode ? (
        <AmbientBackground
          intensity={props.ambientIntensity}
          mode={ambientMode}
        />
      ) : null}
      <AppTopChrome {...props} />
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
        <AppWorkspace {...props} />
      )}
      <AppStatusBar {...props} />
      <AppOverlays {...props} />
      <AppleAssistReviewBar
        activeTabId={props.activeTabId}
        copy={props.lModeCopy}
        menuLanguage={props.menuLanguage}
        onDiscard={props.onDiscardAppleAssistEdit}
      />
      {props.lModeEnabled ? (
        <>
          <LModeExitPill
            copy={props.lModeCopy}
            onExit={props.onToggleLMode}
          />
          <LModeActionRail
            copy={props.lModeCopy}
            onExitToWorkspace={props.onExitLModeToWorkspace}
            onOpenAppleAssistWindow={props.onOpenAppleAssistFromLMode}
            onReviewChanges={props.onReviewChangesFromLMode}
            reviewChangesAvailable={props.activeDirty}
          />
        </>
      ) : null}
    </main>
  );
}

function isAmbientMode(theme: ResolvedTheme): theme is AmbientMode {
  return theme === "sakura" || theme === "yakou" || theme === "shokou";
}
