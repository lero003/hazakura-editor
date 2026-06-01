import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { ReviewSurface } from "../types";

// useReviewDeskController exposes the open / close / toggle actions
// for the v0.7 Review Desk entry point. It is intentionally thin:
// today the only user-visible action is the Cmd+Shift+R toggle and
// the close button on the visible shell. The action surface will
// grow when the AI candidate slice lands. See
// docs/reviews/v0.7-review-desk-design-decisions.md (R-4) and
// docs/reviews/v0.7-readiness-gate.md (R-1).
type UseReviewDeskControllerOptions = {
  reviewSurface: ReviewSurface;
  resetReviewDesk: () => void;
  setReviewSurface: Dispatch<SetStateAction<ReviewSurface>>;
};

export function useReviewDeskController({
  reviewSurface,
  resetReviewDesk,
  setReviewSurface,
}: UseReviewDeskControllerOptions) {
  const openReviewDesk = useCallback(() => {
    setReviewSurface("review");
  }, [setReviewSurface]);

  const closeReviewDesk = useCallback(() => {
    resetReviewDesk();
    setReviewSurface(null);
  }, [resetReviewDesk, setReviewSurface]);

  const toggleReviewDesk = useCallback(() => {
    if (reviewSurface === null) {
      setReviewSurface("review");
      return;
    }

    resetReviewDesk();
    setReviewSurface(null);
  }, [resetReviewDesk, reviewSurface, setReviewSurface]);

  return {
    closeReviewDesk,
    openReviewDesk,
    toggleReviewDesk,
  };
}
