import { useEffect, useMemo, useState } from "react";
import { buildLineDiff } from "../../features/diff/diff";
import type { LocalAssistProposal } from "../../features/editor/localAssistProposal";
import { useLocalAssistProposal } from "../../hooks/editor/useLocalAssistProposal";
import { DiffBody } from "../diff/DiffBody";
import { isJapaneseMenuLanguage, type CompareCase, type CompareViewState, type EditorTab, type MenuLanguage } from "../../types";
import { isKanaStyle } from "../../lib/locale/_helpers";
import { SparklesIcon } from "./Icons";

// v2.6 B2: the main window owns the unapplied-proposal review surface. While
// the detached Local Assist window hosts the conversation, the actual
// original-vs-proposal Diff is rendered here at the editor's font size (via
// the existing `DiffBody` pipeline) so the user can review a large diff before
// deciding to apply or discard it. This is a read-only review of an
// *unapplied* proposal — it is distinct from `AppleAssistReviewBar`, which
// reviews an already-applied `AiEditTransaction`.

type ApplyResult = { ok: true } | { ok: false; error: string };

type LocalAssistProposalReviewProps = {
  activeTab: EditorTab | null;
  menuLanguage: MenuLanguage;
  /** The editor's configured font size, so the Diff reads at the same size. */
  fontSize: number;
  onApply: (proposal: LocalAssistProposal) => Promise<ApplyResult>;
  onDiscard: (proposal: LocalAssistProposal) => void;
};

function getProposalReviewCopy(lang: MenuLanguage) {
  if (isKanaStyle(lang)) {
    return {
      regionLabel: "ていあんの かくにん",
      subtitle: "せいせいされた あんを もとの ぶんと くらべます。ふみは まだ かわっていません。",
      applyLabel: "ふみに はんえい",
      discardLabel: "あんを すてる",
      originalLabel: "もとの ぶん",
      proposalLabel: "せいせい あん",
    };
  }
  if (isJapaneseMenuLanguage(lang)) {
    return {
      regionLabel: "提案の確認",
      subtitle: "生成された案を元の文章と比較します。本文はまだ変更されていません。",
      applyLabel: "文書へ反映",
      discardLabel: "案を破棄",
      originalLabel: "元の文章",
      proposalLabel: "生成案",
    };
  }
  return {
    regionLabel: "Proposal review",
    subtitle: "Compare the generated proposal with the original. The document is unchanged.",
    applyLabel: "Apply proposal",
    discardLabel: "Discard proposal",
    originalLabel: "Original",
    proposalLabel: "Proposal",
  };
}

export function LocalAssistProposalReview({
  activeTab,
  menuLanguage,
  fontSize,
  onApply,
  onDiscard,
}: LocalAssistProposalReviewProps) {
  const copy = getProposalReviewCopy(menuLanguage);
  const { proposal } = useLocalAssistProposal(activeTab?.sessionId ?? null);
  const [applyError, setApplyError] = useState<string | null>(null);

  const view: CompareViewState | null = useMemo(() => {
    if (!proposal || proposal.streaming) {
      return null;
    }
    try {
      const lineDiff = buildLineDiff(
        proposal.originalText,
        proposal.candidateText,
      );
      return { caseKey: `apple-assist-proposal-${proposal.requestId}`, ...lineDiff };
    } catch {
      return null;
    }
  }, [proposal]);

  // A stale/no-op apply leaves the proposal on screen; clear any previous
  // inline error when the reviewed proposal changes.
  useEffect(() => {
    setApplyError(null);
  }, [proposal?.requestId]);

  if (!proposal || !view) {
    return null;
  }

  const handleApply = async () => {
    setApplyError(null);
    const result = await onApply(proposal);
    if (!result.ok) {
      setApplyError(result.error);
    }
  };

  const compareCase: CompareCase = {
    kind: "changes",
    key: `apple-assist-proposal-${proposal.requestId}`,
    scope: "ai-edit-vs-buffer",
    documentPath: proposal.target.activeDocumentPath ?? "",
    documentLabel: proposal.target.activeDocumentName ?? "",
    leftColumnLabel: copy.originalLabel,
    rightColumnLabel: copy.proposalLabel,
  };

  const safeFontSize = Math.min(Math.max(fontSize, 12), 22);

  return (
    <div
      aria-label={copy.regionLabel}
      className="local-assist-proposal-review"
      data-testid="local-assist-proposal-review"
      role="region"
    >
      <div className="local-assist-proposal-review-header">
        <span className="local-assist-proposal-review-icon" aria-hidden="true">
          <SparklesIcon />
        </span>
        <span className="local-assist-proposal-review-title">
          {copy.regionLabel}
        </span>
        <span className="local-assist-proposal-review-subtitle">
          {copy.subtitle}
        </span>
        <div className="local-assist-proposal-review-actions">
          <button
            type="button"
            className="local-assist-proposal-review-button apply"
            onClick={() => void handleApply()}
          >
            {copy.applyLabel}
          </button>
          <button
            type="button"
            className="local-assist-proposal-review-button"
            onClick={() => onDiscard(proposal)}
          >
            {copy.discardLabel}
          </button>
        </div>
      </div>
      <div
        className="local-assist-proposal-review-diff"
        role="table"
        style={{ fontSize: `${safeFontSize}px` }}
      >
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
          view={view}
        />
      </div>
      {applyError ? (
        <p
          className="local-assist-proposal-review-error"
          data-testid="local-assist-proposal-review-error"
          role="alert"
        >
          {applyError}
        </p>
      ) : null}
    </div>
  );
}
