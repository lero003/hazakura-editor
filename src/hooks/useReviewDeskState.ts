import { useCallback, useState } from "react";
import type { ReviewDeskMode } from "../types";

// useReviewDeskState owns the v0.7 Review Desk state slots that
// reach beyond the B-1 `ReviewSurface` open/close flag (which lives
// in useAppViewState alongside rightPaneMode per B-1). The shape is
// the skeleton the readiness gate finding R-4 in
// docs/reviews/v0.7-readiness-gate.md recommended: a single owner
// for the future AI candidate, future case list, and decision log
// so App.tsx does not grow again. Today only the empty state and a
// placeholder pending-case slot are reachable; the candidate / apply
// flow lands in a later slice.
export function useReviewDeskState() {
  const [reviewDeskMode, setReviewDeskMode] =
    useState<ReviewDeskMode>("empty");
  // Placeholder slot for the future B-2 CompareCase that will be
  // rendered inside the Review Desk surface. Intentionally
  // `unknown | null` until the AI candidate slice lands so the type
  // does not leak CompareCase into a slice that is not yet wired.
  const [pendingReviewCase, setPendingReviewCase] = useState<unknown | null>(
    null,
  );

  const resetReviewDesk = useCallback(() => {
    setReviewDeskMode("empty");
    setPendingReviewCase(null);
  }, []);

  return {
    pendingReviewCase,
    resetReviewDesk,
    reviewDeskMode,
    setPendingReviewCase,
    setReviewDeskMode,
  };
}
