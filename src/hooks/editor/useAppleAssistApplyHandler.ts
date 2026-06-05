import { useEffect, useRef } from "react";
import { emitTo, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { buildLineDiff } from "../../features/diff/diff";
import {
  aiEditTransactionStore,
  applyAiEditTransaction,
  type AiEditTransaction,
} from "../../features/editor/aiEditTransactions";
import {
  APPLE_ASSIST_MAX_CONTEXT_CHARS,
  generateAppleAssistCandidate,
  type AppleAssistOperation,
} from "../../lib/tauri/appleAssist";
import {
  APPLY_AI_EDIT_TRANSACTION_EVENT,
  APPLE_ASSIST_APPLY_STATUS_EVENT,
  type AppleAssistApplyEvent,
  type AppleAssistApplyStatusEvent,
  type AppleAssistTargetSnapshot,
  type CompareViewState,
} from "../../types";

// v0.12+ Apple Local Assist Writing Companion (slice 4).
// `useAppleAssistApplyHandler` is the main window's
// listener for the `APPLY_AI_EDIT_TRANSACTION_EVENT` that
// the detached Apple Assist window fires on Apply. The
// hook requests a bounded Apple Assist candidate, rewrites the active
// tab's unsaved buffer in place, marks the tab dirty, and
// records an `AiEditTransaction` in the session-local
// store so the escape hatch (slice 5) can render a
// "review / discard" affordance.
//
// The hook is intentionally side-effect-only: it does
// not own any state, and the only way it talks back to the
// user is via the store and (optionally) a status message
// passed through `setStatus`. Errors are surfaced through
// the store's `clear` path so the next render does not
// surface a stale pending review.

type ActiveTab = {
  id: string;
  name: string;
  path: string;
  contents: string;
};

type UseAppleAssistApplyHandlerOptions = {
  // The currently active tab in the main window, or `null`
  // when no tab is open. The handler early-outs when this
  // is null (the Apple Assist window would not be sending
  // an apply with no active tab on the main side).
  activeTab: ActiveTab | null;
  // Replaces the active tab's contents with the new
  // buffer. The orchestrator owns the tab state; this
  // callback is the only path through which the handler
  // mutates the buffer.
  setActiveTabContents: (next: string) => void;
  // Optional status surface for the main window. Called
  // on apply success / failure with a localized message
  // the orchestrator can pass through to its `setStatus`.
  setStatus?: (message: string) => void;
};

export function useAppleAssistApplyHandler({
  activeTab,
  setActiveTabContents,
  setStatus,
}: UseAppleAssistApplyHandlerOptions): void {
  // Refs let the listener read the latest active tab /
  // status setter without re-subscribing on every change.
  const activeTabRef = useRef<ActiveTab | null>(activeTab);
  activeTabRef.current = activeTab;
  const setActiveTabContentsRef = useRef(setActiveTabContents);
  setActiveTabContentsRef.current = setActiveTabContents;
  const setStatusRef = useRef(setStatus);
  setStatusRef.current = setStatus;

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    let disposed = false;

    void listen<AppleAssistApplyEvent>(APPLY_AI_EDIT_TRANSACTION_EVENT, (event) => {
      if (disposed) return;
      void applyAppleAssistRequest(event.payload);
    })
      .then((handle) => {
        if (disposed) {
          void handle();
          return;
        }
        unlisten = handle;
      })
      .catch((err) => {
        console.warn("Failed to listen for apply event", err);
      });

    return () => {
      disposed = true;
      if (unlisten) {
        void unlisten();
        unlisten = null;
      }
    };
  }, []);

  async function applyAppleAssistRequest(payload: AppleAssistApplyEvent): Promise<void> {
    const tab = activeTabRef.current;
    if (!tab) {
      const message = "Apple Local Assist apply ignored: no active tab.";
      setStatusRef.current?.(message);
      void emitAppleAssistApplyStatus("failed", message, payload.request);
      return;
    }

    const targetCheck = readTargetTextForGeneration(payload.target, tab);
    if (!targetCheck.ok) {
      const message = `Apple Local Assist apply failed: ${targetCheck.error}`;
      setStatusRef.current?.(message);
      void emitAppleAssistApplyStatus("failed", message, payload.request);
      return;
    }

    try {
      const startMessage = "Apple Local Assist is generating a change...";
      setStatusRef.current?.(startMessage);
      void emitAppleAssistApplyStatus("started", startMessage, payload.request);
      const response = await generateAppleAssistCandidate({
        operation: inferAppleAssistOperation(payload.request),
        selectedText: targetCheck.before,
        documentContext: tab.contents.slice(0, APPLE_ASSIST_MAX_CONTEXT_CHARS),
        instruction: payload.request,
      });

      const latestTab = activeTabRef.current;
      if (!latestTab) {
        const message = "Apple Local Assist apply ignored: no active tab.";
        setStatusRef.current?.(message);
        void emitAppleAssistApplyStatus("failed", message, payload.request);
        return;
      }
      const result = applyAiEditTransaction({
        tabId: latestTab.id,
        tabName: latestTab.name,
        tabPath: latestTab.path,
        request: payload.request,
        target: payload.target,
        buffer: latestTab.contents,
        afterText: response.candidateText,
      });
      if (!result.ok) {
        const message = `Apple Local Assist apply failed: ${result.error}`;
        setStatusRef.current?.(message);
        void emitAppleAssistApplyStatus("failed", message, payload.request);
        return;
      }

      // Precompute the line diff so the escape hatch can
      // render the comparison without recomputing it on
      // every render. `buildLineDiff` is the same helper
      // the manual candidate Review Desk uses. The diff
      // is keyed on the transaction's `id` so the case
      // lookup (`getCompareCaseByKey`) treats it as a
      // standalone case rather than colliding with any
      // existing compare slot.
      const lineDiff = buildLineDiff(
        result.transaction.before,
        result.transaction.after,
      );
      const diff: CompareViewState = {
        caseKey: result.transaction.id,
        ...lineDiff,
      };

      const stored: AiEditTransaction = {
        ...result.transaction,
        diff,
      };
      aiEditTransactionStore.record(stored);
      setActiveTabContentsRef.current(result.nextBuffer);
      const successMessage = `Apple Local Assist applied: ${result.transaction.request} (${result.transaction.target.kind})`;
      setStatusRef.current?.(successMessage);
      void emitAppleAssistApplyStatus("completed", successMessage, payload.request);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const errorMessage = `Apple Local Assist generation failed: ${message}`;
      setStatusRef.current?.(errorMessage);
      void emitAppleAssistApplyStatus("failed", errorMessage, payload.request);
    }
  }
}

