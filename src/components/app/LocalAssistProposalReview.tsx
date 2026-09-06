import { useEffect, useMemo, useRef, useState } from "react";
import { buildLineDiff } from "../../features/diff/diff";
import { localAssistProposalStore, type LocalAssistProposal } from "../../features/editor/localAssistProposal";
import { canBuildProposalLineDiff, countProposalCharacters, isProposalCurrentForDocument } from "../../features/editor/proposalReview";
import { useLocalAssistProposal } from "../../hooks/editor/useLocalAssistProposal";
import { sanitizeAppleAssistCandidateText } from "../../features/editor/appleAssistText";
import { DiffBody } from "../diff/DiffBody";
import { isJapaneseMenuLanguage, type CompareCase, type CompareViewState, type EditorTab, type MenuLanguage } from "../../types";
import { isKanaStyle } from "../../lib/locale/_helpers";
import { SparklesIcon } from "./Icons";

type ApplyResult = { ok: true } | { ok: false; error: string };
type Mode = "diff" | "after" | "before";
type LocalAssistProposalReviewProps = {
  activeTab: EditorTab | null;
  menuLanguage: MenuLanguage;
  fontSize: number;
  /** A cancelled native request may still be shutting down. */
  blocked?: boolean;
  onApply: (proposal: LocalAssistProposal) => Promise<ApplyResult>;
  onDiscard: (proposal: LocalAssistProposal) => void;
};

function getProposalReviewCopy(lang: MenuLanguage) {
  if (isKanaStyle(lang)) return {
    regionLabel: "ていあんの かくにん", subtitle: "ふみは まだ かわっていません。つづきの おねがいは Local Assist で。",
    applyLabel: "ふみに はんえい", discardLabel: "あんを すてる", originalLabel: "もとの ぶん", proposalLabel: "せいせい あん",
    diff: "ちがひ", after: "かえた あと", before: "もとの ぶん", views: "みかた", chars: "もじ", target: "たいしょう", turn: "かいめの あん",
    busy: "あんを つくっています。ふみは かわりません。", applying: "はんえいちゅう…", applied: "はんえいずみ",
    stale: "たいしょうが かわりました。あらためて あんを つくってください。", unchanged: "もとの ぶんと おなじです。はんえいは いりません。",
    whitespace: "くうはく・かいぎょうだけの へんこうです。", unavailable: "ちがひの かわりに ぶんそのものを かくにんできます。",
    failed: "はんえいできませんでした。あんは のこっています。", unsafe: "あんの かたちを かくにんできません。もういちど つくってください。",
    undo: "はんえいは 1かい。もどすときは ⌘Z。ほぞんは いつもどおりです。",
  };
  if (isJapaneseMenuLanguage(lang)) return {
    regionLabel: "提案の確認", subtitle: "本文はまだ変更されていません。追加指示は Local Assist で続けられます。",
    applyLabel: "文書へ反映", discardLabel: "案を破棄", originalLabel: "元の文章", proposalLabel: "生成案",
    diff: "差分", after: "変更後", before: "元の文章", views: "表示方法", chars: "文字", target: "対象", turn: "回目の提案",
    busy: "提案を生成しています。本文は変更されません。", applying: "反映中…", applied: "反映済み",
    stale: "対象の文章が変わりました。対象を確認し、新しい提案を作ってください。", unchanged: "元の文章と同じです。反映する必要はありません。",
    whitespace: "空白・改行のみの変更です。", unavailable: "差分の代わりに「変更後」と「元の文章」で全文を確認できます。",
    failed: "反映できませんでした。提案は残っています。", unsafe: "提案の形式を確認できません。もう一度生成してください。",
    undo: "反映は1回だけ。元に戻すには ⌘Z。保存は通常の編集と同じです。",
  };
  return {
    regionLabel: "Proposal review", subtitle: "The document is unchanged. Continue refining in Local Assist.",
    applyLabel: "Apply proposal", discardLabel: "Discard proposal", originalLabel: "Original", proposalLabel: "Proposal",
    diff: "Diff", after: "After", before: "Before", views: "Review view", chars: "characters", target: "Target", turn: "revision",
    busy: "Generating a proposal. The document is unchanged.", applying: "Applying…", applied: "Applied",
    stale: "The target has changed. Check the target and create a new proposal.", unchanged: "This is identical to the original. No application is needed.",
    whitespace: "Only whitespace or line breaks have changed.", unavailable: "Review the complete text in After and Before instead of a line diff.",
    failed: "The proposal could not be applied. It has been kept.", unsafe: "The proposal format could not be verified. Please generate it again.",
    undo: "Apply once. Use ⌘Z to undo. Save as you normally would.",
  };
}

