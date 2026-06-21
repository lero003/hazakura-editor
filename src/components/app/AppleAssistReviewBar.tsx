import { useCallback, useEffect, useMemo, useState } from "react";
import type { LModeCopy } from "../../lib/locale";
import { useAiEditTransaction } from "../../hooks/editor/useAiEditTransaction";
import { DiffBody } from "../diff/DiffBody";
import type { CompareCase, MenuLanguage } from "../../types";
import { SparklesIcon } from "./Icons";

// v0.12+ Hazakura Local Assist Writing Companion (slice 5).
// The diff / change review escape hatch. After the
// detached Hazakura Local Assist window applies a transaction,
// the main window renders this floating bar to surface
// a one-line summary (request + target kind + added /
// removed counts) and three actions:
//
//   * "Open diff" toggles an inline precomputed diff
//     preview sourced from `transaction.diff`.
//   * "Discard" reverts the buffer to `transaction.beforeBuffer`
//     and clears the pending review.
//   * "Close" dismisses the bar without reverting; the
//     AI edit stays in the buffer.
//
// The bar reuses the existing `DiffBody` rendering
// pipeline by constructing a synthetic `changes` case
// with the new `"ai-edit-vs-buffer"` scope. The case
// is not registered in the right-pane `CompareCase`
// store; it is a transient value scoped to this
// component's render only.

type AppleAssistReviewBarProps = {
  activeTabId: string | null;
  copy: LModeCopy;
  diffInitiallyOpen?: boolean;
  menuLanguage: MenuLanguage;
  onDiscard: (tabId: string, beforeBuffer: string) => void;
};

export function AppleAssistReviewBar({
  activeTabId,
  copy,
  diffInitiallyOpen = true,
  menuLanguage,
  onDiscard,
}: AppleAssistReviewBarProps) {
  const { latest, clearLatest } = useAiEditTransaction(activeTabId);
  const [showDiff, setShowDiff] = useState(diffInitiallyOpen);

  useEffect(() => {
    setShowDiff(Boolean(latest?.diff) && diffInitiallyOpen);
  }, [diffInitiallyOpen, latest?.id, latest?.diff]);

  const handleOpenDiff = useCallback(() => {
    setShowDiff((current) => !current);
  }, []);

  const handleClose = useCallback(() => {
    setShowDiff(false);
    clearLatest();
  }, [clearLatest]);

  const handleDiscard = useCallback(() => {
    if (!latest) return;
    onDiscard(latest.tabId, latest.beforeBuffer);
    setShowDiff(false);
    clearLatest();
  }, [clearLatest, latest, onDiscard]);

  const summary = useMemo(() => {
    if (!latest || !latest.diff) return null;
    return {
      added: latest.diff.additions,
      removed: latest.diff.removals,
    };
  }, [latest]);

  if (!latest) return null;

  // Build a synthetic `changes` case so `DiffBody` can
  // render the transaction's precomputed `CompareViewState`
  // without registering the case in the global compare
  // store. The case is local to this render and is never
  // routed through the right pane.
  const compareCase: CompareCase = {
    kind: "changes",
    key: `apple-assist-${latest.id}`,
    scope: "ai-edit-vs-buffer",
    documentPath: latest.tabPath,
    documentLabel: latest.tabName,
    leftColumnLabel: leftColumnLabel(menuLanguage),
    rightColumnLabel: rightColumnLabel(menuLanguage),
  };

  return (
    <div
      aria-label={copy.appleAssistReviewBarLabel}
      aria-live="polite"
      className="apple-assist-review-bar"
      role="region"
      title={copy.appleAssistReviewBarTitle}
    >
      <div className="apple-assist-review-bar-summary">
        <span className="apple-assist-review-bar-icon" aria-hidden="true">
          <SparklesIcon />
        </span>
        <span className="apple-assist-review-bar-message">
          {copy.appleAssistReviewBarLabel}
          <span className="apple-assist-review-bar-request">
            {" — "}
            {latest.request} ({latest.target.kind})
          </span>
        </span>
        {summary ? (
          <span
            aria-label={`+${summary.added} / -${summary.removed}`}
            className="apple-assist-review-bar-counts"
          >
            <span className="apple-assist-review-bar-count added">
              +{summary.added}
            </span>
            <span className="apple-assist-review-bar-count removed">
              -{summary.removed}
            </span>
          </span>
        ) : null}
        <div className="apple-assist-review-bar-actions">
          {latest.diff ? (
            <button
              className="apple-assist-review-bar-button"
              onClick={handleOpenDiff}
              type="button"
            >
              {showDiff
                ? copy.appleAssistReviewBarCloseDiffLabel
                : copy.appleAssistReviewBarOpenDiffLabel}
            </button>
          ) : null}
          <button
            className="apple-assist-review-bar-button danger"
            onClick={handleDiscard}
            title={copy.appleAssistReviewBarDiscardTitle}
            type="button"
          >
            {copy.appleAssistReviewBarDiscardLabel}
          </button>
          <button
            aria-label={copy.appleAssistReviewBarCloseLabel}
            className="apple-assist-review-bar-button close"
            onClick={handleClose}
            title={copy.appleAssistReviewBarCloseTitle}
            type="button"
          >
            ×
          </button>
        </div>
      </div>
      {showDiff && latest.diff ? (
        <div className="apple-assist-review-bar-diff" role="table">
          <div className="diff-split-row diff-row-header" role="row">
            <span className="diff-line-number" role="columnheader" />
            <span className="diff-text-column" role="columnheader">
              {compareCase.leftColumnLabel}
            </span>
            <span className="diff-line-number" role="columnheader" />
            <span className="diff-text-column" role="columnheader">
              {compareCase.rightColumnLabel}
            </span>
          </div>
          <DiffBody
            compareCase={compareCase}
            menuLanguage={menuLanguage}
            view={latest.diff}
          />
        </div>
      ) : null}
      {showDiff && !latest.diff ? (
        <div className="apple-assist-review-bar-empty">
          {copy.appleAssistReviewBarEmptyDiffLabel}
        </div>
      ) : null}
    </div>
  );
}

function leftColumnLabel(lang: string): string {
  if (lang === "kana") return "もとの ぶん";
  if (lang === "ja") return "変更前";
  return "Before";
}

function rightColumnLabel(lang: string): string {
  if (lang === "kana") return "へんこうご";
  if (lang === "ja") return "変更後";
  return "After";
}
