import type { ComponentProps } from "react";
import type {
  AmbientIntensity,
  CompareCase,
  CompareViewState,
  EditorTab,
  MenuLanguage,
  ResolvedTheme,
  ReviewSurface as ReviewSurfaceKind,
} from "../types";
import type { ReviewDeskCopy } from "../locale";
import type { ReviewDeskMode } from "../types";
import { AmbientBackground } from "./AmbientBackground";
import { AppDocumentFeedback } from "./AppDocumentFeedback";
import { AppOverlays } from "./AppOverlays";
import { AppStatusBar } from "./AppStatusBar";
import { AppTopChrome } from "./AppTopChrome";
import { AppWorkspace } from "./AppWorkspace";
import { ReviewSurface } from "./ReviewSurface";

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
    menuLanguage: MenuLanguage;
    onApplyManualCandidate: (
      candidateText: string,
      documentTabId: string,
      documentContents: string,
    ) => void;
    onCloseReviewDesk: () => void;
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
    </main>
  );
}

type AmbientMode = "sakura" | "yakou" | "shokou" | "kouyou";

function isAmbientMode(theme: ResolvedTheme): theme is AmbientMode {
  return theme === "sakura" || theme === "yakou" || theme === "shokou" || theme === "kouyou";
}
