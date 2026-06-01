import type {
  CompareCase,
  CompareViewState,
  EditorTab,
  MenuLanguage,
  ReviewDeskMode,
} from "../types";
import type { ReviewDeskCopy } from "../locale";
import { DiffBody } from "./DiffBody";

type ReviewSurfaceProps = {
  activeTab: EditorTab | null;
  candidateCompareCase: CompareCase | null;
  candidateCompareView: CompareViewState | null;
  candidateErrorMessage: string | null;
  candidateInputText: string;
  clearCandidate: () => void;
  menuLanguage: MenuLanguage;
  onClose: () => void;
  reviewDeskCopy: ReviewDeskCopy;
  reviewDeskMode: ReviewDeskMode;
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
};

// Visible shell for the v0.7 Review Desk. Replaces the editor area
// when the parent surfaces `reviewSurface !== null`. Renders the
// manual candidate paste area plus a diff preview of the active
// buffer against the candidate text using the B-2 CompareCase /
// CompareViewState + DiffBody pipeline. The apply / dismiss log and
// the persistent decision log are intentionally out of scope; see
// docs/reviews/v0.7-review-desk-design-decisions.md (B-1, B-2, R-3,
// R-4) and docs/reviews/v0.7-readiness-gate.md (R-1, R-2).
export function ReviewSurface({
  activeTab,
  candidateCompareCase,
  candidateCompareView,
  candidateErrorMessage,
  candidateInputText,
  clearCandidate,
  menuLanguage,
  onClose,
  reviewDeskCopy,
  reviewDeskMode,
  runCandidateCompare,
  setCandidateInputText,
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
        ) : null}
        <ReviewSurfaceCandidateSection
          activeTab={activeTab}
          candidateCompareCase={candidateCompareCase}
          candidateCompareView={candidateCompareView}
          candidateErrorMessage={candidateErrorMessage}
          candidateInputText={candidateInputText}
          clearCandidate={clearCandidate}
          copy={reviewDeskCopy}
          menuLanguage={menuLanguage}
          runCandidateCompare={runCandidateCompare}
          setCandidateInputText={setCandidateInputText}
        />
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
    </div>
  );
}

type ReviewSurfaceCandidateSectionProps = {
  activeTab: EditorTab | null;
  candidateCompareCase: CompareCase | null;
  candidateCompareView: CompareViewState | null;
  candidateErrorMessage: string | null;
  candidateInputText: string;
  clearCandidate: () => void;
  copy: ReviewDeskCopy;
  menuLanguage: MenuLanguage;
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
};

function ReviewSurfaceCandidateSection({
  activeTab,
  candidateCompareCase,
  candidateCompareView,
  candidateErrorMessage,
  candidateInputText,
  clearCandidate,
  copy,
  menuLanguage,
  runCandidateCompare,
  setCandidateInputText,
}: ReviewSurfaceCandidateSectionProps) {
  const hasActiveTab = activeTab !== null;
  const canCompare = hasActiveTab && candidateInputText.length > 0;
  const canClear =
    candidateInputText.length > 0 ||
    candidateCompareCase !== null ||
    candidateErrorMessage !== null;

  const handleCompare = () => {
    if (!activeTab) {
      return;
    }
    runCandidateCompare({
      bufferContents: activeTab.contents,
      documentPath: activeTab.path,
      documentLabel: activeTab.name,
      leftColumnLabel: copy.candidateColumnLeft,
      rightColumnLabel: copy.candidateColumnRight,
      candidateSourceLabel: copy.candidateSourceManual,
      candidateText: candidateInputText,
    });
  };

  return (
    <div className="review-surface-candidate">
      <div className="review-surface-candidate-input">
        <label
          className="review-surface-candidate-label"
          htmlFor="review-surface-candidate-textarea"
        >
          {copy.candidateInputLabel}
        </label>
        <p className="review-surface-candidate-hint">
          {copy.candidateInputHint}
        </p>
        <textarea
          id="review-surface-candidate-textarea"
          className="review-surface-candidate-textarea"
          value={candidateInputText}
          onChange={(event) => setCandidateInputText(event.target.value)}
          placeholder={copy.candidateInputPlaceholder}
          spellCheck={false}
          rows={10}
          disabled={!hasActiveTab}
        />
        {!hasActiveTab ? (
          <p className="review-surface-candidate-empty" role="note">
            <strong>{copy.candidateEmptyHeading}</strong>
            <span>{copy.candidateEmptyHint}</span>
          </p>
        ) : null}
        <div className="review-surface-candidate-actions">
          <button
            type="button"
            className="review-surface-candidate-compare"
            onClick={handleCompare}
            disabled={!canCompare}
            title={
              canCompare
                ? copy.candidateCompareButtonTitle
                : copy.candidateCompareDisabledHint
            }
          >
            {copy.candidateCompareButton}
          </button>
          <button
            type="button"
            className="review-surface-candidate-clear"
            onClick={clearCandidate}
            disabled={!canClear}
            title={copy.candidateClearButtonTitle}
          >
            {copy.candidateClearButton}
          </button>
        </div>
        {candidateErrorMessage !== null ? (
          <p
            className="review-surface-candidate-error"
            role="alert"
            aria-live="polite"
          >
            {localizeCandidateError(candidateErrorMessage, menuLanguage)}
          </p>
        ) : null}
      </div>
      <ReviewSurfaceCandidatePreview
        candidateCompareCase={candidateCompareCase}
        candidateCompareView={candidateCompareView}
        copy={copy}
        menuLanguage={menuLanguage}
      />
    </div>
  );
}

