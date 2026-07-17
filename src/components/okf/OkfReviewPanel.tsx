import { useEffect, useMemo, useRef } from "react";
import type {
  OkfFileKind,
  OkfFindingSeverity,
  OkfReviewFinding,
  OkfReviewResult,
} from "../../features/okf";
import { presentOkfReviewSurface } from "../../features/okf";
import { isImeComposing } from "../../lib/keyboard";
import {
  formatOkfFindingMessage,
  formatOkfMoreCount,
  formatOkfSurfaceStatus,
  formatOkfTruncationMessage,
  getOkfReviewCopy,
  type OkfReviewCopy,
} from "../../lib/locale/okfReview";
import type { MenuLanguage } from "../../types";

type OkfReviewPanelProps = {
  bundleRoot: string | null;
  cancelRequested: boolean;
  error: string | null;
  isPathDirty: (relativePath: string) => boolean;
  menuLanguage: MenuLanguage;
  onCancelScan: () => void;
  onClose: () => void;
  onOpenConcept: (relativePath: string, sourceOffset?: number) => void;
  onRerun: () => void;
  result: OkfReviewResult | null;
  rerunError: string | null;
  scanning: boolean;
  workspaceOpen: boolean;
};

function kindLabel(kind: OkfFileKind, copy: OkfReviewCopy): string {
  switch (kind) {
    case "concept":
      return copy.kindConcept;
    case "index":
      return copy.kindIndex;
    case "log":
      return copy.kindLog;
    case "unreadable":
      return copy.kindUnreadable;
  }
}

function severityLabel(
  severity: OkfFindingSeverity,
  copy: OkfReviewCopy,
): string {
  switch (severity) {
    case "failure":
      return copy.severityFailure;
    case "advice":
      return copy.severityAdvice;
    case "info":
      return copy.severityInfo;
  }
}

