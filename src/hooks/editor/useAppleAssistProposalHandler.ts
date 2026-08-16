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
import {
  getLocalAssistAction,
  type LocalAssistActionId,
} from "../../lib/appleAssist/instruction";
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

type UseAppleAssistProposalHandlerOptions = {
  activeTab: ActiveTab | null;
  setStatus?: (message: string) => void;
  setGenerationLock?: Dispatch<SetStateAction<AppleAssistGenerationLock | null>>;
};

export const APPLE_ASSIST_MAX_CONVERSATION_TURNS = 4;
export const APPLE_ASSIST_MAX_CONVERSATION_TURN_CHARS = 500;

function takeAppleAssistChars(value: string, maxChars: number): string {
  return Array.from(value).slice(0, maxChars).join("");
}

/**
 * Build the bounded revision packet for A-2. The current proposal is passed
 * as selectedText; this packet keeps the pinned original (follow-up turns
 * only), recent user turns, and nearby document context available without
 * persisting a conversation.
 *
 * On the first request `selectedText` already IS the original, so pinning the
 * same text again under the reference context only duplicates the target and
 * wastes the bounded context window. A follow-up turn needs the pinned
 * original to anchor the revision against the current proposal.
 */
export function buildAppleAssistRevisionContext(
  originalText: string,
  surroundingContext: string,
  revisionHistory: ReadonlyArray<string> = [],
): string {
  const original = takeAppleAssistChars(originalText, APPLE_ASSIST_MAX_SELECTED_CHARS);
  const history = revisionHistory
    .slice(-APPLE_ASSIST_MAX_CONVERSATION_TURNS)
    .map((request) => `- ${takeAppleAssistChars(request, APPLE_ASSIST_MAX_CONVERSATION_TURN_CHARS)}`)
    .join("\n");

  const isFollowUp = history.length > 0;

  // The header is Japanese so the small on-device model reads the meta
  // framing in the same language as the task. On a follow-up turn it must be
  // told explicitly that the target text is the current proposal (not the
  // original) and that only the latest request should be applied.
  const header: string[] = [];
  if (isFollowUp) {
    header.push(
      "対象本文は現在の変更案です。ここまでの変更を保ったまま、最新の依頼だけを適用してください。",
      "固定した元文章（参考。書き換え対象ではありません）:",
      "<<<HAZAKURA_ORIGINAL_START",
      original,
      "HAZAKURA_ORIGINAL_END>>>",
      "これまでの依頼:",
      history,
    );
  }

  const contextLabel = "対象周辺の文脈（参考。書き換え対象ではありません）:\n";
  const availableContextChars = Math.max(
    0,
    APPLE_ASSIST_MAX_CONTEXT_CHARS -
      Array.from(header.join("\n")).length -
      Array.from(contextLabel).length,
  );
  const headerPart = header.filter((line) => line.length > 0).join("\n");
  const contextPart = `${contextLabel}${takeAppleAssistChars(
    surroundingContext,
    availableContextChars,
  )}`;
  return [headerPart, contextPart].filter((part) => part.length > 0).join("\n");
}

function normalizeRevisionHistory(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .slice(-APPLE_ASSIST_MAX_CONVERSATION_TURNS)
    .map((entry) => takeAppleAssistChars(entry, APPLE_ASSIST_MAX_CONVERSATION_TURN_CHARS));
}

function validateProposalText(
  proposalText: string | undefined,
): { ok: true; text: string } | { ok: false; error: string } {
  if (proposalText === undefined) {
    return { ok: true, text: "" };
  }
  if (proposalText.trim().length === 0) {
    return { ok: false, error: "Hazakura Local Assist current proposal is empty." };
  }
  if (Array.from(proposalText).length > APPLE_ASSIST_MAX_SELECTED_CHARS) {
    return {
      ok: false,
      error: `Hazakura Local Assist current proposal exceeds the maximum length of ${APPLE_ASSIST_MAX_SELECTED_CHARS} characters.`,
    };
  }
  return { ok: true, text: proposalText };
}

