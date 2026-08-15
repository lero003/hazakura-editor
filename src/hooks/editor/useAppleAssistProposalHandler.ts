import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { emitTo, listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  APPLE_ASSIST_MAX_CONTEXT_CHARS,
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

type UseAppleAssistProposalHandlerOptions = {
  activeTab: ActiveTab | null;
  setStatus?: (message: string) => void;
  setGenerationLock?: Dispatch<SetStateAction<AppleAssistGenerationLock | null>>;
};

// v2.6 A-1: generation-only Local Assist path. This handler deliberately
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

    try {
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

      const target = targetCheck.target;
      const contextWindow = getAppleAssistContextWindow(target.kind);
      const actionId: LocalAssistActionId = resolveApplyActionId(payload);
      const action = getLocalAssistAction(actionId);
      const response = await generateAppleAssistCandidateStreaming(
        {
          operation: action.operation,
          actionId,
          selectedText: targetCheck.before,
          documentContext: buildSurroundingDocumentContext(
            tab.contents,
            target.start,
            target.end,
            contextWindow.preChars,
            contextWindow.postChars,
            APPLE_ASSIST_MAX_CONTEXT_CHARS,
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

      const candidateText = sanitizeAppleAssistCandidateText(response.candidateText);
      if (candidateText.trim().length === 0) {
        throw new Error("Hazakura Local Assist returned an empty proposal.");
      }
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
      ...options,
      emittedAtMs: Date.now(),
    } satisfies AppleAssistProposalStatusEvent);
  } catch (err) {
    console.warn("Failed to emit Hazakura Local Assist proposal status", err);
  }
}