async function emitAppleAssistApplyStatus(
  phase: AppleAssistApplyStatusEvent["phase"],
  message: string,
  request: string,
): Promise<void> {
  try {
    await emitTo("apple-assist", APPLE_ASSIST_APPLY_STATUS_EVENT, {
      phase,
      message,
      request,
      emittedAtMs: Date.now(),
    } satisfies AppleAssistApplyStatusEvent);
  } catch (err) {
    console.warn("Failed to emit Apple Local Assist apply status", err);
  }
}

function inferAppleAssistOperation(request: string): AppleAssistOperation {
  const lower = request.toLowerCase();
  if (request.includes("校正") || lower.includes("proof")) {
    return "proofread";
  }
  if (request.includes("要約") || lower.includes("summar")) {
    return "summarize";
  }
  return "rephrase";
}

function readTargetTextForGeneration(
  target: AppleAssistTargetSnapshot | null,
  tab: ActiveTab,
): { ok: true; before: string } | { ok: false; error: string } {
  if (!target) {
    return {
      ok: false,
      error: "No Apple Local Assist target snapshot was supplied with the request.",
    };
  }
  if (target.start < 0 || target.end < target.start) {
    return { ok: false, error: "Apple Local Assist target range is invalid." };
  }
  if (target.end > tab.contents.length) {
    return {
      ok: false,
      error: "Apple Local Assist target range is out of bounds for the active buffer.",
    };
  }
  if (target.activeDocumentPath !== tab.path) {
    return { ok: false, error: "Apple Local Assist target is stale for the active document." };
  }
  const before = tab.contents.slice(target.start, target.end);
  if (before !== target.text) {
    return {
      ok: false,
      error: "Apple Local Assist target text no longer matches the active buffer.",
    };
  }
  return { ok: true, before };
}
