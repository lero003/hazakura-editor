import { useEffect, useMemo, useRef } from "react";
import type {
  OkfFileKind,
  OkfFindingSeverity,
  OkfReviewFinding,
  OkfReviewResult,
} from "../../features/okf";
import { isImeComposing } from "../../lib/keyboard";
import {
  formatOkfFindingMessage,
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
  onOpenConcept: (relativePath: string) => void;
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
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
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
            {summary ? (
              <p className="okf-review-spec">
                {summary.specLabel} · {summary.specCommit}
              </p>
            ) : null}
          </div>
          <button className="okf-review-close" onClick={onClose} type="button">
            {copy.close}
          </button>
        </header>

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

        {summary ? (
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
            <span>
              {copy.failures}: {summary.failureCount}
            </span>
            <span>
              {copy.advice}: {summary.adviceCount}
            </span>
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

        {result ? (
          <div className="okf-review-columns">
            <section
              aria-label={copy.filesHeading}
              className="okf-review-section"
            >
              <h3 className="okf-review-section-title">{copy.filesHeading}</h3>
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
              aria-label={copy.findingsHeading}
              className="okf-review-section"
            >
              <h3 className="okf-review-section-title">
                {copy.findingsHeading}
              </h3>
              {result.findings.length === 0 ? (
                <p className="okf-review-empty">{copy.emptyFindings}</p>
              ) : (
                <ul className="okf-review-list">
                  {result.findings.map((finding, index) => (
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
              )}
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FindingRow({
  copy,
  finding,
  onOpenConcept,
  openable,
  scanning,
}: {
  copy: OkfReviewCopy;
  finding: OkfReviewFinding;
  onOpenConcept: (relativePath: string) => void;
  openable: boolean;
  scanning: boolean;
}) {
  return (
    <li className={`okf-review-list-item okf-review-finding-${finding.severity}`}>
      <div className="okf-review-item-main">
        <span className="okf-review-kind">
          {severityLabel(finding.severity, copy)}
        </span>
        <span className="okf-review-path">
          {finding.relativePath} · {finding.code}
        </span>
        <span className="okf-review-message">
          {formatOkfFindingMessage(copy, finding)}
        </span>
      </div>
      {openable ? (
        <button
          aria-label={`${copy.openConcept}: ${finding.relativePath}`}
          className="okf-review-open"
          disabled={scanning}
          onClick={() => onOpenConcept(finding.relativePath)}
          type="button"
        >
          {copy.openConcept}
        </button>
      ) : null}
    </li>
  );
}
