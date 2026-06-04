import type {
  BaseTheme,
  CompareCase,
  CompareViewState,
  EditorSettings,
  EditorTab,
  MenuLanguage,
  ReviewDeskMode,
} from "../../types";
import { isJapaneseMenuLanguage } from "../../types";
import { isKanaStyle } from "../../lib/locale/_helpers";
import type { ReviewDeskCopy } from "../../lib/locale";
import { CandidateEditor } from "../editor/CandidateEditor";
import { DiffBody } from "../diff/DiffBody";

type ReviewSurfaceProps = {
  activeTab: EditorTab | null;
  candidateCompareCase: CompareCase | null;
  candidateCompareView: CompareViewState | null;
  candidateErrorMessage: string | null;
  candidateInputText: string;
  clearCandidate: () => void;
  editorSettings: EditorSettings;
  editorTheme: BaseTheme;
  menuLanguage: MenuLanguage;
  onApplyCandidate: (
    candidateText: string,
    documentTabId: string,
    documentContents: string,
  ) => void;
  onClose: () => void;
  reviewDeskCopy: ReviewDeskCopy;
  reviewDeskMode: ReviewDeskMode;
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

// Visible shell for the v0.7 Review Desk. Replaces the editor area
// when the parent surfaces `reviewSurface !== null`. Renders the
// manual candidate paste area plus a diff preview of the active
// buffer against the candidate text using the B-2 CompareCase /
// CompareViewState + DiffBody pipeline. Apply is explicit and only
// updates the current tab buffer; the persistent dismiss / decision
// log remains out of scope. See
// docs/archive/reviews/v0.7-review-desk-design-decisions.md (B-1, B-2, R-3,
// R-4) and docs/archive/reviews/v0.7-readiness-gate.md (R-1, R-2).
export function ReviewSurface({
  activeTab,
  candidateCompareCase,
  candidateCompareView,
  candidateErrorMessage,
  candidateInputText,
  clearCandidate,
  editorSettings,
  editorTheme,
  menuLanguage,
  onApplyCandidate,
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
          editorSettings={editorSettings}
          editorTheme={editorTheme}
          menuLanguage={menuLanguage}
          onApplyCandidate={onApplyCandidate}
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
  editorSettings: EditorSettings;
  editorTheme: BaseTheme;
  menuLanguage: MenuLanguage;
  onApplyCandidate: (
    candidateText: string,
    documentTabId: string,
    documentContents: string,
  ) => void;
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

function ReviewSurfaceCandidateSection({
  activeTab,
  candidateCompareCase,
  candidateCompareView,
  candidateErrorMessage,
  candidateInputText,
  clearCandidate,
  copy,
  editorSettings,
  editorTheme,
  menuLanguage,
  onApplyCandidate,
  runCandidateCompare,
  setCandidateInputText,
}: ReviewSurfaceCandidateSectionProps) {
  const hasActiveTab = activeTab !== null;
  const canCompare = hasActiveTab && candidateInputText.length > 0;
  const canClear =
    candidateInputText.length > 0 ||
    candidateCompareCase !== null ||
    candidateErrorMessage !== null;
  const candidateLabelId = "review-surface-candidate-editor-label";
  const candidateHintId = "review-surface-candidate-editor-hint";

  const handleCompare = () => {
    if (!activeTab) {
      return;
    }
    runCandidateCompare({
      bufferContents: activeTab.contents,
      documentTabId: activeTab.id,
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
          id={candidateLabelId}
          className="review-surface-candidate-label"
        >
          {copy.candidateInputLabel}
        </label>
        <p id={candidateHintId} className="review-surface-candidate-hint">
          {copy.candidateInputHint}
        </p>
        <CandidateEditor
          ariaLabel={copy.candidateInputLabel}
          describedById={candidateHintId}
          documentKey="review-desk-candidate"
          fontSize={editorSettings.fontSize}
          labelledById={candidateLabelId}
          placeholder={copy.candidateInputPlaceholder}
          readOnly={!hasActiveTab}
          spellcheckEnabled={editorSettings.spellcheckEnabled}
          tabSize={editorSettings.tabSize}
          theme={editorTheme}
          value={candidateInputText}
          wrapLines={editorSettings.wrapLines}
          onChange={setCandidateInputText}
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
        activeTab={activeTab}
        menuLanguage={menuLanguage}
        onApplyCandidate={onApplyCandidate}
        onReCompare={handleCompare}
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
    if (isKanaStyle(menuLanguage)) {
      return "くらべるには おおきすぎます";
    }
    if (isJapaneseMenuLanguage(menuLanguage)) {
      return "現在のバッファと手動候補の差分が大きすぎるため、比較できません。";
    }
    return "The buffer and candidate combination is too large to diff.";
  }
  return rawMessage;
}

type ReviewSurfaceCandidatePreviewProps = {
  activeTab: EditorTab | null;
  candidateCompareCase: CompareCase | null;
  candidateCompareView: CompareViewState | null;
  copy: ReviewDeskCopy;
  menuLanguage: MenuLanguage;
  onApplyCandidate: (
    candidateText: string,
    documentTabId: string,
    documentContents: string,
  ) => void;
  onReCompare: () => void;
};

function ReviewSurfaceCandidatePreview({
  activeTab,
  candidateCompareCase,
  candidateCompareView,
  copy,
  menuLanguage,
  onApplyCandidate,
  onReCompare,
}: ReviewSurfaceCandidatePreviewProps) {
  const hasRenderedPreview =
    candidateCompareCase !== null &&
    candidateCompareView !== null &&
    candidateCompareCase.kind === "candidate";
  const staleness = computeCandidateStaleness(candidateCompareCase, activeTab);
  const isStale = staleness.kind !== "fresh";
  const canApply = hasRenderedPreview && !isStale;

  const handleApply = () => {
    if (!canApply || candidateCompareCase?.kind !== "candidate") {
      return;
    }

    onApplyCandidate(
      candidateCompareCase.candidateText,
      candidateCompareCase.documentTabId,
      candidateCompareCase.documentContents,
    );
  };

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
        {hasRenderedPreview && candidateCompareView ? (
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
        <button
          type="button"
          className="review-surface-candidate-apply"
          onClick={handleApply}
          disabled={!canApply}
          title={
            canApply
              ? copy.candidateApplyButtonTitle
              : copy.candidateApplyDisabledHint
          }
        >
          {copy.candidateApplyButton}
        </button>
      </div>
      {hasRenderedPreview && candidateCompareCase ? (
        <ReviewSurfaceCandidatePreviewMeta
          compareCase={candidateCompareCase}
          copy={copy}
        />
      ) : null}
      {hasRenderedPreview && candidateCompareCase ? (
        <p className="review-surface-candidate-apply-note">
          {copy.candidateApplyWillMarkUnsaved}
        </p>
      ) : null}
      {hasRenderedPreview && candidateCompareCase && isStale ? (
        <ReviewSurfaceCandidateStaleBanner
          staleness={staleness}
          compareCase={candidateCompareCase}
          copy={copy}
          onReCompare={onReCompare}
        />
      ) : null}
      {hasRenderedPreview && candidateCompareCase && candidateCompareView ? (
        <div
          className={
            "review-surface-candidate-table" +
            (isStale ? " is-stale" : "")
          }
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

type ReviewSurfaceCandidatePreviewMetaProps = {
  compareCase: CompareCase;
  copy: ReviewDeskCopy;
};

function ReviewSurfaceCandidatePreviewMeta({
  compareCase,
  copy,
}: ReviewSurfaceCandidatePreviewMetaProps) {
  if (compareCase.kind !== "candidate") {
    return null;
  }
  const bufferLines = countTextLines(compareCase.documentContents);
  const bufferChars = compareCase.documentContents.length;
  const candidateLines = countTextLines(compareCase.candidateText);
  const candidateChars = compareCase.candidateText.length;
  return (
    <dl className="review-surface-candidate-preview-meta">
      <div className="review-surface-candidate-preview-meta-cell">
        <dt>{copy.candidatePreviewTargetLabel}</dt>
        <dd title={compareCase.documentPath}>
          {compareCase.documentLabel}
        </dd>
      </div>
      <div className="review-surface-candidate-preview-meta-cell">
        <dt>{copy.candidatePreviewBufferAtCompareLabel}</dt>
        <dd>
          {copy.candidatePreviewBufferAtCompareText(bufferLines, bufferChars)}
        </dd>
      </div>
      <div className="review-surface-candidate-preview-meta-cell">
        <dt>{copy.candidatePreviewCandidateSizeLabel}</dt>
        <dd>
          {copy.candidatePreviewCandidateSizeText(
            candidateLines,
            candidateChars,
          )}
        </dd>
      </div>
      <div className="review-surface-candidate-preview-meta-cell">
        <dt>{copy.candidatePreviewComparedAtLabel}</dt>
        <dd>{formatCompareTimestamp(compareCase.comparedAt)}</dd>
      </div>
    </dl>
  );
}

type CandidateStaleness =
  | { kind: "fresh" }
  | { kind: "no-active-tab" }
  | { kind: "tab-switched"; activeTabLabel: string | null }
  | { kind: "buffer-edited" };

function computeCandidateStaleness(
  compareCase: CompareCase | null,
  activeTab: EditorTab | null,
): CandidateStaleness {
  if (compareCase === null || compareCase.kind !== "candidate") {
    return { kind: "fresh" };
  }
  if (activeTab === null) {
    return { kind: "no-active-tab" };
  }
  if (activeTab.id !== compareCase.documentTabId) {
    return { kind: "tab-switched", activeTabLabel: activeTab.name };
  }
  if (activeTab.contents !== compareCase.documentContents) {
    return { kind: "buffer-edited" };
  }
  return { kind: "fresh" };
}

type ReviewSurfaceCandidateStaleBannerProps = {
  compareCase: CompareCase;
  staleness: CandidateStaleness;
  copy: ReviewDeskCopy;
  onReCompare: () => void;
};

function ReviewSurfaceCandidateStaleBanner({
  compareCase,
  staleness,
  copy,
  onReCompare,
}: ReviewSurfaceCandidateStaleBannerProps) {
  if (staleness.kind === "fresh") {
    return null;
  }
  const reason = (() => {
    if (staleness.kind === "no-active-tab") {
      return copy.candidateStaleReasonNoActiveTab;
    }
    if (staleness.kind === "buffer-edited") {
      return copy.candidateStaleReasonBufferEdited;
    }
    return copy.candidateStaleReasonTabSwitched(staleness.activeTabLabel);
  })();
  const targetFileName =
    compareCase.kind === "candidate" ? compareCase.documentLabel : "";
  return (
    <div
      className="review-surface-candidate-stale"
      role="status"
      aria-live="polite"
    >
      <div className="review-surface-candidate-stale-text">
        <strong>{copy.candidateStaleHeading}</strong>
        <span>{reason}</span>
        {targetFileName.length > 0 ? (
          <span className="review-surface-candidate-stale-target">
            {copy.candidatePreviewTargetLabel}: {targetFileName}
          </span>
        ) : null}
      </div>
      <button
        type="button"
        className="review-surface-candidate-stale-action"
        disabled={staleness.kind === "no-active-tab"}
        onClick={onReCompare}
        title={copy.candidateStaleActionReCompare}
      >
        {copy.candidateStaleActionReCompare}
      </button>
    </div>
  );
}

function formatCompareTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function countTextLines(text: string): number {
  if (text.length === 0) {
    return 0;
  }
  return text.split("\n").length;
}
