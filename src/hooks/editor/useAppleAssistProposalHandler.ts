import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { emitTo, listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  APPLE_ASSIST_MAX_CONTEXT_CHARS,
  APPLE_ASSIST_MAX_SELECTED_CHARS,
  generateAppleAssistCandidateStreaming,
} from "../../lib/tauri/appleAssist";
import {
  APPLE_ASSIST_PROPOSAL_STATUS_EVENT,
  REQUEST_AI_EDIT_PROPOSAL_EVENT,
  type AppleAssistApplyEvent,
  type AppleAssistGenerationLock,
  type AppleAssistProposalStatusEvent,
} from "../../types";
import { getLocalAssistAction } from "../../lib/appleAssist/instruction";
import {
  buildAppleAssistRevisionContext,
  normalizeRevisionHistory,
  takeAppleAssistChars,
} from "../../lib/appleAssist/revisionContext";
import {
  buildSurroundingDocumentContext,
  getAppleAssistContextWindow,
  isSameAppleAssistTargetTab,
  readTargetTextForGeneration,
  resolveApplyActionId,
  sanitizeAppleAssistCandidateText,
  yieldBeforeAppleAssistGeneration,
  type ActiveTab,
} from "./useAppleAssistApplyHandler";
import { localAssistProposalStore } from "../../features/editor/localAssistProposal";

// Preserve the public imports used by existing callers/tests after extraction.
export {
  APPLE_ASSIST_MAX_CONVERSATION_TURNS,
  APPLE_ASSIST_MAX_CONVERSATION_TURN_CHARS,
  buildAppleAssistRevisionContext,
} from "../../lib/appleAssist/revisionContext";

type UseAppleAssistProposalHandlerOptions = {
  activeTab: ActiveTab | null;
  setStatus?: (message: string) => void;
  setGenerationLock?: Dispatch<SetStateAction<AppleAssistGenerationLock | null>>;
};
type GenerationJob = {
  owner: symbol; sessionId: string; requestId: string;
  tab: ActiveTab; payload: AppleAssistApplyEvent;
};

function validateProposalText(proposalText: unknown):
  { ok: true; text: string } | { ok: false; error: string } {
  if (proposalText === undefined) return { ok: true, text: "" };
  if (typeof proposalText !== "string" || !proposalText.trim()) {
    return { ok: false, error: "Hazakura Local Assist current proposal is empty." };
  }
  if (Array.from(takeAppleAssistChars(proposalText, APPLE_ASSIST_MAX_SELECTED_CHARS + 1)).length > APPLE_ASSIST_MAX_SELECTED_CHARS) {
    return { ok: false, error: `Hazakura Local Assist current proposal exceeds the maximum length of ${APPLE_ASSIST_MAX_SELECTED_CHARS} characters.` };
  }
  return { ok: true, text: proposalText };
}

