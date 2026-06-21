import { useCallback, useState } from "react";
import type { CompareCase, CompareViewState } from "../../types";
import { buildLineDiff } from "../../features/diff/diff";

// Kept as the internal candidate-review primitive for AI assist:
// it owns the candidate CompareCase + diff view, without exposing a
// standalone Review Desk screen in the main editor chrome.
export function useReviewDeskState() {
  const [candidateCompareCase, setCandidateCompareCaseState] =
    useState<CompareCase | null>(null);
  const [candidateCompareView, setCandidateCompareViewState] =
    useState<CompareViewState | null>(null);
  const [candidateErrorMessage, setCandidateErrorMessageState] = useState<
    string | null
  >(null);

  // Build a candidate CompareCase + diff view from the active buffer
  // and an AI-generated candidate. A failed compare clears any stale
  // preview so Apply cannot target an older candidate.
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
    setCandidateCompareCaseState(null);
    setCandidateCompareViewState(null);
    setCandidateErrorMessageState(null);
  }, []);

  return {
    candidateCompareCase,
    candidateCompareView,
    candidateErrorMessage,
    clearCandidate,
    runCandidateCompare,
  };
}