function localizeCandidateError(
  rawMessage: string,
  menuLanguage: MenuLanguage,
): string {
  if (
    rawMessage.includes("too large for the comparison preview") ||
    rawMessage.includes("comparison preview")
  ) {
    return menuLanguage === "ja"
      ? "現在のバッファと手動候補の差分が大きすぎるため、比較できません。"
      : "The buffer and candidate combination is too large to diff.";
  }
  return rawMessage;
}

type ReviewSurfaceCandidatePreviewProps = {
  candidateCompareCase: CompareCase | null;
  candidateCompareView: CompareViewState | null;
  copy: ReviewDeskCopy;
  menuLanguage: MenuLanguage;
};

function ReviewSurfaceCandidatePreview({
  candidateCompareCase,
  candidateCompareView,
  copy,
  menuLanguage,
}: ReviewSurfaceCandidatePreviewProps) {
  const hasPreview =
    candidateCompareCase !== null &&
    candidateCompareView !== null &&
    candidateCompareCase.kind === "candidate";

  return (
    <div
      className="review-surface-candidate-preview"
      role="region"
      aria-label={copy.candidatePreviewTitle}
    >
      <div className="review-surface-candidate-preview-header">
        <div className="review-surface-candidate-preview-title">
          <span className="review-surface-eyebrow">{copy.surfaceLabel}</span>
          <strong>{copy.candidatePreviewTitle}</strong>
        </div>
        {hasPreview && candidateCompareView ? (
          <div
            className="review-surface-candidate-summary"
            aria-label={copy.candidatePreviewTitle}
          >
            <span className="review-surface-candidate-summary-cell added">
              +{candidateCompareView.additions}
            </span>
            <span className="review-surface-candidate-summary-cell removed">
              -{candidateCompareView.removals}
            </span>
          </div>
        ) : null}
      </div>
      {hasPreview && candidateCompareCase && candidateCompareView ? (
        <div
          className="review-surface-candidate-table"
          role="table"
          aria-label={copy.candidatePreviewTitle}
        >
          <div
            className="review-surface-candidate-table-header"
            role="row"
          >
            <span className="review-surface-candidate-line-number" />
            <span className="review-surface-candidate-column-label">
              {candidateCompareCase.leftColumnLabel}
            </span>
            <span className="review-surface-candidate-line-number" />
            <span className="review-surface-candidate-column-label">
              {candidateCompareCase.rightColumnLabel}
            </span>
          </div>
          <DiffBody
            compareCase={candidateCompareCase}
            menuLanguage={menuLanguage}
            view={candidateCompareView}
          />
        </div>
      ) : (
        <p className="review-surface-candidate-preview-empty">
          {copy.candidatePreviewEmpty}
        </p>
      )}
    </div>
  );
}