/** Generation only. No buffer setter or transaction-apply capability. */
export function useAppleAssistProposalHandler({ activeTab, setStatus, setGenerationLock }: UseAppleAssistProposalHandlerOptions): void {
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const setStatusRef = useRef(setStatus);
  setStatusRef.current = setStatus;
  const setGenerationLockRef = useRef(setGenerationLock);
  setGenerationLockRef.current = setGenerationLock;
  const ownerRef = useRef<symbol | null>(null);
  const jobsRef = useRef(new Set<GenerationJob>());

  useEffect(() => {
    const owner = Symbol("local-assist-handler");
    ownerRef.current = owner;
    let unlisten: UnlistenFn | null = null;
    void listen<AppleAssistApplyEvent>(REQUEST_AI_EDIT_PROPOSAL_EVENT, (event) => {
      if (ownerRef.current === owner) void generateAppleAssistProposal(event.payload, owner);
    }).then((handle) => {
      if (ownerRef.current !== owner) { void handle(); return; }
      unlisten = handle;
    }).catch((err) => console.warn("Failed to listen for Local Assist proposal event", err));
    return () => {
      if (ownerRef.current === owner) ownerRef.current = null;
      if (unlisten) void unlisten();
      for (const job of jobsRef.current) {
        if (job.owner !== owner) continue;
        localAssistProposalStore.settleGeneration(job.sessionId, job.requestId, false);
        setGenerationLockRef.current?.((current) => current?.requestId === job.requestId ? null : current);
        jobsRef.current.delete(job);
      }
    };
  }, []);

  // Invalidate on a real document switch/edit, not only when native output
  // finishes. Switching away and back cannot revive an earlier generation.
  useEffect(() => {
    for (const job of jobsRef.current) {
      if (job.owner !== ownerRef.current || !localAssistProposalStore.ownsGeneration(job.sessionId, job.requestId)) continue;
      if (activeTab && isSameAppleAssistTargetTab(job.tab, activeTab) && job.tab.contents === activeTab.contents) continue;
      localAssistProposalStore.settleGeneration(job.sessionId, job.requestId, false);
      setGenerationLockRef.current?.((current) => current?.requestId === job.requestId ? null : current);
      void emitAppleAssistProposalStatus("failed",
        "Hazakura Local Assist proposal discarded: the active document changed during generation.", job.payload);
    }
  }, [activeTab?.id, activeTab?.path, activeTab?.sessionId, activeTab?.contents]);

  async function generateAppleAssistProposal(payload: AppleAssistApplyEvent, owner: symbol): Promise<void> {
    const tab = activeTabRef.current;
    const reject = async (message: string) => {
      if (ownerRef.current !== owner) return;
      setStatusRef.current?.(message);
      await emitAppleAssistProposalStatus("failed", message, payload);
    };
    if (!tab) {
      await reject("Hazakura Local Assist proposal ignored: no active tab.");
      return;
    }
    const targetCheck = readTargetTextForGeneration(payload.target, tab);
    if (!targetCheck.ok) {
      await reject(`Hazakura Local Assist proposal failed: ${targetCheck.error}`);
      return;
    }
    const proposalCheck = validateProposalText(payload.proposalText);
    const originalCheck = validateProposalText(targetCheck.before);
    if (!proposalCheck.ok || !originalCheck.ok) {
      await reject(!proposalCheck.ok ? proposalCheck.error : !originalCheck.ok ? originalCheck.error : "Invalid target.");
      return;
    }
    if (payload.conversationOriginalText !== undefined && payload.conversationOriginalText !== targetCheck.before) {
      await reject("Hazakura Local Assist proposal failed: the pinned original no longer matches the active document.");
      return;
    }

    const target = targetCheck.target;
    const actionId = resolveApplyActionId(payload);
    const proposalBase = {
      requestId: payload.requestId, request: payload.request, actionId,
      originalText: targetCheck.before, candidateText: "", target,
      conversationId: payload.conversationId ?? null,
      turnIndex: payload.conversationTurnIndex ?? 0,
    };
    if (!localAssistProposalStore.beginGeneration(tab.sessionId, proposalBase)) return;
    const job = { owner, sessionId: tab.sessionId, requestId: payload.requestId, tab, payload };
    jobsRef.current.add(job);
    const ownsRequest = () => ownerRef.current === owner &&
      localAssistProposalStore.ownsGeneration(tab.sessionId, payload.requestId);
    const targetIsCurrent = () => {
      const latest = activeTabRef.current;
      return !!latest && isSameAppleAssistTargetTab(tab, latest) &&
        latest.contents === tab.contents && readTargetTextForGeneration(target, latest).ok;
    };

    try {
      const action = getLocalAssistAction(actionId);
      const startMessage = "Hazakura Local Assist is generating an unapplied proposal...";
      setStatusRef.current?.(startMessage);
      setGenerationLockRef.current?.({ requestId: payload.requestId, tabId: tab.id, tabPath: tab.path, request: payload.request });
      await emitAppleAssistProposalStatus("started", startMessage, payload, { target, originalText: targetCheck.before });
      await yieldBeforeAppleAssistGeneration();
      if (!ownsRequest()) return;
      if (!targetIsCurrent()) throw new Error("Hazakura Local Assist target changed before generation.");

      const contextWindow = getAppleAssistContextWindow(target.kind);
      // The target is already selectedText (and, on refinement, the pinned
      // original). Include only adjacent source, not a duplicate target.
      const before = buildSurroundingDocumentContext(tab.contents, target.start, target.start,
        contextWindow.preChars, 0, APPLE_ASSIST_MAX_CONTEXT_CHARS);
      const after = buildSurroundingDocumentContext(tab.contents, target.end, target.end,
        0, contextWindow.postChars, APPLE_ASSIST_MAX_CONTEXT_CHARS);
      const surroundingContext = `対象より前:\n${before}\n対象より後:\n${after}`;
      const response = await generateAppleAssistCandidateStreaming({
        operation: action.operation,
        actionId,
        selectedText: payload.proposalText === undefined ? targetCheck.before : proposalCheck.text,
        documentContext: buildAppleAssistRevisionContext(targetCheck.before, surroundingContext,
          normalizeRevisionHistory(payload.revisionHistory), payload.proposalText !== undefined),
        additionalRequest: payload.additionalRequest,
      }, payload.requestId, payload.request);

      // Every asynchronous continuation must still own the streaming slot.
      if (!ownsRequest()) return;
      if (!targetIsCurrent()) {
        localAssistProposalStore.settleGeneration(tab.sessionId, payload.requestId, false);
        await reject("Hazakura Local Assist proposal discarded: the active document changed during generation.");
        return;
      }
      if (typeof response?.candidateText !== "string") throw new Error("Hazakura Local Assist returned a malformed proposal.");
      // A malformed/unbounded helper response must not allocate a huge diff.
      // Reject rather than silently truncate the text the writer would review.
      if (response.candidateText.length > 64_000) throw new Error("Hazakura Local Assist returned an oversized proposal. Please use a smaller target.");
      if (/HAZAKURA_(?:CONTEXT|ORIGINAL)_(?:START|END)/u.test(response.candidateText)) {
        throw new Error("Hazakura Local Assist returned reference metadata instead of a proposal. Please try again.");
      }
      const candidateText = sanitizeAppleAssistCandidateText(response.candidateText);
      if (!candidateText.trim()) throw new Error("Hazakura Local Assist returned an empty proposal.");
      // Apply must never perform a second, different cleanup after review.
      if (sanitizeAppleAssistCandidateText(candidateText) !== candidateText) {
        throw new Error("Hazakura Local Assist returned ambiguous proposal formatting. Please try again.");
      }
      if (!localAssistProposalStore.completeGeneration(tab.sessionId, { ...proposalBase, candidateText })) return;
      const message = "Hazakura Local Assist created an unapplied proposal for Diff review.";
      setStatusRef.current?.(message);
      await emitAppleAssistProposalStatus("completed", message, payload, { target, originalText: targetCheck.before, candidateText });
    } catch (err) {
      if (!ownsRequest()) return;
      // A failed refinement can restore only an intact prior target; never a
      // streaming placeholder, a stale draft, or another request's proposal.
      localAssistProposalStore.settleGeneration(tab.sessionId, payload.requestId, targetIsCurrent(),
        (previous) => {
          const latest = activeTabRef.current;
          return !!latest && readTargetTextForGeneration(previous.target, latest).ok &&
            previous.originalText === previous.target.text;
        });
      const message = err instanceof Error ? err.message : String(err);
      const cancelled = /cancelled by user|canceled by user/iu.test(message) ||
        (err instanceof Error && err.name === "AbortError");
      const statusMessage = cancelled ? message : `Hazakura Local Assist proposal generation failed: ${message}`;
      setStatusRef.current?.(statusMessage);
      await emitAppleAssistProposalStatus(cancelled ? "cancelled" : "failed", statusMessage, payload,
        { target, originalText: targetCheck.before });
    } finally {
      jobsRef.current.delete(job);
      if (ownerRef.current === owner) {
        setGenerationLockRef.current?.((current) => current?.requestId === payload.requestId ? null : current);
      }
    }
  }
}

async function emitAppleAssistProposalStatus(
  phase: AppleAssistProposalStatusEvent["phase"], message: string, payload: AppleAssistApplyEvent,
  options: Partial<Pick<AppleAssistProposalStatusEvent, "target" | "originalText" | "candidateText">> = {},
): Promise<void> {
  try {
    await emitTo("apple-assist", APPLE_ASSIST_PROPOSAL_STATUS_EVENT, {
      phase, message, requestId: payload.requestId, request: payload.request,
      actionId: payload.actionId, conversationId: payload.conversationId,
      conversationTurnIndex: payload.conversationTurnIndex, ...options, emittedAtMs: Date.now(),
    } satisfies AppleAssistProposalStatusEvent);
  } catch (err) { console.warn("Failed to emit Hazakura Local Assist proposal status", err); }
}
