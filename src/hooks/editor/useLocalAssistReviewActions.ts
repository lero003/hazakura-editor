import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import type { EditorTab } from "../../types";
import { aiEditTransactionStore } from "../../features/editor/aiEditTransactions";
import {
  localAssistProposalStore,
  type LocalAssistProposal,
} from "../../features/editor/localAssistProposal";
import { replaceTabsBufferBySessionId } from "../../features/editor/editorTabs";
import {
  applyReviewedLocalAssistProposal,
  emitLocalAssistApplyStatus,
  type ApplyReviewedProposalResult,
} from "./useAppleAssistApplyHandler";

type Options = {
  activeTab: EditorTab | null;
  rejectIfAppleAssistLocksTab: (tab: Pick<EditorTab, "id" | "path"> | null | undefined) => boolean;
  setActiveTabId: Dispatch<SetStateAction<string | null>>;
  setStatus: (message: string) => void;
  setTabs: Dispatch<SetStateAction<EditorTab[]>>;
  tabs: EditorTab[];
};

export function useLocalAssistReviewActions({
  activeTab,
  rejectIfAppleAssistLocksTab,
  setActiveTabId,
  setStatus,
  setTabs,
  tabs,
}: Options) {
  const [pendingAssistDiscard, setPendingAssistDiscard] = useState<{
    sessionId: string;
    beforeBuffer: string;
  } | null>(null);
  // Apply only the explicitly reviewed proposal through the single buffer
  // writer, which revalidates its target and consumes it without saving.
  const applyLocalAssistProposal = useCallback(
    async (proposal: LocalAssistProposal): Promise<ApplyReviewedProposalResult> => {
      if (!activeTab) {
        return { ok: false, error: "Hazakura Local Assist apply failed: no active tab." };
      }
      // v2.6 B2.1: never apply/discard while a generation is in flight for
      // this tab, otherwise a stale candidate could land mid-generation.
      if (rejectIfAppleAssistLocksTab(activeTab)) {
        return {
          ok: false,
          error: "Hazakura Local Assist apply rejected: a generation is in progress for this document.",
        };
      }
      const result = await applyReviewedLocalAssistProposal({
        proposal,
        activeTab: {
          id: activeTab.id,
          sessionId: activeTab.sessionId,
          name: activeTab.name,
          path: activeTab.path,
          contents: activeTab.contents,
        },
        setActiveTabContents: (next: string, sessionId: string) => {
          setTabs((currentTabs) =>
            replaceTabsBufferBySessionId(currentTabs, sessionId, next),
          );
        },
        setStatus,
      });
      if (result.ok) {
        localAssistProposalStore.clear(activeTab.sessionId);
        await emitLocalAssistApplyStatus(
          "completed",
          "Hazakura Local Assist applied the reviewed proposal.",
          proposal.requestId,
          proposal.request,
          proposal.conversationId,
          { shouldApplyToDocument: true, documentSessionId: proposal.target.activeDocumentSessionId },
        );
      } else {
        // v2.6 B2.1: surface the stale/no-op rejection instead of leaving the
        // user with a silently-unchanged Diff.
        setStatus(result.error);
        await emitLocalAssistApplyStatus(
          "failed",
          result.error,
          proposal.requestId,
          proposal.request,
          proposal.conversationId,
          { documentSessionId: proposal.target.activeDocumentSessionId },
        );
      }
      return result;
    },
    [activeTab, rejectIfAppleAssistLocksTab, setStatus, setTabs],
  );

  const discardLocalAssistProposal = useCallback(
    async (proposal: LocalAssistProposal) => {
      if (!activeTab) {
        return;
      }
      if (rejectIfAppleAssistLocksTab(activeTab)) {
        return;
      }
      localAssistProposalStore.clear(activeTab.sessionId);
      await emitLocalAssistApplyStatus(
        "discarded",
        "Hazakura Local Assist proposal discarded.",
        proposal.requestId,
        proposal.request,
        proposal.conversationId,
        { documentSessionId: proposal.target.activeDocumentSessionId },
      );
    },
    [activeTab, rejectIfAppleAssistLocksTab],
  );

  // When the user hand-edits the buffer after an assist apply
  // (current contents differ from the transaction's
  // `afterBuffer`), a blind revert to `beforeBuffer` would
  // destroy those edits. In that case we open a confirmation
  // dialog instead of reverting immediately; only a confirmed
  // discard reverts all the way back to `beforeBuffer`.
  const confirmDiscardAppleAssistEdit = useCallback(
    (sessionId: string, beforeBuffer: string) => {
      setTabs((currentTabs) =>
        replaceTabsBufferBySessionId(currentTabs, sessionId, beforeBuffer),
      );
      const targetTab = tabs.find((tab) => tab.sessionId === sessionId);
      if (targetTab) {
        setActiveTabId(targetTab.id);
      }
      aiEditTransactionStore.clear(sessionId);
      setStatus("Hazakura Local Assist edit discarded");
    },
    [setActiveTabId, setStatus, setTabs, tabs],
  );

  const discardAppleAssistEdit = useCallback(
    (sessionId: string, beforeBuffer: string, afterBuffer: string) => {
      const targetTab = tabs.find((tab) => tab.sessionId === sessionId);
      if (!targetTab) {
        setStatus("Hazakura Local Assist discard failed");
        return;
      }
      // No hand-edits since the assist was applied: safe to revert now.
      if (targetTab.contents === afterBuffer) {
        confirmDiscardAppleAssistEdit(sessionId, beforeBuffer);
        return;
      }
      // The buffer changed after the apply. Confirm before discarding so
      // the user does not silently lose hand-edits along with the assist.
      setPendingAssistDiscard({ sessionId, beforeBuffer });
    },
    [confirmDiscardAppleAssistEdit, setStatus, tabs],
  );

  const cancelDiscardAppleAssistEdit = useCallback(() => {
    setPendingAssistDiscard(null);
  }, []);

  const confirmPendingAssistDiscard = useCallback(() => {
    if (!pendingAssistDiscard) return;
    confirmDiscardAppleAssistEdit(
      pendingAssistDiscard.sessionId,
      pendingAssistDiscard.beforeBuffer,
    );
    setPendingAssistDiscard(null);
  }, [confirmDiscardAppleAssistEdit, pendingAssistDiscard]);

  return {
    applyLocalAssistProposal,
    discardLocalAssistProposal,
    pendingAssistDiscard,
    discardAppleAssistEdit,
    cancelDiscardAppleAssistEdit,
    confirmPendingAssistDiscard,
  };
}
