import type { AppleAssistTargetSnapshot } from "../../types";
import type { LocalAssistActionId } from "../../lib/appleAssist/instruction";

/** In-memory, session-local proposals. No editor mutation or persistence here. */
export type LocalAssistProposal = {
  requestId: string;
  request: string;
  actionId: LocalAssistActionId;
  originalText: string;
  candidateText: string;
  target: AppleAssistTargetSnapshot;
  conversationId: string | null;
  turnIndex: number;
  streaming?: boolean;
  /** Actual response metadata, never the currently selected model. Legacy drafts may omit it. */
  generation?: { modelId: string | null; latencyMs: number | null };

};

type Listener = () => void;

export class LocalAssistProposalStore {
  private byTab = new Map<string, LocalAssistProposal>();
  private previousByTab = new Map<string, LocalAssistProposal>();
  private listeners = new Set<Listener>();
  private applyingByTab = new Map<string, LocalAssistProposal>();

  getLatest(tabId: string): LocalAssistProposal | null {
    return this.byTab.get(tabId) ?? null;
  }

  record(tabId: string, proposal: LocalAssistProposal): void {
    this.previousByTab.delete(tabId);
    this.byTab.set(tabId, proposal);
    this.emit();
  }

  /** Replace the generation owner, retaining only the last completed proposal. */
  beginGeneration(tabId: string, proposal: LocalAssistProposal): boolean {
    if (this.applyingByTab.has(tabId)) return false;
    const current = this.getLatest(tabId);
    // Duplicate delivery must not start a second native invocation.
    if (current?.requestId === proposal.requestId) return false;
    const previous = current?.streaming ? this.previousByTab.get(tabId) : current;
    if (previous && isSameProposalScope(previous, proposal)) this.previousByTab.set(tabId, previous);
    else this.previousByTab.delete(tabId);
    this.byTab.set(tabId, { ...proposal, streaming: true });
    this.emit();
    return true;
  }

  ownsGeneration(tabId: string, requestId: string): boolean {
    const current = this.getLatest(tabId);
    return !!current?.streaming && current.requestId === requestId;
  }

  completeGeneration(tabId: string, proposal: LocalAssistProposal): boolean {
    if (!this.ownsGeneration(tabId, proposal.requestId)) return false;
    this.record(tabId, { ...proposal, streaming: false });
    return true;
  }

  /** An obsolete request may neither clear a newer one nor restore its old draft. */
  settleGeneration(tabId: string, requestId: string, restorePrevious: boolean,
    isValid: (proposal: LocalAssistProposal) => boolean = () => true): boolean {
    if (!this.ownsGeneration(tabId, requestId)) return false;
    const previous = this.previousByTab.get(tabId);
    if (restorePrevious && previous && isValid(previous)) this.record(tabId, previous);
    else this.clear(tabId);
    return true;
  }

  claimApply(tabId: string, proposal: LocalAssistProposal): boolean {
    if (this.getLatest(tabId) !== proposal || proposal.streaming || this.applyingByTab.has(tabId)) return false;
    this.applyingByTab.set(tabId, proposal);
    return true;
  }

  finishApply(tabId: string, proposal: LocalAssistProposal, applied: boolean): void {
    if (this.applyingByTab.get(tabId) !== proposal) return;
    this.applyingByTab.delete(tabId);
    if (applied && this.getLatest(tabId) === proposal) this.clear(tabId);
  }

  clear(tabId: string): void {
    this.applyingByTab.delete(tabId);
    this.previousByTab.delete(tabId);
    if (this.byTab.delete(tabId)) this.emit();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private emit(): void {
    // Subscribers are observers, not part of the proposal transaction. One
    // failing view must not turn a completed write into an apparent failure.
    for (const listener of this.listeners) {
      try { listener(); }
      catch (error) { console.warn("Local Assist proposal listener failed", error); }
    }
  }
}

function isSameProposalScope(left: LocalAssistProposal, right: LocalAssistProposal): boolean {
  return left.conversationId === right.conversationId && left.originalText === right.originalText &&
    left.target.activeDocumentPath === right.target.activeDocumentPath &&
    left.target.activeDocumentSessionId === right.target.activeDocumentSessionId &&
    left.target.start === right.target.start && left.target.end === right.target.end &&
    left.target.text === right.target.text;
}

export const localAssistProposalStore = new LocalAssistProposalStore();
