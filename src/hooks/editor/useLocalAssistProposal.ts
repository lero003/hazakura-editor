import { useCallback, useSyncExternalStore } from "react";
import {
  localAssistProposalStore,
  type LocalAssistProposal,
} from "../../features/editor/localAssistProposal";

const subscribe = (listener: () => void) => localAssistProposalStore.subscribe(listener);
const getServerSnapshot = () => null;

/** Read the active session synchronously: never render the previous tab's draft. */
export function useLocalAssistProposal(tabId: string | null): {
  proposal: LocalAssistProposal | null;
  clearProposal: () => void;
} {
  const getSnapshot = useCallback(
    () => tabId ? localAssistProposalStore.getLatest(tabId) : null,
    [tabId],
  );
  const proposal = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const clearProposal = useCallback(() => {
    if (tabId && localAssistProposalStore.getLatest(tabId) === proposal) {
      localAssistProposalStore.clear(tabId);
    }
  }, [tabId, proposal]);
  return { proposal, clearProposal };
}