export function OkfReviewPanel({
  bundleRoot,
  cancelRequested,
  error,
  isPathDirty,
  menuLanguage,
  onCancelScan,
  onClose,
  onOpenConcept,
  onRerun,
  result,
  rerunError,
  scanning,
  workspaceOpen,
}: OkfReviewPanelProps) {
  const copy = getOkfReviewCopy(menuLanguage);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleId = "okf-review-title";

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const openablePaths = useMemo(() => {
    const paths = new Set<string>();
    for (const file of result?.files ?? []) {
      if (
        file.kind === "concept" ||
        file.kind === "index" ||
        file.kind === "log"
      ) {
        paths.add(file.relativePath);
      }
    }
    return paths;
  }, [result?.files]);

  const presentation = useMemo(
    () => (result ? presentOkfReviewSurface(result) : null),
    [result],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (isImeComposing(event.nativeEvent)) {
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    // Lightweight focus trap inside the dialog.
    if (event.key === "Tab" && dialogRef.current) {
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), summary, [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) {
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  };

  const summary = result?.summary;
  const surfaceStatus =
    presentation != null
      ? formatOkfSurfaceStatus(copy, presentation, menuLanguage)
      : null;
  const remainingRequired = presentation
    ? Math.max(
        0,
        presentation.requiredCount - presentation.requiredFindings.length,
      )
    : 0;
  const remainingConversion = presentation
    ? Math.max(
        0,
        presentation.conversionCount - presentation.conversionFindings.length,
      )
    : 0;
  const remainingImprovement = presentation
    ? Math.max(
        0,
        presentation.improvementCount - presentation.improvementFindings.length,
      )
    : 0;
  const remainingInfo = presentation
    ? Math.max(0, presentation.infoCount - presentation.infoFindings.length)
    : 0;

  return (
    <div className="okf-review-overlay" onPointerDown={onClose}>
      <div
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-modal="true"
        className="okf-review-dialog"
        onKeyDown={handleKeyDown}
        onPointerDown={(event) => event.stopPropagation()}
        role="dialog"
        tabIndex={-1}
      >
        <header className="okf-review-header">
          <div className="okf-review-title-block">
            <h2 className="okf-review-title" id={titleId}>
              {copy.title}
            </h2>
          </div>
          <button className="okf-review-close" onClick={onClose} type="button">
            {copy.close}
          </button>
        </header>

        <p className="okf-review-intro">{copy.purposeIntro}</p>
        <p className="okf-review-note">{copy.diskSnapshotNote}</p>

        {bundleRoot ? (
          <p className="okf-review-root" title={bundleRoot}>
            {bundleRoot}
          </p>
        ) : null}

        {!workspaceOpen ? (
          <p className="okf-review-status okf-review-status-error">
            {copy.noWorkspace}
          </p>
        ) : null}

        {scanning ? (
          <p className="okf-review-status" aria-live="polite">
            {cancelRequested ? copy.cancelling : copy.scanning}
          </p>
        ) : null}

        {error ? (
          <p className="okf-review-status okf-review-status-error" role="alert">
            {error}
          </p>
        ) : null}

        {rerunError ? (
          <p className="okf-review-status okf-review-status-error" role="alert">
            {rerunError}
          </p>
        ) : null}

        {result?.truncated ? (
          <p className="okf-review-banner">
            {formatOkfTruncationMessage(
              copy,
              result.truncationReason,
              menuLanguage,
            )}
          </p>
        ) : null}

        {result?.cancelled ? (
          <p className="okf-review-banner">{copy.cancelled}</p>
        ) : null}

        {result?.findingsTruncated ? (
          <p className="okf-review-banner">{copy.findingsTruncated}</p>
        ) : null}

        {surfaceStatus ? (
          <p
            className={`okf-review-surface-status okf-review-surface-${presentation?.folderKind ?? "empty"}${
              presentation && presentation.requiredCount > 0
                ? " okf-review-surface-has-failures"
                : ""
            }`}
            aria-live="polite"
          >
            {surfaceStatus}
          </p>
        ) : null}

        {presentation &&
        presentation.requiredFindings.length > 0 &&
        openablePaths.has(presentation.requiredFindings[0]!.relativePath) ? (
          <section
            className="okf-review-first-fix"
            aria-label={copy.firstFixHeading}
          >
            <h3 className="okf-review-first-fix-heading">
              {copy.firstFixHeading}
            </h3>
            <p className="okf-review-first-fix-hint">{copy.firstFixHint}</p>
            <FindingRow
              badgeLabel={copy.severityFailure}
              copy={copy}
              finding={presentation.requiredFindings[0]!}
              onOpenConcept={onOpenConcept}
              openable
              scanning={scanning}
              toneClass="required"
            />
          </section>
        ) : null}

        {presentation ? (
          <div className="okf-review-primary-results">
            <FindingGroup
              copy={copy}
              findings={presentation.requiredFindings}
              heading={copy.requiredHeading}
              keyPrefix="required"
              moreMessage={
                remainingRequired > 0
                  ? formatOkfMoreCount(copy.moreRequired, remainingRequired)
                  : null
              }
              onOpenConcept={onOpenConcept}
              openablePaths={openablePaths}
              scanning={scanning}
              tone="required"
            />
            <FindingGroup
              copy={copy}
              findings={presentation.conversionFindings}
              heading={copy.conversionHeading}
              keyPrefix="conversion"
              moreMessage={
                remainingConversion > 0
                  ? formatOkfMoreCount(
                      copy.moreConversion,
                      remainingConversion,
                    )
                  : null
              }
              onOpenConcept={onOpenConcept}
              openablePaths={openablePaths}
              scanning={scanning}
              tone="conversion"
            />
            <FindingGroup
              copy={copy}
              findings={presentation.improvementFindings}
              heading={copy.improvementHeading}
              keyPrefix="improvement"
              moreMessage={
                remainingImprovement > 0
                  ? formatOkfMoreCount(
                      copy.moreImprovement,
                      remainingImprovement,
                    )
                  : null
              }
              onOpenConcept={onOpenConcept}
              openablePaths={openablePaths}
              scanning={scanning}
              tone="improvement"
            />
          </div>
        ) : null}

        <div className="okf-review-actions">
          {scanning ? (
            <button
              className="okf-review-button"
              disabled={cancelRequested}
              onClick={onCancelScan}
              type="button"
            >
              {copy.cancel}
            </button>
          ) : (
            <button
              className="okf-review-button"
              disabled={!workspaceOpen || !bundleRoot}
              onClick={onRerun}
              type="button"
            >
              {copy.rerun}
            </button>
          )}
        </div>

        {summary ? (
          <details className="okf-review-details">
            <summary className="okf-review-details-summary">
              {copy.detailsHeading}
            </summary>
            <p className="okf-review-spec">
              {summary.specLabel} · {summary.specCommit}
            </p>
            <div className="okf-review-summary" aria-live="polite">
              <span>
                {copy.concepts}: {summary.conceptCount}
              </span>
              <span>
                {copy.indexes}: {summary.indexCount}
              </span>
              <span>
                {copy.logs}: {summary.logCount}
              </span>
              <span>
                {copy.unreadable}: {summary.unreadableCount}
              </span>
              {/* Prefer presentation groups so plain-manuscript prep is not
                  counted as hard failures next to the softer status copy. */}
              <span>
                {copy.failures}:{" "}
                {presentation?.requiredCount ?? summary.failureCount}
              </span>
              {(presentation?.conversionCount ?? 0) > 0 ? (
                <span>
                  {copy.severityConversion}: {presentation?.conversionCount}
                </span>
              ) : null}
              <span>
                {copy.advice}:{" "}
                {presentation?.improvementCount ?? summary.adviceCount}
              </span>
            </div>
          </details>
        ) : null}

        {result ? (
          <details className="okf-review-results-details">
            <summary className="okf-review-details-summary">
              {copy.resultsHeading}
            </summary>
            <div className="okf-review-columns">
              <section
                aria-label={copy.filesHeading}
                className="okf-review-section"
              >
                <h3 className="okf-review-section-title">
                  {copy.filesHeading}
                </h3>
                {result.files.length === 0 ? (
                  <p className="okf-review-empty">{copy.emptyFiles}</p>
                ) : (
                  <ul className="okf-review-list">
                    {result.files.map((file) => {
                      const dirty = isPathDirty(file.relativePath);
                      const canOpen = openablePaths.has(file.relativePath);
                      return (
                        <li
                          className="okf-review-list-item"
                          key={file.relativePath}
                        >
                          <div className="okf-review-item-main">
                            <span className="okf-review-kind">
                              {kindLabel(file.kind, copy)}
                            </span>
                            <span className="okf-review-path">
                              {file.relativePath}
                              {file.type ? ` · ${file.type}` : ""}
                              {file.title ? ` — ${file.title}` : ""}
                            </span>
                            {dirty ? (
                              <span className="okf-review-dirty">
                                {copy.dirtyTabNote}
                              </span>
                            ) : null}
                          </div>
                          {canOpen ? (
                            <button
                              aria-label={`${dirty ? copy.openDirty : copy.openConcept}: ${file.relativePath}`}
                              className="okf-review-open"
                              disabled={scanning}
                              onClick={() => onOpenConcept(file.relativePath)}
                              type="button"
                            >
                              {dirty ? copy.openDirty : copy.openConcept}
                            </button>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section
                aria-label={copy.infoHeading}
                className="okf-review-section"
              >
                <h3 className="okf-review-section-title">
                  {copy.infoHeading}
                </h3>
                {presentation?.infoFindings.length === 0 ? (
                  <p className="okf-review-empty">{copy.emptyFindings}</p>
                ) : (
                  <>
                    <ul className="okf-review-list">
                      {presentation?.infoFindings.map((finding, index) => (
                        <FindingRow
                          copy={copy}
                          finding={finding}
                          key={`${finding.code}-${finding.relativePath}-${index}`}
                          onOpenConcept={onOpenConcept}
                          openable={openablePaths.has(finding.relativePath)}
                          scanning={scanning}
                        />
                      ))}
                    </ul>
                    {remainingInfo > 0 ? (
                      <p className="okf-review-more">
                        {formatOkfMoreCount(copy.moreInfo, remainingInfo)}
                      </p>
                    ) : null}
                  </>
                )}
              </section>
            </div>
          </details>
        ) : null}
      </div>
    </div>
  );
}

function FindingRow({
  badgeLabel,
  copy,
  finding,
  onOpenConcept,
  openable,
  scanning,
  toneClass,
}: {
  badgeLabel?: string;
  copy: OkfReviewCopy;
  finding: OkfReviewFinding;
  onOpenConcept: (relativePath: string, sourceOffset?: number) => void;
  openable: boolean;
  scanning: boolean;
  /** Optional presentation tone so conversion prep is not styled as failure. */
  toneClass?: "required" | "conversion" | "improvement" | "info";
}) {
  const kindClass = toneClass
    ? `okf-review-finding-${toneClass}`
    : `okf-review-finding-${finding.severity}`;
  return (
    <li className={`okf-review-list-item ${kindClass}`}>
      <div className="okf-review-item-main">
        <span className="okf-review-kind">
          {badgeLabel ?? severityLabel(finding.severity, copy)}
        </span>
        <span className="okf-review-path">
          {finding.relativePath}
        </span>
        <span className="okf-review-message">
          {formatOkfFindingMessage(copy, finding)}
        </span>
      </div>
      {openable ? (
        <button
          aria-label={`${copy.openForEdit}: ${finding.relativePath}`}
          className="okf-review-open"
          disabled={scanning}
          onClick={() =>
            onOpenConcept(finding.relativePath, finding.sourceOffset)
          }
          type="button"
        >
          {copy.openForEdit}
        </button>
      ) : null}
    </li>
  );
}

function FindingGroup({
  copy,
  findings,
  heading,
  keyPrefix,
  moreMessage,
  onOpenConcept,
  openablePaths,
  scanning,
  tone,
}: {
  copy: OkfReviewCopy;
  findings: OkfReviewFinding[];
  heading: string;
  keyPrefix: string;
  moreMessage: string | null;
  onOpenConcept: (relativePath: string, sourceOffset?: number) => void;
  openablePaths: Set<string>;
  scanning: boolean;
  tone: "required" | "conversion" | "improvement";
}) {
  if (findings.length === 0) {
    return null;
  }

  const badgeLabel =
    tone === "conversion"
      ? copy.severityConversion
      : tone === "improvement"
        ? copy.severityAdvice
        : copy.severityFailure;

  return (
    <section
      aria-label={heading}
      className={`okf-review-finding-group okf-review-finding-group-${tone}`}
    >
      <h3 className="okf-review-section-title">{heading}</h3>
      <ul className="okf-review-list okf-review-list-compact">
        {findings.map((finding, index) => (
          <FindingRow
            badgeLabel={badgeLabel}
            copy={copy}
            finding={finding}
            key={`${keyPrefix}-${finding.code}-${finding.relativePath}-${index}`}
            onOpenConcept={onOpenConcept}
            openable={openablePaths.has(finding.relativePath)}
            scanning={scanning}
            toneClass={tone}
          />
        ))}
      </ul>
      {moreMessage ? <p className="okf-review-more">{moreMessage}</p> : null}
    </section>
  );
}
