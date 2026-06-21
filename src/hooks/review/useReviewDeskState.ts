import { useCallback, useState } from "react";
import type {
  CandidateInputSource,
  CompareCase,
  CompareViewState,
  ReviewDeskMode,
} from "../../types";
import { buildLineDiff } from "../../features/diff/diff";

// useReviewDeskState owns the v0.7 Review Desk state slots that
// reach beyond the B-1 `ReviewSurface` open/close flag (which lives
// in useAppViewState alongside rightPaneMode per B-1). The shape is
// the skeleton the readiness gate finding R-4 in
// docs/archive/reviews/v0.7-readiness-gate.md recommended: a single owner
// for the manual candidate input, the diff preview, and the future
// case list / decision log so App.tsx does not grow again. Today
// the candidate / diff-preview slots and manual apply reset path are
// wired; the persistent dismiss / decision log stays deferred. See
// docs/archive/reviews/v0.7-review-desk-design-decisions.md (R-4).
export function useReviewDeskState() {
  const [reviewDeskMode, setReviewDeskMode] =
    useState<ReviewDeskMode>("empty");
  // Manual candidate input that the user pastes into the Review
  // Desk textarea. Empty string means no input yet; a non-empty
  // string paired with a null compare view means the user has not
  // pressed Compare yet.
  const [candidateInputText, setCandidateInputTextState] = useState("");
  const [candidateInputSource, setCandidateInputSource] =
    useState<CandidateInputSource>({ kind: "manual" });
  // Compiled CompareCase for the manual candidate preview, or null
  // when no preview is being shown. Kept separate from
  // useCompareState so the right-pane compare route is not
  // affected.
  const [candidateCompareCase, setCandidateCompareCaseState] =
    useState<CompareCase | null>(null);
  // Diff view for the manual candidate preview, or null when the
  // Compare button has not been pressed or after a reset.
  const [candidateCompareView, setCandidateCompareViewState] =
    useState<CompareViewState | null>(null);
  // Localized error message from the most recent Compare attempt
  // (e.g. the buffer / candidate combination is too large for the
  // line-diff algorithm). Cleared on the next Compare press, on
  // Clear, and on reset.
  const [candidateErrorMessage, setCandidateErrorMessageState] = useState<
    string | null
  >(null);

  const setCandidateInputText = useCallback((value: string) => {
    setCandidateInputTextState(value);
    setCandidateInputSource((currentSource) =>
      value.length === 0
        ? { kind: "manual" }
        : currentSource.kind === "file"
          ? { ...currentSource, edited: true }
          : { kind: "manual" },
    );
    setCandidateCompareCaseState(null);
    setCandidateCompareViewState(null);
    setCandidateErrorMessageState(null);
  }, []);
  const setCandidateInputFromFile = useCallback(
    (value: string, sourceName: string) => {
      setCandidateInputTextState(value);
      setCandidateInputSource({
        kind: "file",
        name: sourceName,
        edited: false,
      });
      setCandidateCompareCaseState(null);
      setCandidateCompareViewState(null);
      setCandidateErrorMessageState(null);
    },
    [],
  );

  const setCandidateCompare = useCallback(
    (compareCase: CompareCase, view: CompareViewState) => {
      setCandidateCompareCaseState(compareCase);
      setCandidateCompareViewState(view);
    },
    [],
  );

  // Build a candidate CompareCase + diff view from the active
  // buffer and the candidate input. Returns ok / error so the
  // caller can localize the error message using the active menu
  // language. Does not clear the existing candidate input on
  // failure so the user can edit and retry. A failed compare clears
  // any stale preview so Apply cannot target an older candidate.
  const runCandidateCompare = useCallback(
    (params: {
      bufferContents: string;
      documentTabId: string;
      documentPath: string;
      documentLabel: string;
      leftColumnLabel: string;
      rightColumnLabel: string;
      candidateSourceLabel: string;
      candidateText: string;
    }): { ok: true } | { ok: false; error: string } => {
      setCandidateErrorMessageState(null);

      try {
        const diff = buildLineDiff(params.bufferContents, params.candidateText);
        const compareCase: CompareCase = {
          kind: "candidate",
          key: crypto.randomUUID(),
          documentTabId: params.documentTabId,
          documentContents: params.bufferContents,
          documentPath: params.documentPath,
          documentLabel: params.documentLabel,
          leftColumnLabel: params.leftColumnLabel,
          rightColumnLabel: params.rightColumnLabel,
          candidateSourceLabel: params.candidateSourceLabel,
          candidateText: params.candidateText,
          comparedAt: Date.now(),
        };
        setCandidateCompareCaseState(compareCase);
        setCandidateCompareViewState({
          caseKey: compareCase.key,
          ...diff,
        });
        return { ok: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setCandidateCompareCaseState(null);
        setCandidateCompareViewState(null);
        setCandidateErrorMessageState(message);
        return { ok: false, error: message };
      }
    },
    [],
  );

  const clearCandidate = useCallback(() => {
    setCandidateInputTextState("");
    setCandidateInputSource({ kind: "manual" });
    setCandidateCompareCaseState(null);
    setCandidateCompareViewState(null);
    setCandidateErrorMessageState(null);
  }, []);

  const resetReviewDesk = useCallback(() => {
    setReviewDeskMode("empty");
    setCandidateInputTextState("");
    setCandidateInputSource({ kind: "manual" });
    setCandidateCompareCaseState(null);
    setCandidateCompareViewState(null);
    setCandidateErrorMessageState(null);
  }, []);

  return {
    candidateCompareCase,
    candidateCompareView,
    candidateErrorMessage,
    candidateInputSource,
    candidateInputText,
    clearCandidate,
    resetReviewDesk,
    reviewDeskMode,
    runCandidateCompare,
    setCandidateCompare,
    setCandidateInputFromFile,
    setCandidateInputText,
    setReviewDeskMode,
  };
}
