import type { ReviewSurface as ReviewSurfaceKind } from "../types";

type ReviewSurfaceProps = {
  reviewSurface: ReviewSurfaceKind;
};

// Placeholder host for the v0.7 Review Desk. Replaces the editor area
// when reviewSurface is non-null. The actual sub-states (AI candidate,
// change review, draft review, conflict review) and the action bar are
// implemented in later slices. See
// docs/reviews/v0.7-review-desk-design-decisions.md (B-1) and
// docs/reviews/v0.7-readiness-gate.md (R-1, R-2).
export function ReviewSurface({ reviewSurface }: ReviewSurfaceProps) {
  return (
    <section className="review-surface" aria-label="Review Desk">
      <p>Review Desk placeholder ({reviewSurface})</p>
    </section>
  );
}
