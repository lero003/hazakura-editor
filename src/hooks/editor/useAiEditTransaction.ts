import { useEffect, useState } from "react";
import {
  aiEditTransactionStore,
  type AiEditTransaction,
} from "../../features/editor/aiEditTransactions";

// v0.12+ Hazakura Local Assist Writing Companion (slice 4+).
// `useAiEditTransaction` is a thin re-rendering wrapper over
// the module-level `aiEditTransactionStore`. The store is
// session-local and singleton, so the hook just subscribes
// to its listener set and re-renders when the latest
// transaction for the given `tabId` changes.
//
// Returns the latest transaction (or `null` when no review
// is pending) plus a `clearLatest` callback for the
// escape hatch to drop the pending review after the user
// has applied or discarded it.

export function useAiEditTransaction(
  tabId: string | null,
): {
  latest: AiEditTransaction | null;
  clearLatest: () => void;
} {
  const [latest, setLatest] = useState<AiEditTransaction | null>(
    tabId ? aiEditTransactionStore.getLatest(tabId) : null,
  );

  useEffect(() => {
    if (!tabId) {
      setLatest(null);
      return;
    }
    setLatest(aiEditTransactionStore.getLatest(tabId));
    const unsubscribe = aiEditTransactionStore.subscribe(() => {
      setLatest(aiEditTransactionStore.getLatest(tabId));
    });
    return unsubscribe;
  }, [tabId]);

  const clearLatest = () => {
    if (tabId) {
      aiEditTransactionStore.clear(tabId);
    }
  };

  return { latest, clearLatest };
}
