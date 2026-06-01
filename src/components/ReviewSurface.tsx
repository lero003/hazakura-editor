import type { ReviewDeskMode } from "../types";
import type { ReviewDeskCopy } from "../locale";

type ReviewSurfaceProps = {
  onClose: () => void;
  reviewDeskCopy: ReviewDeskCopy;
  reviewDeskMode: ReviewDeskMode;
};

// Visible shell for the v0.7 Review Desk. Replaces the editor area
// when the parent surfaces `reviewSurface !== null`. Today it
// renders the empty state with a close button and a future slot for
// the B-2 CompareCase view. The candidate / apply flow and the
// persistent decision log are intentionally out of scope; see
// docs/reviews/v0.7-review-desk-design-decisions.md (B-1, B-2, R-3,
// R-4) and docs/reviews/v0.7-readiness-gate.md (R-1, R-2).
export function ReviewSurface({
  onClose,
  reviewDeskCopy,
  reviewDeskMode,
}: ReviewSurfaceProps) {
  return (
    <section
      className="review-surface"
      aria-label={reviewDeskCopy.surfaceLabel}
    >
      <header className="review-surface-header">
        <div className="review-surface-title">
          <span className="review-surface-eyebrow">
            {reviewDeskCopy.surfaceLabel}
          </span>
          <strong>{reviewDeskCopy.title}</strong>
        </div>
        <button
          type="button"
          className="review-surface-close"
          onClick={onClose}
          title={reviewDeskCopy.closeTitle}
        >
          {reviewDeskCopy.close}
        </button>
      </header>
      <div className="review-surface-body">
        {reviewDeskMode === "empty" ? (
          <ReviewSurfaceEmpty copy={reviewDeskCopy} />
        ) : (
          <ReviewSurfaceFutureSlot copy={reviewDeskCopy} />
        )}
      </div>
    </section>
  );
}

function ReviewSurfaceEmpty({ copy }: { copy: ReviewDeskCopy }) {
  return (
    <div className="review-surface-card">
      <span className="review-surface-eyebrow">{copy.surfaceLabel}</span>
      <strong>{copy.emptyIntro}</strong>
      <p>{copy.emptyBody}</p>
      <ReviewSurfaceFutureSlot copy={copy} />
    </div>
  );
}

function ReviewSurfaceFutureSlot({ copy }: { copy: ReviewDeskCopy }) {
  return (
    <div
      className="review-surface-future-slot"
      role="region"
      aria-label={copy.futureSlotHint}
    >
      <span className="review-surface-eyebrow">{copy.surfaceLabel}</span>
      <p>{copy.futureSlotHint}</p>
    </div>
  );
}
