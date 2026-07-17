export function PreviewUnavailablePane({
  ariaLabel,
  purposeHint,
  reason,
}: {
  ariaLabel: string;
  /** Optional short contrast with sibling pane (Preview vs e-book). */
  purposeHint?: string;
  reason: string;
}) {
  return (
    <div className="preview-unavailable" aria-label={ariaLabel}>
      {purposeHint ? (
        <p className="side-pane-purpose side-pane-purpose-empty">{purposeHint}</p>
      ) : null}
      <p className="preview-unavailable-reason">{reason}</p>
    </div>
  );
}
