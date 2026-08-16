import { useEffect, useState } from "react";
import {
  localAssistProposalStore,
  type LocalAssistProposal,
} from "../../features/editor/localAssistProposal";

// v2.6 B2: thin re-rendering wrapper over the module-level
// `localAssistProposalStore`, mirroring `useAiEditTransaction`. The main
// window's proposal review panel reads the active tab's latest unapplied
// proposal and clears it after the user applies or discards it.

export function useLocalAssistProposal(
  tabId: string | null,
): {
  proposal: LocalAssistProposal | null;
  clearProposal: () => void;
} {
  const [proposal, setProposal] = useState<LocalAssistProposal | null>(
    tabId ? localAssistProposalStore.getLatest(tabId) : null,
  );

  useEffect(() => {
    if (!tabId) {
      setProposal(null);
      return;
    }
    setProposal(localAssistProposalStore.getLatest(tabId));
    const unsubscribe = localAssistProposalStore.subscribe(() => {
      setProposal(localAssistProposalStore.getLatest(tabId));
    });
    return unsubscribe;
  }, [tabId]);

  const clearProposal = () => {
    if (tabId) {
      localAssistProposalStore.clear(tabId);
    }
  };

  return { proposal, clearProposal };
}
