import type { ComponentProps } from "react";
import type {
  CompareCase,
  CompareViewState,
  EditorTab,
  MenuLanguage,
  ResolvedTheme,
  ReviewSurface as ReviewSurfaceKind,
} from "../types";
import type { ReviewDeskCopy } from "../locale";
import type { ReviewDeskMode } from "../types";
import { AppDocumentFeedback } from "./AppDocumentFeedback";
import { AppOverlays } from "./AppOverlays";
import { AppStatusBar } from "./AppStatusBar";
import { AppTopChrome } from "./AppTopChrome";
import { AppWorkspace } from "./AppWorkspace";
import { ReviewSurface } from "./ReviewSurface";
import { SakuraPetals } from "./SakuraPetals";

export type AppShellProps = ComponentProps<typeof AppTopChrome> &
  ComponentProps<typeof AppDocumentFeedback> &
  ComponentProps<typeof AppWorkspace> &
  ComponentProps<typeof AppStatusBar> &
  ComponentProps<typeof AppOverlays> & {
    activeTab: EditorTab | null;
    candidateCompareCase: CompareCase | null;
    candidateCompareView: CompareViewState | null;
    candidateErrorMessage: string | null;
    candidateInputText: string;
    clearCandidate: () => void;
    menuLanguage: MenuLanguage;
    onCloseReviewDesk: () => void;
    resolvedTheme: ResolvedTheme;
    reviewDeskCopy: ReviewDeskCopy;
    reviewDeskMode: ReviewDeskMode;
    reviewSurface: ReviewSurfaceKind;
    runCandidateCompare: (params: {
      bufferContents: string;
      documentPath: string;
      documentLabel: string;
      leftColumnLabel: string;
      rightColumnLabel: string;
      candidateSourceLabel: string;
      candidateText: string;
    }) => { ok: true } | { ok: false; error: string };
    setCandidateInputText: (value: string) => void;
    zenMode: boolean;
  };

export function AppShell(props: AppShellProps) {
  return (
    <main className={`app-shell${props.zenMode ? " zen-mode" : ""}`}>
      {props.resolvedTheme === "sakura" ? <SakuraPetals /> : null}
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
          menuLanguage={props.menuLanguage}
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