// v2.6 A-1/A-2: generation-only Local Assist path. This handler deliberately
// does not receive a buffer setter and never calls `applyAiEditTransaction`.
// It validates the target, streams the bounded candidate, and sends the
// unapplied proposal to the detached window's Diff review surface.
export function useAppleAssistProposalHandler({
  activeTab,
  setStatus,
  setGenerationLock,
}: UseAppleAssistProposalHandlerOptions): void {
  const activeTabRef = useRef<ActiveTab | null>(activeTab);
  activeTabRef.current = activeTab;
  const setStatusRef = useRef(setStatus);
  setStatusRef.current = setStatus;
  const setGenerationLockRef = useRef(setGenerationLock);
  setGenerationLockRef.current = setGenerationLock;

  useEffect(() => {
    let disposed = false;
    let unlisten: UnlistenFn | null = null;

    void listen<AppleAssistApplyEvent>(REQUEST_AI_EDIT_PROPOSAL_EVENT, (event) => {
      if (!disposed) {
        void generateAppleAssistProposal(event.payload);
      }
    })
      .then((handle) => {
        if (disposed) {
          void handle();
          return;
        }
        unlisten = handle;
      })
      .catch((err) => {
        console.warn("Failed to listen for Local Assist proposal event", err);
      });

    return () => {
      disposed = true;
      if (unlisten) {
        void unlisten();
        unlisten = null;
      }
    };
  }, []);

  async function generateAppleAssistProposal(
    payload: AppleAssistApplyEvent,
  ): Promise<void> {
    const tab = activeTabRef.current;
    if (!tab) {
      const message = "Hazakura Local Assist proposal ignored: no active tab.";
      setStatusRef.current?.(message);
      await emitAppleAssistProposalStatus("failed", message, payload);
      return;
    }

    const targetCheck = readTargetTextForGeneration(payload.target, tab);
    if (!targetCheck.ok) {
      const message = `Hazakura Local Assist proposal failed: ${targetCheck.error}`;
      setStatusRef.current?.(message);
      await emitAppleAssistProposalStatus("failed", message, payload);
      return;
    }

    const proposalCheck = validateProposalText(payload.proposalText);
    if (!proposalCheck.ok) {
      setStatusRef.current?.(proposalCheck.error);
      await emitAppleAssistProposalStatus("failed", proposalCheck.error, payload, {
        target: targetCheck.target,
        originalText: targetCheck.before,
      });
      return;
    }
    if (
      payload.conversationOriginalText !== undefined &&
      payload.conversationOriginalText !== targetCheck.before
    ) {
      const message =
        "Hazakura Local Assist proposal failed: the pinned original no longer matches the active document.";
      setStatusRef.current?.(message);
      await emitAppleAssistProposalStatus("failed", message, payload, {
        target: targetCheck.target,
        originalText: targetCheck.before,
      });
      return;
    }

    try {
      const target = targetCheck.target;
      const actionId: LocalAssistActionId = resolveApplyActionId(payload);
      const action = getLocalAssistAction(actionId);

      // v2.6 B2.1: mark the pending proposal as streaming as soon as
      // generation starts. This hides the main window's review panel and its
      // Apply/Discard controls for the previous proposal during a follow-up
      // turn, so a stale candidate cannot be applied mid-generation.
      localAssistProposalStore.record(tab.sessionId, {
        requestId: payload.requestId,
        request: payload.request,
        actionId,
        originalText: targetCheck.before,
        candidateText: "",
        target,
        conversationId: payload.conversationId ?? null,
        turnIndex: payload.conversationTurnIndex ?? 0,
        streaming: true,
      });

      const startMessage = "Hazakura Local Assist is generating an unapplied proposal...";
      setStatusRef.current?.(startMessage);
      setGenerationLockRef.current?.({
        requestId: payload.requestId,
        tabId: tab.id,
        tabPath: tab.path,
        request: payload.request,
      });
      await emitAppleAssistProposalStatus("started", startMessage, payload, {
        target: targetCheck.target,
        originalText: targetCheck.before,
      });
      await yieldBeforeAppleAssistGeneration();

      const contextWindow = getAppleAssistContextWindow(target.kind);
      const selectedText =
        payload.proposalText === undefined ? targetCheck.before : proposalCheck.text;
      const surroundingContext = buildSurroundingDocumentContext(
        tab.contents,
        target.start,
        target.end,
        contextWindow.preChars,
        contextWindow.postChars,
        APPLE_ASSIST_MAX_CONTEXT_CHARS,
      );
      const response = await generateAppleAssistCandidateStreaming(
        {
          operation: action.operation,
          actionId,
          selectedText,
          documentContext: buildAppleAssistRevisionContext(
            targetCheck.before,
            surroundingContext,
            normalizeRevisionHistory(payload.revisionHistory),
          ),
          additionalRequest: payload.additionalRequest,
        },
        payload.requestId,
        payload.request,
      );

      const latestTab = activeTabRef.current;
      if (!latestTab || !isSameAppleAssistTargetTab(tab, latestTab)) {
        const message =
          "Hazakura Local Assist proposal discarded: the active document changed during generation.";
        setStatusRef.current?.(message);
        await emitAppleAssistProposalStatus("failed", message, payload, {
          target,
          originalText: targetCheck.before,
        });
        return;
      }
      // Defense-in-depth: re-read the target text at completion time so a
      // stale candidate generated against an edited or rewritten buffer is
      // never stored as a fresh proposal.
      const completionTargetCheck = readTargetTextForGeneration(target, latestTab);
      if (!completionTargetCheck.ok) {
        const message = `Hazakura Local Assist proposal discarded: ${completionTargetCheck.error}`;
        setStatusRef.current?.(message);
        await emitAppleAssistProposalStatus("failed", message, payload, {
          target,
          originalText: targetCheck.before,
        });
        return;
      }

      const candidateText = sanitizeAppleAssistCandidateText(response.candidateText);
      if (candidateText.trim().length === 0) {
        throw new Error("Hazakura Local Assist returned an empty proposal.");
      }
      // v2.6 B2: the main window owns the unapplied proposal review. Record
      // the completed proposal in the session-local store so the main-window
      // review panel can render the large Diff and the explicit Apply/Discard
      // actions. The editor buffer is still untouched here.
      localAssistProposalStore.record(latestTab.sessionId, {
        requestId: payload.requestId,
        request: payload.request,
        actionId,
        originalText: targetCheck.before,
        candidateText,
        target,
        conversationId: payload.conversationId ?? null,
        turnIndex: payload.conversationTurnIndex ?? 0,
      });
      const successMessage =
        "Hazakura Local Assist created an unapplied proposal for Diff review.";
      setStatusRef.current?.(successMessage);
      await emitAppleAssistProposalStatus("completed", successMessage, payload, {
        target,
        originalText: targetCheck.before,
        candidateText,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("cancelled by user")) {
        setStatusRef.current?.(message);
        await emitAppleAssistProposalStatus("cancelled", message, payload, {
          target: targetCheck.target,
          originalText: targetCheck.before,
        });
      } else {
        const errorMessage = `Hazakura Local Assist proposal generation failed: ${message}`;
        setStatusRef.current?.(errorMessage);
        await emitAppleAssistProposalStatus("failed", errorMessage, payload, {
          target: targetCheck.target,
          originalText: targetCheck.before,
        });
      }
    } finally {
      setGenerationLockRef.current?.((current) =>
        current?.requestId === payload.requestId ? null : current,
      );
    }
  }
}

async function emitAppleAssistProposalStatus(
  phase: AppleAssistProposalStatusEvent["phase"],
  message: string,
  payload: AppleAssistApplyEvent,
  options: Partial<
    Pick<AppleAssistProposalStatusEvent, "target" | "originalText" | "candidateText">
  > = {},
): Promise<void> {
  try {
    await emitTo("apple-assist", APPLE_ASSIST_PROPOSAL_STATUS_EVENT, {
      phase,
      message,
      requestId: payload.requestId,
      request: payload.request,
      actionId: payload.actionId,
      conversationId: payload.conversationId,
      conversationTurnIndex: payload.conversationTurnIndex,
      ...options,
      emittedAtMs: Date.now(),
    } satisfies AppleAssistProposalStatusEvent);
  } catch (err) {
    console.warn("Failed to emit Hazakura Local Assist proposal status", err);
  }
}
