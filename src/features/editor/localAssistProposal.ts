import type { AppleAssistTargetSnapshot } from "../../types";
import type { LocalAssistActionId } from "../../lib/appleAssist/instruction";

// v2.6 B2: unapplied Local Assist proposal, owned by the main window.
//
// The proposal is the review surface that exists *before* the user decides to
// apply the change. It is deliberately a separate state machine from
// `AiEditTransaction`: a proposal is generated and streamed into this store
// without touching the editor buffer, while an `AiEditTransaction` is recorded
// only after the explicit "文書へ反映" action and is what the existing Review
// Bar surfaces for undo/discard. Mixing the two would make a merely generated
// candidate look like an already-applied edit.
//
// The store is session-local and in-memory (mirroring
// `aiEditTransactionStore`): closing the app drops it. It is keyed by the
// pinned tab session so a stale proposal never leaks into a different
// reopened document, and the main window's review panel reads only the active
// tab's latest proposal.

export type LocalAssistProposal = {
  requestId: string;
  request: string;
  actionId: LocalAssistActionId;
  originalText: string;
  candidateText: string;
  target: AppleAssistTargetSnapshot;
  conversationId: string | null;
  turnIndex: number;
  /** True while partial output is still streaming; the diff is finalized after. */
  streaming?: boolean;
};

type Listener = () => void;

class LocalAssistProposalStore {
  private byTab = new Map<string, LocalAssistProposal>();
  private listeners = new Set<Listener>();

  getLatest(tabId: string): LocalAssistProposal | null {
    return this.byTab.get(tabId) ?? null;
  }

  record(tabId: string, proposal: LocalAssistProposal): void {
    this.byTab.set(tabId, proposal);
    this.emit();
  }

  clear(tabId: string): void {
    if (this.byTab.delete(tabId)) {
      this.emit();
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const localAssistProposalStore = new LocalAssistProposalStore();