export function LocalAssistProposalReview({ activeTab, menuLanguage, fontSize, blocked = false, onApply, onDiscard }: LocalAssistProposalReviewProps) {
  const copy = getProposalReviewCopy(menuLanguage);
  const { proposal } = useLocalAssistProposal(activeTab?.sessionId ?? null);
  const [mode, setMode] = useState<Mode>("diff");
  const [pending, setPending] = useState<LocalAssistProposal | null>(null);
  const [applied, setApplied] = useState<LocalAssistProposal | null>(null);
  const [error, setError] = useState<{ proposal: LocalAssistProposal; message: string } | null>(null);
  const pendingRef = useRef<LocalAssistProposal | null>(null);
  const appliedRef = useRef<LocalAssistProposal | null>(null);
  const latestRef = useRef({ proposal, activeTab });
  latestRef.current = { proposal, activeTab };
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const diffAllowed = !!proposal && !proposal.streaming && canBuildProposalLineDiff(proposal.originalText, proposal.candidateText);
  const view: CompareViewState | null = useMemo(() => {
    if (!proposal || !diffAllowed || mode !== "diff") return null;
    try {
      return { caseKey: `apple-assist-proposal-${proposal.requestId}`, ...buildLineDiff(proposal.originalText, proposal.candidateText) };
    } catch { return null; }
  }, [proposal, diffAllowed, mode]);
  const counts = useMemo(() => proposal ? {
    before: countProposalCharacters(proposal.originalText), after: countProposalCharacters(proposal.candidateText),
  } : { before: 0, after: 0 }, [proposal]);
  const safeCandidate = useMemo(() => !proposal || proposal.streaming ||
    (proposal.candidateText.trim().length > 0 && sanitizeAppleAssistCandidateText(proposal.candidateText) === proposal.candidateText), [proposal]);
  if (!proposal) return null;

  const applying = pending === proposal;
  const wasApplied = applied === proposal;
  const current = isProposalCurrentForDocument(proposal, activeTab);
  const unchanged = proposal.originalText === proposal.candidateText;
  const whitespaceOnly = !unchanged && proposal.originalText.replace(/\s/gu, "") === proposal.candidateText.replace(/\s/gu, "");
  const applyError = error?.proposal === proposal ? error.message : null;
  const actualMode = mode === "diff" && !view ? "after" : mode;
  const safeFontSize = Number.isFinite(fontSize) ? Math.min(Math.max(fontSize, 12), 48) : 16;
  const stillReviewing = () => mounted.current && latestRef.current.proposal === proposal;

  const handleApply = async () => {
    if (blocked || pendingRef.current === proposal || appliedRef.current === proposal) return;
    const latest = latestRef.current;
    if (!latest.activeTab || latest.proposal !== proposal ||
      localAssistProposalStore.getLatest(latest.activeTab.sessionId) !== proposal ||
      !isProposalCurrentForDocument(proposal, latest.activeTab) || unchanged || !safeCandidate) return;
    pendingRef.current = proposal;
    setPending(proposal);
    setError(null);
    try {
      const result = await onApply(proposal);
      if (!stillReviewing()) return;
      if (result.ok) { appliedRef.current = proposal; setApplied(proposal); }
      else setError({ proposal, message: result.error });
    } catch {
      if (stillReviewing()) setError({ proposal, message: copy.failed });
    } finally {
      if (pendingRef.current === proposal) pendingRef.current = null;
      if (stillReviewing()) setPending(null);
    }
  };
  const handleDiscard = () => {
    const tab = latestRef.current.activeTab;
    if (blocked || pendingRef.current === proposal || appliedRef.current === proposal || !tab ||
      localAssistProposalStore.getLatest(tab.sessionId) !== proposal) return;
    onDiscard(proposal);
  };
  const compareCase: CompareCase = {
    kind: "changes", key: `apple-assist-proposal-${proposal.requestId}`, scope: "ai-edit-vs-buffer",
    documentPath: proposal.target.activeDocumentPath ?? "", documentLabel: proposal.target.activeDocumentName ?? "",
    leftColumnLabel: copy.originalLabel, rightColumnLabel: copy.proposalLabel,
  };

  return (
    <div aria-label={copy.regionLabel} aria-busy={applying || !!proposal.streaming}
      className="local-assist-proposal-review" data-testid="local-assist-proposal-review" role="region">
      <div className="local-assist-proposal-review-header">
        <span className="local-assist-proposal-review-icon" aria-hidden="true"><SparklesIcon /></span>
        <span className="local-assist-proposal-review-title">{copy.regionLabel}</span>
        <span className="local-assist-proposal-review-subtitle">{copy.subtitle}</span>
      </div>
      <p className="local-assist-proposal-review-summary">
        {copy.target}: {proposal.target.activeDocumentName} · {proposal.target.label || proposal.request}
        <br />{proposal.streaming ? counts.before : `${counts.before} → ${counts.after}`} {copy.chars} · {proposal.turnIndex + 1} {copy.turn}
      </p>
      {proposal.streaming ? <p role="status">{copy.busy}</p> : <>
        <div className="local-assist-proposal-review-toolbar">
          <div role="group" aria-label={copy.views} className="local-assist-proposal-review-modes">
            {(["diff", "after", "before"] as const).map((item) => <button key={item} type="button"
              className="local-assist-proposal-review-button" aria-pressed={actualMode === item}
              disabled={item === "diff" && !diffAllowed} onClick={() => setMode(item)}>{copy[item]}</button>)}
          </div>
          <div className="local-assist-proposal-review-actions">
            <button type="button" className="local-assist-proposal-review-button apply"
              disabled={blocked || applying || wasApplied || !current || unchanged || !safeCandidate}
              onClick={() => void handleApply()}>{applying ? copy.applying : wasApplied ? copy.applied : copy.applyLabel}</button>
            <button type="button" className="local-assist-proposal-review-button" disabled={blocked || applying || wasApplied}
              onClick={handleDiscard}>{copy.discardLabel}</button>
          </div>
        </div>
        {!current ? <p role="status" className="local-assist-proposal-review-notice">{copy.stale}</p> : null}
        {unchanged ? <p role="status">{copy.unchanged}</p> : whitespaceOnly ? <p role="status">{copy.whitespace}</p> : null}
        {!safeCandidate ? <p role="alert">{copy.unsafe}</p> : null}
        {mode === "diff" && !view ? <p className="local-assist-proposal-review-notice">{copy.unavailable}</p> : null}
        {actualMode === "diff" && view ? (
          <div className="local-assist-proposal-review-diff" role="table" aria-label={copy.diff} tabIndex={0} style={{ fontSize: `${safeFontSize}px` }}>
            <div className="diff-split-row diff-row-header" role="row">
              <span className="diff-line-number" role="columnheader" />
              <span className="diff-text-column" role="columnheader">{copy.originalLabel}</span>
              <span className="diff-line-number" role="columnheader" />
              <span className="diff-text-column" role="columnheader">{copy.proposalLabel}</span>
            </div>
            <DiffBody compareCase={compareCase} menuLanguage={menuLanguage} view={view} />
          </div>
        ) : <pre className="local-assist-proposal-review-text" role="region" tabIndex={0}
          aria-label={actualMode === "before" ? copy.before : copy.after} style={{ fontSize: `${safeFontSize}px` }}>
          {actualMode === "before" ? proposal.originalText : proposal.candidateText}
        </pre>}
        <p className="local-assist-proposal-review-notice">{copy.undo}</p>
      </>}
      {applyError ? <p className="local-assist-proposal-review-error" data-testid="local-assist-proposal-review-error" role="alert">{applyError}</p> : null}
    </div>
  );
}